import os
import asyncio
import datetime
import zoneinfo
import uuid
import shutil
from pathlib import Path
from typing import Dict, Any, List, Optional
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request, Response, HTTPException, Depends, status, UploadFile, File
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse
from pydantic import BaseModel

import httpx
from config.config import get_or_create_config, update_pin, verify_pin, get_user_profile, update_user_name, get_current_pin, save_config, get_ollama_candidate_urls
from backend import database, auth, network, daily_intel
from backend.parser.pipeline import process_user_input
from backend.backup import run_backup, backup_scheduler_loop

BASE_DIR = Path(__file__).resolve().parent.parent
FRONTEND_DIR = BASE_DIR / "frontend"
MEDIA_DIR = Path(os.environ.get("PETTR_DATA_DIR", BASE_DIR / "data")) / "media"
MEDIA_DIR.mkdir(parents=True, exist_ok=True)

def get_client_now(request: Request) -> datetime.datetime:
    """Returns the current datetime in the client's local timezone if passed in headers."""
    tz_name = request.headers.get("x-client-timezone")
    if tz_name:
        try:
            tz = zoneinfo.ZoneInfo(tz_name)
            return datetime.datetime.now(tz).replace(tzinfo=None)
        except Exception:
            pass
    return datetime.datetime.now()

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: Initialize database schema & background schedulers
    database.init_db()
    backup_task = asyncio.create_task(backup_scheduler_loop())
    midnight_typewriter_task = asyncio.create_task(daily_intel.midnight_typewriter_scheduler_loop())
    yield
    # Shutdown
    backup_task.cancel()
    midnight_typewriter_task.cancel()

app = FastAPI(title="PETTR", description="Personal Errands, Task Tracker & Repository", lifespan=lifespan)

@app.middleware("http")
async def add_no_cache_headers(request: Request, call_next):
    response = await call_next(request)
    if request.url.path.startswith("/static") or request.url.path == "/":
        response.headers["Cache-Control"] = "no-cache, no-store, must-revalidate"
        response.headers["Pragma"] = "no-cache"
        response.headers["Expires"] = "0"
    return response

# --- Pydantic Request Models ---

class LoginRequest(BaseModel):
    pin: str

class SetPinRequest(BaseModel):
    new_pin: str

class IngestRequest(BaseModel):
    text: str

class ReorderRequest(BaseModel):
    task_ids: List[int]

