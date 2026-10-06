from fastapi.testclient import TestClient
from backend.app import app
from backend import database
import config.config as cfg_mod

def test_full_e2e_workflow(tmp_path, monkeypatch):
    # Set custom db and config for isolated test
    test_db = tmp_path / "e2e_pettr.sqlite"
    test_cfg = tmp_path / "e2e_config.json"
    
    monkeypatch.setattr(database, "DEFAULT_DB_PATH", test_db)
    database.init_db(test_db)
    
    # Initialize isolated test config with PIN 1234
    cfg = cfg_mod.get_or_create_config(test_cfg)
    monkeypatch.setattr(cfg_mod, "DEFAULT_CONFIG_PATH", test_cfg)

    with TestClient(app) as client:
        # 1. Unauthenticated request to /api/briefing should fail (401)
        res = client.get("/api/briefing")
        assert res.status_code == 401

        # 2. Login with wrong PIN
        res = client.post("/api/auth/login", json={"pin": "0000"})
        assert res.status_code == 401

        # 3. Login with correct PIN 1234
        res = client.post("/api/auth/login", json={"pin": "1234"})
        assert res.status_code == 200
        token = res.json()["token"]

        # 4. Ingest Example 1: IDEA-1 Concept
        res = client.post("/api/ingest", json={"text": "Work on design for IDEA-1 Concept. Tonight 2359"})
        assert res.status_code == 200
        data = res.json()
        assert data["status"] == "success"
        assert data["entity_type"] == "task"
        assert data["entity"]["tier"] == "focus"
        assert data["entity"]["project_name"] == "IDEA-1 Concept"
        assert data["entity"]["urgency"]["level"] == "urgent"
        idea_task_id = data["entity"]["id"]

        # 5. Ingest Example 2: Social Science 1D CAD
        res = client.post("/api/ingest", json={"text": "Make CAD for Social Science 1D today"})
        assert res.status_code == 200
        data = res.json()
        assert data["status"] == "success"
        assert "Social Science 1D" in data["entity"]["project_name"]
        cad_task_id = data["entity"]["id"]

        # 6. Ingest Example 3: Recurring Trash
        res = client.post("/api/ingest", json={"text": "Take trash out every Tuesday night"})
        assert res.status_code == 200
        data = res.json()
        assert data["status"] == "success"
        assert data["entity"]["tier"] == "trivial"
        assert data["entity"]["recurrence"] == "FREQ=WEEKLY;BYDAY=TU"

        # 7. Ingest Example 4: Reminder
        res = client.post("/api/ingest", json={"text": "Class administered by Prof Collins"})
        assert res.status_code == 200
        data = res.json()
        assert data["status"] == "success"
        assert data["entity_type"] == "reminder"

        # 8. Reorder tasks
        res = client.post("/api/tasks/reorder", json={"task_ids": [cad_task_id, idea_task_id]})
        assert res.status_code == 200

        # 9. Briefing check
        res = client.get("/api/briefing")
        assert res.status_code == 200
        briefing = res.json()
        assert briefing["focus_count"] == 2
        assert briefing["trivial_count"] == 1
        assert briefing["reminders_count"] == 1
        assert "Social Science 1D" in briefing["active_projects"]

        # 10. Exploded view check
        res = client.get("/api/exploded")
        assert res.status_code == 200
        exploded = res.json()
        project_names = [p["name"] for p in exploded["projects"]]
        assert "IDEA-1 Concept" in project_names
        assert "Social Science 1D" in project_names

        # 11. Host-Only PIN change: Test client defaults to host ("testclient")
        res = client.post("/api/auth/set-pin", json={"new_pin": "5678"})
        assert res.status_code == 200
        assert res.json()["status"] == "success"

        # 12. Manual Backup Trigger
        backup_folder = tmp_path / "e2e_backups"
        from backend import backup
        monkeypatch.setattr(backup, "get_or_create_config", lambda *args: {"backup_dir": str(backup_folder), "backup_interval_days": 7})
        res = client.post("/api/backup/now")
        assert res.status_code == 200
        assert res.json()["status"] == "success"
        assert backup_folder.exists()
