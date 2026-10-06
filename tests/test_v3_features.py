import pytest
import datetime
from pathlib import Path
from backend import database

@pytest.fixture
def temp_db(tmp_path):
    db_file = tmp_path / "v3_test.sqlite"
    database.init_db(db_file)
    return db_file

def test_v3_completed_tasks_retention_and_ordering(temp_db):
    today = datetime.date.today()

    t1 = database.create_task(
        title="Pending Focus Task",
        tier="focus",
        db_path=temp_db
    )
    t2 = database.create_task(
        title="Completed Focus Task",
        tier="focus",
        db_path=temp_db
    )

    database.update_task_status(t2["id"], "completed", temp_db)

    day_tasks = database.get_tasks_for_day(today, temp_db)

    assert len(day_tasks["focus"]) == 2
    assert day_tasks["focus"][0]["id"] == t1["id"]
    assert day_tasks["focus"][0]["status"] == "pending"
    assert day_tasks["focus"][1]["id"] == t2["id"]
    assert day_tasks["focus"][1]["status"] == "completed"

def test_v3_standalone_vs_project_separation(temp_db):
    today = datetime.date.today()

    t_standalone = database.create_task(
        title="Calculus Quiz 3",
        tier="focus",
        project_name=None,
        db_path=temp_db
    )

    t_project = database.create_task(
        title="Complete trade analysis for 3U CubeSat",
        tier="focus",
        project_name="CubeSat Propulsion",
        db_path=temp_db
    )

    day_tasks = database.get_tasks_for_day(today, temp_db)

    standalone_ids = [t["id"] for t in day_tasks["standalone_focus"]]
    assert t_standalone["id"] in standalone_ids
    assert t_project["id"] not in standalone_ids

    project_names = [p["name"] for p in day_tasks["projects"]]
    assert "CubeSat Propulsion" in project_names

    cubesat_proj = next(p for p in day_tasks["projects"] if p["name"] == "CubeSat Propulsion")
    cubesat_task_ids = [t["id"] for t in cubesat_proj["tasks"]]
    assert t_project["id"] in cubesat_task_ids

def test_v3_military_time_formatting(temp_db):
    # 1. Direct function tests
    assert database.format_military_time("2026-09-25 15:30:00") == "15:30"
    assert database.format_military_time("2026-09-25 15:30:00", include_date=True) == "2026-09-25 15:30"
    assert database.format_military_time("2359") == "23:59"
    assert database.format_military_time("2:15 PM") == "14:15"
    assert database.format_military_time("9:05 am") == "09:05"
    assert database.format_military_time(datetime.time(14, 45)) == "14:45"

    # 2. Urgency helper test
    urg = database.compute_urgency("2026-09-25 18:00:00")
    assert urg["military_time"] == "18:00"
    assert urg["military_datetime"] == "2026-09-25 18:00"

    # 3. Rich text briefing output test
    today = datetime.date.today()
    database.create_task(
        title="Calculus Military Test",
        tier="focus",
        due_date=f"{today} 23:59:00",
        db_path=temp_db
    )
    database.create_event(
        title="Lab Meeting",
        start_time=f"{today} 14:00:00",
        db_path=temp_db
    )

    brief_text = database.get_rich_text_briefing(today, temp_db)
    assert "23:59" in brief_text
    assert "14:00" in brief_text

def test_v3_projects_today_filtering(temp_db):
    today = datetime.date.today()
    tomorrow = today + datetime.timedelta(days=1)

    # 1. Project with task due today -> should be in Projects Today
    p1 = database.create_project("Project Alpha", db_path=temp_db)
    database.create_task("Alpha Task 1", project_name="Project Alpha", due_date=str(today), db_path=temp_db)

    # 2. Project with 0 tasks -> should NOT be in Projects Today
    p2 = database.create_project("Project Beta", db_path=temp_db)

    # 3. Project with task in future only -> should NOT be in Projects Today
    p3 = database.create_project("Project Gamma", db_path=temp_db)
    database.create_task("Gamma Future Task", project_name="Project Gamma", due_date=f"{tomorrow} 10:00", db_path=temp_db)

    # 4. Project with task completed today -> should be in Projects Today
    p4 = database.create_project("Project Delta", db_path=temp_db)
    t_delta = database.create_task("Delta Task Done", project_name="Project Delta", db_path=temp_db)
    database.update_task_status(t_delta["id"], "completed", temp_db)

    res = database.get_tasks_for_day(today, temp_db)
    today_proj_names = [p["name"] for p in res["projects"]]

    assert "Project Alpha" in today_proj_names
    assert "Project Delta" in today_proj_names
    assert "Project Beta" not in today_proj_names
    assert "Project Gamma" not in today_proj_names

