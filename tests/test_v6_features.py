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

    # Wee hours test (hour 2:00 AM - 00:00 to 06:00)
    wee_hours = daily_intel.filter_phrases_for_diurnal_window(test_lines, client_hour=2)
    for p in wee_hours:
        lower = p.lower()
        assert "start strong" not in lower
        assert "first coffee" not in lower
        assert "good morning" not in lower
        assert "midday boost" not in lower
        assert "afternoon sprint" not in lower
    assert any("wee hours" in p.lower() or "small hours" in p.lower() or "dead of night" in p.lower() or "stillness" in p.lower() or "focus" in p.lower() for p in wee_hours)


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

        # Check RAM & memory footprint breakdown
        assert "ram" in data
        ram_info = data["ram"]
        assert "pettr_process" in ram_info
        assert "llm_process" in ram_info
        assert "host_ram" in ram_info
        assert "combined_pettr_ram" in ram_info

        proc_ram = ram_info["pettr_process"]
        assert proc_ram["rss_bytes"] >= 0
        assert "rss_formatted" in proc_ram
        assert "pid" in proc_ram

        llm_ram = ram_info["llm_process"]
        assert "total_ram_bytes" in llm_ram
        assert "status" in llm_ram
        assert "loaded_models" in llm_ram

        host_ram = ram_info["host_ram"]
        assert host_ram["total_bytes"] >= 0
        assert "used_percent" in host_ram

        combined_ram = ram_info["combined_pettr_ram"]
        assert combined_ram["total_bytes"] == proc_ram["rss_bytes"] + llm_ram["total_ram_bytes"]
        assert "formatted" in combined_ram

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
    """Verify typewriter phrases are substantive, articulate, single-line complete thoughts."""
    from backend import daily_intel
    import datetime

    today = datetime.date.today()
    for hour in [8, 14, 20, 23, 1, 3]:
        phrases = daily_intel.get_curated_phrases(today, "Hong Rong", client_hour=hour)
        assert len(phrases) >= 5
        # Check that phrases are single-line complete thoughts (between 30 and 46 characters)
        for p in phrases:
            assert len(p) >= 30, f"Phrase too short: {p}"
            assert len(p) <= 46, f"Phrase too long (must fit on single line <= 46 chars): {p}"
        # Average length should be comfortably in the articulate 36-43 character range
        avg_len = sum(len(p) for p in phrases) / len(phrases)
        assert avg_len >= 36, f"Average phrase length too low: {avg_len}"


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


def test_auto_tracking_daily_metrics_without_manual_debrief(temp_db, monkeypatch):
    """Test that daily metrics are tracked for each active day without requiring a manual debrief seal."""
    monkeypatch.setattr(database, "DEFAULT_DB_PATH", temp_db)

    today = datetime.date.today().isoformat()
    yesterday = (datetime.date.today() - datetime.timedelta(days=1)).isoformat()
    two_days_ago = (datetime.date.today() - datetime.timedelta(days=2)).isoformat()

    # Day 1 (two days ago): 2 tasks (2 completed = 100%)
    t1 = database.create_task("Task 1 Day -2", tier="focus", due_date=f"{two_days_ago} 10:00:00", db_path=temp_db)
    t2 = database.create_task("Task 2 Day -2", tier="trivial", due_date=f"{two_days_ago} 12:00:00", db_path=temp_db)
    database.update_task_status(t1["id"], "completed", db_path=temp_db)
    database.update_task_status(t2["id"], "completed", db_path=temp_db)

    # Day 2 (yesterday): 2 tasks (1 completed, 1 pending = 50%)
    t3 = database.create_task("Task 3 Day -1", tier="focus", due_date=f"{yesterday} 09:00:00", db_path=temp_db)
    t4 = database.create_task("Task 4 Day -1", tier="trivial", due_date=f"{yesterday} 15:00:00", db_path=temp_db)
    database.update_task_status(t3["id"], "completed", db_path=temp_db)

    # Day 3 (today): 1 task pending
    database.create_task("Task 5 Today", tier="focus", due_date=f"{today} 14:00:00", db_path=temp_db)

    # User never hit debrief to seal any of these days
    assert database.is_day_sealed(two_days_ago, db_path=temp_db) is False
    assert database.is_day_sealed(yesterday, db_path=temp_db) is False
    assert database.is_day_sealed(today, db_path=temp_db) is False

    # Check storage breakdown API
    with TestClient(app) as client:
        client.post("/api/auth/login", json={"pin": "1234"})
        res = client.get("/api/system/storage")
        assert res.status_code == 200
        data = res.json()
        counts = data["database"]["counts"]

        # All 3 days must be tracked in daily metric seals!
        assert counts["day_seals_metrics"] == 3
        assert counts["day_seals_manual"] == 0

    # Verify individual tracked metrics in day_seals
    seal_day2 = database.get_day_seal(two_days_ago, db_path=temp_db)
    assert seal_day2 is not None
    assert seal_day2["completion_rate"] == 100
    assert seal_day2["completed_tasks"] == 2
    assert seal_day2["total_tasks"] == 2
    assert seal_day2["is_sealed"] is False

    seal_day1 = database.get_day_seal(yesterday, db_path=temp_db)
    assert seal_day1 is not None
    assert seal_day1["completion_rate"] == 50
    assert seal_day1["completed_tasks"] == 1
    assert seal_day1["total_tasks"] == 2
    assert seal_day1["is_sealed"] is False

    # Now manually seal yesterday via seal_day
    database.seal_day(yesterday, completion_rate=50, total_tasks=2, completed_tasks=1, retro_notes="Solid day", db_path=temp_db)
    assert database.is_day_sealed(yesterday, db_path=temp_db) is True

    # Recheck storage counts: total tracked remains 3, manual is 1
    storage_info = database.get_storage_breakdown(db_path=temp_db)
    counts2 = storage_info["database"]["counts"]
    assert counts2["day_seals_metrics"] == 3
    assert counts2["day_seals_manual"] == 1


