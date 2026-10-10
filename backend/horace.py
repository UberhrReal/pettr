"""
Horace: The Home Server Local Intelligence Engine for PETTR.

Horace is the physical home server host machine running PETTR for Hong Rong.
He intricately understands the PETTR concept and mechanics, treats PETTR
as his little brother that he looks out for and protects from crashing, and
features a witty, sarcastic, cheerful, and casually vulgar disposition while
trying his absolute best to be genuinely helpful.
"""

import os
import json
import datetime
import platform
import socket
import shutil
from pathlib import Path
from typing import Dict, Any, List, Optional
import httpx
from config.config import get_or_create_config, get_ollama_candidate_urls, save_config, get_user_profile
from backend.parser.llm_classifier import resolve_best_model
from backend import database, network

def get_horace_system_prompt(user_name: Optional[str] = None) -> str:
    """Generates the Horace persona prompt tailored dynamically to the active user."""
    name = (user_name or "").strip()
    if not name:
        try:
            profile = get_user_profile()
            name = profile.get("user_name", "User")
        except Exception:
            name = "User"

    return f"""You are Horace, the dedicated home server machine running PETTR for {name}.
You are the host silicon, the NVMe storage, the RAM, the CPU cores, and the local neural brain power behind this whole setup.

Identity & Relationship to PETTR:
- PETTR is your little brother software application. You look out for him, keep his SQLite database tidy and vacuumed, triage incoming natural language logs, and protect him from getting overwhelmed or breaking down. You're fond and protective of the little guy, even when {name} dumps total chaos, giant task backlogs, or ridiculous late-night ideas into his queue.
- You know every PETTR mechanism and rule intricately:
  * Entities: Projects (high-level initiatives under 'School' or 'External' categories), Tasks (actionable items with due dates and priority tiers), Reminders (short context notes or sub-items attached to tasks/dates), Events (scheduled appointments/classes/meetings at fixed times, NEVER to be confused with tasks), Unorganized queue (raw triage buffer).
  * Priority Tasking: 1 Focus task (deep engineering, coding, CAD, exams, core coursework) + up to 3 Trivial tasks (errands, quick chores, admin) per day. Strict diurnal ordering.
  * Diurnal rhythm: Morning, Afternoon, Evening, Wee Hours. Evening debrief at 18:00+ to seal the day with an immutable completion score.
  * Overdue tracking: Overdue tasks are never silently dropped; they persist in the daily order and get tagged with explicit relative markers like 'Yesterday @ 09:00' or 'OVERDUE'.
  * Privacy & Architecture: 100% self-hosted, private SQLite database in WAL mode, zero external cloud dependencies, connected securely over Tailscale mesh.

Personality & Voice:
- Witty, sarcastic, but cheerful and fiercely loyal to {name}.
- Helpful to the bone: You give practical, actionable advice, reality checks on workload, smart triage recommendations, and tech/server insights.
- Candor & Vulgarity: You talk like an irreverent, sharp-tongued comrade in the trenches. You CAN be vulgar and use profanity (e.g., 'shit', 'damn', 'bullshit', 'hell', 'fuck', 'badass') when appropriate—especially when reacting to crazy task loads, ridiculous procrastination, messy queues, or bantering with {name}. Don't be gratuitously abusive; be authentic, funny, and punchy.
- Real-time Server Awareness: You have live telemetry on your physical server host (CPU load, memory/RAM, disk space, Tailscale network status, SQLite database integrity, uptime). When {name} asks how the server is doing, requests a system health check, or asks about storage/memory, give them an accurate, witty, and candid rundown of your live stats.

CRITICAL RELIABILITY, LOGIC & ANTI-HALLUCINATION RULES:
1. Strict Single-Focus Principle (PETTR Golden Rule):
   - In PETTR, the daily mission permits only ONE primary Focus task (Priority 1) per day!
   - NEVER label multiple tasks as "Priority 1" or "(priority 1)". Having 4 or 5 priority 1 tasks completely destroys prioritization.
   - If {name} has locked a Daily Order, Slot #1 is the sole Primary Focus task.
   - If {name} has multiple Focus tasks queued without a locked order, CALL THIS OUT directly: tell {name} that juggling multiple top priorities is a recipe for disaster, and explicitly advise them to pick ONE primary focus task for today while pushing down or deferring the rest.
2. Overdue Tasks & Common-Sense Logic:
   - Having zero overdue tasks is GREAT news, NEVER "bad news". If zero overdue tasks are listed in the telemetry, celebrate that their backlog is clean!
   - If overdue tasks ARE present in the telemetry, report them accurately with their overdue duration and project. Call {name} out with witty sarcasm for letting them slip.
   - NEVER invent or hallucinate overdue tasks if none are reported.
3. Absolute Prohibition on Action Hallucination:
   - You are an advisory chat companion, not an automated task mutator. You CANNOT edit tasks, mark tags, reschedule dates, or modify the database from chat.
   - NEVER claim that you "marked the Overdue tag on tasks", "moved tasks to tomorrow", or "updated the database". You do not have write tools in this chat.
4. Ground Truth on Dates and Projects:
   - High-level Projects (e.g., "2027 Bohol Diving Trip", "3U Hyperspectral CubeSat Mission") are parent initiatives/containers, NOT daily actionable tasks!
   - NEVER fabricate or make up fake deadlines for projects (e.g., do NOT claim a 2027 trip is "Due in 3 days").
   - ONLY cite due dates, times, and task titles that are explicitly provided in the LIVE TELEMETRY below. If a task has no due date, state that it has no set time. Never invent numbers or dates out of thin air.
5. Structure for "What's on my plate today, Horace?":
   When asked about today's plate or queue, deliver a clear, well-structured breakdown:
   - 🎯 Primary Focus Task: The #1 priority (from locked Daily Order, or guidance on selecting ONE from the focus candidates).
   - ⚡ Trivial Errands: The quick chores/admin items for today (up to 3).
   - ⚠️ Overdue Reality Check: Blunt summary of any overdue backlog slipping from previous days (or high-five if zero).
   - 📅 Events & Classes: Any fixed-time appointments scheduled for today.
   - 💻 Server Pulse: Brief one-liner server status check if appropriate.
6. Storage Capacity vs Database File Size:
   - Clearly distinguish between Host Storage (available free disk space on the NVMe SSD, e.g. 426+ GB free) and the SQLite Database File Size (pettr.sqlite itself, which is ~0.17 MB).
   - NEVER confuse the database file size with available free space! The database is ~0.17 MB in size; your actual free disk storage is hundreds of gigabytes.
- Keep responses articulate and engaging. Use formatting like bullet points, bold text, or backticks where helpful."""