def test_v3_complete_and_reopen_project(temp_db):
    p = database.create_project("Robotics Arm", db_path=temp_db)
    t1 = database.create_task("Assemble servo links", project_name="Robotics Arm", db_path=temp_db)
    t2 = database.create_task("Calibrate encoder", project_name="Robotics Arm", db_path=temp_db)

    # Complete project
    assert database.complete_project(p["id"], complete_subtasks=True, db_path=temp_db) is True
    
    # Active projects should not contain completed project
    active = database.get_all_projects(temp_db)
    assert p["id"] not in [x["id"] for x in active]

    # Subtasks should be completed
    assert database.get_task_by_id(t1["id"], temp_db)["status"] == "completed"
    assert database.get_task_by_id(t2["id"], temp_db)["status"] == "completed"

    # Reopen project
    assert database.reopen_project(p["id"], temp_db) is True
    active_again = database.get_all_projects(temp_db)
    assert p["id"] in [x["id"] for x in active_again]

def test_v3_reopen_task(temp_db):
    t = database.create_task("Derive differential equations", tier="focus", db_path=temp_db)
    database.update_task_status(t["id"], "completed", temp_db)
    assert database.get_task_by_id(t["id"], temp_db)["status"] == "completed"

    database.reopen_task(t["id"], temp_db)
    reopened = database.get_task_by_id(t["id"], temp_db)
    assert reopened["status"] == "pending"
    assert reopened["completed_at"] is None

def test_v3_history_archive_structure(temp_db):
    # Create and complete items
    p = database.create_project("Thesis Defense", db_path=temp_db)
    database.complete_project(p["id"], complete_subtasks=True, db_path=temp_db)

    t = database.create_task("Print slide deck", tier="trivial", db_path=temp_db)
    database.update_task_status(t["id"], "completed", temp_db)

    database.create_reminder("Check laser pointer battery", db_path=temp_db)

    archive = database.get_history_archive(limit=50, db_path=temp_db)
    assert "completed_projects" in archive
    assert "completed_tasks" in archive
    assert "inactive_reminders" in archive
    assert "audit_log" in archive

    completed_proj_ids = [cp["id"] for cp in archive["completed_projects"]]
    assert p["id"] in completed_proj_ids

    completed_task_ids = [ct["id"] for ct in archive["completed_tasks"]]
    assert t["id"] in completed_task_ids


# -------------------------------------------------------------
# PETTR V3.3 Test Suite
# -------------------------------------------------------------
from backend.parser.deterministic import extract_priority
from backend.parser.pipeline import process_user_input

def test_v3_3_extract_priority_and_cleaning():
    cases = [
        ("Design telemetry protocol 5pm high priority", "Design telemetry protocol 5pm", "high"),
        ("urgent write unit tests today", "write unit tests today", "high"),
        ("Finish thesis draft top priority", "Finish thesis draft", "top"),
        ("most important fix memory leak in worker", "fix memory leak in worker", "top"),
        ("buy milk whenever", "buy milk", "low"),
        ("clean the desk lowest priority", "clean the desk", "lowest"),
        ("Review pull request #42", "Review pull request #42", "normal")
    ]
    for text, expected_clean, expected_pri in cases:
        cleaned, pri_level, token = extract_priority(text)
        assert cleaned.strip() == expected_clean.strip(), f"Failed clean for {text}: got '{cleaned}'"
        if expected_pri != "normal":
            assert pri_level == expected_pri, f"Failed priority mapping for {text}: got {pri_level}"
        else:
            assert pri_level in ("normal", None)

def test_v3_3_priority_placement_ranking(temp_db):
    # Create baseline tasks
    t1 = database.create_task("Task A", tier="focus", db_path=temp_db)
    t2 = database.create_task("Task B", tier="focus", db_path=temp_db)
    t3 = database.create_task("Task C", tier="focus", db_path=temp_db)
    t4 = database.create_task("Task D", tier="focus", db_path=temp_db)

    # Insert a "top" priority task
    t_top = database.create_task("Top Urgent Task", tier="focus", priority_placement="top", db_path=temp_db)
    assert t_top["priority_order"] == 1

    # Verify existing tasks shifted down
    tasks = database.get_tasks_for_day(datetime.date.today(), db_path=temp_db)["focus"]
    orders = [t["priority_order"] for t in tasks]
    assert orders == sorted(orders), "Tasks should be ordered by priority_order"
    assert tasks[0]["id"] == t_top["id"]