def test_manual_creation_locked_on_sealed_and_past_days(temp_db, monkeypatch):
    """Verifies backend API blocks task, event, and reminder creation on sealed days, and frontend elements are configured."""
    monkeypatch.setattr(database, "DEFAULT_DB_PATH", temp_db)

    sealed_date = (datetime.date.today() - datetime.timedelta(days=2)).strftime("%Y-%m-%d")
    database.seal_day(sealed_date, completion_rate=100, total_tasks=3, completed_tasks=3, db_path=temp_db)
    assert database.is_day_sealed(sealed_date, db_path=temp_db) is True

    with TestClient(app) as client:
        client.post("/api/auth/login", json={"pin": "1234"})

        # 1. Attempt creating task on sealed day -> 403
        t_res = client.post("/api/tasks", json={
            "title": "Attempted Task",
            "due_date": f"{sealed_date} 14:00:00",
            "tier": "focus"
        })
        assert t_res.status_code == 403
        assert "sealed" in t_res.json()["detail"].lower()

        # 2. Attempt creating event on sealed day -> 403
        e_res = client.post("/api/events", json={
            "title": "Attempted Event",
            "start_time": f"{sealed_date} 10:00:00",
            "end_time": f"{sealed_date} 11:00:00"
        })
        assert e_res.status_code == 403
        assert "sealed" in e_res.json()["detail"].lower()

        # 3. Attempt creating reminder on sealed day -> 403
        r_res = client.post("/api/reminders", json={
            "title": "Attempted Reminder",
            "reminder_date": f"{sealed_date} 09:00:00"
        })
        assert r_res.status_code == 403
        assert "sealed" in r_res.json()["detail"].lower()

    # 4. Verify frontend template and scripts have the lock protection
    html_content = Path("frontend/index.html").read_text(encoding="utf-8")
    assert 'id="directEntryBtn"' in html_content
    assert 'id="manualAddEventBtn"' in html_content
    assert 'id="manualAddProjectBtn"' in html_content
    assert 'id="manualAddFocusBtn"' in html_content
    assert 'id="manualAddTrivialBtn"' in html_content
    assert 'id="manualAddReminderBtn"' in html_content

    dash_content = Path("frontend/js/dashboard.js").read_text(encoding="utf-8")
    assert "updateManualCreationButtonsState" in dash_content
    assert "openManualCreateModal(defaultType = \"focus\")" in dash_content
    assert "if (this.isPastDay())" in dash_content


