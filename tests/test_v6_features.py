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


def test_diurnal_filter_strips_conflicting_times():
    """Test diurnal filtering removes time-conflicting phrases and supplements appropriate ones."""
    from backend import daily_intel

    test_lines = [
        "Start strong today!",
        "First coffee, then deep work.",
        "Midday boost!",
        "Executing afternoon sprint.",
        "Wrap it up!",
        "Smooth landing for today's sprint."
    ]

    # Afternoon test (hour 14:00)
    afternoon = daily_intel.filter_phrases_for_diurnal_window(test_lines, client_hour=14)
    for p in afternoon:
        lower = p.lower()
        assert "start strong" not in lower
        assert "first coffee" not in lower
        assert "wrap it up" not in lower
        assert "smooth landing" not in lower
    assert any("midday" in p.lower() or "afternoon" in p.lower() for p in afternoon)

    # Morning test (hour 8:00)
    morning = daily_intel.filter_phrases_for_diurnal_window(test_lines, client_hour=8)
    for p in morning:
        lower = p.lower()
        assert "midday boost" not in lower
        assert "afternoon sprint" not in lower
        assert "wrap it up" not in lower
    assert any("start strong" in p.lower() or "first coffee" in p.lower() or "good morning" in p.lower() for p in morning)

    # Evening test (hour 20:00)
    evening = daily_intel.filter_phrases_for_diurnal_window(test_lines, client_hour=20)
    for p in evening:
        lower = p.lower()
        assert "start strong" not in lower
        assert "first coffee" not in lower
        assert "midday boost" not in lower
        assert "afternoon sprint" not in lower
    assert any("wrap it up" in p.lower() or "smooth landing" in p.lower() or "good evening" in p.lower() for p in evening)


def test_cached_mixed_phrases_filtered_by_client_hour(temp_db, monkeypatch):
    """Ensure cache containing mixed-diurnal phrases filters out contradictions when client supplies an hour."""
    from backend import daily_intel
    monkeypatch.setattr(database, "DEFAULT_DB_PATH", temp_db)

    # Save mixed lines in cache
    mixed_lines = [
        "Start strong today!",
        "Midday boost!",
        "Wrap it up!",
        "Focus on core tasks.",
        "Precision engineering craft."
    ]
    database.save_daily_typewriter_cache(
        date_str="2026-10-09",
        phrases=mixed_lines,
        subtext="Friday, October 09 · 💡 1872: Aaron Montgomery Ward test",
        source="llm",
        db_path=temp_db
    )

    # Request with hour=14 (afternoon)
    with TestClient(app) as client:
        client.post("/api/auth/login", json={"pin": "1234"})
        res = client.get("/api/daily-intel?date=2026-10-09&hour=14")
        assert res.status_code == 200
        data = res.json()
        phrases = data["phrases"]
        for p in phrases:
            lower = p.lower()
            assert "start strong" not in lower
            assert "wrap it up" not in lower
        assert any("midday boost" in p.lower() or "cruising" in p.lower() or "focus" in p.lower() for p in phrases)


def test_day_sealing_and_immutable_completion_rate(temp_db, monkeypatch):
    """Test evening debrief seal locks the day's completion rate and blocks further edits."""
    monkeypatch.setattr(database, "DEFAULT_DB_PATH", temp_db)
    target_date = datetime.date.today().isoformat()
    tomorrow_date = (datetime.date.today() + datetime.timedelta(days=1)).isoformat()

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
    conn.execute("UPDATE tasks SET due_date = ? WHERE id = ?", (tomorrow_date, t2_id))
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


def test_convert_task_to_reminder_cleans_priority_order(temp_db, monkeypatch):
    """Test that converting a task to a reminder purges it from daily priority sequences."""
    monkeypatch.setattr(database, "DEFAULT_DB_PATH", temp_db)
    today = datetime.date.today().isoformat()

    # 1. Create a task and add to daily order
    task = database.create_task("Buy lab notebook", tier="trivial", due_date=today, db_path=temp_db)
    task_id = task["id"]
    database.save_daily_order(today, [{"id": task_id, "type": "task", "title": "Buy lab notebook"}], db_path=temp_db)

    order_before = database.get_daily_order(today, db_path=temp_db)
    assert len(order_before) == 1
    assert order_before[0]["id"] == task_id

    # 2. Convert task to reminder
    res = database.reclassify_entity(
        from_type="task",
        from_id=task_id,
        to_type="reminder",
        title="Buy lab notebook",
        due_date=f"{today} 10:00:00",
        db_path=temp_db
    )
    assert res["status"] == "success"
    assert res["entity_type"] == "reminder"

    # 3. Verify task is cleanly purged from daily priority order
    order_after = database.get_daily_order(today, db_path=temp_db)
    assert len(order_after) == 0


