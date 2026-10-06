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