def test_multiple_priority_lists_across_different_dates(temp_db, monkeypatch):
    """Verifies creating priority lists on different dates preserves both lists without cross-date wiping."""
    monkeypatch.setattr(database, "DEFAULT_DB_PATH", temp_db)

    today = datetime.date.today().strftime("%Y-%m-%d")
    tomorrow = (datetime.date.today() + datetime.timedelta(days=1)).strftime("%Y-%m-%d")
    in_three_days = (datetime.date.today() + datetime.timedelta(days=3)).strftime("%Y-%m-%d")

    # 1. Create tasks for each day
    t_today = database.create_task("Today Deep Work", tier="focus", due_date=f"{today} 10:00:00", db_path=temp_db)
    t_tomorrow = database.create_task("Tomorrow Prep", tier="focus", due_date=f"{tomorrow} 11:00:00", db_path=temp_db)
    t_future = database.create_task("Future Sprint Item", tier="focus", due_date=f"{in_three_days} 14:00:00", db_path=temp_db)

    with TestClient(app) as client:
        client.post("/api/auth/login", json={"pin": "1234"})

        # 2. Save priority order for today
        res1 = client.post("/api/daily-order", json={
            "date": today,
            "order": [{"id": t_today["id"], "type": "task", "title": "Today Deep Work", "completed": False}]
        })
        assert res1.status_code == 200

        # 3. Hop over to tomorrow and save a priority list there
        res2 = client.post("/api/daily-order", json={
            "date": tomorrow,
            "order": [{"id": t_tomorrow["id"], "type": "task", "title": "Tomorrow Prep", "completed": False}]
        })
        assert res2.status_code == 200

        # 4. Hop over to in_three_days and save a priority list there
        res3 = client.post("/api/daily-order", json={
            "date": in_three_days,
            "order": [{"id": t_future["id"], "type": "task", "title": "Future Sprint Item", "completed": False}]
        })
        assert res3.status_code == 200

        # 5. Hop back to today -> today's priority list must NOT be wiped!
        res_today = client.get(f"/api/daily-order?date={today}")
        assert res_today.status_code == 200
        today_order = res_today.json()["order"]
        assert len(today_order) == 1
        assert today_order[0]["id"] == t_today["id"]

        # 6. Hop to tomorrow -> tomorrow's priority list must NOT be wiped!
        res_tom = client.get(f"/api/daily-order?date={tomorrow}")
        assert res_tom.status_code == 200
        tom_order = res_tom.json()["order"]
        assert len(tom_order) == 1
        assert tom_order[0]["id"] == t_tomorrow["id"]

        # 7. Hop to in_three_days -> future priority list must NOT be wiped!
        res_fut = client.get(f"/api/daily-order?date={in_three_days}")
        assert res_fut.status_code == 200
        fut_order = res_fut.json()["order"]
        assert len(fut_order) == 1
        assert fut_order[0]["id"] == t_future["id"]

    # 8. Check frontend dashboard code guarantees date-isolated state
    dash_code = Path("frontend/js/dashboard.js").read_text(encoding="utf-8")
    assert "switchSelectedDate" in dash_code
    assert "dailyOrderDate" in dash_code
    assert "this.dailyOrderDate && this.dailyOrderDate !== this.selectedDate" in dash_code
    assert "this.loadDailyOrder()" in dash_code


def test_llm_ping_offline_and_online_clarity(temp_db, monkeypatch):
    """Test /api/llm/test returns status, is_model_online, latency, and sample result."""
    monkeypatch.setattr(database, "DEFAULT_DB_PATH", temp_db)

    with TestClient(app) as client:
        client.post("/api/auth/login", json={"pin": "1234"})

        # 1. When Ollama is offline (default on CI / local without Ollama process)
        res = client.post("/api/llm/test")
        assert res.status_code == 200
        data = res.json()
        assert data["status"] == "success"
        assert "engine" in data
        assert "is_model_online" in data
        assert isinstance(data["latency_ms"], int)
        assert data["latency_ms"] >= 0
        assert data["sample_result"]["title"] == "Schedule engineering sprint review tomorrow at 14:00"
        assert data["sample_result"]["entity_type"] == "task"

    # 2. Verify frontend displays clear offline explanation instead of deceiving green
    app_js = Path("frontend/js/app.js").read_text(encoding="utf-8")
    assert "Local LLM is Offline" in app_js
    assert "Deterministic Regex Engine" in app_js
    assert "ollama serve" in app_js


def test_overdue_tasks_persist_in_daily_order_and_tagged_overdue(temp_db, monkeypatch):
    """Test that tasks due on a previous day are not pruned from daily order and are tagged OVERDUE."""
    monkeypatch.setattr(database, "DEFAULT_DB_PATH", temp_db)

    today = datetime.date.today().isoformat()
    yesterday = (datetime.date.today() - datetime.timedelta(days=1)).isoformat()
    tomorrow = (datetime.date.today() + datetime.timedelta(days=1)).isoformat()

    # 1. Create a task that was due yesterday and is still pending
    overdue_task = database.create_task(
        title="Fix telemetry data parser",
        tier="focus",
        due_date=f"{yesterday} 18:00:00",
        db_path=temp_db
    )
    overdue_id = overdue_task["id"]

    # 2. Verify get_tasks_for_day on today fetches it with is_overdue=True
    tasks_today = database.get_tasks_for_day(datetime.date.today(), db_path=temp_db)
    all_today = tasks_today["focus"] + tasks_today["trivial"]
    found_task = next((t for t in all_today if t["id"] == overdue_id), None)
    assert found_task is not None
    assert found_task["is_overdue"] is True
    assert found_task["is_rolled_over"] is True

    # 3. Add overdue task to today's daily order
    database.save_daily_order(today, [{"id": overdue_id, "type": "task", "title": "Fix telemetry data parser", "tier": "focus"}], db_path=temp_db)

    # 4. Fetch daily order for today -> overdue task must NOT be pruned!
    order_today = database.get_daily_order(today, db_path=temp_db)
    assert len(order_today) == 1
    assert order_today[0]["id"] == overdue_id
    assert order_today[0]["is_overdue"] is True

    # 5. Test automatic rollover from yesterday:
    # Create another task in yesterday's daily order
    task_yest = database.create_task(
        title="Unfinished yesterday report",
        tier="focus",
        due_date=f"{yesterday} 12:00:00",
        db_path=temp_db
    )
    database.save_daily_order(yesterday, [{"id": task_yest["id"], "type": "task", "title": "Unfinished yesterday report"}], db_path=temp_db)

    # Clear today's order in daily_orders to simulate a fresh day opening
    conn = database.get_connection(temp_db)
    with conn:
        conn.execute("DELETE FROM daily_orders WHERE date = ?", (today,))

    # Now get_daily_order(today) should automatically roll over unfinished tasks from yesterday!
    rolled_order = database.get_daily_order(today, db_path=temp_db)
    assert len(rolled_order) >= 1
    assert any(it["id"] == task_yest["id"] and it.get("is_overdue") is True for it in rolled_order)

    # 6. Verify moving a task to tomorrow still prunes it from today
    database.reclassify_entity(
        from_type="task",
        from_id=task_yest["id"],
        to_type="task",
        title="Unfinished yesterday report",
        due_date=f"{tomorrow} 15:00:00",
        db_path=temp_db
    )
    pruned_order = database.get_daily_order(today, db_path=temp_db)
    assert not any(it["id"] == task_yest["id"] for it in pruned_order)

    # 7. Check UI files for OVERDUE tag rendering
    dash_code = Path("frontend/js/dashboard.js").read_text(encoding="utf-8")
    assert "OVERDUE" in dash_code
    assert "is_overdue" in dash_code
    simplified_code = Path("frontend/js/simplified_mode.js").read_text(encoding="utf-8")
    assert "OVERDUE" in simplified_code
    assert "is_overdue" in simplified_code