def test_project_due_date_persistence(temp_db, monkeypatch):
    """Test that project due dates persist across creation and edits."""
    monkeypatch.setattr(database, "DEFAULT_DB_PATH", temp_db)

    # 1. Create project with due date
    proj = database.create_project(
        name="Capstone Phase 1",
        category="School",
        due_date="2026-10-25 23:59:00",
        db_path=temp_db
    )
    assert proj["due_date"] == "2026-10-25 23:59:00"

    # 2. Edit project due date via reclassify_entity
    updated = database.reclassify_entity(
        from_type="project",
        from_id=proj["id"],
        to_type="project",
        title="Capstone Phase 1 Updated",
        due_date="2026-11-01 17:00:00",
        category="School",
        db_path=temp_db
    )
    assert updated["status"] == "success"
    assert updated["entity"]["due_date"] == "2026-11-01 17:00:00"

    # 3. Re-fetch from DB
    fetched = database.get_entity_detail("project", proj["id"], db_path=temp_db)
    assert fetched["due_date"] == "2026-11-01 17:00:00"


def test_urgency_label_never_urgent(temp_db, monkeypatch):
    """Verify compute_urgency returns Overdue or Upcoming, never 'Urgent'."""
    now = datetime.datetime.now()
    
    # Due in past -> Overdue
    past_due = (now - datetime.timedelta(hours=2)).strftime("%Y-%m-%d %H:%M:%S")
    urgency_past = database.compute_urgency(past_due)
    assert urgency_past["label"] == "Overdue"

    # Due in 12 hours -> Upcoming (not Urgent)
    soon_due = (now + datetime.timedelta(hours=12)).strftime("%Y-%m-%d %H:%M:%S")
    urgency_soon = database.compute_urgency(soon_due)
    assert urgency_soon["label"] == "Upcoming"
    assert urgency_soon["label"] != "Urgent"


@pytest.mark.anyio
async def test_time_only_task_defaults_to_today(temp_db):
    """Verify that inputs with time-only like 'Get compressor model for Jodan 12pm' default to today."""
    ref_now = datetime.datetime(2026, 10, 9, 9, 30, 0)
    user_input = "Get compressor model for Jodan 12pm"
    result = await process_user_input(user_input, ref_datetime=ref_now, db_path=temp_db)

    assert result["status"] == "success"
    assert result["entity_type"] == "task"
    task = result["entity"]
    assert "Get compressor model for Jodan" in task["title"]
    assert "2026-10-09 12:00:00" in task["due_date"]

    # Ensure unorganized queue is empty
    unorg = database.get_unorganized_items(db_path=temp_db)
    assert len(unorg) == 0


def test_complete_overdue_task_allowed(temp_db, monkeypatch):
    """Verify that a pending task with a past due date (overdue) can be checked off and completed today."""
    monkeypatch.setattr(database, "DEFAULT_DB_PATH", temp_db)
    past_date = (datetime.date.today() - datetime.timedelta(days=2)).isoformat()
    t = database.create_task("Fix broken pump", tier="focus", due_date=f"{past_date} 12:00:00", db_path=temp_db)

    with TestClient(app) as client:
        client.post("/api/auth/login", json={"pin": "1234"})
        res = client.patch(f"/api/tasks/{t['id']}", json={"status": "completed"})
        assert res.status_code == 200
        data = res.json()
        assert data["status"] == "success"
        assert data["task"]["status"] == "completed"
        assert data["task"]["completed_at"] is not None


@pytest.mark.anyio
async def test_event_time_range_nlp_parsing(temp_db):
    """Verify natural language parsing for time periods like 4-6pm and auto-classification as event."""
    ref_now = datetime.datetime(2026, 10, 9, 10, 0, 0)

    # 1. With explicit 'Event' prefix
    res1 = await process_user_input("Event Tim's birthday 4-6pm", ref_datetime=ref_now, db_path=temp_db)
    assert res1["status"] == "success"
    assert res1["entity_type"] == "event"
    ev1 = res1["entity"]
    assert "Tim's birthday" in ev1["title"]
    assert "16:00:00" in ev1["start_time"]
    assert "18:00:00" in ev1["end_time"]

    # 2. Without explicit prefix - time period auto-classifies as event
    res2 = await process_user_input("Board meeting 2-4pm", ref_datetime=ref_now, db_path=temp_db)
    assert res2["status"] == "success"
    assert res2["entity_type"] == "event"
    ev2 = res2["entity"]
    assert "Board meeting" in ev2["title"]
    assert "14:00:00" in ev2["start_time"]
    assert "16:00:00" in ev2["end_time"]

    # 3. 24-hour military time range
    res3 = await process_user_input("Hackathon sync 14:00 - 15:30", ref_datetime=ref_now, db_path=temp_db)
    assert res3["status"] == "success"
    assert res3["entity_type"] == "event"
    ev3 = res3["entity"]
    assert "Hackathon sync" in ev3["title"]
    assert "14:00:00" in ev3["start_time"]
    assert "15:30:00" in ev3["end_time"]


