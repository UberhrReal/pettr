import os
import json
import zipfile
import sqlite3
import datetime
import asyncio
from pathlib import Path
from typing import Dict, Any, Optional
from config.config import get_or_create_config
from backend import database

def create_markdown_summary(db_path: Path) -> str:
    """Generates a human-readable markdown summary of all PETTR data."""
    projects = database.get_all_projects(db_path)
    today = datetime.date.today()
    briefing = database.get_daily_briefing(today, db_path)
    exploded = database.get_exploded_view(db_path)
    notes = database.get_notes(db_path)

    lines = []
    lines.append(f"# PETTR Export Summary - {today.strftime('%d/%m/%Y')}\n")
    lines.append(f"**Generated at:** {datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n")
    lines.append("## Daily Status")
    lines.append(f"- Active Focus Tasks: {briefing['focus_count']}")
    lines.append(f"- Active Trivial Tasks: {briefing['trivial_count']}")
    lines.append(f"- Scheduled Events: {briefing['events_count']}")
    lines.append(f"- Pending Reminders: {briefing['reminders_count']}")
    lines.append(f"- Active Projects: {briefing['active_projects_count']}\n")

    lines.append("## Projects & Tracked Tasks")
    for p in exploded["projects"]:
        lines.append(f"\n### Project: {p['name']}")
        if p.get("description"):
            lines.append(f"*{p['description']}*")
        tasks = p.get("tasks", [])
        if not tasks:
            lines.append("*(No active tasks)*")
        for t in tasks:
            status_box = "[x]" if t["status"] == "completed" else "[ ]"
            due = f" (Due: {t['due_date']})" if t.get("due_date") else ""
            lines.append(f"- {status_box} **[{t['tier'].upper()}]** {t['title']}{due}")

    if exploded.get("standalone_tasks"):
        lines.append("\n## Standalone Tasks")
        for t in exploded["standalone_tasks"]:
            status_box = "[x]" if t["status"] == "completed" else "[ ]"
            due = f" (Due: {t['due_date']})" if t.get("due_date") else ""
            lines.append(f"- {status_box} **[{t['tier'].upper()}]** {t['title']}{due}")

    if exploded.get("events"):
        lines.append("\n## Scheduled Events")
        for e in exploded["events"]:
            lines.append(f"- **{e['title']}** at {e['start_time']}")

    if exploded.get("reminders"):
        lines.append("\n## Active Reminders")
        for r in exploded["reminders"]:
            details_str = f" ({r.get('details')})" if r.get("details") else ""
            lines.append(f"- {r['title']}{details_str}")

    if notes:
        lines.append("\n## Notes & Thoughts")
        for n in notes:
            lines.append(f"### {n['title']} *(Updated: {n['updated_at']})*")
            lines.append(n["content"] + "\n")

    return "\n".join(lines)

def export_json_data(db_path: Path) -> Dict[str, Any]:
    """Exports all tables to a Python dictionary."""
    conn = database.get_connection(db_path)
    data = {}
    for table in ["projects", "tasks", "events", "reminders", "unorganized_queue", "notes", "history"]:
        rows = conn.execute(f"SELECT * FROM {table}").fetchall()
        data[table] = [dict(r) for r in rows]
    return data

def run_backup(target_dir: Optional[Path] = None, db_path: Path = database.DEFAULT_DB_PATH) -> Dict[str, Any]:
    """
    Creates a weekly/manual backup named PETTR_<dd_mm_yyyy>.zip
    containing SQLite database, JSON export, and Markdown summary.
    """
    config = get_or_create_config()
    if target_dir is None:
        target_dir = Path(config.get("backup_dir", "./backups"))
    
    target_dir.mkdir(parents=True, exist_ok=True)
    today = datetime.date.today()
    # Format: PETTR_<dd_mm_yyyy>.zip (Windows filename safe)
    filename = f"PETTR_{today.strftime('%d_%m_%Y')}.zip"
    zip_path = target_dir / filename

    temp_db_copy = target_dir / "temp_backup.sqlite"
    # Clean SQLite snapshot using online backup
    src_conn = database.get_connection(db_path)
    dst_conn = sqlite3.connect(str(temp_db_copy))
    with dst_conn:
        src_conn.backup(dst_conn)
    dst_conn.close()

    # Markdown summary
    summary_md = create_markdown_summary(db_path)
    # JSON data
    json_dump = json.dumps(export_json_data(db_path), indent=2, default=str)

    with zipfile.ZipFile(zip_path, 'w', compression=zipfile.ZIP_DEFLATED) as zipf:
        zipf.write(temp_db_copy, arcname="pettr.sqlite")
        zipf.writestr("PETTR_summary.md", summary_md)
        zipf.writestr("PETTR_export.json", json_dump)

    if temp_db_copy.exists():
        temp_db_copy.unlink()

    return {
        "status": "success",
        "filename": filename,
        "path": str(zip_path),
        "size_bytes": zip_path.stat().st_size,
        "created_at": datetime.datetime.now().isoformat()
    }

async def backup_scheduler_loop(db_path: Path = database.DEFAULT_DB_PATH):
    """Background loop that runs weekly backups automatically."""
    while True:
        try:
            config = get_or_create_config()
            interval_days = config.get("backup_interval_days", 7)
            run_backup(db_path=db_path)
            # Sleep interval in seconds
            await asyncio.sleep(interval_days * 86400)
        except asyncio.CancelledError:
            break
        except Exception:
            await asyncio.sleep(3600) # Retry in 1 hour on error
