import pytest
import datetime
from pathlib import Path
from backend import database
from backend.parser.pipeline import process_user_input

@pytest.fixture
def temp_db(tmp_path):
    db_file = tmp_path / "test_pettr.sqlite"
    database.init_db(db_file)
    return db_file

@pytest.mark.anyio
async def test_idea_1_concept_pipeline(temp_db):
    ref_now = datetime.datetime(2026, 9, 25, 17, 30, 0)
    user_input = "Work on design for IDEA-1 Concept. Tonight 2359"
    
    result = await process_user_input(user_input, ref_datetime=ref_now, db_path=temp_db)
    
    assert result["status"] == "success"
    assert result["entity_type"] == "task"
    task = result["entity"]
    assert task["tier"] == "focus"
    assert task["project_name"] == "IDEA-1 Concept"
    assert "2026-09-25 23:59:00" in task["due_date"]
    assert task["urgency"]["level"] == "urgent"
    assert task["urgency"]["color"] == "#f97316" # Bright Orange

@pytest.mark.anyio
async def test_social_science_cad_pipeline(temp_db):
    ref_now = datetime.datetime(2026, 9, 25, 12, 0, 0)
    user_input = "Make CAD for Social Science 1D today"
    
    result = await process_user_input(user_input, ref_datetime=ref_now, db_path=temp_db)
    
    assert result["status"] == "success"
    assert result["entity_type"] == "task"
    task = result["entity"]
    assert task["tier"] == "focus"
    assert "Social Science 1D" in task["project_name"]
    # Check that project was auto-added to pool of all projects
    projects = database.get_all_projects(temp_db)
    assert any(p["name"] == "Social Science 1D" for p in projects)

@pytest.mark.anyio
async def test_recurring_trash_pipeline(temp_db):
    ref_now = datetime.datetime(2026, 9, 25, 12, 0, 0)
    user_input = "Take trash out every Tuesday night"
    
    result = await process_user_input(user_input, ref_datetime=ref_now, db_path=temp_db)
    
    assert result["status"] == "success"
    assert result["entity_type"] == "task"
    task = result["entity"]
    assert task["tier"] == "trivial"
    assert task["recurrence"] == "FREQ=WEEKLY;BYDAY=TU"

@pytest.mark.anyio
async def test_reminder_pipeline(temp_db):
    ref_now = datetime.datetime(2026, 9, 25, 12, 0, 0)
    user_input = "Class administered by Prof Collins"
    
    result = await process_user_input(user_input, ref_datetime=ref_now, db_path=temp_db)
    
    assert result["status"] == "success"
    assert result["entity_type"] == "reminder"