def test_event_api_and_reclassify_time_periods(temp_db, monkeypatch):
    """Test manual creation and reclassification of events with start and end times."""
    monkeypatch.setattr(database, "DEFAULT_DB_PATH", temp_db)

    with TestClient(app) as client:
        client.post("/api/auth/login", json={"pin": "1234"})

        # 1. Create event with start and end time via API
        create_res = client.post("/api/events", json={
            "title": "Strategy Workshop",
            "start_time": "2026-10-15 13:00:00",
            "end_time": "2026-10-15 16:30:00",
            "description": "Quarterly roadmap review"
        })
        assert create_res.status_code == 200
        ev_data = create_res.json()["event"]
        assert ev_data["title"] == "Strategy Workshop"
        assert ev_data["start_time"] == "2026-10-15 13:00:00"
        assert ev_data["end_time"] == "2026-10-15 16:30:00"

        # 2. Reclassify / update event end_time
        reclass_res = client.post("/api/entities/reclassify", json={
            "from_type": "event",
            "from_id": ev_data["id"],
            "to_type": "event",
            "title": "Strategy Workshop (Extended)",
            "due_date": "2026-10-15 13:00:00",
            "end_time": "2026-10-15 17:30:00"
        })
        assert reclass_res.status_code == 200
        updated = reclass_res.json()["entity"]
        assert updated["title"] == "Strategy Workshop (Extended)"
        assert updated["start_time"] == "2026-10-15 13:00:00"
        assert updated["end_time"] == "2026-10-15 17:30:00"

        # 3. Convert a task into an event with start and end time
        task = database.create_task("Presentation Prep", tier="focus", db_path=temp_db)
        conv_res = client.post("/api/entities/reclassify", json={
            "from_type": "task",
            "from_id": task["id"],
            "to_type": "event",
            "title": "Presentation Rehearsal",
            "due_date": "2026-10-16 10:00:00",
            "end_time": "2026-10-16 11:30:00"
        })
        assert conv_res.status_code == 200
        conv_ev = conv_res.json()["entity"]
        assert conv_ev["title"] == "Presentation Rehearsal"
        assert conv_ev["start_time"] == "2026-10-16 10:00:00"
        assert conv_ev["end_time"] == "2026-10-16 11:30:00"

        # 4. Check get_events_for_day returns end_time_military
        events_day = database.get_events_for_day(datetime.date(2026, 10, 16), db_path=temp_db)
        assert len(events_day) == 1
        assert events_day[0]["start_time_military"] == "10:00"
        assert events_day[0]["end_time_military"] == "11:30"


