import pytest
import datetime
from pathlib import Path
from fastapi.testclient import TestClient

from backend import database
from backend.app import app
from backend.parser.pipeline import process_user_input

@pytest.fixture
def temp_db(tmp_path):
    db_file = tmp_path / "v5_test.sqlite"
    database.init_db(db_file)
    return db_file

def test_project_category_and_stats(temp_db):
    """Test School vs External categories and exploded view pool statistics."""
    p_school = database.create_project("Aerospace Propulsion", category="School", db_path=temp_db)
    assert p_school["category"] == "School"

    p_ext = database.create_project("Personal Blog Redesign", category="External", db_path=temp_db)
    assert p_ext["category"] == "External"

    # Default category should be External
    p_def = database.create_project("Home Lab Setup", db_path=temp_db)
    assert p_def["category"] == "External"

    # Exploded view statistics
    exploded = database.get_exploded_view(db_path=temp_db)
    stats = exploded.get("stats", {})
    assert stats["total_projects"] == 3
    assert stats["school_count"] == 1
    assert stats["external_count"] == 2

def test_delete_project_api(temp_db, monkeypatch):
    """Test DELETE /api/projects/{id} removes the project and unlinks tasks."""
    monkeypatch.setattr(database, "DEFAULT_DB_PATH", temp_db)

    # Create project and task
    p = database.create_project("Obsolete Project", db_path=temp_db)
    t = database.create_task("Subtask 1", project_name="Obsolete Project", db_path=temp_db)
    assert t["project_id"] == p["id"]

    with TestClient(app) as client:
        # Authenticate
        client.post("/api/auth/login", json={"pin": "1234"})

        # Delete project
        res = client.delete(f"/api/projects/{p['id']}")
        assert res.status_code == 200
        data = res.json()
        assert data["success"] is True

    # Verify project is deleted
    conn = database.get_connection(temp_db)
    row = conn.execute("SELECT * FROM projects WHERE id = ?", (p["id"],)).fetchone()
    assert row is None

    # Verify task was unlinked rather than corrupted
    task_row = conn.execute("SELECT * FROM tasks WHERE id = ?", (t["id"],)).fetchone()
    assert task_row is not None
    assert task_row["project_id"] is None

def test_untaken_color_assignment(temp_db):
    """Test that projects get assigned untaken colors from palette."""
    p1 = database.create_project("Project One", db_path=temp_db)
    p2 = database.create_project("Project Two", db_path=temp_db)
    
    assert p1["color"] is not None
    assert p2["color"] is not None
    assert p1["color"].startswith("#")
    assert p2["color"].startswith("#")
    # Both should get distinct untaken colors
    assert p1["color"] != p2["color"]

@pytest.mark.anyio
async def test_compound_nlp_project_and_task(temp_db):
    """Test smart compound command: New project: 'CALYPSO-2', add first task due today at 9: Draft user journey map."""
    # Set reference time to 14:00 (so 9 without am/pm must be upcoming 9pm = 21:00)
    ref_now = datetime.datetime(2026, 10, 6, 14, 0, 0)
    user_input = "New project: 'CALYPSO-2', add first task due today at 9: Draft user journey map"

    result = await process_user_input(user_input, ref_datetime=ref_now, db_path=temp_db)
    assert result["status"] == "success"

    # Verify project CALYPSO-2 was created
    conn = database.get_connection(temp_db)
    proj = conn.execute("SELECT * FROM projects WHERE name = 'CALYPSO-2'").fetchone()
    assert proj is not None

    # Verify task was attached to CALYPSO-2 and scheduled for 21:00 (9 PM)
    tasks = conn.execute("SELECT * FROM tasks WHERE project_id = ?", (proj["id"],)).fetchall()
    assert len(tasks) == 1
    task = tasks[0]
    assert "Draft user journey map" in task["title"]
    assert "21:00:00" in task["due_date"]

@pytest.mark.anyio
async def test_natural_language_project_task_no_date(temp_db):
    """Test natural language logging: 'Project iDeA-1 new task purchase esp32' creates task under project without routing to unorganized."""
    # Pre-create project iDeA-1
    database.create_project("iDeA-1", category="External", db_path=temp_db)

    # User command: "Project iDeA-1 new task purchase esp32"
    user_input = "Project iDeA-1 new task purchase esp32"
    result = await process_user_input(user_input, db_path=temp_db)

    assert result["status"] == "success"
    assert result["entity_type"] == "task"

    conn = database.get_connection(temp_db)
    proj = conn.execute("SELECT * FROM projects WHERE name = 'iDeA-1'").fetchone()
    assert proj is not None

    tasks = conn.execute("SELECT * FROM tasks WHERE project_id = ?", (proj["id"],)).fetchall()
    assert len(tasks) == 1
    task = tasks[0]
    # Cleaned task title should be 'purchase esp32'
    assert task["title"].lower().strip() == "purchase esp32"
    # Project task should not be forced into unorganized queue even without a due date
    unorg = conn.execute("SELECT * FROM unorganized_queue WHERE status = 'pending'").fetchall()
    assert len(unorg) == 0

