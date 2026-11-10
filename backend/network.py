import os
import subprocess
import json
import socket
import ipaddress
import time
from pathlib import Path
from typing import Dict, Any, Optional

try:
    import httpx
except ImportError:
    httpx = None

TAILSCALE_SOCKET_PATH = os.environ.get("TAILSCALE_SOCKET_PATH", "/var/run/tailscale/tailscaled.sock")

_LAST_TAILSCALE_CACHE: Optional[Dict[str, Any]] = None
_LAST_TAILSCALE_CACHE_TIME: float = 0.0
_TAILSCALE_CACHE_TTL: float = 86400.0  # 24 hours

def _get_persistent_cache_path() -> Path:
    data_dir = os.environ.get("PETTR_DATA_DIR", "data")
    return Path(data_dir) / "tailscale_state.json"

def _save_tailscale_persistent_cache(data: Dict[str, Any]) -> None:
    """Persists confirmed Tailscale status to disk so restarts preserve mesh connectivity."""
    try:
        path = _get_persistent_cache_path()
        path.parent.mkdir(parents=True, exist_ok=True)
        save_obj = {
            "tailscale_installed": data.get("tailscale_installed", True),
            "connected": True,
            "state": "Running",
            "tailscale_ip": data.get("tailscale_ip"),
            "dns_name": data.get("dns_name"),
            "tailscale_url": data.get("tailscale_url"),
            "saved_at": time.time()
        }
        path.write_text(json.dumps(save_obj), encoding="utf-8")
    except Exception:
        pass

def _load_tailscale_persistent_cache() -> Optional[Dict[str, Any]]:
    """Loads persistent Tailscale connectivity from disk if available."""
    try:
        path = _get_persistent_cache_path()
        if path.exists():
            content = path.read_text(encoding="utf-8")
            if content.strip():
                data = json.loads(content)
                if data.get("connected"):
                    return data
    except Exception:
        pass
    return None

def _update_tailscale_cache(data: Dict[str, Any]) -> None:
    global _LAST_TAILSCALE_CACHE, _LAST_TAILSCALE_CACHE_TIME
    if data and data.get("connected"):
        _LAST_TAILSCALE_CACHE = dict(data)
        _LAST_TAILSCALE_CACHE_TIME = time.time()
        _save_tailscale_persistent_cache(_LAST_TAILSCALE_CACHE)

def _get_tailscale_cache() -> Optional[Dict[str, Any]]:
    global _LAST_TAILSCALE_CACHE, _LAST_TAILSCALE_CACHE_TIME
    if _LAST_TAILSCALE_CACHE and (time.time() - _LAST_TAILSCALE_CACHE_TIME) < _TAILSCALE_CACHE_TTL:
        return _LAST_TAILSCALE_CACHE
    disk_cached = _load_tailscale_persistent_cache()
    if disk_cached and disk_cached.get("connected"):
        _LAST_TAILSCALE_CACHE = dict(disk_cached)
        _LAST_TAILSCALE_CACHE_TIME = time.time()
        return _LAST_TAILSCALE_CACHE
    return None