def test_resolve_best_model_aliases():
    """Verify smart model tag matching and fallback logic."""
    from backend.parser.llm_classifier import resolve_best_model

    # 1. Exact match
    assert resolve_best_model("llama3.2:3b", ["llama3.2:3b", "llama3.2:latest"]) == "llama3.2:3b"

    # 2. Server has llama3.2:latest, PETTR default is llama3.2:3b -> resolves to llama3.2:latest
    assert resolve_best_model("llama3.2:3b", ["llama3.2:latest"]) == "llama3.2:latest"

    # 3. Server has llama3.2:3b, user requests llama3.2:latest -> resolves to llama3.2:3b
    assert resolve_best_model("llama3.2:latest", ["llama3.2:3b"]) == "llama3.2:3b"

    # 4. Untagged requested name matches installed :latest or :tag
    assert resolve_best_model("llama3.2", ["llama3.2:latest"]) == "llama3.2:latest"
    assert resolve_best_model("qwen2.5", ["qwen2.5:3b"]) == "qwen2.5:3b"

    # 5. Fuzzy match on model family
    assert resolve_best_model("llama3.2:3b", ["llama3.1:8b"]) == "llama3.1:8b"

    # 6. Fallback to first available model if family is different
    assert resolve_best_model("llama3.2:3b", ["mistral:7b"]) == "mistral:7b"

    # 7. Empty available list preserves requested model
    assert resolve_best_model("llama3.2:3b", []) == "llama3.2:3b"

def test_llm_select_accessible_from_non_host_client(tmp_path, monkeypatch):
    """Verify authenticated non-host clients (e.g. mobile/Tailscale) can switch models without 403."""
    import config.config as cfg_mod
    test_cfg = tmp_path / "test_cfg.json"
    cfg = cfg_mod.get_or_create_config(test_cfg)
    monkeypatch.setattr(cfg_mod, "DEFAULT_CONFIG_PATH", test_cfg)

    with TestClient(app) as client:
        # 1. Login to get session cookie
        login_res = client.post("/api/auth/login", json={"pin": "1234"})
        assert login_res.status_code == 200

        # 2. Call /api/llm/select from non-host client IP (Tailscale / LAN IP)
        res = client.post(
            "/api/llm/select",
            json={"model": "llama3.2:latest"},
            headers={"x-forwarded-for": "100.64.0.5"} # Remote client IP
        )
        assert res.status_code == 200
        data = res.json()
        assert data["status"] == "success"
        assert data["active_model"] == "llama3.2:latest"

        # Verify persisted in config
        saved = cfg_mod.get_or_create_config(test_cfg)
        assert saved["ollama_model"] == "llama3.2:latest"