def test_completed_tasks_30_day_retention_and_metrics_preservation(temp_db, monkeypatch):
    """
    Test 30-day history retention for completed tasks:
    - Tasks completed > 30 days ago are purged.
    - Day completion metrics are permanently snapshotted into day_seals before purging.
    - Projects stay indefinite (never purged).
    - Monthly productivity stats for past months leverage day_seals metrics.
    """
    monkeypatch.setattr(database, "DEFAULT_DB_PATH", temp_db)
    today = datetime.date.today()
    conn = database.get_connection(temp_db)

    # 1. Create a recent completed task (5 days ago) -> should be kept
    d_recent = (today - datetime.timedelta(days=5)).strftime("%Y-%m-%d")
    t_recent = database.create_task("Recent task", tier="focus", due_date=f"{d_recent} 10:00:00", db_path=temp_db)
    with conn:
        conn.execute("UPDATE tasks SET status = 'completed', completed_at = ? WHERE id = ?", (f"{d_recent} 11:00:00", t_recent["id"]))

    # 2. Create an old completed task (45 days ago) -> should be purged, metrics archived
    d_old1 = (today - datetime.timedelta(days=45)).strftime("%Y-%m-%d")
    t_old1 = database.create_task("Old task 1", tier="focus", due_date=f"{d_old1} 09:00:00", db_path=temp_db)
    with conn:
        conn.execute("UPDATE tasks SET status = 'completed', completed_at = ? WHERE id = ?", (f"{d_old1} 10:00:00", t_old1["id"]))

    # 3. Create another old completed task on same old day (45 days ago)
    t_old2 = database.create_task("Old task 2", tier="trivial", due_date=f"{d_old1} 14:00:00", db_path=temp_db)
    with conn:
        conn.execute("UPDATE tasks SET status = 'completed', completed_at = ? WHERE id = ?", (f"{d_old1} 15:00:00", t_old2["id"]))

    # 4. Create a completed project from 45 days ago -> should REMAIN indefinite!
    p_old = database.create_project("Historical Capstone", category="School", db_path=temp_db)
    database.complete_project(p_old["id"], db_path=temp_db)
    with conn:
        conn.execute("UPDATE projects SET completed_at = ? WHERE id = ?", (f"{d_old1} 12:00:00", p_old["id"]))

    # 5. Check before purge
    tasks_before = conn.execute("SELECT COUNT(*) FROM tasks WHERE status = 'completed'").fetchone()[0]
    assert tasks_before == 3

    # 6. Run purge
    deleted = database.purge_old_completed_tasks(retention_days=30, db_path=temp_db)
    assert deleted == 2

    # 7. Verify remaining completed tasks in tasks table
    remaining_tasks = conn.execute("SELECT id, title FROM tasks WHERE status = 'completed'").fetchall()
    assert len(remaining_tasks) == 1
    assert remaining_tasks[0]["title"] == "Recent task"

    # 8. Verify project was NOT deleted
    p_check = database.get_entity_detail("project", p_old["id"], db_path=temp_db)
    assert p_check is not None
    assert p_check["name"] == "Historical Capstone"
    assert p_check["status"] == "completed"

    # 9. Verify metrics for 45 days ago were permanently preserved in day_seals
    seal = database.get_day_seal(d_old1, db_path=temp_db)
    assert seal is not None
    assert seal["date"] == d_old1
    assert seal["completed_tasks"] == 2
    assert seal["total_tasks"] == 2
    assert seal["completion_rate"] == 100

    # 10. Verify get_history_archive returns only tasks within the 30-day window but indefinite projects
    archive = database.get_history_archive(limit=100, db_path=temp_db)
    assert len(archive["completed_tasks"]) == 1
    assert archive["completed_tasks"][0]["title"] == "Recent task"
    assert len(archive["completed_projects"]) >= 1


def test_server_storage_breakdown_api(temp_db, monkeypatch):
    """Test real-time storage diagnostics API endpoint."""
    monkeypatch.setattr(database, "DEFAULT_DB_PATH", temp_db)

    with TestClient(app) as client:
        # Without auth -> 401
        unauth = client.get("/api/system/storage")
        assert unauth.status_code == 401

        # With auth
        client.post("/api/auth/login", json={"pin": "1234"})
        res = client.get("/api/system/storage")
        assert res.status_code == 200
        data = res.json()

        # Check required breakdown sections
        assert "database" in data
        assert "media" in data
        assert "backups" in data
        assert "app_code" in data
        assert "runtime_env" in data
        assert "llm" in data
        assert "total_app_storage" in data
        assert "disk" in data
        assert "retention_policy" in data

        # Check runtime env
        rt_info = data["runtime_env"]
        assert "size_bytes" in rt_info
        assert "formatted" in rt_info
        assert "python_version" in rt_info

        # Check LLM info
        llm_info = data["llm"]
        assert "total_bytes" in llm_info
        assert "formatted" in llm_info
        assert "model_count" in llm_info
        assert "online" in llm_info
        assert "active_model" in llm_info

        # Check database metrics
        db_info = data["database"]
        assert db_info["total_bytes"] >= 0
        assert "formatted" in db_info
        assert "counts" in db_info
        counts = db_info["counts"]
        assert "tasks_total" in counts
        assert "day_seals_metrics" in counts
        assert "projects_total" in counts

        # Check total app storage breakdown sums
        total_app = data["total_app_storage"]
        assert "breakdown" in total_app
        bd = total_app["breakdown"]
        assert bd["database_bytes"] == db_info["total_bytes"]
        assert bd["runtime_env_bytes"] == rt_info["size_bytes"]
        assert bd["llm_bytes"] == llm_info["total_bytes"]
        assert total_app["size_bytes"] == sum(bd.values())

        # Check disk info
        disk_info = data["disk"]
        assert disk_info["total_bytes"] > 0
        assert disk_info["free_bytes"] > 0
        assert "used_percent" in disk_info

        # Check retention policy description
        assert data["retention_policy"]["completed_tasks_days"] == 30
        assert data["retention_policy"]["projects"] == "Indefinite"


