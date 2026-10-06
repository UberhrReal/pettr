import time
import secrets
from typing import Dict, Any, Optional, Tuple
from fastapi import Request, HTTPException, Depends
from config.config import verify_pin, update_pin

# In-memory rate limiting tracker: ip -> {"failures": count, "locked_until": timestamp}
_rate_limits: Dict[str, Dict[str, Any]] = {}

# Active authenticated sessions: token -> {"created_at": timestamp, "ip": str}
_sessions: Dict[str, Dict[str, Any]] = {}
SESSION_EXPIRY_SECONDS = 30 * 24 * 3600 # 30 days session

def get_client_ip(request: Request) -> str:
    """Extracts client IP address safely."""
    # If behind reverse proxy/Tailscale headers
    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "127.0.0.1"

def is_host_client(ip: str) -> bool:
    """Checks whether the client is directly on the host machine."""
    return ip in ("127.0.0.1", "::1", "localhost", "testclient")

def check_rate_limit(ip: str) -> Tuple[bool, int]:
    """
    Checks if an IP is currently locked out.
    Returns (is_allowed, seconds_remaining).
    """
    now = time.time()
    info = _rate_limits.get(ip)
    if not info:
        return True, 0
    
    locked_until = info.get("locked_until", 0)
    if now < locked_until:
        return False, int(locked_until - now)
    
    return True, 0

def record_failed_attempt(ip: str) -> int:
    """
    Records a failed PIN attempt and applies progressive lockout:
    5 failed: 60s
    6 failed: 300s (5m)
    7+ failed: 900s (15m)
    Returns remaining lockout seconds if locked, else 0.
    """
    now = time.time()
    info = _rate_limits.setdefault(ip, {"failures": 0, "locked_until": 0, "first_fail": now})
    
    # Reset failures if last failure was more than 15 minutes ago
    if now - info.get("first_fail", now) > 900:
        info["failures"] = 0
        info["first_fail"] = now

    info["failures"] += 1
    failures = info["failures"]

    lockout = 0
    if failures == 5:
        lockout = 60
    elif failures == 6:
        lockout = 300
    elif failures >= 7:
        lockout = 900

    if lockout > 0:
        info["locked_until"] = now + lockout
        return lockout
    return 0

def record_successful_login(ip: str) -> str:
    """Clears failed attempts and generates a secure session token."""
    if ip in _rate_limits:
        _rate_limits.pop(ip, None)
    
    token = secrets.token_urlsafe(32)
    _sessions[token] = {
        "created_at": time.time(),
        "ip": ip
    }
    return token

def validate_session(request: Request) -> bool:
    """Validates session token from cookie or Authorization header."""
    token = request.cookies.get("pettr_session")
    if not token:
        auth_header = request.headers.get("Authorization")
        if auth_header and auth_header.startswith("Bearer "):
            token = auth_header[7:].strip()
            
    if not token:
        return False
    
    session = _sessions.get(token)
    if not session:
        return False
    
    # Check expiry
    if time.time() - session["created_at"] > SESSION_EXPIRY_SECONDS:
        _sessions.pop(token, None)
        return False
        
    return True

def require_auth(request: Request):
    """FastAPI dependency to protect private API endpoints."""
    if not validate_session(request):
        raise HTTPException(status_code=401, detail="Authentication required. Please enter 4-digit PIN.")

def require_host_only(request: Request):
    """FastAPI dependency: allows access ONLY from the physical host machine."""
    ip = get_client_ip(request)
    if not is_host_client(ip):
        raise HTTPException(
            status_code=403, 
            detail="Forbidden: This action can only be performed directly on the hosting PC."
        )
