import pytest
import datetime
from pathlib import Path
from backend import database, network

@pytest.fixture
def temp_db(tmp_path):
    db_file = tmp_path / "v2_test.sqlite"
    database.init_db(db_file)
    return db_file

def test_network_status_structure():
    status = network.get_network_status()
    assert isinstance(status, dict)
    assert "connected" in status
    assert "state" in status
    assert "hostname" in status
    assert "lan_ip" in status

def test_tailscale_ip_detection():
    assert network.is_tailscale_ip("100.115.92.42") is True
    assert network.is_tailscale_ip("100.64.0.1") is True
    assert network.is_tailscale_ip("100.127.255.254") is True
    assert network.is_tailscale_ip("192.168.1.50") is False
    assert network.is_tailscale_ip("172.18.0.2") is False
    assert network.is_tailscale_ip("127.0.0.1") is False

def test_network_status_with_request_header(monkeypatch):
    monkeypatch.setattr(network, "_query_tailscale_socket", lambda: None)
    monkeypatch.setattr(network, "_query_tailscale_cli", lambda: None)
    monkeypatch.setattr(network, "_detect_linux_tailscale_interface", lambda: None)

    class DummyRequest:
        def __init__(self, headers):
            self.headers = headers

    # When accessed via Tailscale IP
    req_ip = DummyRequest({"host": "100.115.92.42:8000"})
    res_ip = network.get_network_status(request=req_ip)
    assert res_ip["connected"] is True
    assert res_ip["tailscale_ip"] == "100.115.92.42"

    # When accessed via MagicDNS
    req_dns = DummyRequest({"host": "pettr-server.tailnet.ts.net:8000"})
    res_dns = network.get_network_status(request=req_dns)
    assert res_dns["connected"] is True
    assert res_dns["dns_name"] == "pettr-server.tailnet.ts.net"

def test_entity_reclassification_and_conversion(temp_db):
    # 1. Create a focus task
    task = database.create_task(
        title="Initial Task",
        description="To be converted",
        tier="focus",
        project_name="Alpha",
        due_date="2026-09-25 15:00:00",
        db_path=temp_db
    )
    task_id = task["id"]

    # 2. In-place update (change title and tier to trivial)
    res = database.reclassify_entity(
        from_type="task",
        from_id=task_id,
        to_type="task",
        title="Updated Task Title",
        description="Updated notes",
        project_name="Alpha",
        tier="trivial",
        due_date="2026-09-25 16:00:00",
        status="pending",
        db_path=temp_db
    )
    assert res["status"] == "success"
    assert res["entity"]["tier"] == "trivial"
    assert res["entity"]["title"] == "Updated Task Title"

    # 3. Convert task to event
    res_event = database.reclassify_entity(
        from_type="task",
        from_id=task_id,
        to_type="event",
        title="Now an Appointment",
        description="Converted to scheduled event",
        project_name="Alpha",
        due_date="2026-09-25 18:00:00",
        db_path=temp_db
    )
    assert res_event["status"] == "success"
    assert res_event["entity_type"] == "event"
    # Verify old task is deleted
    assert database.get_task_by_id(task_id, temp_db) is None
    # Verify event exists
    event_id = res_event["entity"]["id"]
    ev_detail = database.get_entity_detail("event", event_id, temp_db)
    assert ev_detail["title"] == "Now an Appointment"

def test_timeline_multi_scale(temp_db):
    # Seed sample items
    database.seed_sample_data(temp_db)

    # 1. Day scale
    day_res = database.get_timeline_data(scale="day", year=2026, month=9, day=25, db_path=temp_db)
    assert day_res["scale"] == "day"
    assert "hours" in day_res
    assert len(day_res["hours"]) == 24

    # 2. Month scale
    month_res = database.get_timeline_data(scale="month", year=2026, month=9, day=25, db_path=temp_db)
    assert month_res["scale"] == "month"
    assert month_res["month"] == 9
    assert len(month_res["days"]) == 30

    # 3. Year scale
    year_res = database.get_timeline_data(scale="year", year=2026, db_path=temp_db)
    assert year_res["scale"] == "year"
    assert len(year_res["months"]) == 12

    # Clear sample data
    clear_res = database.clear_sample_data(temp_db)
    assert clear_res["status"] == "success"

def test_rich_text_briefing_generation(temp_db):
    database.create_task(title="Deep Focus Coding", tier="focus", project_name="PETTR", due_date="2026-09-25 23:59:00", db_path=temp_db)
    database.create_task(title="Trash out", tier="trivial", due_date="2026-09-25 20:00:00", db_path=temp_db)
    database.create_reminder(title="Bring notebook", details="Important", reminder_date="2026-09-25", db_path=temp_db)

    brief_text = database.get_rich_text_briefing(datetime.date(2026, 9, 25), temp_db)
    assert "PETTR MORNING BRIEF" in brief_text
    assert "FOCUS TASKS" in brief_text
    assert "Deep Focus Coding" in brief_text
    assert "TRIVIAL ERRANDS" in brief_text
    assert "Trash out" in brief_text
    assert "REMINDERS TO SELF" in brief_text
    assert "Bring notebook" in brief_text

def test_user_profile_management(tmp_path):
    from config import config
    test_cfg = tmp_path / "test_cfg.json"
    
    # Check default profile
    profile = config.get_user_profile(test_cfg)
    assert profile["user_name"] == "User"

    # Update name
    ok, msg = config.update_user_name("Alex Mercer", test_cfg)
    assert ok is True
    
    profile_updated = config.get_user_profile(test_cfg)
    assert profile_updated["user_name"] == "Alex Mercer"

    # Reject empty name
    ok_empty, _ = config.update_user_name("   ", test_cfg)
    assert ok_empty is False

