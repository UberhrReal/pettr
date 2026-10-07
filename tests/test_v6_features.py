import pytest
import io
import datetime
from pathlib import Path
from fastapi.testclient import TestClient

from backend import database, backup
from backend.app import app
from backend.parser.pipeline import process_user_input
from backend.parser.deterministic import extract_explicit_entity_intent

@pytest.fixture
def temp_db(tmp_path):
    db_file = tmp_path / "v6_test.sqlite"
    database.init_db(db_file)
    return db_file

def test_daily_order_persistence_and_api(temp_db, monkeypatch):
    """Test priority tasking sequence persists per date and syncs across devices."""
    monkeypatch.setattr(database, "DEFAULT_DB_PATH", temp_db)

    today = datetime.date.today().isoformat()
    order_items = [
        {"id": 101, "type": "task", "title": "Priority 1 Task", "tier": "focus"},
        {"id": 102, "type": "task", "title": "Priority 2 Task", "tier": "focus"},
        {"id": 103, "type": "event", "title": "Team Sync 1500", "tier": "event"}
    ]

    with TestClient(app) as client:
        client.post("/api/auth/login", json={"pin": "1234"})

        # Save daily order
        res = client.post("/api/daily-order", json={"date": today, "items": order_items})
        assert res.status_code == 200
        data = res.json()
        assert data["status"] == "success"

        # Fetch daily order
        res_get = client.get(f"/api/daily-order?date={today}")
        assert res_get.status_code == 200
        get_data = res_get.json()
        assert len(get_data["order"]) == 3
        assert get_data["order"][0]["title"] == "Priority 1 Task"
        assert get_data["order"][2]["title"] == "Team Sync 1500"

def test_reminder_prefix_stripping():
    """Test 'Reminder to feed the fish' cleanly normalizes to 'Feed the fish'."""
    cleaned1, entity_type1, _ = extract_explicit_entity_intent("Reminder to feed the fish")
    assert entity_type1 == "reminder"
    assert cleaned1 == "Feed the fish"

    cleaned2, entity_type2, _ = extract_explicit_entity_intent("Remind me to check telemetry")
    assert entity_type2 == "reminder"
    assert cleaned2 == "Check telemetry"

    cleaned3, entity_type3, _ = extract_explicit_entity_intent("Reminder that system backup runs tonight")
    assert entity_type3 == "reminder"
    assert cleaned3 == "System backup runs tonight"

def test_time_sensitive_flag_persistence(temp_db, monkeypatch):
    """Test manual and NLP time-sensitive flag persistence on tasks."""
    monkeypatch.setattr(database, "DEFAULT_DB_PATH", temp_db)

    # Database level
    t = database.create_task("Fix orbital guidance", is_time_sensitive=True, db_path=temp_db)
    assert t["is_time_sensitive"] == 1

    # Reclassify / edit entity with is_time_sensitive
    updated = database.reclassify_entity(
        from_type="task",
        from_id=t["id"],
        to_type="task",
        title="Fix orbital guidance immediately",
        is_time_sensitive=False,
        db_path=temp_db
    )
    assert updated["entity"]["is_time_sensitive"] == 0

def test_return_entity_to_unorganized(temp_db, monkeypatch):
    """Test returning an existing task back to the unorganized queue from edit modal."""
    monkeypatch.setattr(database, "DEFAULT_DB_PATH", temp_db)

    t = database.create_task("Unclear requirement note", db_path=temp_db)
    task_id = t["id"]

    with TestClient(app) as client:
        client.post("/api/auth/login", json={"pin": "1234"})

        res = client.post("/api/entities/reclassify", json={
            "from_type": "task",
            "from_id": task_id,
            "to_type": "unorganized",
            "title": "Unclear requirement note",
            "description": "Sent back for review"
        })
        assert res.status_code == 200
        data = res.json()
        assert data["status"] == "success"

        # Verify old task is removed and unorganized entry exists
        task_check = database.get_task_by_id(task_id, db_path=temp_db)
        assert task_check is None

        unorg = database.get_unorganized_items(db_path=temp_db)
        assert any(item["raw_input"].startswith("Unclear requirement note") for item in unorg)

