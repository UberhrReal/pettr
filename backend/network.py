import os
import subprocess
import json
import socket
import ipaddress
from typing import Dict, Any, Optional

try:
    import httpx
except ImportError:
    httpx = None

TAILSCALE_SOCKET_PATH = os.environ.get("TAILSCALE_SOCKET_PATH", "/var/run/tailscale/tailscaled.sock")

def is_in_container() -> bool:
    """Detects if running inside Docker or another container runtime."""
    return (
        os.path.exists("/.dockerenv")
        or os.path.exists("/run/.containerenv")
        or os.environ.get("PETTR_IN_DOCKER") == "1"
    )

def is_tailscale_ip(ip: str) -> bool:
    """Checks whether an IPv4 address belongs to Tailscale's 100.64.0.0/10 CGNAT subnet."""
    if not ip:
        return False
    try:
        addr = ipaddress.ip_address(ip.strip())
        return addr in ipaddress.ip_network("100.64.0.0/10")
    except Exception:
        return False

def get_lan_ip() -> str:
    """Attempts to find the primary LAN IPv4 address."""
    env_ip = os.environ.get("LAN_IP") or os.environ.get("HOST_IP")
    if env_ip:
        return env_ip

    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        # Does not actually connect but determines routing interface
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except Exception:
        return "127.0.0.1"

def _query_tailscale_socket() -> Optional[Dict[str, Any]]:
    """
    Directly queries Tailscale LocalAPI via mounted Unix domain socket.
    Works inside Docker containers when /var/run/tailscale/tailscaled.sock is mounted.
    """
    if not hasattr(socket, "AF_UNIX"):
        return None
    if not os.path.exists(TAILSCALE_SOCKET_PATH):
        return None
    if httpx is None:
        return None

    try:
        transport = httpx.HTTPTransport(uds=TAILSCALE_SOCKET_PATH)
        with httpx.Client(transport=transport, timeout=2.0) as client:
            resp = client.get("http://local-tailscaled.sock/localapi/v0/status")
            if resp.status_code == 200:
                return resp.json()
    except Exception:
        return None
    return None

def _query_tailscale_cli() -> Optional[Dict[str, Any]]:
    """Executes 'tailscale status --json' via subprocess if binary is present."""
    try:
        proc = subprocess.run(
            ["tailscale", "status", "--json"],
            capture_output=True,
            text=True,
            timeout=3.0,
            check=False
        )
        if proc.returncode == 0 and proc.stdout.strip():
            return json.loads(proc.stdout)
    except Exception:
        return None
    return None

def _detect_linux_tailscale_interface() -> Optional[str]:
    """Inspects Linux kernel network interfaces for tailscale0 or 100.x.y.z assignment."""
    try:
        import fcntl
        import struct
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        ip = socket.inet_ntoa(fcntl.ioctl(
            s.fileno(),
            0x8915,  # SIOCGIFADDR
            struct.pack('256s', b"tailscale0"[:15])
        )[20:24])
        s.close()
        if is_tailscale_ip(ip):
            return ip
    except Exception:
        pass
    return None

def get_network_status(request: Optional[Any] = None) -> Dict[str, Any]:
    """
    Safely inspects real Tailscale connection state, IP address, and MagicDNS name.
    Supports host execution, Docker with socket mount, host network mode, and client header heuristics.
    """
    hostname = socket.gethostname()
    lan_ip = get_lan_ip()
    in_container = is_in_container()

    # Priority 1: Query Tailscale LocalAPI Unix domain socket (primary for Docker)
    data = _query_tailscale_socket()

    # Priority 2: Query Tailscale CLI binary (primary for bare metal / host)
    if not data:
        data = _query_tailscale_cli()

    if data:
        backend_state = data.get("BackendState", "Unknown")
        tailscale_ips = data.get("TailscaleIPs") or []
        self_node = data.get("Self") or {}
        dns_name = self_node.get("DNSName", "").rstrip(".")
        auth_url = data.get("AuthURL")

        is_connected = (backend_state == "Running") and len(tailscale_ips) > 0
        ts_ip = tailscale_ips[0] if tailscale_ips else None

        return {
            "tailscale_installed": True,
            "connected": is_connected,
            "state": backend_state,  # "Running", "NeedsLogin", "Stopped"
            "tailscale_ip": ts_ip,
            "dns_name": dns_name if dns_name else None,
            "auth_url": auth_url,
            "hostname": hostname,
            "lan_ip": lan_ip,
            "is_container": in_container,
            "local_url": f"http://{lan_ip}:8000",
            "tailscale_url": f"http://{ts_ip}:8000" if ts_ip else (f"http://{dns_name}:8000" if dns_name else None)
        }

    # Priority 3: Check Linux tailscale0 interface (e.g. Docker host network mode)
    iface_ip = _detect_linux_tailscale_interface()
    if iface_ip:
        return {
            "tailscale_installed": True,
            "connected": True,
            "state": "Running",
            "tailscale_ip": iface_ip,
            "dns_name": None,
            "auth_url": None,
            "hostname": hostname,
            "lan_ip": lan_ip,
            "is_container": in_container,
            "local_url": f"http://{lan_ip}:8000",
            "tailscale_url": f"http://{iface_ip}:8000"
        }

    # Priority 4: Environment variable override (e.g. TAILSCALE_IP=100.x.y.z)
    env_ts_ip = os.environ.get("TAILSCALE_IP")
    if env_ts_ip and is_tailscale_ip(env_ts_ip):
        env_dns = os.environ.get("TAILSCALE_DNS_NAME")
        return {
            "tailscale_installed": True,
            "connected": True,
            "state": "Running",
            "tailscale_ip": env_ts_ip,
            "dns_name": env_dns,
            "auth_url": None,
            "hostname": hostname,
            "lan_ip": lan_ip,
            "is_container": in_container,
            "local_url": f"http://{lan_ip}:8000",
            "tailscale_url": f"http://{env_ts_ip}:8000"
        }

    # Priority 5: Request header heuristics (if accessed via Tailscale IP or MagicDNS)
    if request:
        try:
            raw_host = request.headers.get("host", "")
            host_header = raw_host.split(":")[0].strip()
            if is_tailscale_ip(host_header):
                return {
                    "tailscale_installed": True,
                    "connected": True,
                    "state": "Running",
                    "tailscale_ip": host_header,
                    "dns_name": None,
                    "auth_url": None,
                    "hostname": hostname,
                    "lan_ip": lan_ip,
                    "is_container": in_container,
                    "local_url": f"http://{lan_ip}:8000",
                    "tailscale_url": f"http://{host_header}:8000"
                }
            elif host_header.endswith(".ts.net"):
                return {
                    "tailscale_installed": True,
                    "connected": True,
                    "state": "Running",
                    "tailscale_ip": None,
                    "dns_name": host_header,
                    "auth_url": None,
                    "hostname": hostname,
                    "lan_ip": lan_ip,
                    "is_container": in_container,
                    "local_url": f"http://{lan_ip}:8000",
                    "tailscale_url": f"http://{host_header}:8000"
                }
        except Exception:
            pass

    # No Tailscale detected
    return {
        "tailscale_installed": False,
        "connected": False,
        "state": "NotInstalled",
        "tailscale_ip": None,
        "dns_name": None,
        "auth_url": None,
        "hostname": hostname,
        "lan_ip": lan_ip,
        "is_container": in_container,
        "local_url": f"http://{lan_ip}:8000",
        "tailscale_url": None
    }