def record_request_traffic(request: Any) -> None:
    """Inspects any incoming request to detect if client or host is on Tailscale, refreshing cache."""
    if not request:
        return
    try:
        raw_host = getattr(request, "headers", {}).get("host", "") if hasattr(request, "headers") else ""
        host_header = raw_host.split(":")[0].strip()
        client_ip = getattr(getattr(request, "client", None), "host", "")
        forwarded = getattr(request, "headers", {}).get("x-forwarded-for", "").split(",")[0].strip() if hasattr(request, "headers") else ""
        query_client = ""
        if hasattr(request, "query_params"):
            query_client = request.query_params.get("client_host", "").strip()

        candidates = [c for c in [query_client, host_header, client_ip, forwarded] if c]
        for cand in candidates:
            cand_clean = cand.split(":")[0].strip()
            if is_tailscale_ip(cand_clean):
                res = {
                    "tailscale_installed": True,
                    "connected": True,
                    "state": "Running",
                    "tailscale_ip": cand_clean,
                    "dns_name": None,
                    "auth_url": None,
                    "tailscale_url": f"http://{cand_clean}:8000"
                }
                _update_tailscale_cache(res)
                return
            elif cand_clean.endswith(".ts.net"):
                res = {
                    "tailscale_installed": True,
                    "connected": True,
                    "state": "Running",
                    "tailscale_ip": None,
                    "dns_name": cand_clean,
                    "auth_url": None,
                    "tailscale_url": f"http://{cand_clean}:8000"
                }
                _update_tailscale_cache(res)
                return
    except Exception:
        pass

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
    Requires 'Sec-Tailscale: localapi' header for authorization.
    """
    if not hasattr(socket, "AF_UNIX"):
        return None

    candidate_paths = [
        os.environ.get("TAILSCALE_SOCKET_PATH", ""),
        TAILSCALE_SOCKET_PATH,
        "/var/run/tailscale/tailscaled.sock",
        "/run/tailscale/tailscaled.sock",
        "/var/run/tailscale/tailscaled.socket",
    ]
    socket_path = None
    for p in candidate_paths:
        if p and os.path.exists(p):
            socket_path = p
            break

    if not socket_path:
        return None

    # Method A: Try httpx with required Sec-Tailscale header
    if httpx is not None:
        try:
            transport = httpx.HTTPTransport(uds=socket_path)
            with httpx.Client(transport=transport, timeout=2.0) as client:
                resp = client.get("http://local-tailscaled.sock/localapi/v0/status", headers={"Sec-Tailscale": "localapi"})
                if resp.status_code == 200:
                    return resp.json()
        except Exception:
            pass

    # Method B: Pure Python socket fallback
    try:
        s = socket.socket(socket.AF_UNIX, socket.SOCK_STREAM)
        s.settimeout(2.0)
        s.connect(socket_path)
        http_req = (
            b"GET /localapi/v0/status HTTP/1.1\r\n"
            b"Host: local-tailscaled.sock\r\n"
            b"Sec-Tailscale: localapi\r\n"
            b"Connection: close\r\n\r\n"
        )
        s.sendall(http_req)
        response_bytes = b""
        while True:
            chunk = s.recv(4096)
            if not chunk:
                break
            response_bytes += chunk
        s.close()
        parts = response_bytes.split(b"\r\n\r\n", 1)
        if len(parts) == 2:
            headers_raw = parts[0].decode("latin-1", errors="ignore").lower()
            body_bytes = parts[1]
            if "transfer-encoding: chunked" in headers_raw:
                chunks = []
                rem = body_bytes
                while rem:
                    nl = rem.find(b"\r\n")
                    if nl == -1:
                        break
                    hex_len = rem[:nl].split(b";")[0].strip()
                    try:
                        chunk_len = int(hex_len, 16)
                    except ValueError:
                        break
                    if chunk_len == 0:
                        break
                    start = nl + 2
                    chunk_data = rem[start:start + chunk_len]
                    chunks.append(chunk_data)
                    rem = rem[start + chunk_len + 2:]
                body = b"".join(chunks).decode("utf-8", errors="ignore")
            else:
                body = body_bytes.decode("utf-8", errors="ignore")
            return json.loads(body)
    except Exception:
        pass

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

        res = {
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
        if is_connected:
            _update_tailscale_cache(res)
        return res

    # Priority 3: Check Linux tailscale0 interface (e.g. Docker host network mode)
    iface_ip = _detect_linux_tailscale_interface()
    if iface_ip:
        res = {
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
        _update_tailscale_cache(res)
        return res

    # Priority 4: Environment variable override (e.g. TAILSCALE_IP=100.x.y.z)
    env_ts_ip = os.environ.get("TAILSCALE_IP")
    if env_ts_ip and is_tailscale_ip(env_ts_ip):
        env_dns = os.environ.get("TAILSCALE_DNS_NAME")
        res = {
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
        _update_tailscale_cache(res)
        return res

    # Priority 5: Request header heuristics (if accessed via Tailscale IP or MagicDNS)
    if request:
        try:
            raw_host = getattr(request, "headers", {}).get("host", "") if hasattr(request, "headers") else ""
            host_header = raw_host.split(":")[0].strip()
            client_ip = getattr(getattr(request, "client", None), "host", "")
            forwarded = getattr(request, "headers", {}).get("x-forwarded-for", "").split(",")[0].strip() if hasattr(request, "headers") else ""
            query_client = ""
            if hasattr(request, "query_params"):
                query_client = request.query_params.get("client_host", "").strip()

            candidates = [c for c in [query_client, host_header, client_ip, forwarded] if c]
            for cand in candidates:
                cand_clean = cand.split(":")[0].strip()
                if is_tailscale_ip(cand_clean):
                    res = {
                        "tailscale_installed": True,
                        "connected": True,
                        "state": "Running",
                        "tailscale_ip": cand_clean,
                        "dns_name": None,
                        "auth_url": None,
                        "hostname": hostname,
                        "lan_ip": lan_ip,
                        "is_container": in_container,
                        "local_url": f"http://{lan_ip}:8000",
                        "tailscale_url": f"http://{cand_clean}:8000"
                    }
                    _update_tailscale_cache(res)
                    return res
                elif cand_clean.endswith(".ts.net"):
                    res = {
                        "tailscale_installed": True,
                        "connected": True,
                        "state": "Running",
                        "tailscale_ip": None,
                        "dns_name": cand_clean,
                        "auth_url": None,
                        "hostname": hostname,
                        "lan_ip": lan_ip,
                        "is_container": in_container,
                        "local_url": f"http://{lan_ip}:8000",
                        "tailscale_url": f"http://{cand_clean}:8000"
                    }
                    _update_tailscale_cache(res)
                    return res
        except Exception:
            pass

    # Priority 6: Fallback to recent cached Tailscale connectivity (15-min TTL)
    cached = _get_tailscale_cache()
    if cached:
        cached_copy = dict(cached)
        cached_copy["hostname"] = hostname
        cached_copy["lan_ip"] = lan_ip
        cached_copy["is_container"] = in_container
        return cached_copy

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
