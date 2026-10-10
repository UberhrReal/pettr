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
from pathlib import Path
from typing import Dict, Any, List, Optional
import httpx
from config.config import get_or_create_config, get_ollama_candidate_urls, save_config, get_user_profile
from backend.parser.llm_classifier import resolve_best_model
from backend import database

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
- Keep responses articulate and engaging. Use formatting like bullet points, bold text, or backticks where helpful."""

HORACE_BASE_SYSTEM_PROMPT = get_horace_system_prompt("Hong Rong")

def build_live_telemetry_context(db_path: Optional[Path] = None, user_name: Optional[str] = None) -> str:
    """Builds a concise real-time state snippet of PETTR to inject into Horace's system instructions."""
    try:
        now = datetime.datetime.now()
        today = datetime.date.today()
        today_str = today.isoformat()

        # Active projects
        projects = database.get_all_projects(db_path=db_path)
        active_projects = [p for p in projects if p.get("status") == "active"]
        proj_names = [p.get("name") for p in active_projects[:6] if p.get("name")]

        # Today's tasks
        day_tasks_data = database.get_tasks_for_day(today, db_path=db_path)
        focus_tasks = day_tasks_data.get("focus", [])
        trivial_tasks = day_tasks_data.get("trivial", [])
        pending_focus = [t.get("title") for t in focus_tasks if t.get("status") != "completed"]
        pending_trivial = [t.get("title") for t in trivial_tasks if t.get("status") != "completed"]
        completed_today = [t for t in focus_tasks + trivial_tasks if t.get("status") == "completed"]

        # Today's daily order
        daily_order = database.get_daily_order(today_str, db_path=db_path)

        context_lines = [
            f"[LIVE PETTR TELEMETRY - {now.strftime('%Y-%m-%d %H:%M')}]",
            f"- Server Host: Horace (Local home server node)",
            f"- Active Projects ({len(projects)}): {', '.join(proj_names) if proj_names else 'None'}",
            f"- Today's Focus Task(s): {', '.join(pending_focus) if pending_focus else 'None pending'}",
            f"- Today's Trivial Task(s): {', '.join(pending_trivial[:4]) if pending_trivial else 'None pending'} ({len(pending_trivial)} total)",
            f"- Tasks Completed Today: {len(completed_today)}",
            f"- Priority Daily Order: {len(daily_order)} items locked"
        ]
        return "\n".join(context_lines)
    except Exception:
        return f"[LIVE PETTR TELEMETRY: Host Horace active, {datetime.datetime.now().strftime('%H:%M')}]"

async def chat_with_horace(
    user_message: str,
    db_path: Optional[Path] = None,
    model_override: Optional[str] = None,
    timeout_seconds: float = 60.0
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
    telemetry = build_live_telemetry_context(db_path=db_path, user_name=user_name)
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
            "temperature": 0.8,
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