def test_overdue_snapshot_time_marker_distinction(temp_db, monkeypatch):
    """Verify overdue tasks in snapshot briefing receive distinct relative time markers from today's items."""
    monkeypatch.setattr(database, "DEFAULT_DB_PATH", temp_db)
    today = datetime.date.today()
    yesterday = today - datetime.timedelta(days=1)
    two_days_ago = today - datetime.timedelta(days=2)

    # 1. Create a task due today at 09:00
    t_today = database.create_task(
        "Current sprint standup",
        tier="focus",
        due_date=f"{today.isoformat()} 09:00:00",
        db_path=temp_db
    )

    # 2. Create an overdue task due yesterday at 09:00
    t_yest = database.create_task(
        "Unfinished yesterday analysis",
        tier="focus",
        due_date=f"{yesterday.isoformat()} 09:00:00",
        db_path=temp_db
    )

    # 3. Create an overdue task due two days ago without specific time
    t_older = database.create_task(
        "Older overdue report",
        tier="trivial",
        due_date=f"{two_days_ago.isoformat()} 00:00:00",
        db_path=temp_db
    )

    # 4. Fetch rich text briefing for today
    briefing_md = database.get_rich_text_briefing(today, db_path=temp_db)
    
    # Normal today task should just say Due 09:00
    assert "Current sprint standup — Due 09:00" in briefing_md

    # Overdue task from yesterday must NOT be misleadingly labeled as Due 09:00; it must say Due Yesterday @ 09:00
    assert "[OVERDUE] Unfinished yesterday analysis — Due Yesterday @ 09:00" in briefing_md

    # Older overdue item must have [OVERDUE] and indicate the previous date
    assert "[OVERDUE] Older overdue report" in briefing_md
    assert two_days_ago.strftime("%b %d") in briefing_md

    # 5. Check frontend code for formatSnapshotTimeMarker and distinct overdue time markers
    dash_code = Path("frontend/js/dashboard.js").read_text(encoding="utf-8")
    assert "formatSnapshotTimeMarker" in dash_code
    assert "${relativeDay} @ ${milTime}" in dash_code
    assert "Due ${relativeDay}" in dash_code


@pytest.mark.anyio
async def test_horace_persona_instructions_and_context(temp_db, monkeypatch):
    """Verify Horace persona instructions contain required traits, little brother relationship, and telemetry context."""
    from backend import horace

    monkeypatch.setattr(database, "DEFAULT_DB_PATH", temp_db)

    # Check persona instructions
    prompt = horace.HORACE_BASE_SYSTEM_PROMPT
    assert "Horace" in prompt
    assert "little brother" in prompt
    assert "PETTR" in prompt
    assert "Hong Rong" in prompt
    assert "witty" in prompt.lower()
    assert "sarcastic" in prompt.lower()
    assert "vulgar" in prompt.lower() or "profanity" in prompt.lower()
    assert "Priority Tasking" in prompt

    # Create dummy active project and task to test telemetry injection
    database.create_project(name="Hyperion-1", category="External", db_path=temp_db)
    today_str = datetime.date.today().isoformat()
    database.create_task(title="Calibrate gyroscopes", tier="focus", due_date=f"{today_str} 10:00:00", db_path=temp_db)

    telemetry = horace.build_live_telemetry_context(db_path=temp_db)
    assert "Horace" in telemetry
    assert "Hyperion-1" in telemetry
    assert "Calibrate gyroscopes" in telemetry
    assert "Server Host Node:" in telemetry
    assert "Host Storage:" in telemetry
    assert "SQLite Database:" in telemetry

    # Verify custom user persona adaptation works dynamically for any user
    custom_prompt = horace.get_horace_system_prompt("Sarah")
    assert "running PETTR for Sarah" in custom_prompt
    assert "Sarah dumps total chaos" in custom_prompt


@pytest.mark.anyio
async def test_horace_chat_persistence_and_api(temp_db, monkeypatch):
    """Test persistent Horace chat history, database operations, and API endpoints."""
    from backend import horace
    import httpx

    monkeypatch.setattr(database, "DEFAULT_DB_PATH", temp_db)

    # 1. Test database operations
    msg1 = database.save_chat_message(role="user", content="Yo Horace, you online?", db_path=temp_db)
    assert msg1["id"] is not None
    assert msg1["role"] == "user"
    assert msg1["content"] == "Yo Horace, you online?"

    msg2 = database.save_chat_message(role="assistant", content="Always online, Hong Rong. What do you need?", model="llama3.2:latest", db_path=temp_db)
    assert msg2["id"] is not None
    assert msg2["role"] == "assistant"

    history = database.get_chat_history(db_path=temp_db)
    assert len(history) == 2
    assert history[0]["content"] == "Yo Horace, you online?"
    assert history[1]["content"] == "Always online, Hong Rong. What do you need?"

    # 2. Test chat API with mock Ollama response
    async def mock_post(url, *args, **kwargs):
        class MockResp:
            status_code = 200
            def json(self):
                return {
                    "model": "llama3.2:latest",
                    "message": {
                        "role": "assistant",
                        "content": "Of course I'm here. PETTR's running smooth, stop slacking off."
                    }
                }
        return MockResp()

    monkeypatch.setattr(httpx.AsyncClient, "post", mock_post)

    with TestClient(app) as client:
        client.post("/api/auth/login", json={"pin": "1234"})

        # Get history endpoint
        res_hist = client.get("/api/llm/chat/history")
        assert res_hist.status_code == 200
        assert len(res_hist.json()["messages"]) == 2

        # Send new message via chat endpoint
        res_chat = client.post("/api/llm/chat", json={"message": "Roast my task list."})
        assert res_chat.status_code == 200
        chat_data = res_chat.json()
        assert chat_data["status"] == "success"
        assert "stop slacking off" in chat_data["reply"]
        assert chat_data["online"] is True

        # Check history increased
        res_hist2 = client.get("/api/llm/chat/history")
        assert res_hist2.status_code == 200
        hist_msgs = res_hist2.json()["messages"]
        assert len(hist_msgs) == 4
        assert hist_msgs[-2]["role"] == "user"
        assert hist_msgs[-2]["content"] == "Roast my task list."
        assert hist_msgs[-1]["role"] == "assistant"
        assert "stop slacking off" in hist_msgs[-1]["content"]

        # Clear history endpoint
        res_del = client.delete("/api/llm/chat/history")
        assert res_del.status_code == 200

        res_hist_empty = client.get("/api/llm/chat/history")
        assert res_hist_empty.status_code == 200
        assert len(res_hist_empty.json()["messages"]) == 0

    # 3. Verify frontend integration
    index_html = Path("frontend/index.html").read_text(encoding="utf-8")
    assert "horaceToggleBtn" in index_html
    assert "horacePanel" in index_html
    assert "horace_chat.js" in index_html
    assert "Because everything needs an AI agent now" in index_html

    css_content = Path("frontend/css/pettr.css").read_text(encoding="utf-8")
    assert ".horace-panel" in css_content
    assert ".horace-toggle-btn" in css_content
    assert ".horace-msg-bubble" in css_content

    js_content = Path("frontend/js/horace_chat.js").read_text(encoding="utf-8")
    assert "const HoraceChat =" in js_content
    assert "/api/llm/chat" in js_content
    assert "Because everything needs an AI agent now" in js_content


