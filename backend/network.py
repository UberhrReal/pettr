import subprocess
import json
import socket
from typing import Dict, Any

def get_lan_ip() -> str:
    """Attempts to find the primary LAN IPv4 address."""
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        # Does not actually connect but determines routing interface
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except Exception:
        return "127.0.0.1"

def get_network_status() -> Dict[str, Any]:
    """
    Executes 'tailscale status --json' to safely inspect real Tailscale connection state,
    IP address, and MagicDNS name.
    """
    hostname = socket.gethostname()
    lan_ip = get_lan_ip()

    try:
        proc = subprocess.run(
            ["tailscale", "status", "--json"],
            capture_output=True,
            text=True,
            timeout=3.0,
            check=False
        )
        if proc.returncode == 0 and proc.stdout.strip():
            data = json.loads(proc.stdout)
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
                "state": backend_state, # "Running", "NeedsLogin", "Stopped"
                "tailscale_ip": ts_ip,
                "dns_name": dns_name if dns_name else None,
                "auth_url": auth_url,
                "hostname": hostname,
                "lan_ip": lan_ip,
                "local_url": f"http://{lan_ip}:8000",
                "tailscale_url": f"http://{ts_ip}:8000" if ts_ip else (f"http://{dns_name}:8000" if dns_name else None)
            }
        else:
            # Command ran but returned non-zero (e.g. Tailscale daemon not running)
            return {
                "tailscale_installed": True,
                "connected": False,
                "state": "Stopped",
                "tailscale_ip": None,
                "dns_name": None,
                "auth_url": None,
                "hostname": hostname,
                "lan_ip": lan_ip,
                "local_url": f"http://{lan_ip}:8000",
                "tailscale_url": None
            }
    except FileNotFoundError:
        # tailscale binary not found
        return {
            "tailscale_installed": False,
            "connected": False,
            "state": "NotInstalled",
            "tailscale_ip": None,
            "dns_name": None,
            "auth_url": None,
            "hostname": hostname,
            "lan_ip": lan_ip,
            "local_url": f"http://{lan_ip}:8000",
            "tailscale_url": None
        }
    except Exception as e:
        return {
            "tailscale_installed": True,
            "connected": False,
            "state": "Error",
            "error": str(e),
            "tailscale_ip": None,
            "dns_name": None,
            "auth_url": None,
            "hostname": hostname,
            "lan_ip": lan_ip,
            "local_url": f"http://{lan_ip}:8000",
            "tailscale_url": None
        }