def test_notes_media_upload_api(temp_db, monkeypatch, tmp_path):
    """Test media upload endpoint saving files and returning safe static URL."""
    monkeypatch.setattr(database, "DEFAULT_DB_PATH", temp_db)
    media_dir = tmp_path / "media_test"
    monkeypatch.setattr("backend.app.MEDIA_DIR", media_dir)

    with TestClient(app) as client:
        client.post("/api/auth/login", json={"pin": "1234"})

        # Upload a dummy image
        file_bytes = b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR"
        res = client.post(
            "/api/notes/upload-media",
            files={"file": ("test_diagram.png", io.BytesIO(file_bytes), "image/png")}
        )
        assert res.status_code == 200
        data = res.json()
        assert data["status"] == "success"
        assert data["url"].startswith("/static/media/")
        assert "test_diagram" in data["filename"]

        # Verify file exists on disk
        saved_file = media_dir / Path(data["url"]).name
        assert saved_file.exists()
        assert saved_file.read_bytes() == file_bytes

def test_client_timezone_header_support(temp_db, monkeypatch):
    """Test X-Client-Timezone header propagates to current time calculation."""
    monkeypatch.setattr(database, "DEFAULT_DB_PATH", temp_db)

    with TestClient(app) as client:
        client.post("/api/auth/login", json={"pin": "1234"})

        # Briefing with Tokyo timezone header
        res = client.get("/api/briefing", headers={"X-Client-Timezone": "Asia/Tokyo"})
        assert res.status_code == 200
        data = res.json()
        assert "date" in data

def test_toggle_time_sensitive_api(temp_db, monkeypatch):
    """Test manual toggle of task time sensitive flag via PATCH."""
    monkeypatch.setattr(database, "DEFAULT_DB_PATH", temp_db)
    t = database.create_task("Review orbital descent angles", is_time_sensitive=False, db_path=temp_db)
    assert t["is_time_sensitive"] == 0

    with TestClient(app) as client:
        client.post("/api/auth/login", json={"pin": "1234"})
        res = client.patch(f"/api/tasks/{t['id']}/toggle-time-sensitive")
        assert res.status_code == 200
        assert res.json()["task"]["is_time_sensitive"] == 1

        # Toggle back off
        res2 = client.patch(f"/api/tasks/{t['id']}/toggle-time-sensitive")
        assert res2.status_code == 200
        assert res2.json()["task"]["is_time_sensitive"] == 0

def test_daily_intel_api(temp_db, monkeypatch):
    """Test date-aware daily intelligence endpoint ensuring no duplicates between phrases and subtext."""
    monkeypatch.setattr(database, "DEFAULT_DB_PATH", temp_db)
    with TestClient(app) as client:
        client.post("/api/auth/login", json={"pin": "1234"})
        res = client.get("/api/daily-intel?date=2026-10-07")
        assert res.status_code == 200
        data = res.json()
        assert "phrases" in data
        assert "subtext" in data
        assert len(data["phrases"]) > 0
        # Check non-duplication
        for phrase in data["phrases"]:
            assert phrase.strip() != data["subtext"].strip()
        assert "Luna 3" in data["milestone"] or "October" in data["subtext"]

        # Second call should read from SQLite cache
        res2 = client.get("/api/daily-intel?date=2026-10-07")
        assert res2.status_code == 200
        data2 = res2.json()
        assert data2["source"] == "cache"
        assert data2["phrases"] == data["phrases"]