def test_header_clock_visibility_logic_on_tab_switch():
    """Verify that mini clock properly hides when mission clock is visible on dashboard,
    even after switching back and forth between tabs."""
    app_js = Path("frontend/js/app.js").read_text(encoding="utf-8")

    # 1. Verify updateHeaderClockVisibility handles non-dashboard vs dashboard correctly
    assert "updateHeaderClockVisibility()" in app_js
    assert "if (!isDashboard)" in app_js
    assert 'headerClock.classList.add("visible")' in app_js
    assert "isClockInDOM = missionClock.offsetParent !== null" in app_js
    assert "window.scrollY < 80" in app_js

    # 2. Verify switchTab sets targetPane to active BEFORE updating header clock visibility
    switch_tab_idx = app_js.find("switchTab(tabName)")
    assert switch_tab_idx != -1
    switch_tab_code = app_js[switch_tab_idx:switch_tab_idx + 1200]

    active_pane_idx = switch_tab_code.find("targetPane.classList.add(\"active\")")
    clock_call_idx = switch_tab_code.find("this.updateHeaderClockVisibility()")

    assert active_pane_idx != -1, "targetPane.classList.add('active') should be in switchTab"
    assert clock_call_idx != -1, "this.updateHeaderClockVisibility() should be in switchTab"
    assert active_pane_idx < clock_call_idx, "targetPane must be made active before updateHeaderClockVisibility is called"


def test_pettr_and_llm_ram_footprint_integration():
    """Verify that PETTR and local LLM RAM metrics are computed and integrated into the resource footprint panel."""
    # 1. Backend database RAM breakdown computation
    ram_data = database.get_ram_breakdown()
    assert "pettr_process" in ram_data
    assert "llm_process" in ram_data
    assert "host_ram" in ram_data
    assert "combined_pettr_ram" in ram_data

    proc = ram_data["pettr_process"]
    assert proc["pid"] > 0
    assert proc["rss_bytes"] > 0
    assert "MB" in proc["rss_formatted"] or "KB" in proc["rss_formatted"] or "B" in proc["rss_formatted"]

    llm = ram_data["llm_process"]
    assert "total_ram_bytes" in llm
    assert "status" in llm
    assert isinstance(llm["loaded_models"], list)

    host = ram_data["host_ram"]
    assert host["total_bytes"] > 0
    assert 0 <= host["used_percent"] <= 100

    combined = ram_data["combined_pettr_ram"]
    assert combined["total_bytes"] == proc["rss_bytes"] + llm["total_ram_bytes"]

    # 2. Horace server metrics integration
    from backend import horace
    metrics = horace.get_host_server_metrics()
    assert "pettr_ram" in metrics
    assert "llm_ram" in metrics
    assert metrics["pettr_ram"] != "Unknown"

    telemetry = horace.build_live_telemetry_context()
    assert "PETTR Process RAM:" in telemetry
    assert "Local LLM In-Memory Status:" in telemetry

    # 3. Frontend resource footprint panel integration
    app_js = Path("frontend/js/app.js").read_text(encoding="utf-8")
    assert "procRam = ram.pettr_process" in app_js
    assert "llmRam = ram.llm_process" in app_js
    assert "hostRam = ram.host_ram" in app_js
    assert "combinedRam = ram.combined_pettr_ram" in app_js
    assert "PETTR Process RAM" in app_js
    assert "Active LLM (In-Memory)" in app_js
    assert "Server System RAM" in app_js
    assert "ram-fill" in app_js

    css_content = Path("frontend/css/pettr.css").read_text(encoding="utf-8")
    assert ".storage-progress-bar-fill.ram-fill" in css_content
    assert ".storage-meters-row" in css_content

    html_content = Path("frontend/index.html").read_text(encoding="utf-8")
    assert "PETTR process memory, local LLM RAM allocation" in html_content


