import json
import os
import hashlib
import secrets
from pathlib import Path
from typing import Dict, Any, Tuple, Optional, List

CONFIG_DIR = Path(os.environ.get("PETTR_CONFIG_DIR", Path(__file__).resolve().parent))
DEFAULT_CONFIG_PATH = CONFIG_DIR / "pettr_config.json"
DEFAULT_BACKUP_DIR = str(Path(os.environ.get("PETTR_BACKUP_DIR", Path(__file__).resolve().parent.parent / "backups")).resolve())
DEFAULT_OLLAMA_URL = os.environ.get("OLLAMA_URL", "http://localhost:11434")

def get_ollama_candidate_urls() -> List[str]:
    """
    Returns prioritized candidate URLs to connect to Ollama,
    supporting Docker-to-host bridges, Linux host gateways, and direct local endpoints.
    """
    candidate_urls: List[str] = []
    if os.environ.get("OLLAMA_URL"):
        candidate_urls.append(os.environ["OLLAMA_URL"].rstrip("/"))

    try:
        cfg = get_or_create_config()
        cfg_url = cfg.get("ollama_url")
        if cfg_url and cfg_url.rstrip("/") not in candidate_urls:
            candidate_urls.append(cfg_url.rstrip("/"))
    except Exception:
        pass

    defaults = [
        "http://host.docker.internal:11434",
        "http://172.17.0.1:11434",
        "http://localhost:11434",
        "http://127.0.0.1:11434"
    ]
    for d in defaults:
        clean_d = d.rstrip("/")
        if clean_d not in candidate_urls:
            candidate_urls.append(clean_d)

    return candidate_urls

DEFAULT_CONFIG = {
    "host": "0.0.0.0",
    "port": 8000,
    "pin_salt": "",
    "pin_hash": "",
    "session_secret": "",
    "rate_limit_max_attempts": 5,
    "rate_limit_lockout_seconds": [60, 300, 900],
    "ollama_url": DEFAULT_OLLAMA_URL,
    "ollama_model": "llama3.2:3b",
    "backup_dir": DEFAULT_BACKUP_DIR,
    "backup_interval_days": 7,
    "user_name": "User",
    "current_pin": "1234"
}

def hash_pin(pin: str, salt: str) -> str:
    """Hashes a 4-digit PIN with a salt using SHA-256."""
    return hashlib.sha256((salt + pin).encode("utf-8")).hexdigest()

def get_or_create_config(config_path: Optional[Path] = None) -> Dict[str, Any]:
    """Loads configuration or creates default if missing."""
    if config_path is None:
        config_path = DEFAULT_CONFIG_PATH
    if not config_path.exists():
        salt = secrets.token_hex(16)
        secret = secrets.token_hex(32)
        # Default PIN is 1234
        default_pin_hash = hash_pin("1234", salt)
        config = dict(DEFAULT_CONFIG)
        config["pin_salt"] = salt
        config["pin_hash"] = default_pin_hash
        config["session_secret"] = secret
        config["current_pin"] = "1234"
        save_config(config, config_path)
        return config

    try:
        with open(config_path, "r", encoding="utf-8") as f:
            data = json.load(f)
        # Ensure all default keys exist
        updated = False
        for k, v in DEFAULT_CONFIG.items():
            if k not in data:
                data[k] = v
                updated = True
        if updated:
            save_config(data, config_path)
        return data
    except Exception:
        return dict(DEFAULT_CONFIG)

def save_config(config_data: Dict[str, Any], config_path: Optional[Path] = None) -> None:
    """Saves configuration safely."""
    if config_path is None:
        config_path = DEFAULT_CONFIG_PATH
    config_path.parent.mkdir(parents=True, exist_ok=True)
    with open(config_path, "w", encoding="utf-8") as f:
        json.dump(config_data, f, indent=2)

def verify_pin(pin: str, config_path: Optional[Path] = None) -> bool:
    """Verifies a 4-digit PIN against stored hash."""
    if config_path is None:
        config_path = DEFAULT_CONFIG_PATH
    config = get_or_create_config(config_path)
    salt = config.get("pin_salt", "")
    target_hash = config.get("pin_hash", "")
    return hash_pin(pin, salt) == target_hash

def update_pin(new_pin: str, config_path: Optional[Path] = None) -> Tuple[bool, str]:
    """Updates 4-digit PIN."""
    if not (new_pin.isdigit() and len(new_pin) == 4):
        return False, "PIN must be exactly 4 numeric digits (0000-9999)."
    
    if config_path is None:
        config_path = DEFAULT_CONFIG_PATH
    config = get_or_create_config(config_path)
    salt = secrets.token_hex(16)
    config["pin_salt"] = salt
    config["pin_hash"] = hash_pin(new_pin, salt)
    config["current_pin"] = new_pin
    save_config(config, config_path)
    return True, "PIN successfully updated."

def get_current_pin(config_path: Optional[Path] = None) -> str:
    """Returns current active PIN (host-only accessible)."""
    if config_path is None:
        config_path = DEFAULT_CONFIG_PATH
    config = get_or_create_config(config_path)
    return config.get("current_pin", "1234")

def get_user_profile(config_path: Optional[Path] = None) -> Dict[str, Any]:
    """Retrieves user profile information."""
    if config_path is None:
        config_path = DEFAULT_CONFIG_PATH
    config = get_or_create_config(config_path)
    return {
        "user_name": config.get("user_name", "User"),
        "host": config.get("host", "0.0.0.0"),
        "port": config.get("port", 8000)
    }

def update_user_name(new_name: str, config_path: Optional[Path] = None) -> Tuple[bool, str]:
    """Updates user display name."""
    clean_name = new_name.strip()
    if not clean_name:
        return False, "Name cannot be empty."
    if len(clean_name) > 50:
        return False, "Name is too long (max 50 chars)."

    if config_path is None:
        config_path = DEFAULT_CONFIG_PATH
    config = get_or_create_config(config_path)
    config["user_name"] = clean_name
    save_config(config, config_path)
    return True, "User name updated successfully."

