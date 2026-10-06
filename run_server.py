import sys
import subprocess
from pathlib import Path

# Auto-detect venv if running with global python without dependencies
try:
    import uvicorn
except ImportError:
    venv_python = Path(__file__).resolve().parent / "venv" / "Scripts" / "python.exe"
    if venv_python.exists() and sys.executable != str(venv_python):
        print(f"[INFO] Launching PETTR with virtual environment Python: {venv_python}")
        res = subprocess.run([str(venv_python)] + sys.argv)
        sys.exit(res.returncode)
    else:
        print("[ERROR] uvicorn is not installed. Please run: .\\venv\\Scripts\\pip install -r requirements.txt")
        sys.exit(1)

from config.config import get_or_create_config

def main():
    cfg = get_or_create_config()
    host = cfg.get("host", "0.0.0.0")
    port = int(cfg.get("port", 8000))
    print(f"=================================================")
    print(f"       PETTR Home Server Starting 24/7           ")
    print(f"=================================================")
    print(f"[*] Binding to: http://{host}:{port}")
    print(f"[*] Accessible locally at: http://127.0.0.1:{port}")
    print(f"[*] Accessible via Tailscale at: http://<your-tailscale-node>:{port}")
    print(f"[*] Default PIN: 1234 (change anytime in Settings on host PC)")
    print(f"=================================================\n")
    uvicorn.run("backend.app:app", host=host, port=port, reload=False)

if __name__ == "__main__":
    main()