def test_horace_tailscale_telemetry_accuracy(monkeypatch):
    """Verify that Horace host server metrics correctly parse network.get_network_status() without false Disconnected reports."""
    from backend import horace, network

    # 1. Mock network status as connected with Tailscale IP
    mock_status = {
        "tailscale_installed": True,
        "connected": True,
        "state": "Running",
        "tailscale_ip": "100.109.253.121",
        "dns_name": "hrsoverpoweredpc.taild56457.ts.net",
        "auth_url": None,
        "hostname": "horace-server",
        "lan_ip": "192.168.1.100",
        "is_container": False,
        "local_url": "http://192.168.1.100:8000",
        "tailscale_url": "http://100.109.253.121:8000"
    }
    monkeypatch.setattr(network, "get_network_status", lambda request=None: mock_status)

    metrics = horace.get_host_server_metrics()
    assert "Connected" in metrics["tailscale"]
    assert "100.109.253.121" in metrics["tailscale"]
    assert "hrsoverpoweredpc" in metrics["tailscale"]
    assert metrics["tailscale"] != "Disconnected"

    telemetry = horace.build_live_telemetry_context()
    assert "Tailscale: Connected (IP: 100.109.253.121" in telemetry
    assert "Tailscale: Disconnected" not in telemetry

    # 2. Test network cache behavior for request heuristics
    network._LAST_TAILSCALE_CACHE = None
    network._LAST_TAILSCALE_CACHE_TIME = 0.0

    class DummyClient:
        host = "100.109.253.50"

    class DummyRequest:
        headers = {"host": "100.109.253.121:8000"}
        client = DummyClient()

    monkeypatch.undo()
    monkeypatch.setattr(network, "_query_tailscale_socket", lambda: None)
    monkeypatch.setattr(network, "_query_tailscale_cli", lambda: None)
    monkeypatch.setattr(network, "_detect_linux_tailscale_interface", lambda: None)
    monkeypatch.delenv("TAILSCALE_IP", raising=False)

    # Calling with dummy request should detect Tailscale and set cache
    req_status = network.get_network_status(request=DummyRequest())
    assert req_status["connected"] is True
    assert req_status["tailscale_ip"] == "100.109.253.121"

    # Subsequent call without request should use cache
    cached_status = network.get_network_status(request=None)
    assert cached_status["connected"] is True
    assert cached_status["tailscale_ip"] == "100.109.253.121"


@pytest.mark.anyio
async def test_horace_quick_menu_and_typewriter_single_line_regeneration(temp_db, monkeypatch):
    """Verify Horace chat has a persistent quick curated questions menu, and typewriter auto-regenerates stale long lines."""
    from backend import daily_intel

    # 1. Verify frontend quick menu structure and scripts
    index_html = Path("frontend/index.html").read_text(encoding="utf-8")
    assert "horace-quick-menu-section" in index_html
    assert "horaceQuickPromptsTray" in index_html
    assert "Server Status" in index_html
    assert "Tailscale & Network" in index_html
    assert "Today's Queue" in index_html
    assert "Pick Focus Task" in index_html
    assert "RAM & LLM Footprint" in index_html
    assert "Roast Backlog" in index_html

    chat_js = Path("frontend/js/horace_chat.js").read_text(encoding="utf-8")
    assert "toggleQuickMenuExpanded" in chat_js
    assert "isQuickMenuExpanded" in chat_js

    css_text = Path("frontend/css/pettr.css").read_text(encoding="utf-8")
    assert ".horace-quick-menu-section" in css_text
    assert ".horace-quick-pill" in css_text
    assert ".greeting-text" in css_text
    assert "clamp(19px, 2.2vw, 26px)" in css_text

    # 2. Test auto-regeneration of stale long typewriter phrases (> 46 chars) in SQLite cache
    monkeypatch.setattr(database, "DEFAULT_DB_PATH", temp_db)
    test_date = "2026-10-10"
    stale_long_phrases = [
        "Cruising altitude reached, Hong Rong - keep the momentum steady through the afternoon sprint.",
        "Working hard or hardly working, Hong Rong? Either way, let's close out that next priority.",
        "Midday checkpoint: resist the urge to context-switch and see this focus block through, Hong Rong."
    ]
    # Manually populate database cache with stale long lines
    database.save_daily_typewriter_cache(
        date_str=test_date,
        phrases=stale_long_phrases,
        subtext="Saturday, October 10 · 💡 Fun fact",
        source="stale_test",
        db_path=temp_db
    )

    # Fetch daily intel without force_refresh - should detect length > 46 and upgrade to single-line phrases
    d_obj = datetime.date(2026, 10, 10)
    intel = await daily_intel.get_or_generate_daily_intel(d_obj, "Hong Rong", force_refresh=False, client_hour=14, db_path=temp_db)
    assert intel["phrases"] is not None
    assert len(intel["phrases"]) >= 3
    for phrase in intel["phrases"]:
        assert len(phrase) <= 46, f"Upgraded phrase still exceeds 46 characters: {phrase}"
        assert "keep the momentum steady through the afternoon sprint" not in phrase

    # Verify SQLite cache was updated with the clean single-line phrases
    cached_after = database.get_daily_typewriter_cache(test_date, db_path=temp_db)
    assert cached_after["source"] == "single_line_upgrade"
    for phrase in cached_after["phrases"]:
        assert len(phrase) <= 46