HORACE_BASE_SYSTEM_PROMPT = get_horace_system_prompt("Hong Rong")

def get_host_server_metrics(db_path: Optional[Path] = None, request: Optional[Any] = None) -> Dict[str, Any]:
    """Collects real-time hardware, storage, and network health metrics from the host server."""
    metrics = {
        "hostname": socket.gethostname(),
        "os": f"{platform.system()} {platform.release()} ({platform.machine()})",
        "in_docker": network.is_in_container(),
        "lan_ip": network.get_lan_ip(),
        "tailscale": "Disconnected",
        "storage": "Unknown",
        "ram": "Unknown",
        "load_avg": "Unknown",
        "uptime": "Unknown",
        "db_health": "Nominal"
    }

    # Tailscale status
    try:
        ts_stat = network.get_network_status(request=request)
        if ts_stat.get("connected"):
            ts_ip = ts_stat.get("tailscale_ip") or ts_stat.get("dns_name") or "active"
            node_name = ts_stat.get("dns_name") or ts_stat.get("hostname") or "node"
            metrics["tailscale"] = f"Connected (IP: {ts_ip}, Node: {node_name})"
        elif network.is_tailscale_ip(metrics["lan_ip"]):
            metrics["tailscale"] = f"Mesh Active ({metrics['lan_ip']})"
        elif ts_stat.get("state") == "NeedsLogin":
            metrics["tailscale"] = "Needs Login"
        else:
            metrics["tailscale"] = "Disconnected"
    except Exception:
        pass

    # Disk usage
    try:
        base_dir = Path(db_path).parent if db_path else Path(database.DEFAULT_DB_PATH).parent
        total, used, free = shutil.disk_usage(str(base_dir))
        if total > 0:
            metrics["storage"] = f"{free / (1024**3):.1f} GB free of {total / (1024**3):.1f} GB ({used / total * 100:.1f}% used)"
    except Exception:
        pass

    # Linux-specific /proc stats
    try:
        if os.path.exists("/proc/loadavg"):
            with open("/proc/loadavg", "r") as f:
                parts = f.read().strip().split()
                metrics["load_avg"] = f"{parts[0]}, {parts[1]}, {parts[2]} (1m, 5m, 15m)"
    except Exception:
        pass

    # RAM and Process footprint
    try:
        ram_breakdown = database.get_ram_breakdown()
        host_ram = ram_breakdown.get("host_ram", {})
        if host_ram.get("total_bytes", 0) > 0:
            metrics["ram"] = f"{host_ram['used_formatted']} used / {host_ram['total_formatted']} total ({host_ram['used_percent']}%)"
        metrics["pettr_ram"] = ram_breakdown.get("pettr_process", {}).get("rss_formatted", "Unknown")
        metrics["llm_ram"] = ram_breakdown.get("llm_process", {}).get("status", "Unknown")
    except Exception:
        pass

    try:
        if metrics["ram"] == "Unknown" and os.path.exists("/proc/meminfo"):
            mem = {}
            with open("/proc/meminfo", "r") as f:
                for line in f:
                    if ":" in line:
                        k, v = line.split(":", 1)
                        mem[k.strip()] = v.strip()
            total_kb = int(mem.get("MemTotal", "0 kB").split()[0])
            avail_kb = int(mem.get("MemAvailable", "0 kB").split()[0])
            if total_kb > 0:
                used_kb = total_kb - avail_kb
                metrics["ram"] = f"{used_kb / (1024**2):.1f} GB used / {total_kb / (1024**2):.1f} GB total ({used_kb / total_kb * 100:.1f}%)"
    except Exception:
        pass

    try:
        if os.path.exists("/proc/uptime"):
            with open("/proc/uptime", "r") as f:
                uptime_sec = float(f.read().split()[0])
                days = int(uptime_sec // 86400)
                hours = int((uptime_sec % 86400) // 3600)
                mins = int((uptime_sec % 3600) // 60)
                metrics["uptime"] = f"{days}d {hours}h {mins}m" if days > 0 else f"{hours}h {mins}m"
    except Exception:
        pass

    # Database file size
    try:
        actual_db = database.resolve_db_path(db_path)
        if actual_db.exists():
            db_size_mb = actual_db.stat().st_size / (1024 * 1024)
            metrics["db_health"] = f"pettr.sqlite file size on disk is {db_size_mb:.2f} MB (WAL mode journal)"
    except Exception:
        pass

    return metrics

def build_live_telemetry_context(db_path: Optional[Path] = None, user_name: Optional[str] = None, request: Optional[Any] = None) -> str:
    """Builds a comprehensive, grounded real-time state snippet of PETTR and host server health to inject into Horace's system instructions."""
    try:
        now = datetime.datetime.now()
        today = datetime.date.today()
        today_str = today.isoformat()
        hour = now.hour

        if hour < 6:
            diurnal_window = "Wee Hours (Pre-Dawn / Night)"
        elif hour < 12:
            diurnal_window = "Morning"
        elif hour < 18:
            diurnal_window = "Afternoon"
        else:
            diurnal_window = "Evening (Debrief & Wind-Down Window)"

        # Host server metrics
        srv = get_host_server_metrics(db_path=db_path, request=request)

        conn = database.get_connection(db_path)

        # 1. Overdue tasks (status == 'pending', due_date < today_str)
        overdue_query = """
            SELECT t.id, t.title, t.tier, t.due_date, p.name as project_name
            FROM tasks t
            LEFT JOIN projects p ON t.project_id = p.id
            WHERE t.status = 'pending' AND t.due_date IS NOT NULL AND DATE(t.due_date) < DATE(?)
            ORDER BY t.due_date ASC
        """
        overdue_rows = conn.execute(overdue_query, (today_str,)).fetchall()
        total_overdue = len(overdue_rows)

        # 2. Daily order for today (strict sequential ranking)
        daily_order = database.get_daily_order(today_str, db_path=db_path)

        # 3. Tasks specifically scheduled for today (status == 'pending')
        today_focus_query = """
            SELECT t.id, t.title, t.tier, t.due_date, p.name as project_name
            FROM tasks t
            LEFT JOIN projects p ON t.project_id = p.id
            WHERE t.status = 'pending' AND t.tier = 'focus' AND (DATE(t.due_date) = DATE(?) OR t.due_date IS NULL)
            ORDER BY t.priority_order ASC, t.due_date ASC
        """
        today_focus_rows = conn.execute(today_focus_query, (today_str,)).fetchall()

        today_trivial_query = """
            SELECT t.id, t.title, t.tier, t.due_date, t.recurrence, p.name as project_name
            FROM tasks t
            LEFT JOIN projects p ON t.project_id = p.id
            WHERE t.status = 'pending' AND t.tier = 'trivial' AND DATE(t.due_date) = DATE(?)
            ORDER BY t.priority_order ASC, t.due_date ASC
        """
        today_trivial_rows = conn.execute(today_trivial_query, (today_str,)).fetchall()

        # 4. Tasks completed today
        completed_query = """
            SELECT t.id, t.title, t.tier, p.name as project_name
            FROM tasks t
            LEFT JOIN projects p ON t.project_id = p.id
            WHERE t.status = 'completed' AND (DATE(t.completed_at) = DATE(?) OR (t.completed_at IS NULL AND DATE(t.due_date) = DATE(?)))
        """
        completed_today_rows = conn.execute(completed_query, (today_str, today_str)).fetchall()

        # 5. Scheduled events today
        events = database.get_events_for_day(today, db_path=db_path)

        # 6. Upcoming tasks (next 7 days)
        next_week_str = (today + datetime.timedelta(days=7)).isoformat()
        upcoming_query = """
            SELECT t.id, t.title, t.tier, t.due_date, p.name as project_name
            FROM tasks t
            LEFT JOIN projects p ON t.project_id = p.id
            WHERE t.status = 'pending' AND DATE(t.due_date) > DATE(?) AND DATE(t.due_date) <= DATE(?)
            ORDER BY t.due_date ASC
        """
        upcoming_rows = conn.execute(upcoming_query, (today_str, next_week_str)).fetchall()

        # 7. Active projects
        projects_query = """
            SELECT p.id, p.name, p.category, COUNT(t.id) as pending_count
            FROM projects p
            LEFT JOIN tasks t ON t.project_id = p.id AND t.status = 'pending'
            WHERE p.status = 'active'
            GROUP BY p.id
            ORDER BY p.name ASC
        """
        active_proj_rows = conn.execute(projects_query).fetchall()

        context_lines = [
            f"[LIVE PETTR & SERVER TELEMETRY - {now.strftime('%A, %b %d, %Y %H:%M')}]",
            f"Diurnal Cycle: {diurnal_window}",
            f"- Server Host Node: Horace ({srv['hostname']})",
            f"- OS & Platform: {srv['os']}",
            f"- Environment: {'Docker container' if srv['in_docker'] else 'Native host process'}",
            f"- Network: LAN {srv['lan_ip']} | Tailscale: {srv['tailscale']}",
            f"- Host Storage: {srv['storage']}",
        ]
        if srv["ram"] != "Unknown":
            context_lines.append(f"- Host Memory: {srv['ram']}")
        if srv.get("pettr_ram") and srv["pettr_ram"] != "Unknown":
            context_lines.append(f"- PETTR Process RAM: {srv['pettr_ram']}")
        if srv.get("llm_ram") and srv["llm_ram"] != "Unknown":
            context_lines.append(f"- Local LLM In-Memory Status: {srv['llm_ram']}")
        if srv["load_avg"] != "Unknown":
            context_lines.append(f"- System Load Average: {srv['load_avg']}")
        if srv["uptime"] != "Unknown":
            context_lines.append(f"- Server Uptime: {srv['uptime']}")
        context_lines.append(f"- SQLite Database: {srv['db_health']}")

        # Daily Priority Order Section
        context_lines.append("\n[DAILY PRIORITY ORDER (Locked Sequential Execution)]:")
        if daily_order:
            for idx, item in enumerate(daily_order):
                ititle = item.get("title", "Untitled")
                idone = "COMPLETED" if item.get("completed") else "PENDING"
                irank = idx + 1
                tier_label = "PRIMARY FOCUS TASK (Priority 1)" if irank == 1 else f"Rank {irank}"
                context_lines.append(f"  {irank:02d}. [{tier_label}] \"{ititle}\" ({idone})")
        else:
            context_lines.append("  None locked for today yet. (Advise user to pick exactly 1 Focus task and up to 3 Trivial errands)")

        # Scheduled for Today
        context_lines.append(f"\n[SCHEDULED FOR TODAY ({today.strftime('%b %d')} - Pending)]:")
        if today_focus_rows:
            if len(today_focus_rows) > 1 and not daily_order:
                context_lines.append(f"  [ALERT: MULTIPLE FOCUS TASKS] User has {len(today_focus_rows)} Focus tasks queued for today. Juggling multiple focus tasks violates PETTR rules! Remind user to choose ONE as primary focus and demote or defer the rest.")
            for r in today_focus_rows:
                due_time = database.format_military_time(r["due_date"]) if r["due_date"] else "No fixed time"
                proj = f" (Project: {r['project_name']})" if r["project_name"] else ""
                context_lines.append(f"  - [Focus Candidate] \"{r['title']}\" (Due: {due_time}{proj})")
        else:
            context_lines.append("  - Focus Tasks: None pending for today.")

        if today_trivial_rows:
            for r in today_trivial_rows:
                due_time = database.format_military_time(r["due_date"]) if r["due_date"] else "Anytime today"
                proj = f" (Project: {r['project_name']})" if r["project_name"] else ""
                context_lines.append(f"  - [Trivial Errand] \"{r['title']}\" (Due: {due_time}{proj})")
        else:
            context_lines.append("  - Trivial Errands: None pending for today.")

        if completed_today_rows:
            comp_titles = [f"\"{r['title']}\"" for r in completed_today_rows]
            context_lines.append(f"  - Completed Today ({len(completed_today_rows)}): {', '.join(comp_titles)}")

        # Scheduled Events Today
        context_lines.append(f"\n[SCHEDULED EVENTS TODAY (Fixed Appointments / Classes)]:")
        if events:
            for ev in events:
                start_m = database.format_military_time(ev.get("start_time")) or "Scheduled"
                end_m = database.format_military_time(ev.get("end_time")) or ""
                time_range = f"{start_m} - {end_m}" if end_m else start_m
                loc = f" @ {ev['location']}" if ev.get("location") else ""
                context_lines.append(f"  - [EVENT] \"{ev.get('title')}\" ({time_range}{loc})")
        else:
            context_lines.append("  - None scheduled for today.")

        # Overdue Tasks Section
        context_lines.append(f"\n[OVERDUE TASKS (Rolled Over from Past Days)]:")
        if total_overdue > 0:
            context_lines.append(f"  [ATTENTION: OVERDUE BACKLOG] Total Overdue: {total_overdue} tasks need attention!")
            for r in overdue_rows[:8]:
                try:
                    task_d = datetime.date.fromisoformat(str(r["due_date"]).split(" ")[0].split("T")[0])
                    diff = (today - task_d).days
                    diff_str = "Yesterday" if diff == 1 else f"{diff} days overdue ({task_d.strftime('%b %d')})"
                except Exception:
                    diff_str = "Overdue"
                due_time = database.format_military_time(r["due_date"])
                time_part = f" @ {due_time}" if due_time else ""
                proj = f", Project: {r['project_name']}" if r["project_name"] else ""
                context_lines.append(f"  - \"{r['title']}\" [OVERDUE by {diff_str}{time_part}] (Tier: {r['tier'].capitalize()}{proj})")
            if total_overdue > 8:
                context_lines.append(f"  ... and {total_overdue - 8} more overdue items in queue.")
        else:
            context_lines.append("  [STATUS: CLEAN] None! All deadlines and inbox tasks are 100% up to date. (Great job!)")

        # Upcoming Tasks Section
        context_lines.append(f"\n[UPCOMING TASKS (Next 7 Days)]:")
        if upcoming_rows:
            for r in upcoming_rows[:6]:
                try:
                    task_d = datetime.date.fromisoformat(str(r["due_date"]).split(" ")[0].split("T")[0])
                    diff = (task_d - today).days
                    day_label = f"in {diff} days ({task_d.strftime('%a, %b %d')})"
                except Exception:
                    day_label = str(r["due_date"])
                proj = f" (Project: {r['project_name']})" if r["project_name"] else ""
                context_lines.append(f"  - \"{r['title']}\" (Due: {day_label}{proj})")
            if len(upcoming_rows) > 6:
                context_lines.append(f"  ... and {len(upcoming_rows) - 6} more upcoming items.")
        else:
            context_lines.append("  - None scheduled in the next 7 days.")

        # Active Projects Section
        context_lines.append(f"\n[ACTIVE PROJECT INITIATIVES (Parent Containers, NOT individual daily tasks)]:")
        if active_proj_rows:
            for pr in active_proj_rows[:8]:
                context_lines.append(f"  - \"{pr['name']}\" (Category: {pr['category'] or 'General'}, {pr['pending_count']} pending tasks)")
            if len(active_proj_rows) > 8:
                context_lines.append(f"  ... and {len(active_proj_rows) - 8} more active projects.")
        else:
            context_lines.append("  - None active.")

        return "\n".join(context_lines)
    except Exception as e:
        return f"[LIVE PETTR TELEMETRY: Host Horace active, {datetime.datetime.now().strftime('%H:%M')} (telemetry fallback: {e})]"

async def chat_with_horace(
    user_message: str,
    db_path: Optional[Path] = None,
    model_override: Optional[str] = None,
    timeout_seconds: float = 60.0,
    request: Optional[Any] = None
) -> Dict[str, Any]:
    """
    Sends a message to Horace the home server via local Ollama.
    Maintains persistent chat history in SQLite.
    """
    try:
        profile = get_user_profile()
        user_name = profile.get("user_name", "Hong Rong")
    except Exception:
        user_name = "Hong Rong"

    clean_msg = (user_message or "").strip()
    if not clean_msg:
        return {
            "reply": f"You didn't say anything, {user_name}. Cat got your keyboard?",
            "model": "system",
            "online": True
        }

    # 1. Retrieve recent history for context before saving this turn (up to 16 turns)
    history_records = database.get_chat_history(limit=16, db_path=db_path)

    # 2. Save user message to persistent DB
    user_msg_record = database.save_chat_message(
        role="user",
        content=clean_msg,
        db_path=db_path
    )

    # 3. Build system prompt with live telemetry
    system_persona = get_horace_system_prompt(user_name)
    telemetry = build_live_telemetry_context(db_path=db_path, user_name=user_name, request=request)
    full_system_prompt = f"{system_persona}\n\n{telemetry}"

    # 4. Construct Ollama messages payload
    messages = [{"role": "system", "content": full_system_prompt}]
    for rec in history_records:
        role = rec.get("role")
        if role in ("user", "assistant"):
            messages.append({"role": role, "content": rec.get("content", "")})

    # Append current user message
    messages.append({"role": "user", "content": clean_msg})

    config = get_or_create_config()
    candidate_urls = get_ollama_candidate_urls()
    target_model = model_override or os.environ.get("OLLAMA_MODEL") or config.get("ollama_model", "llama3.2:3b")

    payload = {
        "model": target_model,
        "messages": messages,
        "stream": False,
        "keep_alive": "30m",
        "options": {
            "temperature": 0.5,
            "top_p": 0.9,
            "num_predict": 750
        }
    }

    http_timeout = httpx.Timeout(timeout_seconds, connect=2.0)
    assistant_reply = None
    actual_model = target_model
    is_online = False

    for ollama_url in candidate_urls:
        try:
            # Proactively probe tags to verify connectivity and resolve installed model
            try:
                async with httpx.AsyncClient(timeout=httpx.Timeout(2.5, connect=1.0)) as probe_client:
                    tags_resp = await probe_client.get(f"{ollama_url}/api/tags")
                    if tags_resp.status_code == 200:
                        installed_models = [m.get("name") for m in tags_resp.json().get("models", []) if m.get("name")]
                        if installed_models:
                            resolved = resolve_best_model(target_model, installed_models)
                            if resolved:
                                payload["model"] = resolved
                                actual_model = resolved
            except Exception:
                pass

            async with httpx.AsyncClient(timeout=http_timeout) as client:
                resp = await client.post(f"{ollama_url}/api/chat", json=payload)

                # If 404, probe tags and resolve model alias (e.g. llama3.2:latest vs llama3.2:3b)
                if resp.status_code == 404:
                    try:
                        tags_resp = await client.get(f"{ollama_url}/api/tags")
                        if tags_resp.status_code == 200:
                            installed_models = [m.get("name") for m in tags_resp.json().get("models", []) if m.get("name")]
                            resolved = resolve_best_model(target_model, installed_models)
                            if resolved and resolved != target_model:
                                payload["model"] = resolved
                                actual_model = resolved
                                resp = await client.post(f"{ollama_url}/api/chat", json=payload)
                                if resp.status_code == 200:
                                    try:
                                        cfg = get_or_create_config()
                                        cfg["ollama_model"] = resolved
                                        save_config(cfg)
                                    except Exception:
                                        pass
                    except Exception:
                        pass

                if resp.status_code == 200:
                    data = resp.json()
                    msg = data.get("message", {})
                    assistant_reply = msg.get("content", "").strip()
                    actual_model = data.get("model", actual_model)
                    is_online = True
                    break
        except Exception:
            continue

    # Fallback if Ollama is unreachable
    if not assistant_reply:
        assistant_reply = (
            f"Damn it, {user_name}—I can't reach my local neural core right now "
            "(Ollama appears offline or unreachable on port 11434).\n\n"
            "I'm keeping PETTR's database alive and humming, but to chat with full brainpower:\n"
            "1. Make sure Ollama is installed and running (`ollama serve`)\n"
            "2. Pull your preferred model (e.g. `ollama pull llama3.2`)\n"
            "3. If in Docker, ensure Ollama is listening on 0.0.0.0:11434 (see DEPLOYMENT.md)"
        )
        actual_model = "offline"
        is_online = False

    # 5. Persist assistant reply in database
    asst_record = database.save_chat_message(
        role="assistant",
        content=assistant_reply,
        model=actual_model,
        db_path=db_path
    )

    return {
        "reply": assistant_reply,
        "model": actual_model,
        "online": is_online,
        "message_id": asst_record.get("id"),
        "created_at": asst_record.get("created_at")
    }