def test_llm_storage_discovery_mocked(tmp_path, monkeypatch):
    """Test LLM storage footprint calculation with mocked model directory and API."""
    mock_models_dir = tmp_path / "ollama_models"
    mock_models_dir.mkdir()
    blob_file = mock_models_dir / "sha256-abc123"
    blob_file.write_bytes(b"x" * 1024 * 1024 * 5)  # 5 MB mock blob

    monkeypatch.setenv("OLLAMA_MODELS", str(mock_models_dir))

    # Test disk fallback calculation
    llm_info = database._get_llm_storage_info(force_refresh=True)
    assert llm_info["total_bytes"] == 1024 * 1024 * 5
    assert "5.00 MB" in llm_info["formatted"]
    assert llm_info["storage_path"] == str(mock_models_dir.resolve())


def test_articulate_typewriter_phrases_length_and_substance():
    """Verify typewriter phrases are substantive, articulate, and allow longer character counts."""
    from backend import daily_intel
    import datetime

    today = datetime.date.today()
    for hour in [8, 14, 20, 1]:
        phrases = daily_intel.get_curated_phrases(today, "Hong Rong", client_hour=hour)
        assert len(phrases) >= 5
        # Check that phrases are substantial sentences rather than tiny 2-word slogans
        for p in phrases:
            assert len(p) >= 30, f"Phrase too short: {p}"
            assert len(p) <= 125, f"Phrase too long: {p}"
        # Average length should be comfortably over 45 characters
        avg_len = sum(len(p) for p in phrases) / len(phrases)
        assert avg_len > 45, f"Average phrase length too low: {avg_len}"


def test_daily_order_pruned_when_due_date_moves_to_another_day(temp_db, monkeypatch):
    """Test that moving a task's due date to another day removes it from the daily order sequence."""
    monkeypatch.setattr(database, "DEFAULT_DB_PATH", temp_db)

    today = datetime.date.today().isoformat()
    tomorrow = (datetime.date.today() + datetime.timedelta(days=1)).isoformat()

    # 1. Create a task due today
    task1 = database.create_task(
        title="Task Moving Via Patch",
        tier="focus",
        due_date=f"{today} 14:00:00",
        db_path=temp_db
    )
    task1_id = task1["id"]

    # 2. Add task1 to today's daily order
    order_items = [
        {"id": task1_id, "type": "task", "title": "Task Moving Via Patch", "tier": "focus"}
    ]
    database.save_daily_order(today, order_items, db_path=temp_db)

    # Verify task is currently in today's daily order
    cur_order = database.get_daily_order(today, db_path=temp_db)
    assert any(it["id"] == task1_id for it in cur_order)

    # 3. Update task due date to tomorrow via PATCH endpoint
    with TestClient(app) as client:
        client.post("/api/auth/login", json={"pin": "1234"})
        res = client.patch(f"/api/tasks/{task1_id}", json={"due_date": f"{tomorrow} 10:00:00"})
        assert res.status_code == 200

        # Verify today's daily order no longer contains task1
        res_today = client.get(f"/api/daily-order?date={today}")
        assert res_today.status_code == 200
        today_order = res_today.json()["order"]
        assert not any(it["id"] == task1_id for it in today_order)

    # 4. Test reclassify_entity (used by EntityModal)
    task2 = database.create_task(
        title="Task Moving Via Reclassify",
        tier="focus",
        due_date=f"{today} 16:00:00",
        db_path=temp_db
    )
    task2_id = task2["id"]
    database.save_daily_order(today, [{"id": task2_id, "type": "task", "title": "Task Moving Via Reclassify"}], db_path=temp_db)

    cur_order2 = database.get_daily_order(today, db_path=temp_db)
    assert any(it["id"] == task2_id for it in cur_order2)

    database.reclassify_entity(
        from_type="task",
        from_id=task2_id,
        to_type="task",
        title="Task Moving Via Reclassify",
        due_date=f"{tomorrow} 16:00:00",
        db_path=temp_db
    )

    today_order2 = database.get_daily_order(today, db_path=temp_db)
    assert not any(it["id"] == task2_id for it in today_order2)