def test_unorganized_triage_defaults_to_today_and_locks_past(temp_db, monkeypatch):
    """Verify that triaging unorganized items defaults to today's date and locks historical past days."""
    monkeypatch.setattr(database, "DEFAULT_DB_PATH", temp_db)
    from backend import auth
    token = auth.record_successful_login("testclient")
    client = TestClient(app)
    headers = {"Authorization": f"Bearer {token}"}

    # 1. Add item to unorganized queue with no date
    unorg_item = database.add_to_unorganized_queue(
        raw_input="buy safety glasses for workshop",
        suggested_type="task",
        suggested_tier="focus",
        db_path=temp_db
    )
    assert unorg_item["id"] is not None

    # 2. Resolve via API without providing due_date (e.g. clicking Focus button on dashboard)
    res = client.post(
        f"/api/unorganized/{unorg_item['id']}/resolve",
        headers=headers,
        json={
            "entity_type": "task",
            "tier": "focus",
            "title": "buy safety glasses for workshop"
        }
    )
    assert res.status_code == 200
    created = res.json()["entity"]
    today_str = datetime.date.today().strftime("%Y-%m-%d")
    assert today_str in created["due_date"]

    # Verify task appears in get_tasks_for_day for today
    today_tasks = database.get_tasks_for_day(datetime.date.today(), db_path=temp_db)
    focus_titles = [t["title"] for t in today_tasks["focus"]]
    assert "buy safety glasses for workshop" in focus_titles

    # 3. Add second unorganized item with a past parsed date (e.g. yesterday)
    yesterday = datetime.date.today() - datetime.timedelta(days=1)
    unorg_item_past = database.add_to_unorganized_queue(
        raw_input="overdue errand from yesterday",
        parsed_date=f"{yesterday} 10:00:00",
        db_path=temp_db
    )

    # 4. Resolve it - historical lock should protect yesterday and route to today
    res2 = client.post(
        f"/api/unorganized/{unorg_item_past['id']}/resolve",
        headers=headers,
        json={
            "entity_type": "task",
            "tier": "focus",
            "title": "overdue errand from yesterday"
        }
    )
    assert res2.status_code == 200
    created2 = res2.json()["entity"]
    assert today_str in created2["due_date"]
    assert str(yesterday) not in created2["due_date"]

def test_event_edit_and_status_preservation(temp_db, monkeypatch):
    """Verify that editing an event in entity modal preserves active status, updates time, and remains visible in get_events."""
    monkeypatch.setattr(database, "DEFAULT_DB_PATH", temp_db)
    from backend import auth
    token = auth.record_successful_login("testclient")
    client = TestClient(app)
    headers = {"Authorization": f"Bearer {token}"}

    today = datetime.date.today()
    today_str = today.strftime("%Y-%m-%d")

    # 1. Create an event scheduled for today 14:00
    ev = database.create_event(
        title="Weekly Lab Review",
        start_time=f"{today_str} 14:00:00",
        db_path=temp_db
    )
    assert ev["id"] is not None
    assert ev["status"] == "scheduled"

    # 2. Simulate editing the event (even if user edits nothing or sends status='pending' from legacy UI)
    edit_res = client.post(
        "/api/entities/reclassify",
        headers=headers,
        json={
            "from_type": "event",
            "from_id": ev["id"],
            "to_type": "event",
            "title": "Weekly Lab Review (Edited)",
            "description": "Updated room number",
            "project_name": None,
            "tier": "focus",
            "due_date": f"{today_str} 15:30",
            "status": "pending"  # Crucial test: legacy modal sent "pending"
        }
    )
    assert edit_res.status_code == 200
    updated_ev = edit_res.json()["entity"]
    assert updated_ev["title"] == "Weekly Lab Review (Edited)"
    assert updated_ev["status"] == "scheduled"  # Correctly normalized to scheduled
    assert f"{today_str} 15:30" in updated_ev["start_time"]

    # 3. Verify event is returned by get_events_for_day
    day_events = database.get_events_for_day(today, db_path=temp_db)
    event_titles = [e["title"] for e in day_events]
    assert "Weekly Lab Review (Edited)" in event_titles

    # 4. Verify briefing still includes the event in events_today
    briefing = database.get_daily_briefing(today, db_path=temp_db)
    apt_titles = [a["title"] for a in briefing["events_today"]]
    assert "Weekly Lab Review (Edited)" in apt_titles

    # 5. Verify DELETE /api/events/{id} works
    del_res = client.delete(f"/api/events/{ev['id']}", headers=headers)
    assert del_res.status_code == 200

    day_events_post = database.get_events_for_day(today, db_path=temp_db)
    assert len(day_events_post) == 0