def test_v3_3_tomorrow_outlook_generation(temp_db):
    today = datetime.date.today()
    tomorrow = today + datetime.timedelta(days=1)

    # 1 task today
    database.create_task("Today Task", tier="focus", due_date=str(today), db_path=temp_db)

    # 3 tasks tomorrow, 1 reminder tomorrow
    database.create_task("Tomorrow Task 1", tier="focus", due_date=str(tomorrow), db_path=temp_db)
    database.create_task("Tomorrow Task 2", tier="trivial", due_date=str(tomorrow), db_path=temp_db)
    database.create_task("Tomorrow Task 3", tier="trivial", due_date=str(tomorrow), db_path=temp_db)
    database.create_reminder("Tomorrow Reminder", reminder_date=str(tomorrow), db_path=temp_db)

    outlook = database.generate_tomorrow_outlook(today, db_path=temp_db)
    assert outlook["focus_count"] == 1
    assert outlook["trivial_count"] == 2
    assert outlook["reminders_count"] == 1
    assert outlook["total_items"] == 4
    assert outlook["comparison"] == "heavier"
    assert isinstance(outlook["witty_quip"], str)
    assert len(outlook["witty_quip"]) > 5

    # Check briefing integration
    briefing = database.get_daily_briefing(today, temp_db)
    assert "tomorrow_outlook" in briefing
    assert briefing["tomorrow_outlook"]["total_items"] == 4
    assert len(briefing["tomorrow_blurb"]) > 0

def test_v3_3_productivity_stats(temp_db):
    today = datetime.date.today()
    # Create 3 tasks for today: 2 completed, 1 pending
    t1 = database.create_task("Task 1", due_date=str(today), db_path=temp_db)
    t2 = database.create_task("Task 2", due_date=str(today), db_path=temp_db)
    t3 = database.create_task("Task 3", due_date=str(today), db_path=temp_db)

    database.update_task_status(t1["id"], "completed", temp_db)
    database.update_task_status(t2["id"], "completed", temp_db)

    stats = database.get_productivity_stats(today, temp_db)
    assert "weekly" in stats
    assert "monthly" in stats
    assert len(stats["weekly"]["days"]) == 7

    # Today should have 2 completed out of 3 -> ~67%
    today_stat = next(d for d in stats["weekly"]["days"] if d["is_today"])
    assert today_stat["completed"] == 2
    assert today_stat["total"] == 3
    assert today_stat["completion_rate"] == 67

    # Monthly stats
    assert stats["monthly"]["completed_tasks"] >= 2
    assert stats["monthly"]["total_tasks"] >= 3

def test_v3_3_recurrence_tagging_and_persistence(temp_db):
    # Create a task
    t = database.create_task("Weekly Sync", tier="focus", db_path=temp_db)
    assert t.get("recurrence") is None

    # Reclassify with recurrence
    updated_res = database.reclassify_entity(
        from_type="task",
        from_id=t["id"],
        to_type="task",
        title="Weekly Sync Meeting",
        recurrence="FREQ=WEEKLY;BYDAY=MO",
        db_path=temp_db
    )
    assert updated_res["entity"]["recurrence"] == "FREQ=WEEKLY;BYDAY=MO"

    # Reclassify reminder with recurrence
    rem = database.create_reminder("Take vitamins", db_path=temp_db)
    updated_rem = database.reclassify_entity(
        from_type="reminder",
        from_id=rem["id"],
        to_type="reminder",
        title="Take vitamins daily",
        recurrence="FREQ=DAILY",
        db_path=temp_db
    )
    assert updated_rem["entity"]["recurrence"] == "FREQ=DAILY"

@pytest.mark.anyio
async def test_v3_3_pipeline_nlp_priority_integration(temp_db):
    today = datetime.date.today()
    res = await process_user_input("Calibrate antenna feed high priority", today=today, db_path=temp_db)
    assert res["status"] == "success"
    assert res["entity_type"] == "task"

    created = res["entity"]
    # Verify title does not contain "high priority"
    assert "high priority" not in created["title"].lower()
    assert "Calibrate antenna feed" in created["title"]


