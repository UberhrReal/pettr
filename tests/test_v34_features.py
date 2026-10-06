"""
Test suite for PETTR V3.4:
- Cozy minimalist aesthetics & typography assets
- In-App User & Deployment Guide endpoints and assets
- SQLite WAL journal mode durability verification
- Datetime formatting & quick presets API integration
- Production Docker container assets verification
"""
import pytest
from pathlib import Path
from fastapi.testclient import TestClient
from backend.app import app
import backend.database as database

client = TestClient(app)

def test_static_assets_v34():
    """Verify all V3.4 frontend assets (HTML, CSS, JS) are present and serve 200 OK."""
    # 1. Main index
    res = client.get("/")
    assert res.status_code == 200
    html = res.text

    # Verify Guide tab markup exists
    assert 'id="tabGuide"' in html
    assert 'guideSection_quickstart' in html
    assert 'guideSection_deployment' in html
    assert 'guideSection_hardware' in html
    assert 'guideSection_persistence' in html

    # Verify Voice input button exists
    assert 'id="voiceInputBtn"' in html

    # Verify Theme switcher control exists
    assert 'id="themeSwitcherControl"' in html

    # Verify Ruler timeline option exists
    assert 'data-view="ruler"' in html

    # Verify Datetime-local inputs exist
    assert 'type="datetime-local"' in html

    # 2. Stylesheet
    res_css = client.get("/static/css/pettr.css")
    assert res_css.status_code == 200
    css = res_css.text
    assert "--urgent-orange: #FF4500;" in css
    assert "auroraShift" in css
    assert ".horizontal-ruler-container" in css
    assert ".guide-container" in css
    assert '[data-theme="dark"]' in css

    # 3. Scripts
    for script_name in [
        "pin_lock.js", "drag_drop.js", "wave_canvas.js", "entity_modal.js",
        "timeline.js", "mindmap.js", "dashboard.js", "exploded.js",
        "notes.js", "history.js", "app.js"
    ]:
        res_js = client.get(f"/static/js/{script_name}")
        assert res_js.status_code == 200, f"Failed to load /static/js/{script_name}"

def test_sqlite_wal_journal_mode(tmp_path):
    """Verify SQLite database enforces WAL journal mode and NORMAL synchrony."""
    db_file = tmp_path / "wal_test.sqlite"
    conn = database.get_connection(db_file)
    cursor = conn.cursor()

    cursor.execute("PRAGMA journal_mode;")
    mode = cursor.fetchone()[0].upper()
    assert mode == "WAL", f"Expected WAL mode, got {mode}"

    cursor.execute("PRAGMA synchronous;")
    sync_val = cursor.fetchone()[0]
    # NORMAL is 1 in SQLite
    assert sync_val in (1, "NORMAL"), f"Expected NORMAL synchronous mode, got {sync_val}"
    conn.close()

def test_docker_and_deployment_files():
    """Verify production Dockerfile, docker-compose.yml, and DEPLOYMENT.md exist."""
    base_dir = Path(__file__).resolve().parent.parent
    assert (base_dir / "Dockerfile").exists()
    assert (base_dir / "docker-compose.yml").exists()
    assert (base_dir / ".dockerignore").exists()
    assert (base_dir / "DEPLOYMENT.md").exists()

    # Check docker-compose volume mapping
    compose_content = (base_dir / "docker-compose.yml").read_text(encoding="utf-8")
    assert "./data:/app/data" in compose_content
    assert "./config:/config" in compose_content or "./config:/app/config" in compose_content
    assert "./backups:/backups" in compose_content or "./backups:/app/backups" in compose_content
    assert "host.docker.internal:host-gateway" in compose_content

def test_invalid_date_routing_to_unorganized(tmp_path, monkeypatch):
    """Verify that inputs with invalid dates or missing days are routed to unorganized queue."""
    test_db = tmp_path / "date_routing_test.sqlite"
    monkeypatch.setattr(database, "DEFAULT_DB_PATH", test_db)
    database.init_db(test_db)

    with TestClient(app) as test_client:
        # Login
        test_client.post("/api/auth/login", json={"pin": "1234"})

        # 1. Invalid date (Feb 30)
        res = test_client.post("/api/ingest", json={"text": "Review budget figures due on Feb 30"})
        assert res.status_code == 200
        data = res.json()
        assert data["status"] == "unorganized"
        assert "Uncertain date/time" in data["reasoning"] or "manual review" in data["reasoning"]

        # 2. Time-only without a set day
        res = test_client.post("/api/ingest", json={"text": "Standup call at 14:00"})
        assert res.status_code == 200
        data = res.json()
        assert data["status"] == "unorganized"

        # Check queue
        unorg_res = test_client.get("/api/unorganized")
        assert unorg_res.status_code == 200
        unorg_items = unorg_res.json()
        assert len(unorg_items) >= 2

def test_infinite_timeline_range_api(tmp_path, monkeypatch):
    """Verify that timeline endpoint supports days_around and returns multi-day range."""
    test_db = tmp_path / "timeline_range_test.sqlite"
    monkeypatch.setattr(database, "DEFAULT_DB_PATH", test_db)
    database.init_db(test_db)

    with TestClient(app) as test_client:
        test_client.post("/api/auth/login", json={"pin": "1234"})

        # Multi-day range query
        res = test_client.get("/api/timeline?scale=day&days_around=3")
        assert res.status_code == 200
        data = res.json()
        assert data["scale"] == "range"
        assert "days" in data
        assert len(data["days"]) == 7 # -3 to +3 = 7 days

        # Single-day backward compatibility query
        res_single = test_client.get("/api/timeline?scale=day")
        assert res_single.status_code == 200
        data_single = res_single.json()
        assert data_single["scale"] == "day"
        assert "hours" in data_single
        assert len(data_single["hours"]) == 24