class UpdateTaskRequest(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    tier: Optional[str] = None
    due_date: Optional[str] = None
    status: Optional[str] = None
    project_name: Optional[str] = None

class AppendReminderRequest(BaseModel):
    task_id: int

class SaveNoteRequest(BaseModel):
    title: str = "Quick Note"
    content: str
    id: Optional[int] = None

class ResolveUnorganizedRequest(BaseModel):
    entity_type: str # task, event, reminder, project
    title: str
    tier: Optional[str] = "focus"
    project_name: Optional[str] = None
    due_date: Optional[str] = None
    end_time: Optional[str] = None

class DailyOrderRequest(BaseModel):
    date: str
    order: Optional[List[Dict[str, Any]]] = None
    items: Optional[List[Dict[str, Any]]] = None

    def get_order_list(self) -> List[Dict[str, Any]]:
        return self.order if self.order is not None else (self.items or [])

class ReclassifyRequest(BaseModel):
    from_type: str
    from_id: int
    to_type: str
    title: str
    description: Optional[str] = ""
    project_name: Optional[str] = None
    tier: Optional[str] = "focus"
    due_date: Optional[str] = None
    end_time: Optional[str] = None
    status: Optional[str] = "pending"
    recurrence: Optional[str] = None
    color: Optional[str] = None
    category: Optional[str] = None
    is_time_sensitive: Optional[bool] = None

class ProfileUpdateRequest(BaseModel):
    user_name: str

class CreateProjectRequest(BaseModel):
    name: str
    description: Optional[str] = ""
    color: Optional[str] = None
    category: Optional[str] = "External"
    initial_task: Optional[str] = None

class CreateTaskRequest(BaseModel):
    title: str
    description: Optional[str] = ""
    project_name: Optional[str] = None
    tier: Optional[str] = "focus"
    due_date: Optional[str] = None
    is_time_sensitive: Optional[bool] = None

class CreateEventRequest(BaseModel):
    title: str
    start_time: str
    end_time: Optional[str] = None
    description: Optional[str] = ""
    project_name: Optional[str] = None
    recurrence: Optional[str] = None

class UpdateEventStatusRequest(BaseModel):
    status: str # "scheduled", "completed", "cancelled"

class CreateReminderRequest(BaseModel):
    title: str
    details: Optional[str] = ""
    reminder_date: Optional[str] = None
    task_id: Optional[int] = None

class SelectLlmModelRequest(BaseModel):
    model: str

# --- Auth Routes ---

@app.get("/api/auth/status")
async def auth_status(request: Request):
    ip = auth.get_client_ip(request)
    allowed, lockout = auth.check_rate_limit(ip)
    is_authenticated = auth.validate_session(request)
    is_host = auth.is_host_client(ip)
    return {
        "authenticated": is_authenticated,
        "locked": not allowed,
        "lockout_seconds": lockout,
        "is_host": is_host
    }

@app.post("/api/auth/login")
async def login(req: LoginRequest, request: Request, response: Response):
    ip = auth.get_client_ip(request)
    allowed, lockout = auth.check_rate_limit(ip)
    if not allowed:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"Too many incorrect attempts. Locked out for {lockout} seconds."
        )

    if not verify_pin(req.pin):
        lockout_duration = auth.record_failed_attempt(ip)
        if lockout_duration > 0:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail=f"Incorrect PIN. Rate limit exceeded! Locked out for {lockout_duration} seconds."
            )
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Incorrect 4-digit PIN.")

    token = auth.record_successful_login(ip)
    response.set_cookie(
        key="pettr_session",
        value=token,
        max_age=auth.SESSION_EXPIRY_SECONDS,
        httponly=True,
        samesite="lax",
        secure=False # allows HTTP over local Tailscale mesh
    )
    return {"status": "authenticated", "token": token}

@app.post("/api/auth/logout")
async def logout(response: Response):
    response.delete_cookie("pettr_session")
    return {"status": "logged_out"}

@app.post("/api/auth/set-pin", dependencies=[Depends(auth.require_auth), Depends(auth.require_host_only)])
async def change_pin(req: SetPinRequest):
    """Can ONLY be invoked directly on the hosting PC (localhost)."""
    success, msg = update_pin(req.new_pin)
    if not success:
        raise HTTPException(status_code=400, detail=msg)
    return {"status": "success", "message": msg}

@app.get("/api/settings/pin-info", dependencies=[Depends(auth.require_auth), Depends(auth.require_host_only)])
async def get_pin_info():
    """Returns the current active PIN for host-only verification in the security panel."""
    return {"current_pin": get_current_pin()}

# --- User Profile Routes ---

@app.get("/api/profile")
async def get_profile(user=Depends(auth.require_auth)):
    return get_user_profile()

@app.post("/api/profile")
async def update_profile(req: ProfileUpdateRequest, user=Depends(auth.require_auth)):
    success, msg = update_user_name(req.user_name)
    if not success:
        raise HTTPException(status_code=400, detail=msg)
    return {"status": "success", "message": msg, "profile": get_user_profile()}

# --- Core Ingestion Route ---

@app.post("/api/ingest", dependencies=[Depends(auth.require_auth)])
async def ingest_entry(req: IngestRequest, request: Request):
    """Processes natural language input through the 3-stage hybrid parsing engine."""
    client_now = get_client_now(request)
    result = await process_user_input(req.text, ref_datetime=client_now)
    return result

# --- Dashboard & Task Routes ---

@app.get("/api/briefing", dependencies=[Depends(auth.require_auth)])
async def get_briefing(request: Request, date: Optional[str] = None):
    client_now = get_client_now(request)
    target = datetime.date.fromisoformat(date) if date else client_now.date()
    return database.get_daily_briefing(target)

@app.get("/api/tasks", dependencies=[Depends(auth.require_auth)])
async def get_tasks(request: Request, date: Optional[str] = None):
    client_now = get_client_now(request)
    target = datetime.date.fromisoformat(date) if date else client_now.date()
    return database.get_tasks_for_day(target)