@pytest.mark.anyio
async def test_llm_typewriter_generation_and_cache(temp_db, monkeypatch):
    """Test LLM generation mock and SQLite persistence."""
    import datetime
    from backend import daily_intel

    mock_phrases = [
        "Orbital velocity achieved, Hong Rong.",
        "Deep focus mode engaged.",
        "1959 Luna 3 anniversary salute.",
        "Conquering targets with precision.",
        "Systems online and nominal."
    ]

    async def mock_llm_call(target_date, user_name, milestone_info=None, timeout_seconds=8.0):
        return mock_phrases

    monkeypatch.setattr(daily_intel, "generate_llm_typewriter_lines", mock_llm_call)

    # Force generate for today
    today = datetime.date(2026, 10, 7)
    res = await daily_intel.get_or_generate_daily_intel(
        target_date=today,
        user_name="Hong Rong",
        force_refresh=True,
        db_path=temp_db
    )
    assert res["source"] == "llm"
    assert res["phrases"] == mock_phrases

    # Check persistence in database
    cached = database.get_daily_typewriter_cache("2026-10-07", db_path=temp_db)
    assert cached is not None
    assert cached["phrases"] == mock_phrases
    assert cached["source"] == "llm"


def test_day_sealing_and_immutable_completion_rate(temp_db, monkeypatch):
    """Test evening debrief seal locks the day's completion rate and blocks further edits."""
    monkeypatch.setattr(database, "DEFAULT_DB_PATH", temp_db)
    target_date = "2026-10-08"

    # Step 1: Create 2 tasks for target date (1 completed, 1 pending)
    t1 = database.create_task("Finish Thesis Chapter", tier="focus", due_date=target_date, db_path=temp_db)
    t2 = database.create_task("Review Slides", tier="trivial", due_date=target_date, db_path=temp_db)
    t1_id = t1["id"]
    t2_id = t2["id"]
    database.update_task_status(t1_id, status="completed", db_path=temp_db)

    # Initial stats: 1 of 2 completed = 50%
    stats_before = database.get_productivity_stats(target_date, db_path=temp_db)
    day_stat = next(d for d in stats_before["weekly"]["days"] if d["date"] == target_date)
    assert day_stat["total"] == 2
    assert day_stat["completed"] == 1
    assert day_stat["completion_rate"] == 50.0

    # Step 2: Seal the day (like Evening Debrief does)
    seal = database.seal_day(
        target_date,
        completion_rate=50.0,
        total_tasks=2,
        completed_tasks=1,
        retro_notes="Good focus session today.",
        db_path=temp_db
    )
    assert seal["is_sealed"] is True
    assert database.is_day_sealed(target_date, db_path=temp_db) is True

    # Step 3: Simulate task rollover to tomorrow
    conn = database.get_connection(temp_db)
    conn.execute("UPDATE tasks SET due_date = '2026-10-09' WHERE id = ?", (t2_id,))
    conn.commit()

    # Productivity stats for the sealed day must remain 50.0% (not jump to 100%!)
    stats_sealed = database.get_productivity_stats(target_date, db_path=temp_db)
    day_stat_sealed = next(d for d in stats_sealed["weekly"]["days"] if d["date"] == target_date)
    assert day_stat_sealed["completion_rate"] == 50.0
    assert day_stat_sealed["total"] == 2
    assert day_stat_sealed["completed"] == 1

    # Step 4: Verify API blocks mutating sealed day
    with TestClient(app) as client:
        client.post("/api/auth/login", json={"pin": "1234"})

        # Seal status endpoint
        res = client.get(f"/api/debrief/seal-status?date={target_date}")
        assert res.status_code == 200
        assert res.json()["is_sealed"] is True
        assert res.json()["completion_rate"] == 50.0

        # Attempting to edit t1 on sealed day via API returns 403 Forbidden
        edit_res = client.patch(f"/api/tasks/{t1_id}", json={"title": "Hacked Title"})
        assert edit_res.status_code == 403
        assert "sealed" in edit_res.json()["detail"].lower()

        # Attempting to create new task on sealed day returns 403 Forbidden
        create_res = client.post("/api/tasks", json={"title": "Late Task", "due_date": target_date})
        assert create_res.status_code == 403
        assert "sealed" in create_res.json()["detail"].lower()


