import time
import pytest
from backend import auth
from config import config

def test_pin_verification(tmp_path):
    cfg_file = tmp_path / "test_config.json"
    cfg = config.get_or_create_config(cfg_file)
    
    # Default PIN is 1234
    assert config.verify_pin("1234", cfg_file) is True
    assert config.verify_pin("0000", cfg_file) is False

    # Update PIN
    success, msg = config.update_pin("9876", cfg_file)
    assert success is True
    assert config.verify_pin("9876", cfg_file) is True
    assert config.verify_pin("1234", cfg_file) is False

    # Invalid PIN
    success, msg = config.update_pin("12a4", cfg_file)
    assert success is False

def test_rate_limiting():
    test_ip = "192.168.1.100"
    # Reset any existing state
    auth._rate_limits.pop(test_ip, None)

    # 4 failed attempts: not locked out yet
    for _ in range(4):
        auth.record_failed_attempt(test_ip)
    
    allowed, secs = auth.check_rate_limit(test_ip)
    assert allowed is True
    assert secs == 0

    # 5th failed attempt: triggers lockout
    lockout = auth.record_failed_attempt(test_ip)
    assert lockout == 60
    
    allowed, secs = auth.check_rate_limit(test_ip)
    assert allowed is False
    assert secs > 0

    # Successful login resets the rate limit
    auth.record_successful_login(test_ip)
    allowed, secs = auth.check_rate_limit(test_ip)
    assert allowed is True

def test_host_only_verification():
    assert auth.is_host_client("127.0.0.1") is True
    assert auth.is_host_client("::1") is True
    assert auth.is_host_client("localhost") is True
    assert auth.is_host_client("100.64.0.1") is False # Remote Tailscale peer
    assert auth.is_host_client("192.168.1.42") is False
