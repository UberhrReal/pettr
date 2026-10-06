import sqlite3
import json
import random
import datetime
from pathlib import Path
from typing import List, Dict, Any, Optional

import os

DEFAULT_DATA_DIR = Path(os.environ.get("PETTR_DATA_DIR", Path(__file__).resolve().parent.parent))
DEFAULT_DB_PATH = DEFAULT_DATA_DIR / "pettr.sqlite"

def resolve_db_path(db_path: Optional[Path] = None) -> Path:
    return Path(db_path) if db_path is not None else Path(DEFAULT_DB_PATH)

def run_migrations(conn: sqlite3.Connection) -> None:
    """Safely applies non-breaking schema migrations to existing databases."""
    try:
        conn.execute("ALTER TABLE projects ADD COLUMN completed_at TIMESTAMP")
    except Exception:
        pass
    try:
        conn.execute("ALTER TABLE reminders ADD COLUMN recurrence TEXT")
    except Exception:
        pass
    try:
        conn.execute("ALTER TABLE projects ADD COLUMN category TEXT DEFAULT 'External'")
    except Exception:
        pass

def get_connection(db_path: Optional[Path] = None, auto_init: bool = True) -> sqlite3.Connection:
    """Creates a connection with WAL mode, normal synchronous durability, and row factory enabled."""
    resolved_path = resolve_db_path(db_path)
    resolved_path.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(str(resolved_path), check_same_thread=False)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL;")
    conn.execute("PRAGMA synchronous=NORMAL;")
    conn.execute("PRAGMA foreign_keys=ON;")
    
    # Auto-initialize tables if not present, and run migrations
    if auto_init:
        table_exists = conn.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='projects'").fetchone()
        if not table_exists:
            init_db(resolved_path)
        else:
            run_migrations(conn)
        
    return conn

def init_db(db_path: Path = DEFAULT_DB_PATH) -> None:
    """Initializes tables and indexes."""
    conn = get_connection(db_path, auto_init=False)
    with conn:
        conn.executescript("""
        CREATE TABLE IF NOT EXISTS projects (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT UNIQUE NOT NULL,
            description TEXT DEFAULT '',
            color TEXT DEFAULT '#3b82f6',
            category TEXT DEFAULT 'External', -- School, External
            status TEXT DEFAULT 'active', -- active, completed, archived
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            completed_at TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS tasks (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            description TEXT DEFAULT '',
            project_id INTEGER REFERENCES projects(id) ON DELETE SET NULL,
            tier TEXT NOT NULL DEFAULT 'focus', -- focus, trivial
            due_date TIMESTAMP, -- ISO string YYYY-MM-DD HH:MM:SS
            due_date_raw TEXT, -- original string representation e.g. "Tonight 2359"
            recurrence TEXT, -- RRULE format e.g. "FREQ=WEEKLY;BYDAY=TU"
            priority_order INTEGER DEFAULT 0,
            status TEXT DEFAULT 'pending', -- pending, completed, cancelled
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            completed_at TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS events (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            description TEXT DEFAULT '',
            project_id INTEGER REFERENCES projects(id) ON DELETE SET NULL,
            start_time TIMESTAMP NOT NULL,
            end_time TIMESTAMP,
            recurrence TEXT,
            status TEXT DEFAULT 'scheduled', -- scheduled, completed, cancelled
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS reminders (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            details TEXT DEFAULT '',
            task_id INTEGER REFERENCES tasks(id) ON DELETE CASCADE,
            reminder_date DATE, -- YYYY-MM-DD
            is_done INTEGER DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS unorganized_queue (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            raw_input TEXT NOT NULL,
            parsed_date TEXT,
            suggested_type TEXT,
            suggested_tier TEXT,
            suggested_project TEXT,
            reasoning TEXT,
            confidence REAL DEFAULT 0.0,
            status TEXT DEFAULT 'pending', -- pending, processed, dismissed
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS notes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT DEFAULT 'Untitled Note',
            content TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS history (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            raw_input TEXT NOT NULL,
            extracted_date TEXT,
            llm_classification TEXT, -- JSON string
            target_entity_type TEXT, -- task, project, event, reminder, unorganized
            target_entity_id INTEGER,
            status TEXT DEFAULT 'success', -- success, unorganized, error
            error_message TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        CREATE INDEX IF NOT EXISTS idx_tasks_due ON tasks(due_date);
        CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
        CREATE INDEX IF NOT EXISTS idx_tasks_project ON tasks(project_id);
        CREATE INDEX IF NOT EXISTS idx_events_start ON events(start_time);
        CREATE INDEX IF NOT EXISTS idx_reminders_task ON reminders(task_id);
        CREATE INDEX IF NOT EXISTS idx_reminders_date ON reminders(reminder_date);
        """)
        try:
            conn.execute("ALTER TABLE projects ADD COLUMN completed_at TIMESTAMP")
        except Exception:
            pass
        try:
            conn.execute("ALTER TABLE reminders ADD COLUMN recurrence TEXT")
        except Exception:
            pass
        try:
            conn.execute("ALTER TABLE projects ADD COLUMN category TEXT DEFAULT 'External'")
        except Exception:
            pass

def format_military_time(dt_val: Any, include_date: bool = False) -> str:
    """Converts any datetime, time, or timestamp string to 24-hour military format (HH:MM or YYYY-MM-DD HH:MM)."""
    if not dt_val:
        return ""
    if isinstance(dt_val, datetime.datetime):
        return dt_val.strftime("%Y-%m-%d %H:%M" if include_date else "%H:%M")
    if isinstance(dt_val, datetime.time):
        return dt_val.strftime("%H:%M")
    
    val_str = str(dt_val).strip()
    clean = val_str.replace("T", " ").split(".")[0]

    import re
    # Full datetime match
    for fmt in ("%Y-%m-%d %H:%M:%S", "%Y-%m-%d %H:%M"):
        try:
            parsed = datetime.datetime.strptime(clean, fmt)
            return parsed.strftime("%Y-%m-%d %H:%M" if include_date else "%H:%M")
        except ValueError:
            pass

    # 4-digit military "2359"
    m4 = re.match(r"^(\d{2})(\d{2})$", clean)
    if m4:
        hh, mm = int(m4.group(1)), int(m4.group(2))
        if 0 <= hh <= 23 and 0 <= mm <= 59:
            return f"{hh:02d}:{mm:02d}"

    # HH:MM or HH:MM:SS
    m_time = re.match(r"^(\d{1,2}):(\d{2})(?::\d{2})?$", clean)
    if m_time:
        hh, mm = int(m_time.group(1)), int(m_time.group(2))
        return f"{hh:02d}:{mm:02d}"

    # 12-hour AM/PM formats
    for fmt in ("%I:%M %p", "%I:%M%p", "%I %p", "%I%p"):
        try:
            parsed_t = datetime.datetime.strptime(clean, fmt)
            return parsed_t.strftime("%H:%M")
        except ValueError:
            pass

    return clean

def compute_urgency(due_date_str: Optional[str], ref_datetime: Optional[datetime.datetime] = None) -> Dict[str, Any]:
    """
    Computes urgency badge and days remaining:
    - Bright Orange: due within the next 2 days (<= 48h) or overdue
    - Green: not urgent (> 2 days)
    - Grey: no due date given
    """
    if not due_date_str:
        return {
            "level": "none",
            "color": "#9ca3af", # Grey
            "label": "No Date",
            "hours_left": None,
            "military_time": "",
            "military_datetime": ""
        }
    
    if ref_datetime is None:
        ref_datetime = datetime.datetime.now()

    try:
        # Normalize ISO or space-separated date
        dt_str = due_date_str.replace("T", " ").split(".")[0]
        if len(dt_str) == 10:
            due_dt = datetime.datetime.strptime(dt_str, "%Y-%m-%d")
            due_dt = due_dt.replace(hour=23, minute=59, second=59)
        else:
            due_dt = datetime.datetime.strptime(dt_str, "%Y-%m-%d %H:%M:%S")
    except Exception:
        return {
            "level": "none",
            "color": "#9ca3af",
            "label": "Invalid Date",
            "hours_left": None,
            "military_time": "",
            "military_datetime": ""
        }

    delta = due_dt - ref_datetime
    total_hours = delta.total_seconds() / 3600.0
    mil_time = due_dt.strftime("%H:%M")
    mil_datetime = due_dt.strftime("%Y-%m-%d %H:%M")

    if total_hours <= 48.0:
        return {
            "level": "urgent",
            "color": "#f97316", # Bright Orange
            "label": "Urgent" if total_hours >= 0 else "Overdue",
            "hours_left": round(total_hours, 1),
            "military_time": mil_time,
            "military_datetime": mil_datetime
        }
    else:
        return {
            "level": "normal",
            "color": "#22c55e", # Green
            "label": "Upcoming",
            "hours_left": round(total_hours, 1),
            "military_time": mil_time,
            "military_datetime": mil_datetime
        }

# --- Project Operations ---

PROJECT_PALETTE = [
    "#3b82f6",  # Electric Blue
    "#10b981",  # Emerald Green
    "#f59e0b",  # Amber Orange
    "#8b5cf6",  # Purple Violet
    "#ec4899",  # Neon Pink
    "#06b6d4",  # Cyan Blue
    "#f97316",  # Deep Sunset Orange
    "#14b8a6",  # Vibrant Teal
    "#e11d48",  # Rose Red
    "#84cc16",  # Lime Green
    "#6366f1",  # Indigo
    "#d946ef",  # Fuchsia
]

def get_untaken_project_color(db_path: Optional[Path] = None) -> str:
    """Returns a random untaken color from the palette, or random choice if all are taken."""
    conn = get_connection(db_path)
    rows = conn.execute("SELECT color FROM projects WHERE status = 'active'").fetchall()
    taken = {r["color"].lower() for r in rows if r["color"]}
    untaken = [c for c in PROJECT_PALETTE if c.lower() not in taken]
    if untaken:
        return random.choice(untaken)
    return random.choice(PROJECT_PALETTE)

def get_or_create_project(name: str, category: str = "External", db_path: Optional[Path] = None) -> Dict[str, Any]:
    clean_name = name.strip()
    # Support callers passing db_path as second positional argument: get_or_create_project(name, db_path)
    if isinstance(category, Path):
        db_path = category
        category = "External"
    elif isinstance(category, str) and (category.endswith(".sqlite") or "/" in category or "\\" in category):
        db_path = Path(category)
        category = "External"

    conn = get_connection(db_path)
    with conn:
        row = conn.execute("SELECT * FROM projects WHERE LOWER(name) = LOWER(?)", (clean_name,)).fetchone()
        if row:
            return dict(row)
        auto_color = get_untaken_project_color(db_path)
        valid_cat = "School" if str(category).strip().lower() == "school" else "External"
        cursor = conn.execute("INSERT INTO projects (name, color, category) VALUES (?, ?, ?)", (clean_name, auto_color, valid_cat))
        new_row = conn.execute("SELECT * FROM projects WHERE id = ?", (cursor.lastrowid,)).fetchone()
        return dict(new_row)