@app.post("/api/tasks/reorder", dependencies=[Depends(auth.require_auth)])
async def reorder_tasks(req: ReorderRequest):
    database.update_task_order(req.task_ids)
    return {"status": "success"}

@app.patch("/api/tasks/{task_id}", dependencies=[Depends(auth.require_auth)])
async def update_task(task_id: int, req: UpdateTaskRequest):
    existing_task = database.get_task_by_id(task_id)
    if not existing_task:
        raise HTTPException(status_code=404, detail="Task not found")

    # Protection: Sealed days are completely locked from any edits; past unsealed days lock status toggles
    task_date_str = existing_task.get("due_date")
    is_historical_completed = (existing_task.get("status") == "completed")
    if task_date_str:
        try:
            task_date = datetime.date.fromisoformat(task_date_str.split("T")[0].split(" ")[0])
            is_sealed = database.is_day_sealed(task_date.strftime("%Y-%m-%d"))
            is_past = (task_date < datetime.date.today())

            # Sealed day protection:
            # If day is sealed, completed tasks on that day cannot be edited or reopened.
            # Active pending tasks rolling over can still be completed today!
            if is_sealed:
                if is_historical_completed or req.title is not None or req.due_date is not None or req.status == "pending":
                    raise HTTPException(status_code=403, detail="The day has been sealed by Evening Debrief and is locked from further edits.")
            # Past day protection:
            # Historical completed records from past days cannot have their status toggled (reopened)
            if is_past and is_historical_completed and req.status == "pending":
                raise HTTPException(status_code=403, detail="Historical records from past days are locked and uneditable to preserve productivity score integrity.")
        except HTTPException:
            raise
        except (ValueError, TypeError):
            pass

    conn = database.get_connection()
    updates = []
    values = []
    
    if req.title is not None:
        updates.append("title = ?")
        values.append(req.title)
    if req.description is not None:
        updates.append("description = ?")
        values.append(req.description)
    if req.tier is not None:
        updates.append("tier = ?")
        values.append(req.tier)
    if req.due_date is not None:
        old_due = existing_task.get("due_date")
        if old_due:
            old_day = str(old_due).split("T")[0].split(" ")[0]
            new_day = str(req.due_date).split("T")[0].split(" ")[0] if req.due_date else None
            if old_day and new_day and old_day != new_day:
                database.remove_from_daily_order_for_date(task_id, "task", old_day)
        updates.append("due_date = ?")
        values.append(req.due_date)
    if req.status is not None:
        updates.append("status = ?")
        values.append(req.status)
        if req.status == "completed":
            updates.append("completed_at = ?")
            values.append(datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S"))
        else:
            updates.append("completed_at = NULL")
    if req.project_name is not None:
        proj = database.get_or_create_project(req.project_name)
        updates.append("project_id = ?")
        values.append(proj["id"])

    if updates:
        values.append(task_id)
        with conn:
            conn.execute(f"UPDATE tasks SET {', '.join(updates)} WHERE id = ?", tuple(values))

    updated_task = database.get_task_by_id(task_id)
    return {"status": "success", "task": updated_task}

@app.post("/api/tasks", dependencies=[Depends(auth.require_auth)])
async def create_task_endpoint(req: CreateTaskRequest):
    """Direct manual creation of a task without NLP parsing."""
    if req.due_date:
        due_d = req.due_date.split("T")[0].split(" ")[0]
        if database.is_day_sealed(due_d):
            raise HTTPException(status_code=403, detail="Cannot add tasks to a day that has already been sealed and wrapped up.")
    created = database.create_task(
        title=req.title,
        description=req.description or "",
        project_name=req.project_name,
        tier=req.tier or "focus",
        due_date=req.due_date,
        is_time_sensitive=req.is_time_sensitive
    )
    return {"status": "success", "task": created}

@app.post("/api/tasks/{task_id}/reopen", dependencies=[Depends(auth.require_auth)])
async def reopen_task_endpoint(task_id: int):
    """Restores a completed task back to pending."""
    existing_task = database.get_task_by_id(task_id)
    if existing_task and existing_task.get("due_date"):
        try:
            task_date = datetime.date.fromisoformat(existing_task["due_date"].split("T")[0].split(" ")[0])
            if database.is_day_sealed(task_date.strftime("%Y-%m-%d")):
                raise HTTPException(status_code=403, detail="Cannot reopen tasks on a day that has already been sealed.")
        except HTTPException:
            raise
        except (ValueError, TypeError):
            pass
    database.reopen_task(task_id)
    return {"status": "success"}

@app.delete("/api/tasks/{task_id}", dependencies=[Depends(auth.require_auth)])
async def delete_task(task_id: int):
    existing_task = database.get_task_by_id(task_id)
    if existing_task and existing_task.get("due_date"):
        try:
            task_date = datetime.date.fromisoformat(existing_task["due_date"].split("T")[0].split(" ")[0])
            if database.is_day_sealed(task_date.strftime("%Y-%m-%d")):
                raise HTTPException(status_code=403, detail="Cannot delete tasks from a day that has been sealed.")
        except HTTPException:
            raise
        except (ValueError, TypeError):
            pass
    conn = database.get_connection()
    with conn:
        conn.execute("DELETE FROM tasks WHERE id = ?", (task_id,))
    database.remove_from_daily_order(task_id, "task")
    return {"status": "success"}

@app.patch("/api/tasks/{task_id}/toggle-time-sensitive", dependencies=[Depends(auth.require_auth)])
async def toggle_task_time_sensitive_endpoint(task_id: int):
    task = database.toggle_task_time_sensitive(task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    return {"status": "success", "task": task}

@app.get("/api/daily-intel", dependencies=[Depends(auth.require_auth)])
async def get_daily_intel_endpoint(date: Optional[str] = None, refresh: bool = False, hour: Optional[int] = None):
    profile = get_user_profile()
    user_name = profile.get("user_name", "Hong Rong")
    target = datetime.date.fromisoformat(date) if date else datetime.date.today()
    return await daily_intel.get_or_generate_daily_intel(target, user_name, force_refresh=refresh, client_hour=hour)

# --- Events & Reminders Routes ---

@app.get("/api/events", dependencies=[Depends(auth.require_auth)])
async def get_events(date: Optional[str] = None):
    target = datetime.date.fromisoformat(date) if date else None
    return database.get_events_for_day(target)

@app.post("/api/events", dependencies=[Depends(auth.require_auth)])
async def create_event_endpoint(req: CreateEventRequest):
    """Direct manual creation of a scheduled event."""
    if req.start_time:
        ev_d = req.start_time.split("T")[0].split(" ")[0]
        if database.is_day_sealed(ev_d):
            raise HTTPException(status_code=403, detail="Cannot add events to a day that has already been sealed.")
    created = database.create_event(
        title=req.title,
        start_time=req.start_time,
        end_time=req.end_time,
        description=req.description or "",
        project_name=req.project_name,
        recurrence=req.recurrence
    )
    return {"status": "success", "event": created}

@app.patch("/api/events/{event_id}/status", dependencies=[Depends(auth.require_auth)])
async def update_event_status_endpoint(event_id: int, req: UpdateEventStatusRequest):
    """Updates status of a scheduled event (e.g. check off as completed)."""
    conn = database.get_connection()
    ev_row = conn.execute("SELECT start_time FROM events WHERE id = ?", (event_id,)).fetchone()
    if ev_row and ev_row["start_time"]:
        ev_d = ev_row["start_time"].split("T")[0].split(" ")[0]
        if database.is_day_sealed(ev_d):
            raise HTTPException(status_code=403, detail="Cannot modify events on a day that has already been sealed.")
    updated = database.update_event_status(event_id, req.status)
    if not updated:
        raise HTTPException(status_code=404, detail="Event not found")
    return {"status": "success", "event": updated}

@app.delete("/api/events/{event_id}", dependencies=[Depends(auth.require_auth)])
async def delete_event_endpoint(event_id: int):
    """Deletes an event."""
    conn = database.get_connection()
    with conn:
        conn.execute("DELETE FROM events WHERE id = ?", (event_id,))
    return {"status": "success"}

@app.get("/api/reminders", dependencies=[Depends(auth.require_auth)])
async def get_reminders(date: Optional[str] = None):
    target = datetime.date.fromisoformat(date) if date else None
    return database.get_reminders_for_day(target)

@app.post("/api/reminders", dependencies=[Depends(auth.require_auth)])
async def create_reminder_endpoint(req: CreateReminderRequest):
    """Direct manual creation of a reminder."""
    if req.reminder_date:
        rem_d = req.reminder_date.split("T")[0].split(" ")[0]
        if database.is_day_sealed(rem_d):
            raise HTTPException(status_code=403, detail="Cannot add reminders to a day that has already been sealed.")
    created = database.create_reminder(
        title=req.title,
        details=req.details or "",
        reminder_date=req.reminder_date,
        task_id=req.task_id
    )
    return {"status": "success", "reminder": created}

@app.post("/api/reminders/{reminder_id}/append-to-task", dependencies=[Depends(auth.require_auth)])
async def append_reminder(reminder_id: int, req: AppendReminderRequest):
    database.append_reminder_to_task(reminder_id, req.task_id)
    return {"status": "success"}

@app.patch("/api/reminders/{reminder_id}/toggle", dependencies=[Depends(auth.require_auth)])
async def toggle_reminder(reminder_id: int):
    conn = database.get_connection()
    with conn:
        conn.execute("UPDATE reminders SET is_done = CASE WHEN is_done = 1 THEN 0 ELSE 1 END WHERE id = ?", (reminder_id,))
    return {"status": "success"}

@app.delete("/api/reminders/{reminder_id}", dependencies=[Depends(auth.require_auth)])
async def delete_reminder_endpoint(reminder_id: int):
    """Deletes a reminder."""
    conn = database.get_connection()
    with conn:
        conn.execute("DELETE FROM reminders WHERE id = ?", (reminder_id,))
    return {"status": "success"}

# --- Exploded View & Projects Routes ---

@app.get("/api/exploded", dependencies=[Depends(auth.require_auth)])
async def exploded_view():
    return database.get_exploded_view()

@app.get("/api/projects", dependencies=[Depends(auth.require_auth)])
async def list_projects():
    return database.get_all_projects()

@app.post("/api/projects", dependencies=[Depends(auth.require_auth)])
async def create_project_endpoint(req: CreateProjectRequest):
    """Direct manual creation of a new project."""
    created = database.create_project(
        name=req.name,
        description=req.description or "",
        color=req.color,
        category=req.category or "External",
        initial_task=req.initial_task
    )
    return {"status": "success", "project": created}

@app.delete("/api/projects/{project_id}", dependencies=[Depends(auth.require_auth)])
async def delete_project_endpoint(project_id: int):
    """Permanently deletes a project and unlinks subtasks."""
    database.delete_project(project_id)
    return {"status": "success", "success": True}

@app.post("/api/projects/{project_id}/complete", dependencies=[Depends(auth.require_auth)])
async def complete_project_endpoint(project_id: int):
    """Marks a project complete, wraps up subtasks, and records completion timestamp."""
    database.complete_project(project_id, complete_subtasks=True)
    return {"status": "success"}

@app.post("/api/projects/{project_id}/reopen", dependencies=[Depends(auth.require_auth)])
async def reopen_project_endpoint(project_id: int):
    """Restores a completed project back to active."""
    database.reopen_project(project_id)
    return {"status": "success"}

# --- Notes Routes ---

@app.get("/api/notes", dependencies=[Depends(auth.require_auth)])
async def list_notes():
    return database.get_notes()

@app.post("/api/notes", dependencies=[Depends(auth.require_auth)])
async def save_note_endpoint(req: SaveNoteRequest):
    saved = database.save_note(title=req.title, content=req.content, note_id=req.id)
    return {"status": "success", "note": saved}

@app.delete("/api/notes/{note_id}", dependencies=[Depends(auth.require_auth)])
async def delete_note(note_id: int):
    conn = database.get_connection()
    with conn:
        conn.execute("DELETE FROM notes WHERE id = ?", (note_id,))
    return {"status": "success"}

# --- History & Unorganized Queue Routes ---

@app.get("/api/history", dependencies=[Depends(auth.require_auth)])
async def view_history():
    return database.get_history_archive()

@app.get("/api/unorganized", dependencies=[Depends(auth.require_auth)])
async def list_unorganized():
    return database.get_unorganized_items()

@app.post("/api/unorganized/{item_id}/resolve", dependencies=[Depends(auth.require_auth)])
async def resolve_unorganized(item_id: int, req: ResolveUnorganizedRequest):
    conn = database.get_connection()
    row = conn.execute("SELECT * FROM unorganized_queue WHERE id = ?", (item_id,)).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Item not found")

    today_str = datetime.date.today().strftime("%Y-%m-%d")
    effective_due_date = req.due_date or row["parsed_date"] or f"{today_str} 23:59:00"

    # Historical lock protection: cannot triage unorganized items into locked past days
    try:
        check_date = datetime.date.fromisoformat(effective_due_date.split("T")[0].split(" ")[0])
        if check_date < datetime.date.today():
            effective_due_date = f"{today_str} 23:59:00"
    except (ValueError, TypeError):
        pass

    assigned_project = req.project_name or row["suggested_project"]

    created = None
    if req.entity_type == "task":
        created = database.create_task(
            title=req.title,
            tier=req.tier or "focus",
            project_name=assigned_project,
            due_date=effective_due_date
        )
    elif req.entity_type == "event":
        created = database.create_event(
            title=req.title,
            start_time=effective_due_date,
            end_time=req.end_time,
            project_name=assigned_project
        )
    elif req.entity_type == "reminder":
        rem_date = effective_due_date.split(" ")[0] if effective_due_date else today_str
        created = database.create_reminder(
            title=req.title,
            reminder_date=rem_date
        )
    elif req.entity_type == "project":
        created = database.get_or_create_project(req.title)

    with conn:
        conn.execute("UPDATE unorganized_queue SET status = 'processed' WHERE id = ?", (item_id,))

    return {"status": "success", "entity": created}

@app.delete("/api/unorganized/{item_id}", dependencies=[Depends(auth.require_auth)])
async def delete_unorganized_item_endpoint(item_id: int):
    success = database.delete_unorganized_item(item_id)
    if not success:
        raise HTTPException(status_code=404, detail="Unorganized item not found")
    return {"status": "success", "message": "Item deleted from unorganized queue"}

@app.post("/api/notes/upload-media", dependencies=[Depends(auth.require_auth)])
async def upload_notes_media(file: UploadFile = File(...)):
    MEDIA_DIR.mkdir(parents=True, exist_ok=True)
    suffix = Path(file.filename or "upload").suffix
    safe_name = f"{uuid.uuid4().hex[:12]}_{Path(file.filename or 'file').stem}{suffix}"
    dest_path = MEDIA_DIR / safe_name
    contents = await file.read()
    with open(dest_path, "wb") as f:
        f.write(contents)
    return {
        "status": "success",
        "url": f"/static/media/{safe_name}",
        "filename": file.filename or safe_name
    }

# --- Daily Sequence & Tasking Priority Order ---

@app.get("/api/daily-order", dependencies=[Depends(auth.require_auth)])
async def get_daily_order_endpoint(date: Optional[str] = None):
    if not date:
        date = datetime.date.today().strftime("%Y-%m-%d")
    order = database.get_daily_order(date)
    return {"status": "success", "date": date, "order": order, "items": order}

@app.post("/api/daily-order", dependencies=[Depends(auth.require_auth)])
async def save_daily_order_endpoint(req: DailyOrderRequest):
    order = database.save_daily_order(req.date, req.get_order_list())
    return {"status": "success", "date": req.date, "order": order, "items": order}

# --- Backup Route ---

@app.post("/api/backup/now", dependencies=[Depends(auth.require_auth)])
async def manual_backup():
    res = run_backup()
    return res

@app.get("/api/backup/download/{filename}", dependencies=[Depends(auth.require_auth)])
async def download_backup(filename: str):
    config = get_or_create_config()
    backup_dir = Path(config.get("backup_dir", "./backups"))
    if filename in ("latest", "pettr_backup_latest.tar.gz", "pettr_backup_latest.zip"):
        backup_files = sorted(backup_dir.glob("PETTR_*"), key=lambda p: p.stat().st_mtime, reverse=True)
        if not backup_files:
            raise HTTPException(status_code=404, detail="No backup files exist yet")
        file_path = backup_files[0]
        filename = file_path.name
    else:
        file_path = backup_dir / filename
    if not file_path.exists() or not file_path.is_file():
        raise HTTPException(status_code=404, detail="Backup file not found")
    media_type = "application/zip" if file_path.suffix == ".zip" else "application/gzip"
    return FileResponse(path=str(file_path), filename=filename, media_type=media_type)

# --- Server Storage Diagnostics ---

@app.get("/api/system/storage", dependencies=[Depends(auth.require_auth)])
async def get_storage_metrics():
    """Returns real-time server storage breakdown: database, media, backups, codebase, and disk usage."""
    return database.get_storage_breakdown()

# --- Network & Tailscale Live Diagnostics ---

@app.get("/api/network/status")
async def get_network_diagnostics(request: Request):
    """Returns live Tailscale connection status, local LAN IP, and MagicDNS name."""
    return network.get_network_status(request=request)

# --- Rich Text Morning Briefing ---

@app.get("/api/briefing/text", dependencies=[Depends(auth.require_auth)])
async def get_rich_briefing_text(date: Optional[str] = None):
    """Returns structured markdown morning briefing for quick 20s reading."""
    target = datetime.date.fromisoformat(date) if date else None
    text = database.get_rich_text_briefing(target)
    return {"status": "success", "markdown": text}

# --- Entity Detail & Re-sorting / Conversion ---

@app.get("/api/entities/{entity_type}/{entity_id}", dependencies=[Depends(auth.require_auth)])
async def get_entity(entity_type: str, entity_id: int):
    item = database.get_entity_detail(entity_type, entity_id)
    if not item:
        raise HTTPException(status_code=404, detail="Entity not found")
    return {"status": "success", "entity": item}

@app.post("/api/entities/reclassify", dependencies=[Depends(auth.require_auth)])
async def reclassify_item(req: ReclassifyRequest):
    """Edits details or re-sorts item between Task (Focus/Trivial), Event, Reminder, Project, and Unorganized."""
    result = database.reclassify_entity(
        from_type=req.from_type,
        from_id=req.from_id,
        to_type=req.to_type,
        title=req.title,
        description=req.description or "",
        project_name=req.project_name,
        tier=req.tier or "focus",
        due_date=req.due_date,
        end_time=req.end_time,
        status=req.status or "pending",
        recurrence=req.recurrence,
        color=req.color,
        category=req.category,
        is_time_sensitive=req.is_time_sensitive
    )
    return result

# --- Productivity Metrics Routes ---

@app.get("/api/productivity", dependencies=[Depends(auth.require_auth)])
async def get_productivity():
    """Returns weekly (Monday-Sunday) and monthly task completion rates and streak stats."""
    return database.get_productivity_stats()

@app.post("/api/debrief/seal", dependencies=[Depends(auth.require_auth)])
async def seal_day_endpoint(request: Request):
    payload = await request.json()
    date_str = payload.get("date")
    if not date_str:
        today = get_effective_today(request)
        date_str = today.strftime("%Y-%m-%d")
    completion_rate = int(payload.get("completion_rate", 100))
    total_tasks = int(payload.get("total_tasks", 0))
    completed_tasks = int(payload.get("completed_tasks", 0))
    retro_notes = payload.get("retro_notes", "")
    res = database.seal_day(date_str, completion_rate, total_tasks, completed_tasks, retro_notes)
    return res

@app.get("/api/debrief/seal-status", dependencies=[Depends(auth.require_auth)])
async def get_seal_status(request: Request, date: Optional[str] = None):
    if not date:
        today = get_effective_today(request)
        date = today.strftime("%Y-%m-%d")
    is_sealed = database.is_day_sealed(date)
    seal = database.get_day_seal(date)
    return {
        "date": date,
        "is_sealed": is_sealed,
        "completion_rate": seal["completion_rate"] if seal else None,
        "seal": seal
    }

# --- Scalable Timeline Routes (Day, Month, Year) ---

@app.get("/api/timeline", dependencies=[Depends(auth.require_auth)])
async def timeline_data(scale: str = "day", year: Optional[int] = None, month: Optional[int] = None, day: Optional[int] = None, start_date: Optional[str] = None, end_date: Optional[str] = None, days_around: Optional[int] = None):
    return database.get_timeline_data(scale=scale, year=year, month=month, day=day, start_date=start_date, end_date=end_date, days_around=days_around)

# --- Sample Data Seeder & Purger ---

@app.post("/api/sample-data/seed", dependencies=[Depends(auth.require_auth)])
async def seed_samples():
    return database.seed_sample_data()

@app.post("/api/sample-data/clear", dependencies=[Depends(auth.require_auth)])
async def clear_samples():
    """Wipes ALL tasks, events, reminders, projects, and the unorganized queue.
    This is a full clean-slate reset intended only for testing / demo purposes."""
    return database.clear_all_data()

# --- Ollama Local LLM Integration & Diagnostics ---

@app.get("/api/llm/status", dependencies=[Depends(auth.require_auth)])
async def get_llm_status():
    """Checks local Ollama server connectivity and installed models across candidate URLs."""
    config = get_or_create_config()
    active_model = config.get("ollama_model", "llama3.2:3b")
    candidate_urls = get_ollama_candidate_urls()
    models = []
    online = False
    connected_url = candidate_urls[0] if candidate_urls else "http://localhost:11434"

    for url in candidate_urls:
        try:
            async with httpx.AsyncClient(timeout=1.5) as client:
                resp = await client.get(f"{url}/api/tags")
                if resp.status_code == 200:
                    online = True
                    connected_url = url
                    data = resp.json()
                    models = [m.get("name") for m in data.get("models", [])]
                    break
        except Exception:
            continue

    return {
        "online": online,
        "ollama_url": connected_url,
        "active_model": active_model,
        "available_models": models,
        "candidate_urls": candidate_urls
    }

@app.post("/api/llm/select", dependencies=[Depends(auth.require_auth), Depends(auth.require_host_only)])
async def select_llm_model(req: SelectLlmModelRequest):
    """Sets active Ollama model in config (host only)."""
    config = get_or_create_config()
    config["ollama_model"] = req.model
    save_config(config)
    return {"status": "success", "active_model": req.model}

@app.post("/api/llm/test", dependencies=[Depends(auth.require_auth)])
async def test_llm_ping():
    """Runs a test intent classification prompt to measure model latency and connectivity."""
    import time
    from backend.parser.llm_classifier import classify_with_llm
    t0 = time.time()
    res = await classify_with_llm(
        cleaned_text="Schedule engineering sprint review tomorrow at 14:00",
        has_date=True,
        extracted_date_str="tomorrow 14:00",
        active_projects=["IDEA-1 Concept"]
    )
    elapsed_ms = round((time.time() - t0) * 1000)
    engine_name = res.get("engine", "unknown")
    is_model_online = str(engine_name).lower().startswith("ollama")
    return {
        "status": "success",
        "engine": engine_name,
        "is_model_online": is_model_online,
        "latency_ms": elapsed_ms,
        "sample_result": res,
        "diagnostics": res.get("diagnostics", {})
    }

# --- Static Frontend Serving ---

@app.middleware("http")
async def add_cache_control_headers(request: Request, call_next):
    response = await call_next(request)
    if request.url.path.endswith((".css", ".js")) or request.url.path == "/":
        response.headers["Cache-Control"] = "no-cache, must-revalidate"
    return response

app.mount("/static/media", StaticFiles(directory=str(MEDIA_DIR)), name="media")
app.mount("/static", StaticFiles(directory=str(FRONTEND_DIR)), name="static")

@app.get("/")
async def root():
    index_file = FRONTEND_DIR / "index.html"
    if not index_file.exists():
        return JSONResponse({"status": "PETTR backend online. Frontend initializing..."})
    return FileResponse(
        str(index_file),
        headers={"Cache-Control": "no-cache, no-store, must-revalidate"}
    )