def test_scratchpad_media_folder_api_and_ui(temp_db, monkeypatch, tmp_path):
    """Verify Notes tab has a dedicated scratchpad media folder with listing, upload, selection, preview, and deletion."""
    monkeypatch.setattr(database, "DEFAULT_DB_PATH", temp_db)
    test_media_dir = tmp_path / "media_folder_test"
    monkeypatch.setattr("backend.app.MEDIA_DIR", test_media_dir)

    with TestClient(app) as client:
        client.post("/api/auth/login", json={"pin": "1234"})

        # 1. Initially empty media folder
        res_list = client.get("/api/notes/media")
        assert res_list.status_code == 200
        assert res_list.json()["count"] == 0
        assert res_list.json()["media"] == []

        # 2. Upload image and audio
        img_bytes = b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR"
        res_up1 = client.post(
            "/api/notes/upload-media",
            files={"file": ("circuit_board.png", io.BytesIO(img_bytes), "image/png")}
        )
        assert res_up1.status_code == 200
        up1_data = res_up1.json()
        assert up1_data["media_type"] == "image"
        safe_name1 = Path(up1_data["url"]).name

        audio_bytes = b"ID3\x03\x00\x00\x00\x00\x00#TSSE"
        res_up2 = client.post(
            "/api/notes/upload-media",
            files={"file": ("meeting_audio.mp3", io.BytesIO(audio_bytes), "audio/mpeg")}
        )
        assert res_up2.status_code == 200
        up2_data = res_up2.json()
        assert up2_data["media_type"] == "audio"
        safe_name2 = Path(up2_data["url"]).name

        # 3. List media folder
        res_list2 = client.get("/api/notes/media")
        assert res_list2.status_code == 200
        data2 = res_list2.json()
        assert data2["count"] == 2
        assert len(data2["media"]) == 2
        filenames = [m["filename"] for m in data2["media"]]
        assert safe_name1 in filenames
        assert safe_name2 in filenames

        # Verify media types
        media_by_name = {m["filename"]: m for m in data2["media"]}
        assert media_by_name[safe_name1]["media_type"] == "image"
        assert media_by_name[safe_name2]["media_type"] == "audio"
        assert "circuit_board" in media_by_name[safe_name1]["display_name"]

        # 4. Delete one media file
        res_del = client.delete(f"/api/notes/media/{safe_name1}")
        assert res_del.status_code == 200
        assert not (test_media_dir / safe_name1).exists()

        # 5. List after deletion
        res_list3 = client.get("/api/notes/media")
        assert res_list3.status_code == 200
        assert res_list3.json()["count"] == 1
        assert res_list3.json()["media"][0]["filename"] == safe_name2

        # 6. Delete non-existent file -> 404
        res_del404 = client.delete("/api/notes/media/non_existent_file.png")
        assert res_del404.status_code == 404

    # 7. Verify frontend templates and scripts contain media folder components
    index_html = Path("frontend/index.html").read_text(encoding="utf-8")
    assert "notes-folder-nav" in index_html
    assert "notesNavMediaBtn" in index_html
    assert "notesMediaFiltersSection" in index_html
    assert "notesMediaFolderCard" in index_html
    assert "notesMediaGrid" in index_html
    assert "notesMediaLightboxModal" in index_html
    assert "browse-media-btn" in index_html

    notes_js = Path("frontend/js/notes.js").read_text(encoding="utf-8")
    assert "switchView" in notes_js
    assert "loadMediaList" in notes_js
    assert "selectMediaForNote" in notes_js
    assert "openMediaLightbox" in notes_js
    assert "confirmDeleteMedia" in notes_js

    css_text = Path("frontend/css/pettr.css").read_text(encoding="utf-8")
    assert ".notes-folder-nav" in css_text
    assert ".notes-media-folder-card" in css_text
    assert ".notes-media-grid" in css_text
    assert ".notes-media-card" in css_text
    assert ".notes-media-lightbox-card" in css_text