def create_project(name: str,
                   description: str = "",
                   color: Optional[str] = None,
                   category: str = "External",
                   initial_task: Optional[str] = None,
                   db_path: Optional[Path] = None) -> Dict[str, Any]:
    """Manually creates a new project with optional initial task, category ('School' or 'External'), and accent color."""
    clean_name = name.strip()
    if not clean_name:
        raise ValueError("Project name cannot be empty")
    valid_cat = "School" if str(category).strip().lower() == "school" else "External"
    conn = get_connection(db_path)
    with conn:
        row = conn.execute("SELECT * FROM projects WHERE LOWER(name) = LOWER(?)", (clean_name,)).fetchone()
        assigned_color = color if color and color != "#3b82f6" else (row["color"] if row and row["color"] else get_untaken_project_color(db_path))
        if row:
            conn.execute("""
                UPDATE projects 
                SET description = CASE WHEN ? != '' THEN ? ELSE description END,
                    color = ?,
                    category = ?,
                    status = 'active',
                    completed_at = NULL,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
            """, (description, description, assigned_color, valid_cat, row["id"]))
            proj_id = row["id"]
        else:
            cursor = conn.execute("""
                INSERT INTO projects (name, description, color, category, status)
                VALUES (?, ?, ?, ?, 'active')
            """, (clean_name, description, assigned_color, valid_cat))
            proj_id = cursor.lastrowid

        if initial_task and initial_task.strip():
            create_task(
                title=initial_task.strip(),
                project_name=clean_name,
                tier="focus",
                db_path=db_path
            )

        new_row = conn.execute("SELECT * FROM projects WHERE id = ?", (proj_id,)).fetchone()
        return dict(new_row)

def delete_project(project_id: int, delete_tasks: bool = False, db_path: Optional[Path] = None) -> bool:
    """Permanently deletes a project. If delete_tasks is True, subtasks are removed; otherwise unlinked."""
    conn = get_connection(db_path)
    with conn:
        if delete_tasks:
            conn.execute("DELETE FROM tasks WHERE project_id = ?", (project_id,))
            conn.execute("DELETE FROM events WHERE project_id = ?", (project_id,))
        else:
            conn.execute("UPDATE tasks SET project_id = NULL WHERE project_id = ?", (project_id,))
            conn.execute("UPDATE events SET project_id = NULL WHERE project_id = ?", (project_id,))
        conn.execute("DELETE FROM projects WHERE id = ?", (project_id,))
    return True

def complete_project(project_id: int, complete_subtasks: bool = True, db_path: Optional[Path] = None) -> bool:
    """Wraps up a project, marking it completed and completing open subtasks."""
    conn = get_connection(db_path)
    with conn:
        conn.execute("""
            UPDATE projects 
            SET status = 'completed', completed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        """, (project_id,))
        if complete_subtasks:
            conn.execute("""
                UPDATE tasks 
                SET status = 'completed', completed_at = CURRENT_TIMESTAMP
                WHERE project_id = ? AND status = 'pending'
            """, (project_id,))
    return True

def reopen_project(project_id: int, db_path: Optional[Path] = None) -> bool:
    """Restores a completed project back to active status."""
    conn = get_connection(db_path)
    with conn:
        conn.execute("""
            UPDATE projects 
            SET status = 'active', completed_at = NULL, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        """, (project_id,))
    return True

def reopen_task(task_id: int, db_path: Optional[Path] = None) -> bool:
    """Restores a completed task back to pending status."""
    conn = get_connection(db_path)
    with conn:
        conn.execute("""
            UPDATE tasks 
            SET status = 'pending', completed_at = NULL
            WHERE id = ?
        """, (task_id,))
    return True

def get_all_projects(db_path: Optional[Path] = None) -> List[Dict[str, Any]]:
    conn = get_connection(db_path)
    rows = conn.execute("SELECT * FROM projects WHERE status = 'active' ORDER BY name ASC").fetchall()
    return [dict(r) for r in rows]

# --- Task Operations ---

def create_task(title: str,
                description: str = "",
                project_name: Optional[str] = None,
                tier: str = "focus",
                due_date: Optional[str] = None,
                due_date_raw: Optional[str] = None,
                recurrence: Optional[str] = None,
                priority_placement: Optional[str] = "normal",
                db_path: Optional[Path] = None) -> Dict[str, Any]:
    conn = get_connection(db_path)
    project_id = None
    if project_name:
        proj = get_or_create_project(project_name, db_path=db_path)
        project_id = proj["id"]

    task_id = None
    with conn:
        count = conn.execute("SELECT COUNT(*) FROM tasks WHERE tier = ? AND status = 'pending'", (tier,)).fetchone()[0]
        max_order = conn.execute("SELECT COALESCE(MAX(priority_order), 0) + 1 FROM tasks WHERE tier = ?", (tier,)).fetchone()[0]

        if priority_placement == "top":
            target_order = 1
            conn.execute("UPDATE tasks SET priority_order = priority_order + 1 WHERE tier = ? AND status = 'pending' AND priority_order >= 1", (tier,))
        elif priority_placement == "high":
            # Place in top quarter: if count is 4, target is 2; if 8, target is 2 or 3; if <=1, target is 1
            target_order = max(1, count // 4 + 1)
            conn.execute("UPDATE tasks SET priority_order = priority_order + 1 WHERE tier = ? AND status = 'pending' AND priority_order >= ?", (tier, target_order))
        elif priority_placement == "low":
            # Place in lower quarter (around 75% down)
            target_order = max(1, (count * 3) // 4 + 1)
            conn.execute("UPDATE tasks SET priority_order = priority_order + 1 WHERE tier = ? AND status = 'pending' AND priority_order >= ?", (tier, target_order))
        else:
            # "lowest" or "normal"
            target_order = max_order

        cursor = conn.execute("""
            INSERT INTO tasks (title, description, project_id, tier, due_date, due_date_raw, recurrence, priority_order)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """, (title, description, project_id, tier, due_date, due_date_raw, recurrence, target_order))
        task_id = cursor.lastrowid
    return get_task_by_id(task_id, db_path)

def get_task_by_id(task_id: int, db_path: Optional[Path] = None) -> Optional[Dict[str, Any]]:
    conn = get_connection(db_path)
    query = """
        SELECT t.*, p.name as project_name, p.color as project_color
        FROM tasks t
        LEFT JOIN projects p ON t.project_id = p.id
        WHERE t.id = ?
    """
    row = conn.execute(query, (task_id,)).fetchone()
    if not row:
        return None
    d = dict(row)
    d["urgency"] = compute_urgency(d["due_date"])
    # Fetch attached reminders
    rem_rows = conn.execute("SELECT * FROM reminders WHERE task_id = ? ORDER BY id ASC", (task_id,)).fetchall()
    d["reminders"] = [dict(r) for r in rem_rows]
    return d

def update_task_order(task_ids: List[int], db_path: Optional[Path] = None) -> None:
    """Updates priority_order for an ordered list of task IDs from drag-and-drop."""
    conn = get_connection(db_path)
    with conn:
        for order, tid in enumerate(task_ids, start=1):
            conn.execute("UPDATE tasks SET priority_order = ? WHERE id = ?", (order, tid))

def update_task_status(task_id: int, status: str, db_path: Optional[Path] = None) -> Optional[Dict[str, Any]]:
    """Updates status and completed_at timestamp for a task."""
    conn = get_connection(db_path)
    with conn:
        if status == "completed":
            conn.execute("UPDATE tasks SET status = ?, completed_at = CURRENT_TIMESTAMP WHERE id = ?", (status, task_id))
        else:
            conn.execute("UPDATE tasks SET status = ?, completed_at = NULL WHERE id = ?", (status, task_id))
    return get_task_by_id(task_id, db_path)

def get_tasks_for_day(target_date: Optional[datetime.date] = None, db_path: Optional[Path] = None) -> Dict[str, Any]:
    """Gets tasks categorized into 'focus' and 'trivial', including tasks completed today and project grouping."""
    if target_date is None:
        target_date = datetime.date.today()
    
    date_str = target_date.strftime("%Y-%m-%d")
    is_today = (target_date == datetime.date.today())
    conn = get_connection(db_path)

    # 1. Fetch tasks scheduled or completed for this specific target_date
    if is_today:
        query = """
            SELECT t.*, p.name as project_name, p.color as project_color
            FROM tasks t
            LEFT JOIN projects p ON t.project_id = p.id
            WHERE (t.status = 'pending' AND (t.due_date IS NULL OR DATE(t.due_date) <= DATE(?) OR t.recurrence IS NOT NULL))
               OR (t.status = 'completed' AND (DATE(t.completed_at) = DATE(?) OR (t.completed_at IS NULL AND DATE(t.due_date) = DATE(?))))
            ORDER BY 
                CASE WHEN t.status = 'completed' THEN 1 ELSE 0 END ASC,
                t.priority_order ASC, 
                t.due_date ASC,
                t.created_at ASC
        """
        rows = conn.execute(query, (date_str, date_str, date_str)).fetchall()
    else:
        query = """
            SELECT t.*, p.name as project_name, p.color as project_color
            FROM tasks t
            LEFT JOIN projects p ON t.project_id = p.id
            WHERE (t.status = 'pending' AND DATE(t.due_date) = DATE(?))
               OR (t.status = 'completed' AND (DATE(t.completed_at) = DATE(?) OR (t.completed_at IS NULL AND DATE(t.due_date) = DATE(?))))
            ORDER BY 
                CASE WHEN t.status = 'completed' THEN 1 ELSE 0 END ASC,
                t.priority_order ASC, 
                t.due_date ASC,
                t.created_at ASC
        """
        rows = conn.execute(query, (date_str, date_str, date_str)).fetchall()
    focus_list = []
    trivial_list = []
    standalone_focus = []
    standalone_trivial = []

    for r in rows:
        d = dict(r)
        d["urgency"] = compute_urgency(d["due_date"])
        d["due_date_military"] = format_military_time(d["due_date"])
        # Fetch attached reminders
        rem_rows = conn.execute("SELECT * FROM reminders WHERE task_id = ?", (d["id"],)).fetchall()
        d["reminders"] = [dict(rem) for rem in rem_rows]

        if d["tier"] == "trivial":
            trivial_list.append(d)
            if not d.get("project_id"):
                standalone_trivial.append(d)
        else:
            focus_list.append(d)
            if not d.get("project_id"):
                standalone_focus.append(d)

    # 2. Fetch projects with their tasks for the Projects Today panel
    # Only active projects that have tasks specifically due or completed today!
    projects_rows = conn.execute("SELECT * FROM projects WHERE status = 'active' ORDER BY name ASC").fetchall()
    projects_list = []
    for pr in projects_rows:
        p_dict = dict(pr)
        # Tasks due today or completed today for this project
        if is_today:
            today_tasks_rows = conn.execute("""
                SELECT * FROM tasks 
                WHERE project_id = ? 
                  AND (
                    (status = 'pending' AND (due_date IS NULL OR DATE(due_date) <= DATE(?)))
                    OR (status = 'completed' AND (DATE(completed_at) = DATE(?) OR (completed_at IS NULL AND DATE(due_date) = DATE(?))))
                  )
                ORDER BY CASE WHEN status = 'completed' THEN 1 ELSE 0 END ASC, priority_order ASC, due_date ASC
            """, (p_dict["id"], date_str, date_str, date_str)).fetchall()
        else:
            today_tasks_rows = conn.execute("""
                SELECT * FROM tasks 
                WHERE project_id = ? 
                  AND (
                    (status = 'pending' AND DATE(due_date) = DATE(?))
                    OR (status = 'completed' AND (DATE(completed_at) = DATE(?) OR (completed_at IS NULL AND DATE(due_date) = DATE(?))))
                  )
                ORDER BY CASE WHEN status = 'completed' THEN 1 ELSE 0 END ASC, priority_order ASC, due_date ASC
            """, (p_dict["id"], date_str, date_str, date_str)).fetchall()
        
        # Only show projects that have tasks to be done on this day
        if len(today_tasks_rows) == 0:
            continue

        p_tasks = []
        for pt in today_tasks_rows:
            pt_dict = dict(pt)
            pt_dict["urgency"] = compute_urgency(pt_dict["due_date"])
            pt_dict["due_date_military"] = format_military_time(pt_dict["due_date"])
            pt_dict["is_today"] = True
            p_tasks.append(pt_dict)
            
        p_dict["tasks"] = p_tasks

        # Also fetch later/future tasks for this project (greyed out, informational, not required today)
        later_tasks_rows = conn.execute("""
            SELECT * FROM tasks
            WHERE project_id = ?
              AND status = 'pending'
              AND (due_date IS NOT NULL AND DATE(due_date) > DATE(?))
            ORDER BY priority_order ASC, due_date ASC
        """, (p_dict["id"], date_str)).fetchall()

        later_tasks = []
        for lt in later_tasks_rows:
            lt_dict = dict(lt)
            lt_dict["urgency"] = compute_urgency(lt_dict["due_date"])
            lt_dict["due_date_military"] = format_military_time(lt_dict["due_date"])
            lt_dict["is_today"] = False
            lt_dict["is_later"] = True
            later_tasks.append(lt_dict)

        p_dict["later_tasks"] = later_tasks
        projects_list.append(p_dict)

    return {
        "focus": focus_list,
        "trivial": trivial_list,
        "standalone_focus": standalone_focus,
        "standalone_trivial": standalone_trivial,
        "projects": projects_list
    }

# --- Event Operations ---

def create_event(title: str,
                 start_time: str,
                 end_time: Optional[str] = None,
                 description: str = "",
                 project_name: Optional[str] = None,
                 recurrence: Optional[str] = None,
                 db_path: Optional[Path] = None) -> Dict[str, Any]:
    conn = get_connection(db_path)
    project_id = None
    if project_name:
        proj = get_or_create_project(project_name, db_path=db_path)
        project_id = proj["id"]

    with conn:
        cursor = conn.execute("""
            INSERT INTO events (title, description, project_id, start_time, end_time, recurrence)
            VALUES (?, ?, ?, ?, ?, ?)
        """, (title, description, project_id, start_time, end_time, recurrence))
        row = conn.execute("""
            SELECT e.*, p.name as project_name
            FROM events e
            LEFT JOIN projects p ON e.project_id = p.id
            WHERE e.id = ?
        """, (cursor.lastrowid,)).fetchone()
        return dict(row)

def update_event_status(event_id: int, status: str, db_path: Optional[Path] = None) -> Optional[Dict[str, Any]]:
    """Updates event status ('scheduled', 'completed', 'cancelled')."""
    conn = get_connection(db_path)
    with conn:
        conn.execute("UPDATE events SET status = ? WHERE id = ?", (status, event_id))
        row = conn.execute("""
            SELECT e.*, p.name as project_name
            FROM events e
            LEFT JOIN projects p ON e.project_id = p.id
            WHERE e.id = ?
        """, (event_id,)).fetchone()
        return dict(row) if row else None

def get_events_for_day(target_date: Optional[datetime.date] = None, db_path: Optional[Path] = None) -> List[Dict[str, Any]]:
    if target_date is None:
        target_date = datetime.date.today()
    date_str = target_date.strftime("%Y-%m-%d")
    conn = get_connection(db_path)
    rows = conn.execute("""
        SELECT e.*, p.name as project_name
        FROM events e
        LEFT JOIN projects p ON e.project_id = p.id
        WHERE date(e.start_time) = date(?) AND e.status IN ('scheduled', 'completed')
        ORDER BY CASE WHEN e.status = 'completed' THEN 1 ELSE 0 END ASC, e.start_time ASC
    """, (date_str,)).fetchall()
    
    events_list = []
    for r in rows:
        ed = dict(r)
        ed["start_time_military"] = format_military_time(ed.get("start_time"))
        events_list.append(ed)
    return events_list

# --- Reminder Operations ---

def create_reminder(title: str,
                    details: str = "",
                    reminder_date: Optional[str] = None,
                    task_id: Optional[int] = None,
                    recurrence: Optional[str] = None,
                    db_path: Optional[Path] = None) -> Dict[str, Any]:
    conn = get_connection(db_path)
    if reminder_date is None:
        reminder_date = datetime.date.today().strftime("%Y-%m-%d")
    with conn:
        cursor = conn.execute("""
            INSERT INTO reminders (title, details, task_id, reminder_date, recurrence)
            VALUES (?, ?, ?, ?, ?)
        """, (title, details, task_id, reminder_date, recurrence))
        row = conn.execute("SELECT * FROM reminders WHERE id = ?", (cursor.lastrowid,)).fetchone()
        return dict(row)

def get_reminders_for_day(target_date: Optional[datetime.date] = None, db_path: Optional[Path] = None) -> List[Dict[str, Any]]:
    if target_date is None:
        target_date = datetime.date.today()
    date_str = target_date.strftime("%Y-%m-%d")
    conn = get_connection(db_path)
    rows = conn.execute("""
        SELECT r.*, t.title as task_title
        FROM reminders r
        LEFT JOIN tasks t ON r.task_id = t.id
        WHERE (r.reminder_date = ? OR r.reminder_date IS NULL) AND r.is_done = 0
        ORDER BY r.created_at ASC
    """, (date_str,)).fetchall()
    return [dict(r) for r in rows]

def append_reminder_to_task(reminder_id: int, task_id: int, db_path: Optional[Path] = None) -> bool:
    conn = get_connection(db_path)
    with conn:
        conn.execute("UPDATE reminders SET task_id = ? WHERE id = ?", (task_id, reminder_id))
    return True

# --- Unorganized Queue Operations ---

def add_to_unorganized_queue(raw_input: str,
                             parsed_date: Optional[str] = None,
                             suggested_type: Optional[str] = None,
                             suggested_tier: Optional[str] = None,
                             suggested_project: Optional[str] = None,
                             reasoning: Optional[str] = None,
                             confidence: float = 0.0,
                             db_path: Optional[Path] = None) -> Dict[str, Any]:
    conn = get_connection(db_path)
    with conn:
        cursor = conn.execute("""
            INSERT INTO unorganized_queue (raw_input, parsed_date, suggested_type, suggested_tier, suggested_project, reasoning, confidence)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        """, (raw_input, parsed_date, suggested_type, suggested_tier, suggested_project, reasoning, confidence))
        row = conn.execute("SELECT * FROM unorganized_queue WHERE id = ?", (cursor.lastrowid,)).fetchone()
        return dict(row)

def get_unorganized_items(db_path: Optional[Path] = None) -> List[Dict[str, Any]]:
    conn = get_connection(db_path)
    rows = conn.execute("SELECT * FROM unorganized_queue WHERE status = 'pending' ORDER BY created_at DESC").fetchall()
    return [dict(r) for r in rows]

# --- Notes Operations ---

def get_notes(db_path: Optional[Path] = None) -> List[Dict[str, Any]]:
    conn = get_connection(db_path)
    rows = conn.execute("SELECT * FROM notes ORDER BY updated_at DESC").fetchall()
    return [dict(r) for r in rows]

def save_note(content: str, title: str = "Quick Note", note_id: Optional[int] = None, db_path: Optional[Path] = None) -> Dict[str, Any]:
    conn = get_connection(db_path)
    with conn:
        if note_id:
            conn.execute("UPDATE notes SET title = ?, content = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?", (title, content, note_id))
            row = conn.execute("SELECT * FROM notes WHERE id = ?", (note_id,)).fetchone()
        else:
            cursor = conn.execute("INSERT INTO notes (title, content) VALUES (?, ?)", (title, content))
            row = conn.execute("SELECT * FROM notes WHERE id = ?", (cursor.lastrowid,)).fetchone()
        return dict(row)

# --- History Log Operations ---

def log_history(raw_input: str,
                extracted_date: Optional[str],
                llm_classification: Dict[str, Any],
                target_entity_type: str,
                target_entity_id: Optional[int],
                status: str = "success",
                error_message: Optional[str] = None,
                db_path: Optional[Path] = None) -> int:
    conn = get_connection(db_path)
    with conn:
        cursor = conn.execute("""
            INSERT INTO history (raw_input, extracted_date, llm_classification, target_entity_type, target_entity_id, status, error_message)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        """, (raw_input, extracted_date, json.dumps(llm_classification), target_entity_type, target_entity_id, status, error_message))
        return cursor.lastrowid

def get_history(limit: int = 50, db_path: Optional[Path] = None) -> List[Dict[str, Any]]:
    conn = get_connection(db_path)
    rows = conn.execute("SELECT * FROM history ORDER BY created_at DESC LIMIT ?", (limit,)).fetchall()
    res = []
    for r in rows:
        d = dict(r)
        try:
            d["llm_classification"] = json.loads(d["llm_classification"])
        except Exception:
            pass
        res.append(d)
    return res

def get_history_archive(limit: int = 100, db_path: Optional[Path] = None) -> Dict[str, Any]:
    """Returns structured archive data for the History tab: completed projects, completed tasks, inactive reminders, and audit log."""
    conn = get_connection(db_path)

    # 1. Completed projects
    proj_rows = conn.execute("""
        SELECT p.*,
               (SELECT COUNT(*) FROM tasks t WHERE t.project_id = p.id AND t.status = 'completed') as completed_tasks_count,
               (SELECT COUNT(*) FROM tasks t WHERE t.project_id = p.id) as total_tasks_count
        FROM projects p
        WHERE p.status = 'completed'
        ORDER BY p.completed_at DESC, p.updated_at DESC
        LIMIT ?
    """, (limit,)).fetchall()
    completed_projects = []
    for pr in proj_rows:
        d = dict(pr)
        d["completed_at_military"] = format_military_time(d.get("completed_at") or d.get("updated_at"), include_date=True)
        completed_projects.append(d)

    # 2. Completed tasks
    task_rows = conn.execute("""
        SELECT t.*, p.name as project_name, p.color as project_color
        FROM tasks t
        LEFT JOIN projects p ON t.project_id = p.id
        WHERE t.status = 'completed'
        ORDER BY t.completed_at DESC, t.id DESC
        LIMIT ?
    """, (limit,)).fetchall()
    completed_tasks = []
    for tr in task_rows:
        d = dict(tr)
        d["completed_at_military"] = format_military_time(d.get("completed_at"), include_date=True)
        d["due_date_military"] = format_military_time(d.get("due_date"), include_date=True)
        completed_tasks.append(d)

    # 3. Inactive / Completed reminders
    rem_rows = conn.execute("""
        SELECT r.*, t.title as task_title, t.status as task_status
        FROM reminders r
        LEFT JOIN tasks t ON r.task_id = t.id
        WHERE r.is_done = 1 OR (r.task_id IS NOT NULL AND t.status = 'completed')
        ORDER BY r.created_at DESC
        LIMIT ?
    """, (limit,)).fetchall()
    inactive_reminders = []
    for rr in rem_rows:
        d = dict(rr)
        d["created_at_military"] = format_military_time(d.get("created_at"), include_date=True)
        inactive_reminders.append(d)

    # 4. Ingestion audit log
    audit_log = get_history(limit=50, db_path=db_path)

    return {
        "completed_projects": completed_projects,
        "completed_tasks": completed_tasks,
        "inactive_reminders": inactive_reminders,
        "audit_log": audit_log
    }

# --- Briefing & Exploded View Computations ---

# Witty remarks for daily briefing
WITTY_QUIPS_HEAVY = [
    "Drink your coffee black and pray the compiler shows mercy.",
    "Remember: sleep is just a free trial of death, so drink more caffeine.",
    "Your future self is already judging how you handle this queue.",
    "Houston, we don't have a problem, just an ambitious to-do list.",
    "Brace for impact—entropy is undefeated, but so is your resolve."
]
WITTY_QUIPS_LIGHT = [
    "A suspicious lack of chaos... almost feels like a trap.",
    "Clear schedule ahead. Don't invent problems just to feel productive.",
    "Coast is clear. Take the win before life remembers you exist.",
    "Zero fires to put out. Go touch grass or read a book.",
    "A clean slate: your brain's favorite holiday."
]
WITTY_QUIPS_BALANCED = [
    "Steady as she goes. Rome wasn't built in a day, but CAD files were.",
    "Smooth seas never made a skilled sailor—good thing this sea is just lukewarm water.",
    "Keep your eyes on the prize, or at least on the clock.",
    "One task at a time, unless you've figured out multithreading for humans."
]

def generate_tomorrow_outlook(target_date: datetime.date,
                              today_tasks: Optional[Dict[str, Any]] = None,
                              today_events: Optional[List[Any]] = None,
                              today_reminders: Optional[List[Any]] = None,
                              conn: Optional[sqlite3.Connection] = None,
                              db_path: Optional[Path] = None) -> Dict[str, Any]:
    if conn is None:
        conn = get_connection(db_path)
    if today_tasks is None:
        today_tasks = get_tasks_for_day(target_date, db_path)
    if today_events is None:
        today_events = get_events_for_day(target_date, db_path)
    if today_reminders is None:
        today_reminders = get_reminders_for_day(target_date, db_path)

    tomorrow_date = target_date + datetime.timedelta(days=1)
    tomorrow_str = tomorrow_date.strftime("%Y-%m-%d")

    tomorrow_task_rows = conn.execute("""
        SELECT t.*, p.name as project_name FROM tasks t
        LEFT JOIN projects p ON t.project_id = p.id
        WHERE t.status = 'pending' AND date(t.due_date) = date(?)
    """, (tomorrow_str,)).fetchall()

    tomorrow_focus = [dict(t) for t in tomorrow_task_rows if t["tier"] != "trivial"]
    tomorrow_trivial = [dict(t) for t in tomorrow_task_rows if t["tier"] == "trivial"]
    tomorrow_events = get_events_for_day(tomorrow_date, db_path)

    tomorrow_project_names = sorted(list(set(t["project_name"] for t in tomorrow_task_rows if t["project_name"])))

    tomorrow_reminders = conn.execute("""
        SELECT * FROM reminders
        WHERE (reminder_date = ? OR reminder_date IS NULL) AND is_done = 0
    """, (tomorrow_str,)).fetchall()

    # Compare workloads
    today_active_tasks = conn.execute("""
        SELECT id FROM tasks
        WHERE ((status = 'pending' AND (due_date IS NULL OR date(due_date) <= date(?)))
            OR (status = 'completed' AND date(completed_at) = date(?)))
          AND status != 'cancelled'
    """, (target_date.strftime("%Y-%m-%d"), target_date.strftime("%Y-%m-%d"))).fetchall()

    items_today_count = len(today_active_tasks) + len(today_events) + len(today_reminders)
    items_tomorrow_count = len(tomorrow_task_rows) + len(tomorrow_events) + len(tomorrow_reminders)

    if items_tomorrow_count == 0:
        comp_phrase = "Clear slate ahead—no looming deadlines for tomorrow."
        comparison = "empty"
        quips = WITTY_QUIPS_LIGHT
    elif items_tomorrow_count > items_today_count:
        diff = items_tomorrow_count - items_today_count
        comp_phrase = f"Heavier workload tomorrow ({items_tomorrow_count} vs {items_today_count} today, +{diff} more items)—brace your focus early."
        comparison = "heavier"
        quips = WITTY_QUIPS_HEAVY
    elif items_tomorrow_count < items_today_count:
        diff = items_today_count - items_tomorrow_count
        comp_phrase = f"Lighter horizon tomorrow ({items_tomorrow_count} vs {items_today_count} today, -{diff} fewer items)—a welcome window to breathe."
        comparison = "lighter"
        quips = WITTY_QUIPS_LIGHT
    else:
        comp_phrase = f"Balanced workload tomorrow ({items_tomorrow_count} items, steady pace with today)."
        comparison = "equal"
        quips = WITTY_QUIPS_BALANCED

    witty_quip = quips[tomorrow_date.day % len(quips)]

    # Item breakdown
    parts = []
    if tomorrow_task_rows:
        t_parts = []
        if tomorrow_focus:
            t_parts.append(f"{len(tomorrow_focus)} deep focus")
        if tomorrow_trivial:
            t_parts.append(f"{len(tomorrow_trivial)} trivial errand{'s' if len(tomorrow_trivial) != 1 else ''}")
        t_detail = f" ({', '.join(t_parts)})" if t_parts else ""
        parts.append(f"{len(tomorrow_task_rows)} task{'s' if len(tomorrow_task_rows) != 1 else ''}{t_detail}")

    if tomorrow_project_names:
        p_names = ", ".join(tomorrow_project_names[:2]) + ("…" if len(tomorrow_project_names) > 2 else "")
        parts.append(f"across {len(tomorrow_project_names)} project{'s' if len(tomorrow_project_names) != 1 else ''} ({p_names})")

    if tomorrow_events:
        parts.append(f"{len(tomorrow_events)} scheduled appointment{'s' if len(tomorrow_events) != 1 else ''}")

    if tomorrow_reminders:
        parts.append(f"{len(tomorrow_reminders)} reminder{'s' if len(tomorrow_reminders) != 1 else ''}")

    if parts:
        summary_text = "Tomorrow: " + "; ".join(parts) + "."
    else:
        summary_text = "Tomorrow: No scheduled items or deadlines."

    full_blurb = f"{summary_text} {comp_phrase} \"{witty_quip}\""

    return {
        "focus_count": len(tomorrow_focus),
        "trivial_count": len(tomorrow_trivial),
        "tasks_count": len(tomorrow_task_rows),
        "projects_count": len(tomorrow_project_names),
        "projects": tomorrow_project_names,
        "events_count": len(tomorrow_events),
        "reminders_count": len(tomorrow_reminders),
        "total_items": items_tomorrow_count,
        "comparison": comparison,
        "summary": summary_text,
        "comparison_phrase": comp_phrase,
        "witty_quip": witty_quip,
        "full_blurb": full_blurb
    }

def get_daily_briefing(target_date: Optional[datetime.date] = None, db_path: Optional[Path] = None) -> Dict[str, Any]:
    """Generates the briefing at the top of the main tab UI."""
    if target_date is None:
        target_date = datetime.date.today()
    
    today_tasks = get_tasks_for_day(target_date, db_path)
    today_events = get_events_for_day(target_date, db_path)
    today_reminders = get_reminders_for_day(target_date, db_path)
    active_projects = get_all_projects(db_path)
    unorganized = get_unorganized_items(db_path)

    conn = get_connection(db_path)
    outlook = generate_tomorrow_outlook(target_date, today_tasks, today_events, today_reminders, conn, db_path)

    return {
        "date": target_date.strftime("%A, %B %d, %Y"),
        "focus_count": len(today_tasks["focus"]),
        "trivial_count": len(today_tasks["trivial"]),
        "events_count": len(today_events),
        "reminders_count": len(today_reminders),
        "active_projects_count": len(active_projects),
        "unorganized_count": len(unorganized),
        "active_projects": [p["name"] for p in active_projects],
        "events_today": today_events,
        "tomorrow_outlook": outlook,
        "tomorrow_blurb": outlook["full_blurb"]
    }

def get_exploded_view(db_path: Optional[Path] = None) -> Dict[str, Any]:
    """Generates the Exploded View data: everything going on across all projects, tasks, events."""
    conn = get_connection(db_path)
    projects = get_all_projects(db_path)
    
    # Group tasks by project
    projects_with_tasks = []
    for p in projects:
        task_rows = conn.execute("""
            SELECT * FROM tasks WHERE project_id = ? AND status != 'cancelled'
            ORDER BY status ASC, priority_order ASC
        """, (p["id"],)).fetchall()
        tasks = []
        for t in task_rows:
            td = dict(t)
            td["urgency"] = compute_urgency(td["due_date"])
            tasks.append(td)
        p_copy = dict(p)
        p_copy["tasks"] = tasks
        projects_with_tasks.append(p_copy)

    # Standalone tasks (no project)
    unassigned_rows = conn.execute("""
        SELECT * FROM tasks WHERE project_id IS NULL AND status != 'cancelled'
        ORDER BY status ASC, priority_order ASC
    """).fetchall()
    unassigned_tasks = []
    for t in unassigned_rows:
        td = dict(t)
        td["urgency"] = compute_urgency(td["due_date"])
        unassigned_tasks.append(td)

    # All upcoming events
    events = conn.execute("SELECT e.*, p.name as project_name FROM events e LEFT JOIN projects p ON e.project_id = p.id WHERE e.status = 'scheduled' ORDER BY e.start_time ASC").fetchall()
    
    # All active reminders
    reminders = conn.execute("SELECT r.*, t.title as task_title FROM reminders r LEFT JOIN tasks t ON r.task_id = t.id WHERE r.is_done = 0 ORDER BY r.created_at ASC").fetchall()

    school_count = sum(1 for p in projects_with_tasks if (p.get("category") or "External").lower() == "school")
    external_count = sum(1 for p in projects_with_tasks if (p.get("category") or "External").lower() != "school")
    stats = {
        "total_projects": len(projects_with_tasks),
        "school_count": school_count,
        "external_count": external_count
    }

    return {
        "projects": projects_with_tasks,
        "standalone_tasks": unassigned_tasks,
        "events": [dict(e) for e in events],
        "reminders": [dict(r) for r in reminders],
        "stats": stats
    }

# --- Entity Detail & Re-sorting / Conversion Operations ---

def get_entity_detail(entity_type: str, entity_id: int, db_path: Optional[Path] = None) -> Optional[Dict[str, Any]]:
    conn = get_connection(db_path)
    clean_type = entity_type.lower()
    
    if clean_type == "task":
        return get_task_by_id(entity_id, db_path)
    elif clean_type == "event":
        row = conn.execute("""
            SELECT e.*, p.name as project_name, p.color as project_color
            FROM events e
            LEFT JOIN projects p ON e.project_id = p.id
            WHERE e.id = ?
        """, (entity_id,)).fetchone()
        return dict(row) if row else None
    elif clean_type == "reminder":
        row = conn.execute("""
            SELECT r.*, t.title as task_title
            FROM reminders r
            LEFT JOIN tasks t ON r.task_id = t.id
            WHERE r.id = ?
        """, (entity_id,)).fetchone()
        return dict(row) if row else None
    elif clean_type == "project":
        row = conn.execute("SELECT * FROM projects WHERE id = ?", (entity_id,)).fetchone()
        return dict(row) if row else None
    elif clean_type == "unorganized":
        row = conn.execute("SELECT * FROM unorganized_queue WHERE id = ?", (entity_id,)).fetchone()
        return dict(row) if row else None
    return None

def reclassify_entity(from_type: str,
                      from_id: int,
                      to_type: str,
                      title: str,
                      description: str = "",
                      project_name: Optional[str] = None,
                      tier: str = "focus",
                      due_date: Optional[str] = None,
                      status: str = "pending",
                      recurrence: Optional[str] = None,
                      color: Optional[str] = None,
                      category: Optional[str] = None,
                      db_path: Optional[Path] = None) -> Dict[str, Any]:
    """
    Edits an entity or converts it between Task, Event, Reminder, and Project.
    Allows complete manual re-sorting if the automatic engine got it wrong.
    Supports setting and changing recurrence rules, project color tags, and School/External categories.
    """
    conn = get_connection(db_path)
    clean_from = from_type.lower()
    clean_to = to_type.lower()

    project_id = None
    if project_name:
        proj = get_or_create_project(project_name, category=category or "External", db_path=db_path)
        project_id = proj["id"]

    # Case 1: In-place update within the same entity type
    if clean_from == clean_to:
        with conn:
            if clean_to == "task":
                conn.execute("""
                    UPDATE tasks SET title = ?, description = ?, project_id = ?, tier = ?, due_date = ?, status = ?, recurrence = ?
                    WHERE id = ?
                """, (title, description, project_id, tier, due_date, status, recurrence, from_id))
            elif clean_to == "event":
                conn.execute("""
                    UPDATE events SET title = ?, description = ?, project_id = ?, start_time = ?, status = ?, recurrence = ?
                    WHERE id = ?
                """, (title, description, project_id, due_date or str(datetime.datetime.now()), status, recurrence, from_id))
            elif clean_to == "reminder":
                rem_date = due_date.split(" ")[0] if due_date else None
                conn.execute("""
                    UPDATE reminders SET title = ?, details = ?, reminder_date = ?, recurrence = ?
                    WHERE id = ?
                """, (title, description, rem_date, recurrence, from_id))
            elif clean_to == "project":
                valid_cat = "School" if category and category.lower() == "school" else ("External" if category else None)
                conn.execute("""
                    UPDATE projects 
                    SET name = ?, description = ?, color = COALESCE(?, color), category = COALESCE(?, category), updated_at = CURRENT_TIMESTAMP 
                    WHERE id = ?
                """, (title, description, color, valid_cat, from_id))

        if clean_to == "task":
            return {"status": "success", "entity_type": "task", "entity": get_task_by_id(from_id, db_path)}
        else:
            return {"status": "success", "entity_type": clean_to, "entity": get_entity_detail(clean_to, from_id, db_path)}

    # Case 2: Conversion across types
    with conn:
        # Delete old row from source table
        if clean_from == "task":
            conn.execute("DELETE FROM tasks WHERE id = ?", (from_id,))
        elif clean_from == "event":
            conn.execute("DELETE FROM events WHERE id = ?", (from_id,))
        elif clean_from == "reminder":
            conn.execute("DELETE FROM reminders WHERE id = ?", (from_id,))
        elif clean_from == "unorganized":
            conn.execute("UPDATE unorganized_queue SET status = 'processed' WHERE id = ?", (from_id,))

    # Now create new row into destination table cleanly
    new_entity = None
    if clean_to == "task":
        new_entity = create_task(title=title, description=description, project_name=project_name, tier=tier, due_date=due_date, recurrence=recurrence, db_path=db_path)
    elif clean_to == "event":
        new_entity = create_event(title=title, description=description, project_name=project_name, start_time=due_date or str(datetime.datetime.now()), recurrence=recurrence, db_path=db_path)
    elif clean_to == "reminder":
        rem_date = due_date.split(" ")[0] if due_date else None
        new_entity = create_reminder(title=title, details=description, reminder_date=rem_date, db_path=db_path)
    elif clean_to == "project":
        valid_cat = "School" if category and category.lower() == "school" else "External"
        new_entity = create_project(name=title, description=description, color=color, category=valid_cat, db_path=db_path)

    return {"status": "success", "entity_type": clean_to, "entity": new_entity}

# --- Multi-Scale Scalable Timeline Operations (Day, Month, Year) ---

def _build_day_timeline(conn, target_date: datetime.date) -> Dict[str, Any]:
    date_str = target_date.strftime("%Y-%m-%d")
    tasks = conn.execute("""
        SELECT t.*, p.name as project_name, p.color as project_color
        FROM tasks t LEFT JOIN projects p ON t.project_id = p.id
        WHERE date(t.due_date) = date(?) AND t.status != 'cancelled'
        ORDER BY t.due_date ASC
    """, (date_str,)).fetchall()

    events = conn.execute("""
        SELECT e.*, p.name as project_name, p.color as project_color
        FROM events e LEFT JOIN projects p ON e.project_id = p.id
        WHERE date(e.start_time) = date(?) AND e.status != 'cancelled'
        ORDER BY e.start_time ASC
    """, (date_str,)).fetchall()

    # Build 24-hour slots
    hours = {h: {"tasks": [], "events": []} for h in range(24)}
    for t in tasks:
        td = dict(t)
        td["urgency"] = compute_urgency(td["due_date"])
        td["due_date_military"] = format_military_time(td["due_date"])
        try:
            hour = int(td["due_date"].split(" ")[1].split(":")[0])
        except Exception:
            hour = 9 # Default morning slot
        hours[hour]["tasks"].append(td)

    for e in events:
        ed = dict(e)
        ed["start_time_military"] = format_military_time(ed["start_time"])
        try:
            hour = int(ed["start_time"].split(" ")[1].split(":")[0])
        except Exception:
            hour = 12
        hours[hour]["events"].append(ed)

    return {
        "scale": "day",
        "date": date_str,
        "year": target_date.year,
        "month": target_date.month,
        "day": target_date.day,
        "display_date": target_date.strftime("%A, %B %d, %Y"),
        "hours": hours
    }

def get_timeline_data(scale: str = "day",
                      year: Optional[int] = None,
                      month: Optional[int] = None,
                      day: Optional[int] = None,
                      start_date: Optional[str] = None,
                      end_date: Optional[str] = None,
                      days_around: Optional[int] = None,
                      db_path: Optional[Path] = None) -> Dict[str, Any]:
    """
    Returns scalable timeline data:
    - day: 24-hour vertical slot list for the specified day
    - range: Multi-day continuous slots for infinite graphic timeline
    - month: Calendar days matrix with task counts, events, and urgency density
    - year: 12-month bird's-eye milestone roadmap
    """
    now = datetime.datetime.now()
    year = year or now.year
    month = month or now.month
    day = day or now.day
    target_date = datetime.date(year, month, day)

    conn = get_connection(db_path)

    if scale == "month":
        # Calculate start and end of month
        import calendar
        _, num_days = calendar.monthrange(year, month)
        first_day_weekday = calendar.monthrange(year, month)[0] # 0 = Monday

        days_data = []
        for d in range(1, num_days + 1):
            curr_date = datetime.date(year, month, d)
            curr_str = curr_date.strftime("%Y-%m-%d")
            
            task_rows = conn.execute("""
                SELECT t.*, p.name as project_name FROM tasks t
                LEFT JOIN projects p ON t.project_id = p.id
                WHERE date(t.due_date) = date(?) AND t.status != 'cancelled'
            """, (curr_str,)).fetchall()
            
            event_rows = conn.execute("""
                SELECT e.*, p.name as project_name FROM events e
                LEFT JOIN projects p ON e.project_id = p.id
                WHERE date(e.start_time) = date(?) AND e.status != 'cancelled'
            """, (curr_str,)).fetchall()

            urgencies = [compute_urgency(t["due_date"])["level"] for t in task_rows if t["due_date"]]
            has_urgent = "urgent" in urgencies
            has_normal = "normal" in urgencies

            days_data.append({
                "day": d,
                "date": curr_str,
                "is_today": curr_str == now.strftime("%Y-%m-%d"),
                "task_count": len(task_rows),
                "event_count": len(event_rows),
                "has_urgent": has_urgent,
                "has_normal": has_normal
            })

        return {
            "scale": "month",
            "year": year,
            "month": month,
            "month_name": target_date.strftime("%B"),
            "first_weekday": first_day_weekday,
            "days_in_month": num_days,
            "days": days_data
        }

    elif scale == "year":
        months_data = []
        for m in range(1, 13):
            m_dt = datetime.date(year, m, 1)
            t_cnt = conn.execute("""
                SELECT COUNT(*) FROM tasks 
                WHERE strftime('%Y-%m', due_date) = ? AND status != 'cancelled'
            """, (f"{year:04d}-{m:02d}",)).fetchone()[0]

            e_cnt = conn.execute("""
                SELECT COUNT(*) FROM events 
                WHERE strftime('%Y-%m', start_time) = ? AND status != 'cancelled'
            """, (f"{year:04d}-{m:02d}",)).fetchone()[0]

            density = "low"
            if (t_cnt + e_cnt) > 20: density = "heavy"
            elif (t_cnt + e_cnt) > 8: density = "moderate"

            months_data.append({
                "month": m,
                "name": m_dt.strftime("%B"),
                "task_count": t_cnt,
                "event_count": e_cnt,
                "density": density
            })

        return {
            "scale": "year",
            "year": year,
            "months": months_data
        }

    elif scale == "day" and days_around is None and start_date is None:
        return _build_day_timeline(conn, target_date)

    elif scale == "range" or days_around is not None or start_date is not None:
        if start_date and end_date:
            cur_d = datetime.date.fromisoformat(start_date)
            end_d = datetime.date.fromisoformat(end_date)
        elif days_around is not None:
            cur_d = target_date - datetime.timedelta(days=days_around)
            end_d = target_date + datetime.timedelta(days=days_around)
        else:
            cur_d = target_date - datetime.timedelta(days=3)
            end_d = target_date + datetime.timedelta(days=3)

        days_list = []
        while cur_d <= end_d:
            days_list.append(_build_day_timeline(conn, cur_d))
            cur_d += datetime.timedelta(days=1)

        return {
            "scale": "range",
            "target_date": target_date.strftime("%Y-%m-%d"),
            "days": days_list
        }

    return {"scale": scale}

# --- Realistic Sample Data Seeder & Purger ---

# --- Realistic Full-Week Sample Data Seeder & Purger ---

def seed_sample_data(db_path: Optional[Path] = None) -> Dict[str, Any]:
    """Seeds a rich, cohesive full-week dataset (Monday through Sunday) for testing and demos."""
    # 1. Clear any prior sample items first to avoid duplication
    clear_sample_data(db_path)

    today = datetime.date.today()
    # Compute Monday of current week so Mon-Sun are cohesive
    start_of_week = today - datetime.timedelta(days=today.weekday())
    mon = start_of_week
    tue = start_of_week + datetime.timedelta(days=1)
    wed = start_of_week + datetime.timedelta(days=2)
    thu = start_of_week + datetime.timedelta(days=3)
    fri = start_of_week + datetime.timedelta(days=4)
    sat = start_of_week + datetime.timedelta(days=5)
    sun = start_of_week + datetime.timedelta(days=6)
    next_mon = start_of_week + datetime.timedelta(days=7)
    in_three_weeks = today + datetime.timedelta(days=21)
    in_three_months = today + datetime.timedelta(days=90)

    # 2. Rich Demo Projects with distinct colors
    p1 = create_project("IDEA-1 Concept", "Modular satellite bus chassis and thermal avionics prototyping [SAMPLE]", color="#3b82f6", db_path=db_path)
    p2 = create_project("Autonomous Rover", "ROS2 mobile robotics platform with multi-sensor telemetry [SAMPLE]", color="#10b981", db_path=db_path)
    p3 = create_project("Social Science 1D", "Cognitive behavioral research and behavioral economics symposium [SAMPLE]", color="#f59e0b", db_path=db_path)
    p4 = create_project("Home Server Node", "Shuttle DH610 mini PC infrastructure and private Tailscale mesh [SAMPLE]", color="#6366f1", db_path=db_path)
    p5 = create_project("Personal Health & Fitness", "Strength training, aerobic endurance, and recovery tracking [SAMPLE]", color="#ec4899", db_path=db_path)

    # Helper for creating sample tasks
    def add_s_task(title: str, due_date: str, due_raw: str, tier: str = "focus", proj: Optional[str] = None, desc: str = "", completed: bool = False, recurrence: Optional[str] = None, priority: str = "normal"):
        t = create_task(
            title=title,
            description=f"{desc} [SAMPLE]" if desc else "[SAMPLE]",
            project_name=proj,
            tier=tier,
            due_date=due_date,
            due_date_raw=due_raw,
            recurrence=recurrence,
            priority_placement=priority,
            db_path=db_path
        )
        if completed and t and "id" in t:
            update_task_status(t["id"], "completed", db_path)
        return t

    # Helper for creating sample events
    def add_s_event(title: str, start: str, end: str, proj: Optional[str] = None, desc: str = "", status: str = "scheduled"):
        conn = get_connection(db_path)
        pid = None
        if proj:
            p_obj = get_or_create_project(proj, db_path)
            pid = p_obj["id"]
        with conn:
            conn.execute("""
                INSERT INTO events (title, description, project_id, start_time, end_time, status)
                VALUES (?, ?, ?, ?, ?, ?)
            """, (title, f"{desc} [SAMPLE]" if desc else "[SAMPLE]", pid, start, end, status))

    # Helper for creating sample reminders
    def add_s_reminder(title: str, rem_date: str, details: str = ""):
        create_reminder(
            title=title,
            details=f"{details} [SAMPLE]" if details else "[SAMPLE]",
            reminder_date=rem_date,
            db_path=db_path
        )

    # ==================== MONDAY ====================
    add_s_task("Derive Kalman filter equations for attitude estimation", f"{mon.strftime('%Y-%m-%d')} 11:30:00", "Mon 11:30", tier="focus", proj="Autonomous Rover", desc="Fuse 3-axis gyro and accelerometer telemetry with covariance matrix", completed=True, priority="top")
    add_s_task("CAD chassis iterations for IDEA-1 payload housing", f"{mon.strftime('%Y-%m-%d')} 15:00:00", "Mon 15:00", tier="focus", proj="IDEA-1 Concept", desc="Refine 6061 aluminium wall thickness and internal thermal ribbing", completed=True, priority="high")
    add_s_task("Draft comparative trade study for CubeSat propulsion systems", f"{mon.strftime('%Y-%m-%d')} 21:00:00", "Tonight 21:00", tier="focus", proj="IDEA-1 Concept", desc="Evaluate pulsed plasma vs cold gas thruster performance metrics", priority="high")
    add_s_task("Configure Tailscale subnet routes and exit node on Shuttle DH610", f"{mon.strftime('%Y-%m-%d')} 23:59:00", "Tonight 23:59", tier="focus", proj="Home Server Node", desc="Enable IP forwarding in sysctl.conf and verify dual Intel LAN connectivity", priority="normal")
    add_s_task("Pick up electronic components parcel from Amazon locker", f"{mon.strftime('%Y-%m-%d')} 18:30:00", "Mon 18:30", tier="trivial", desc="Six-digit retrieval PIN stored in confirmation email")
    add_s_task("Order replacement soldering tips and lead-free flux", f"{mon.strftime('%Y-%m-%d')} 12:00:00", "Mon 12:00", tier="trivial", desc="T12 bevel and needle chisel tip pack", completed=True)
    add_s_event("Engineering Architecture Review", f"{mon.strftime('%Y-%m-%d')} 09:30:00", f"{mon.strftime('%Y-%m-%d')} 11:00:00", proj="IDEA-1 Concept", desc="Present initial subsystem partitioning to team leads", status="completed")
    add_s_event("Project Sync with Academic Advisor", f"{mon.strftime('%Y-%m-%d')} 14:00:00", f"{mon.strftime('%Y-%m-%d')} 15:30:00", proj="Social Science 1D", desc="Review quantitative analysis methodology and sample size", status="completed")
    add_s_reminder("Bring printed syllabus and spare calculator to evening lab", mon.strftime('%Y-%m-%d'), "Required for practical calibration exam")

    # ==================== TUESDAY ====================
    add_s_task("Simulate IDEA-1 thermal airflow distribution in OpenFOAM", f"{tue.strftime('%Y-%m-%d')} 14:00:00", "Tue 14:00", tier="focus", proj="IDEA-1 Concept", desc="Verify max temperature does not exceed 65C under vacuum solar flux", priority="top")
    add_s_task("Study chapter 4 lecture notes for Social Science 1D", f"{tue.strftime('%Y-%m-%d')} 17:30:00", "Tue 17:30", tier="focus", proj="Social Science 1D", desc="Focus on cognitive behavioral models and decision heuristics", priority="high")
    add_s_task("Flash updated firmware to brushless motor ESCs", f"{tue.strftime('%Y-%m-%d')} 21:00:00", "Tue 21:00", tier="focus", proj="Autonomous Rover", desc="Calibrate bidirectional DShot protocol and current telemetry feedback", priority="normal")
    add_s_task("Take trash out to curbside collection bin", f"{tue.strftime('%Y-%m-%d')} 20:00:00", "Every Tuesday 20:00", tier="trivial", recurrence="FREQ=WEEKLY;BYDAY=TU", desc="General recycling and sorted plastics bin")
    add_s_event("Autonomous Rover Field Telemetry Test", f"{tue.strftime('%Y-%m-%d')} 10:00:00", f"{tue.strftime('%Y-%m-%d')} 12:00:00", proj="Autonomous Rover", desc="Live outdoor RTK-GPS waypoint navigation and wheel slip testing")
    add_s_event("Guest Lecture: Orbital Mechanics & Trajectory Analysis", f"{tue.strftime('%Y-%m-%d')} 15:00:00", f"{tue.strftime('%Y-%m-%d')} 16:30:00", proj="IDEA-1 Concept", desc="Guest seminar by Dr. Aris Thorne in Hall 4B")
    add_s_reminder("Return inter-library loan engineering textbooks", tue.strftime('%Y-%m-%d'), "Front desk circulation returns bin")

    # ==================== WEDNESDAY ====================
    add_s_task("Synthesize multi-modal sensor fusion in ROS2", f"{wed.strftime('%Y-%m-%d')} 13:30:00", "Wed 13:30", tier="focus", proj="Autonomous Rover", desc="Combine depth camera point-cloud with 2D LiDAR laser scans", priority="top")
    add_s_task("Draft Midterm essay outline on behavioral economics", f"{wed.strftime('%Y-%m-%d')} 18:00:00", "Wed 18:00", tier="focus", proj="Social Science 1D", desc="Structure thesis argument on loss aversion in volatile markets", priority="high")
    add_s_task("Inspect mini PC CPU temperature and power consumption", f"{wed.strftime('%Y-%m-%d')} 16:00:00", "Wed 16:00", tier="trivial", proj="Home Server Node", desc="Check lm-sensors readings under full SQLite WAL checkpoint stress")
    add_s_event("Faculty Research Colloquium & Lunch", f"{wed.strftime('%Y-%m-%d')} 11:30:00", f"{wed.strftime('%Y-%m-%d')} 13:00:00", proj="Social Science 1D", desc="Interdisciplinary department presentations in Faculty Lounge")
    add_s_event("Strength & Conditioning Gym Session", f"{wed.strftime('%Y-%m-%d')} 19:00:00", f"{wed.strftime('%Y-%m-%d')} 20:30:00", proj="Personal Health & Fitness", desc="Compound lift progression and rotational core work")
    add_s_reminder("Water office indoor plants and check hydroponic reservoir", wed.strftime('%Y-%m-%d'), "Top up nutrient solution to 1.4 EC")

    # ==================== THURSDAY ====================
    add_s_task("3D print IDEA-1 avionics bay bracket prototypes in PETG", f"{thu.strftime('%Y-%m-%d')} 12:00:00", "Thu 12:00", tier="focus", proj="IDEA-1 Concept", desc="4 perimeters, 40% gyroid infill for structural vibration damping", priority="top")
    add_s_task("Benchmark local LLM inference latency on Shuttle DH610 (i3-12th Gen)", f"{thu.strftime('%Y-%m-%d')} 17:00:00", "Thu 17:00", tier="focus", proj="Home Server Node", desc="Compare llama3.2:3b q4_k_m vs qwen2.5:3b tokens/sec across 16GB dual-channel DDR4-3200", priority="high")
    add_s_task("Review propulsion cold gas test valve specifications", f"{thu.strftime('%Y-%m-%d')} 22:00:00", "Thu 22:00", tier="focus", proj="IDEA-1 Concept", desc="Verify 3000 PSI burst disc threshold and solenoid response time", priority="normal")
    add_s_task("Restock filament spools and desiccant packs", f"{thu.strftime('%Y-%m-%d')} 15:30:00", "Thu 15:30", tier="trivial", desc="Transfer newly opened spools into sealed dry box")
    add_s_event("Sprint Demo & Engineering Progress Presentation", f"{thu.strftime('%Y-%m-%d')} 10:00:00", f"{thu.strftime('%Y-%m-%d')} 11:30:00", proj="IDEA-1 Concept", desc="Bi-weekly progress showcase to stakeholders")
    add_s_event("Study Group Review: Cognitive Psychology", f"{thu.strftime('%Y-%m-%d')} 14:30:00", f"{thu.strftime('%Y-%m-%d')} 16:00:00", proj="Social Science 1D", desc="Group discussion on Kahneman heuristics and experimental findings")
    add_s_reminder("Check tire pressures and oil before weekend road trip", thu.strftime('%Y-%m-%d'), "Target 34 PSI front and rear")

    # ==================== FRIDAY ====================
    add_s_task("Assemble and wire power distribution board with surge protection", f"{fri.strftime('%Y-%m-%d')} 14:00:00", "Fri 14:00", tier="focus", proj="Autonomous Rover", desc="Solder XT60 connectors and TVS diode transient clamp circuit", priority="top")
    add_s_task("Synthesize weekly research findings into thesis notes", f"{fri.strftime('%Y-%m-%d')} 16:30:00", "Fri 16:30", tier="focus", proj="Social Science 1D", desc="Format citations in APA style and export annotated bibliography", priority="high")
    add_s_task("Back up SQLite database and config to offsite storage", f"{fri.strftime('%Y-%m-%d')} 18:00:00", "Fri 18:00", tier="trivial", proj="Home Server Node", desc="Generate encrypted tar.gz snapshot and verify checksum")
    add_s_event("End-of-Week Team Wrap-Up & Milestone Sync", f"{fri.strftime('%Y-%m-%d')} 15:30:00", f"{fri.strftime('%Y-%m-%d')} 16:30:00", proj="IDEA-1 Concept", desc="Retro on completed deliverables and next week objectives")
    add_s_event("Dinner & Social with Robotics Lab Colleagues", f"{fri.strftime('%Y-%m-%d')} 19:00:00", f"{fri.strftime('%Y-%m-%d')} 21:30:00", desc="Casual social dinner at Downtown Bistro")
    add_s_reminder("Confirm hotel booking and flight tickets for symposium", fri.strftime('%Y-%m-%d'), "Check boarding passes in airline app")

    # ==================== SATURDAY ====================
    add_s_task("Deep dive into state estimation literature and covariance bounds", f"{sat.strftime('%Y-%m-%d')} 11:00:00", "Sat 11:00", tier="focus", proj="Autonomous Rover", desc="Read papers on invariant extended Kalman filtering for nonlinear manifolds", priority="top")
    add_s_task("Solder custom CAN-bus transceiver wire harness", f"{sat.strftime('%Y-%m-%d')} 16:00:00", "Sat 16:00", tier="focus", proj="IDEA-1 Concept", desc="Twisted shielded pair cabling with silicone strain reliefs", priority="normal")
    add_s_task("Weekly farmers market grocery run and meal preparation", f"{sat.strftime('%Y-%m-%d')} 10:00:00", "Sat 10:00", tier="trivial", proj="Personal Health & Fitness", desc="Stock up on fresh greens, lean proteins, and produce for the week")
    add_s_task("Clean and calibrate 3D printer PEI bed", f"{sat.strftime('%Y-%m-%d')} 14:00:00", "Sat 14:00", tier="trivial", desc="Wash with warm soapy water and re-run bed level mesh probe")
    add_s_event("Weekend Endurance Cycling & Hill Ride", f"{sat.strftime('%Y-%m-%d')} 07:30:00", f"{sat.strftime('%Y-%m-%d')} 09:30:00", proj="Personal Health & Fitness", desc="45 km mountain loop with 600m climbing elevation")
    add_s_reminder("Clean dust filters on mini PC home server", sat.strftime('%Y-%m-%d'), "Rinse mesh filter and inspect intake fans")

    # ==================== SUNDAY ====================
    add_s_task("Weekly executive planning & goal mapping for next cycle", f"{sun.strftime('%Y-%m-%d')} 15:00:00", "Sun 15:00", tier="focus", proj="Home Server Node", desc="Review milestone burndown charts and allocate sprint priorities", priority="top")
    add_s_task("Finalize reading synthesis for Social Science 1D lecture 5", f"{sun.strftime('%Y-%m-%d')} 18:00:00", "Sun 18:00", tier="focus", proj="Social Science 1D", desc="Summarize social learning theory and observational reinforcement", priority="high")
    add_s_task("Deep clean workstation and organize electronics lab bench", f"{sun.strftime('%Y-%m-%d')} 12:00:00", "Sun 12:00", tier="trivial", desc="Organize test leads, wipe down cutting mat, organize SMD bins")
    add_s_event("Family Video Call", f"{sun.strftime('%Y-%m-%d')} 11:00:00", f"{sun.strftime('%Y-%m-%d')} 12:00:00", desc="Weekly catch-up call over video link")
    add_s_event("Sunday Evening Meditation & Digital Sunset", f"{sun.strftime('%Y-%m-%d')} 20:30:00", f"{sun.strftime('%Y-%m-%d')} 21:30:00", proj="Personal Health & Fitness", desc="Wind down screen time, read physical book, prep for Monday")
    add_s_reminder("Charge drone battery packs and inspect propellers", sun.strftime('%Y-%m-%d'), "Balance charge 4S LiPo packs to storage voltage")

    # ==================== UPCOMING LONGER-RANGE TARGETS ====================
    add_s_task("Annual project milestone synthesis and report", f"{in_three_months.strftime('%Y-%m-%d')} 17:00:00", "In 3 months", tier="focus", proj="IDEA-1 Concept", desc="Compile year-end deliverables and budget reconciliation")
    add_s_event("Social Science 1D Midterm Exam", f"{in_three_weeks.strftime('%Y-%m-%d')} 10:00:00", f"{in_three_weeks.strftime('%Y-%m-%d')} 12:00:00", proj="Social Science 1D", desc="Room 302 Auditorium - bring photo ID and blue book")

    # 3. Rich Technical Reference Notes
    save_note(
        title="IDEA-1 Avionics Pinout & Power Architecture [SAMPLE]",
        content="""# IDEA-1 Avionics Pinout & Power Architecture

- **Bus Voltage**: 12V LiFePO4 battery pack with 5V/3.3V step-down buck regulators.
- **Telemetry Protocol**: CAN-bus 2.0B operating at 1 Mbps with 120Ω termination resistors.
- **Sensor Payload**: BMI088 6-DOF IMU, MS5611 barometric pressure sensor, and u-blox M9N GNSS module.
- **Microcontroller**: Dual-core Cortex-M7 running FreeRTOS with hard real-time sensor polling threads.
- **Thermal Dissipation**: Conductive heat-pipe chassis transfer to exterior radiator panels.
[SAMPLE]""",
        db_path=db_path
    )
    save_note(
        title="Shuttle DH610 Home Server Runbook [SAMPLE]",
        content="""# Shuttle DH610 Mini PC - Home Server Runbook

- **Hardware**: Intel Core i3 12th Gen (4C/8T @ 3.3-4.3 GHz, 60W max / ~8W idle), 16GB DDR4-3200 Dual-Channel, 512GB NVMe SSD.
- **Enclosure**: Shuttle XPC Slim DH610 (1.3L industrial steel chassis, dual-heatpipe ICE cooling module).
- **Operating System**: Ubuntu Server 24.04 LTS (Linux Kernel 6.8+ with native `intel_pstate`).
- **Networking**: Dual Intel LAN (1GbE + 2.5GbE), Tailscale MagicDNS active (`http://shuttle:8000`), zero port forwarding required.
- **Durability & Power**: Hardware Always-On Jumper (JP01) enabled; SQLite Write-Ahead Logging (WAL) with hourly checkpointing and daily zip snapshots.
- **Acoustics & Power**: ~7-10W idle, whisper-quiet Shuttle Smart Fan profile.
[SAMPLE]""",
        db_path=db_path
    )
    save_note(
        title="Autonomous Rover Milestone Checklist [SAMPLE]",
        content="""# Autonomous Rover Milestone Checklist

- [x] Integrate 3-axis gyro covariance matrix into extended Kalman filter
- [x] Verify wheel encoder odometry against visual odometry stream
- [x] Flash bidirectional DShot protocol to brushless motor ESCs
- [ ] Tune Nav2 costmap inflation radius for dynamic obstacle avoidance
- [ ] Validate emergency software stop (e-stop) over 5GHz Wi-Fi link
[SAMPLE]""",
        db_path=db_path
    )

    # 4. Realistic History Ingestion Logs
    conn = get_connection(db_path)
    with conn:
        conn.execute("""
            INSERT INTO history (raw_input, extracted_date, llm_classification, target_entity_type, target_entity_id, status)
            VALUES 
            ('Review propulsion test telemetry tonight 2359 top priority [SAMPLE]', ?, '{"type":"task","tier":"focus","priority":"top"}', 'task', NULL, 'success'),
            ('Schedule CAD model review Friday 1500 high priority [SAMPLE]', ?, '{"type":"event","tier":"focus","priority":"high"}', 'event', NULL, 'success'),
            ('Pick up electronic components parcel from Amazon locker [SAMPLE]', ?, '{"type":"task","tier":"trivial","priority":"normal"}', 'task', NULL, 'success'),
            ('Simulate IDEA-1 thermal airflow distribution in OpenFOAM [SAMPLE]', ?, '{"type":"task","tier":"focus","priority":"top"}', 'task', NULL, 'success'),
            ('Synthesize multi-modal sensor fusion in ROS2 [SAMPLE]', ?, '{"type":"task","tier":"focus","priority":"top"}', 'task', NULL, 'success')
        """, (mon.strftime("%Y-%m-%d"), fri.strftime("%Y-%m-%d"), mon.strftime("%Y-%m-%d"), tue.strftime("%Y-%m-%d"), wed.strftime("%Y-%m-%d")))

    return {"status": "success", "message": "Full-week demo data populated across all 7 days!"}

def clear_sample_data(db_path: Optional[Path] = None) -> Dict[str, Any]:
    """Purges all seeded sample data cleanly."""
    conn = get_connection(db_path)
    with conn:
        conn.execute("DELETE FROM tasks WHERE description LIKE '%[SAMPLE]%'")
        conn.execute("DELETE FROM events WHERE description LIKE '%[SAMPLE]%'")
        conn.execute("DELETE FROM reminders WHERE details LIKE '%[SAMPLE]%'")
        conn.execute("DELETE FROM notes WHERE content LIKE '%[SAMPLE]%' OR title LIKE '%[SAMPLE]%'")
        conn.execute("DELETE FROM history WHERE raw_input LIKE '%[SAMPLE]%'")
        # Clean up projects that were only created for sample data and have no non-sample tasks or events left
        conn.execute("""
            DELETE FROM projects 
            WHERE description LIKE '%[SAMPLE]%'
              AND id NOT IN (SELECT DISTINCT project_id FROM tasks WHERE project_id IS NOT NULL)
              AND id NOT IN (SELECT DISTINCT project_id FROM events WHERE project_id IS NOT NULL)
        """)
    return {"status": "success", "message": "Sample items cleared."}

def clear_all_data(db_path: Optional[Path] = None) -> Dict[str, Any]:
    """
    Wipes ALL data from every table for a complete clean-slate reset.
    Intended for testing / demo purposes only.
    """
    conn = get_connection(db_path)
    with conn:
        conn.execute("DELETE FROM tasks")
        conn.execute("DELETE FROM events")
        conn.execute("DELETE FROM reminders")
        conn.execute("DELETE FROM unorganized_queue")
        conn.execute("DELETE FROM projects")
        conn.execute("DELETE FROM notes")
        # Reset auto-increment counters so IDs start fresh
        conn.execute("DELETE FROM sqlite_sequence WHERE name IN ('tasks','events','reminders','unorganized_queue','projects','notes')")
    return {"status": "success", "message": "All data cleared. Database reset to clean slate."}

# --- Rich-Text Morning Executive Briefing Generator ---

def get_rich_text_briefing(target_date: Optional[datetime.date] = None, db_path: Optional[Path] = None) -> str:
    """
    Formats the daily briefing as clean, readable rich text:
    *TASKS* -> _Trivial_ -> - Task A...
    A quick 20-second snapshot for the morning.
    """
    if target_date is None:
        target_date = datetime.date.today()
    
    tasks = get_tasks_for_day(target_date, db_path)
    events = get_events_for_day(target_date, db_path)
    reminders = get_reminders_for_day(target_date, db_path)
    briefing = get_daily_briefing(target_date, db_path)

    lines = []
    lines.append(f"📋 PETTR MORNING BRIEF — {target_date.strftime('%A, %b %d, %Y')}")
    lines.append("─" * 48)

    # Focus Tasks
    lines.append("\n🎯 *FOCUS TASKS (Deep Work — Ranked by Priority)*")
    if tasks["focus"]:
        for idx, t in enumerate(tasks["focus"], 1):
            urg = "[URGENT] " if t.get("urgency", {}).get("level") == "urgent" else ""
            proj = f" ({t['project_name']})" if t.get("project_name") else ""
            time_mil = format_military_time(t.get("due_date") or t.get("due_date_raw"))
            due = f" — Due {time_mil}" if time_mil else ""
            lines.append(f"  {idx:02d}. {urg}{t['title']}{due}{proj}")
    else:
        lines.append("  • _(No pending focus tasks for today)_")

    # Trivial Tasks
    lines.append("\n⚡ *TRIVIAL ERRANDS (Ranked by Priority)*")
    if tasks["trivial"]:
        for idx, t in enumerate(tasks["trivial"], 1):
            time_mil = format_military_time(t.get("due_date") or t.get("due_date_raw"))
            due = f" — Due {time_mil}" if time_mil else ""
            rec = f" [↻ {t['recurrence'].replace('FREQ=WEEKLY;BYDAY=', 'Weekly ')}]" if t.get("recurrence") else ""
            lines.append(f"  {idx:02d}. {t['title']}{due}{rec}")
    else:
        lines.append("  • _(No quick errands pending)_")

    # Scheduled Events
    lines.append("\n📅 *SCHEDULED APPOINTMENTS*")
    if events:
        for idx, e in enumerate(events, 1):
            time_part = format_military_time(e['start_time']) or "Today"
            proj = f" [{e['project_name']}]" if e.get("project_name") else ""
            lines.append(f"  {idx:02d}. {time_part} : {e['title']}{proj}")
    else:
        lines.append("  • _(No events scheduled today)_")

    # Reminders
    lines.append("\n🔔 *REMINDERS FOR TODAY (REMINDERS TO SELF)*")
    if reminders:
        for idx, r in enumerate(reminders, 1):
            detail = f" — _{r['details']}_" if r.get("details") else ""
            lines.append(f"  {idx:02d}. {r['title']}{detail}")
    else:
        lines.append("  • _(No active reminders)_")

    lines.append("─" * 48)

    return "\n".join(lines)

def get_productivity_stats(target_date: Optional[datetime.date] = None, db_path: Optional[Path] = None) -> Dict[str, Any]:
    """
    Computes weekly and monthly task productivity metrics (completion percentages by day).
    """
    if target_date is None:
        target_date = datetime.date.today()

    conn = get_connection(db_path)

    # 1. Weekly view: Monday through Sunday for current week
    start_of_week = target_date - datetime.timedelta(days=target_date.weekday())
    week_days = []
    total_week_completed = 0
    total_week_due = 0

    for i in range(7):
        curr_d = start_of_week + datetime.timedelta(days=i)
        curr_str = curr_d.strftime("%Y-%m-%d")

        completed_cnt = conn.execute("""
            SELECT COUNT(*) FROM tasks 
            WHERE status = 'completed' AND date(completed_at) = date(?)
        """, (curr_str,)).fetchone()[0]

        total_cnt = conn.execute("""
            SELECT COUNT(DISTINCT id) FROM tasks 
            WHERE (date(due_date) = date(?) OR (status = 'completed' AND date(completed_at) = date(?)))
              AND status != 'cancelled'
        """, (curr_str, curr_str)).fetchone()[0]

        if total_cnt > 0:
            rate = min(100, round((completed_cnt / total_cnt) * 100))
        else:
            rate = None # No tasks scheduled or done

        is_today = (curr_d == target_date)
        is_future = (curr_d > target_date)

        week_days.append({
            "date": curr_str,
            "day_name": curr_d.strftime("%a"),
            "day_num": curr_d.day,
            "short_label": curr_d.strftime("%a %d"),
            "is_today": is_today,
            "is_future": is_future,
            "completed": completed_cnt,
            "total": total_cnt,
            "rate": rate,
            "completion_rate": rate
        })

        if not is_future:
            total_week_completed += completed_cnt
            total_week_due += total_cnt

    week_avg = round((total_week_completed / total_week_due) * 100) if total_week_due > 0 else 0

    # 2. Monthly view: Current month completion metrics
    month_str = target_date.strftime("%Y-%m")
    
    month_completed = conn.execute("""
        SELECT COUNT(*) FROM tasks 
        WHERE status = 'completed' AND strftime('%Y-%m', completed_at) = ?
    """, (month_str,)).fetchone()[0]

    month_total = conn.execute("""
        SELECT COUNT(DISTINCT id) FROM tasks 
        WHERE (strftime('%Y-%m', due_date) = ? OR (status = 'completed' AND strftime('%Y-%m', completed_at) = ?))
          AND status != 'cancelled'
    """, (month_str, month_str)).fetchone()[0]

    monthly_rate = round((month_completed / month_total) * 100) if month_total > 0 else 0

    active_projects_cnt = conn.execute("SELECT COUNT(*) FROM projects WHERE status = 'active'").fetchone()[0]

    week_data = {
        "start_date": start_of_week.strftime("%Y-%m-%d"),
        "end_date": (start_of_week + datetime.timedelta(days=6)).strftime("%Y-%m-%d"),
        "days": week_days,
        "week_average": week_avg,
        "overall_rate_pct": week_avg,
        "total_completed": total_week_completed,
        "total_tasks": total_week_due,
        "total_scheduled": total_week_due
    }

    month_data = {
        "year": target_date.year,
        "month": target_date.month,
        "month_name": target_date.strftime("%B %Y"),
        "month_completed": month_completed,
        "completed_tasks": month_completed,
        "month_total": month_total,
        "total_tasks": month_total,
        "monthly_rate": monthly_rate,
        "completion_rate_pct": monthly_rate,
        "active_projects": active_projects_cnt,
        "pending_tasks": max(0, month_total - month_completed)
    }

    return {
        "status": "success",
        "week": week_data,
        "weekly": week_data,
        "month": month_data,
        "monthly": month_data
    }


