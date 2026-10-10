import os
import json
import re
from typing import Dict, Any, List, Optional
import httpx
from config.config import get_or_create_config, get_ollama_candidate_urls

SYSTEM_PROMPT = """You are PETTR's intelligent task and project intent classification engine.
Your job is to understand natural language logs and transform them into structured JSON with contextual reasoning.

Entities:
1. "task": An actionable todo.
   - tier: "focus" (deep work, studying, design, exams, CAD, coding, complex reports, hardware) OR "trivial" (errands, chores, quick calls, picking up parcels, purchasing items, groceries).
2. "event": A scheduled appointment, class, session, workshop, or meeting at a specific time (e.g. "meet Jodan for OpenRocket tutorial", "dentist at 2pm", "call with Sarah").
3. "reminder": A short informational note to self that may attach to a task later (e.g. "Class administered by Prof Collins", "Bring spare batteries").
4. "project": A new high-level initiative or major endeavor.
5. "unorganized": Used ONLY if the input is completely incoherent or meaningless gibberish.

Key Rules:
- If the user explicitly commands an entity type or tier (e.g. "Event ...", "Task ...", "Reminder ...", "Focus task ..."), respect that entity_type and tier unconditionally.
- Scheduled appointments and meetings ("meet X", "meeting with X", "call with X", "coffee with X") with dates/times are ALWAYS "event" entities, NOT tasks.
- Purpose or topic phrases in meetings (e.g. "meet Jodan for OpenRocket tutorial", "lunch with Dave for project review") are part of the event title/topic, NOT a new project to create. NEVER infer or create a new project from meeting topics.
- Strict Project Rule: NEVER create or infer a new project from prepositional phrases like "for <Phrase>" or "on <Phrase>" unless explicitly tagged with the word "project" (e.g. "project Phoenix", "for project Apollo") or matching an existing project in the active projects list.

Natural Language Project Task Patterns:
- Users frequently log tasks under projects using natural phrasing:
  * "Project <Name> new task <Task>" -> entity_type: "task", project_name: "<Name>", title: "<Task>"
  * "Project <Name> task <Task>" -> entity_type: "task", project_name: "<Name>", title: "<Task>"
  * "Project <Name>: <Task>" -> entity_type: "task", project_name: "<Name>", title: "<Task>"
  * "<Task> for project <Name>" -> entity_type: "task", project_name: "<Name>", title: "<Task>"
  * "New task for <Name>: <Task>" -> entity_type: "task", project_name: "<Name>", title: "<Task>"
  * "Add to <Name>: <Task>" -> entity_type: "task", project_name: "<Name>", title: "<Task>"
  * "Under <Name>, do <Task>" -> entity_type: "task", project_name: "<Name>", title: "<Task>"
- Always strip connector words like "new task", "task", "add task", "todo:" from the final title so it is clean (e.g. "purchase esp32", NOT "new task purchase esp32").
- If the project matches one of the current active projects (case-insensitively or fuzzy), reuse that project_name. If it does not exist yet, infer its name and set is_new_project: true.
- Tasks attached to a project do NOT require a deadline and MUST NEVER be classified as unorganized.

Few-Shot Examples:
Input: "Meet Jodan for OpenRocket tutorial"
Output: {"entity_type": "event", "title": "Meet Jodan for OpenRocket tutorial", "project_name": null, "is_new_project": false, "task_tier": null, "confidence": 0.98, "reasoning": "Scheduled meeting event with Jodan"}

Input: "Project iDeA-1 new task purchase esp32"
Output: {"entity_type": "task", "title": "purchase esp32", "project_name": "iDeA-1", "is_new_project": false, "task_tier": "trivial", "confidence": 0.95, "reasoning": "Task 'purchase esp32' under project 'iDeA-1'"}

Input: "New project: 'CALYPSO-2', add first task due today at 9: Draft user journey map"
Output: {"entity_type": "task", "title": "Draft user journey map", "project_name": "CALYPSO-2", "project_category": "External", "is_new_project": true, "task_tier": "focus", "confidence": 0.95, "reasoning": "Create project 'CALYPSO-2' with first task"}

Input: "Dentist appointment tomorrow at 14:00"
Output: {"entity_type": "event", "title": "Dentist appointment", "project_name": null, "is_new_project": false, "task_tier": null, "confidence": 0.95, "reasoning": "Scheduled appointment"}

Input: "Administered by Prof Collins"
Output: {"entity_type": "reminder", "title": "Administered by Prof Collins", "project_name": null, "is_new_project": false, "task_tier": null, "confidence": 0.90, "reasoning": "Informational context note"}

Output MUST be valid JSON adhering strictly to this schema:
{
  "entity_type": "task" | "event" | "reminder" | "project" | "unorganized",
  "title": "<clean summary title without temporal or structural prefix words>",
  "description": "<optional details or empty string>",
  "project_name": "<project name or null>",
  "project_category": "School" | "External" | null,
  "is_new_project": false,
  "task_tier": "focus" | "trivial" | null,
  "confidence": 0.0 - 1.0,
  "reasoning": "<short rationale>"
}
"""

def heuristic_classify(cleaned_text: str,
                       has_date: bool,
                       active_projects: Optional[List[str]] = None,
                       explicit_entity_type: Optional[str] = None,
                       explicit_tier: Optional[str] = None) -> Dict[str, Any]:
    """
    Fast rule-based classifier used as an instant offline fallback
    when Ollama is not yet running or during initial setup.
    """
    active_projects = active_projects or []
    text = cleaned_text.strip()
    lower = text.lower()

    # If the user explicitly commanded an entity type at the start of input
    if explicit_entity_type == "event":
        matched_proj = None
        for ap in active_projects:
            if ap and re.search(rf'\b(?:project\s+)?{re.escape(ap)}\b', text, re.IGNORECASE):
                matched_proj = ap
                break
        return {
            "entity_type": "event",
            "title": text,
            "description": "",
            "project_name": matched_proj,
            "is_new_project": False,
            "task_tier": None,
            "confidence": 0.98,
            "reasoning": f"Explicitly commanded event: '{text}'"
        }

    if explicit_entity_type == "reminder":
        matched_proj = None
        for ap in active_projects:
            if ap and re.search(rf'\b(?:project\s+)?{re.escape(ap)}\b', text, re.IGNORECASE):
                matched_proj = ap
                break
        return {
            "entity_type": "reminder",
            "title": text,
            "description": "",
            "project_name": matched_proj,
            "is_new_project": False,
            "task_tier": None,
            "confidence": 0.95,
            "reasoning": f"Explicitly commanded reminder: '{text}'"
        }

    # 0a. Explicit project task pattern:
    # "Project <Name> (new) task <Task>" or "Project: <Name> - <Task>" or "Project <Name>: <Task>"
    # e.g. "Project iDeA-1 new task purchase esp32"
    proj_task_p1 = re.search(
        r'^\s*project\s*[:\-]?(?:\s*[\'\"`]([^\'\"`]+)[\'\"`]|\s+([A-Za-z0-9\-_\.]+))\s*(?:,\s*|\s+-\s+|\s*:\s*|\s+)(?:(?:new\s+)?task|todo|add\s+task)?\s*[:\-]?(?:\s+)?(.+)$',
        text,
        re.IGNORECASE
    )
    if proj_task_p1:
        cand_proj = (proj_task_p1.group(1) or proj_task_p1.group(2)).strip(' \'\":,')
        raw_task = proj_task_p1.group(3).strip(' \'\":,')
        if cand_proj and raw_task and len(cand_proj) <= 40:
            actual_proj = cand_proj
            is_new = True
            for ap in active_projects:
                if ap.lower() == cand_proj.lower() or cand_proj.lower() in ap.lower():
                    actual_proj = ap
                    is_new = False
                    break

            clean_task = re.sub(r'^(?:(?:new\s+)?task|todo|add\s+task)\s*[:\-]?\s*', '', raw_task, flags=re.IGNORECASE).strip(' :-,')
            if not clean_task:
                clean_task = raw_task

            school_cues = r'\b(class|course|prof|professor|exam|homework|study|lecture|thesis|semester|assignment|module|school)\b'
            cat = "School" if re.search(school_cues, lower) else "External"
            focus_cues = r'\b(exam|study|design|cad|model|thesis|paper|report|write|build|develop|analysis|research|code|program)\b'
            tier = explicit_tier or ("focus" if re.search(focus_cues, clean_task.lower()) else ("trivial" if len(clean_task.split()) <= 4 else "focus"))

            return {
                "entity_type": "task",
                "title": clean_task,
                "description": "",
                "project_name": actual_proj,
                "project_category": cat,
                "is_new_project": is_new,
                "task_tier": tier,
                "confidence": 0.95,
                "reasoning": f"Identified task '{clean_task}' under project '{actual_proj}'"
            }

    # 0b. Inverted pattern: "new task for (project) <Name>: <Task>" or "add task to <Name>: <Task>"
    proj_task_p2 = re.search(
        r'\b(?:new\s+task|add\s+task|task)\s+(?:for|to|in|under)\s+(?:project\s+)?(?:[\'\"`]([^\'\"`]+)[\'\"`]|([A-Za-z0-9\-_\.]+))\s*[:\-]?(?:\s+to\s+|\s*:\s*|\s*\-\s*|\s+)(.+)$',
        text,
        re.IGNORECASE
    )
    if proj_task_p2:
        cand_proj = (proj_task_p2.group(1) or proj_task_p2.group(2)).strip(' \'\":,')
        raw_task = proj_task_p2.group(3).strip(' \'\":,')
        if cand_proj and raw_task and len(cand_proj) <= 40:
            actual_proj = cand_proj
            is_new = True
            for ap in active_projects:
                if ap.lower() == cand_proj.lower() or cand_proj.lower() in ap.lower():
                    actual_proj = ap
                    is_new = False
                    break
            clean_task = re.sub(r'^(?:(?:new\s+)?task|todo|add\s+task)\s*[:\-]?\s*', '', raw_task, flags=re.IGNORECASE).strip(' :-,')
            if not clean_task:
                clean_task = raw_task

            school_cues = r'\b(class|course|prof|professor|exam|homework|study|lecture|thesis|semester|assignment|module|school)\b'
            cat = "School" if re.search(school_cues, lower) else "External"
            focus_cues = r'\b(exam|study|design|cad|model|thesis|paper|report|write|build|develop|analysis|research|code|program)\b'
            tier = explicit_tier or ("focus" if re.search(focus_cues, clean_task.lower()) else ("trivial" if len(clean_task.split()) <= 4 else "focus"))

            return {
                "entity_type": "task",
                "title": clean_task,
                "description": "",
                "project_name": actual_proj,
                "project_category": cat,
                "is_new_project": is_new,
                "task_tier": tier,
                "confidence": 0.95,
                "reasoning": f"Identified task '{clean_task}' under project '{actual_proj}'"
            }

    # 0c. Check explicit compound project creation pattern:
    # e.g. "New project: 'CALYPSO-2', add first task due today at 9: Draft user journey map"
    # or "New project: CALYPSO-2, add first task: ..."
    compound_match = re.search(
        r'\b(?:new|create|start)\s+project\s*[:\-]?\s*(?:[\'\"`]([^\'\"`]+)[\'\"`]|([A-Za-z0-9\-_\. ]+?))\s*(?:,\s*|\s+-\s+|\s+and\s+|\s*:\s*|$)(?:add\s+(?:first\s+)?task\s*(?:due\s+[^:]+)?[:\-]?\s*)?(.*)',
        text,
        re.IGNORECASE
    )
    if compound_match:
        cand_proj = (compound_match.group(1) or compound_match.group(2)).strip(' \'\":,')
        rest_part = compound_match.group(3).strip(' \'\":,') if compound_match.group(3) else ""
        if cand_proj and len(cand_proj) <= 40:
            school_cues = r'\b(class|course|prof|professor|exam|homework|study|lecture|thesis|semester|assignment|module|school)\b'
            cat = "School" if re.search(school_cues, lower) else "External"

            if rest_part:
                task_title = re.sub(r'^(?:add\s+(?:first\s+)?task\s*[:\-]?\s*|due\s+[^:]+:\s*)', '', rest_part, flags=re.IGNORECASE).strip(' :-,')
                if not task_title:
                    task_title = rest_part
                return {
                    "entity_type": "task",
                    "title": task_title,
                    "description": "",
                    "project_name": cand_proj,
                    "project_category": cat,
                    "is_new_project": True,
                    "task_tier": explicit_tier or "focus",
                    "confidence": 0.95,
                    "reasoning": f"Compound command: create project '{cand_proj}' ({cat}) with initial focus task"
                }
            else:
                return {
                    "entity_type": "project",
                    "title": cand_proj,
                    "description": "",
                    "project_name": cand_proj,
                    "project_category": cat,
                    "is_new_project": True,
                    "task_tier": None,
                    "confidence": 0.95,
                    "reasoning": f"Create new project '{cand_proj}' ({cat})"
                }

    # 1. Check for reminders (e.g. "administered by...", "note to self:", "remember that...")
    if re.search(r'\b(administered by|remember to|remember that|note:|note to self|bring |dont forget)\b', lower):
        return {
            "entity_type": "reminder",
            "title": text,
            "description": "",
            "project_name": None,
            "is_new_project": False,
            "task_tier": None,
            "confidence": 0.85,
            "reasoning": "Heuristic matched reminder phrasing"
        }

    # 2. Check for events (e.g. "meeting", "class", "doctor appointment", "dentist", "meet Jodan", "call with")
    event_keywords = (
        r'\b(?:'
        r'event|meeting|appointment|call\s+with|sync\s+with|interview|class|flight|lecture|'
        r'tutorial|session|workshop|hangout|lunch\s+with|dinner\s+with|coffee\s+with|catch\s+up\s+with|'
        r'doctor|dentist|meet\s+[a-z0-9_\-]+'
        r')\b'
    )
    if re.search(event_keywords, lower) and has_date:
        matched_proj = None
        for ap in active_projects:
            if ap and re.search(rf'\b(?:project\s+)?{re.escape(ap)}\b', text, re.IGNORECASE):
                matched_proj = ap
                break
        return {
            "entity_type": "event",
            "title": text,
            "description": "",
            "project_name": matched_proj,
            "is_new_project": False,
            "task_tier": None,
            "confidence": 0.92,
            "reasoning": "Heuristic matched scheduled event with date/time"
        }

    # 3. Project detection from prefix pattern, active projects, or preposition cues (Tasks)
    matched_project = None
    is_new = False
    cleaned_task_title = text

    # A. Check prefix pattern: e.g. "Social Studies T1 complete analysis of Gaertz text"
    prefix_proj_match = re.match(
        r'^([A-Z][A-Za-z0-9\s]{1,30}?(?:T\d+|1D|Concept|Project|Phase\s*\d+|\d+[A-Za-z]?))\s+(?:-|:|\b(complete|finish|do|draft|work on|prepare|analyze|review|study|make|build|write|create|read|submit)\b)(.*)',
        text,
        re.IGNORECASE
    )
    if prefix_proj_match:
        matched_project = prefix_proj_match.group(1).strip()
        verb = prefix_proj_match.group(2) or ""
        rest = prefix_proj_match.group(3) or ""
        cleaned_task_title = f"{verb.capitalize()} {rest}".strip() if verb else rest.strip()
        is_new = matched_project.lower() not in [p.lower() for p in active_projects]

    # B. Check active projects pool (using word boundary matching to avoid false positives like single-letter project names)
    if not matched_project:
        for proj in active_projects:
            if not proj or len(proj.strip()) == 0:
                continue
            # Match whole word/token only
            escaped_proj = re.escape(proj.strip())
            match = re.search(rf'(?:\b|(?<=^))(?:for|on|in|project)?\s*{escaped_proj}(?:\b|(?=$))', text, re.IGNORECASE)
            if match:
                matched_project = proj
                pattern = re.compile(rf'(?:\b|(?<=^))(?:for|on|in|project)?\s*{escaped_proj}(?:\b|(?=$))', re.IGNORECASE)
                sub_text = pattern.sub('', text).strip(' :-,')
                if sub_text:
                    cleaned_task_title = sub_text
                break
            
    # C. Check pattern like "for project <Project>" or "project <Project>" or module/course codes
    if not matched_project:
        proj_match = re.search(r'\b(?:for\s+project|project)\s+([A-Z0-9][A-Za-z0-9\s\-]{2,25})\b', text, re.IGNORECASE)
        if not proj_match:
            # Module/course code pattern: e.g. "for Social Science 1D" or "for IDEA-1 Concept"
            proj_match = re.search(r'\b(?:for|on)\s+([A-Z0-9][A-Za-z0-9\s\-]{1,25}?(?:[0-9]+[A-Za-z]?|[A-Za-z]+[0-9]+|Concept|Phase|T\d+|1D)\b[A-Za-z0-9\s\-]{0,10})', text)

        if proj_match:
            candidate = proj_match.group(1).strip()
            # Exclude common false positives
            if candidate.lower() not in ("tomorrow", "today", "tonight", "myself", "dinner", "lunch", "breakfast"):
                matched_project = candidate
                is_new = True
                sub_text = re.sub(r'\b(?:for\s+project|project|for|on)\s+' + re.escape(candidate), '', text, flags=re.IGNORECASE).strip(' :-,')
                if sub_text:
                    cleaned_task_title = sub_text

    # 4. Check for tasks: Focus vs Trivial
    # Focus keywords: exam, study, design, cad, code, program, write paper, report, thesis, analysis, research
    focus_keywords = r'\b(exam|study|design|cad|model|thesis|paper|report|write|build|develop|analysis|research|prepare for)\b'
    # Trivial keywords: trash, parcel, package, laundry, grocery, groceries, buy, milk, dishes, clean, pickup, pick up
    trivial_keywords = r'\b(trash|parcel|package|laundry|groceries|grocery|buy|clean|dishes|pickup|pick up|mail|errand)\b'

    if explicit_tier:
        tier = explicit_tier
        confidence = 0.95
    elif re.search(focus_keywords, lower):
        tier = "focus"
        confidence = 0.92
    elif re.search(trivial_keywords, lower):
        tier = "trivial"
        confidence = 0.92
    else:
        # Default task tier based on word count/complexity
        tier = "focus" if len(text.split()) > 6 else "trivial"
        confidence = 0.75

    return {
        "entity_type": "task",
        "title": cleaned_task_title or text,
        "description": "",
        "project_name": matched_project,
        "is_new_project": is_new,
        "task_tier": tier,
        "confidence": confidence,
        "reasoning": f"Heuristic classified as {tier} task"
    }

async def classify_with_llm(cleaned_text: str,
                           has_date: bool,
                           extracted_date_str: Optional[str],
                           active_projects: List[str],
                           timeout_seconds: float = 12.0,
                           explicit_entity_type: Optional[str] = None,
                           explicit_tier: Optional[str] = None) -> Dict[str, Any]:
    """
    Classifies intent using local Ollama model with structured JSON enforcement.
    Falls back seamlessly to the heuristic classifier if Ollama is unreachable.
    """
    config = get_or_create_config()
    candidate_urls = get_ollama_candidate_urls()
    model_name = os.environ.get("OLLAMA_MODEL") or config.get("ollama_model", "llama3.2:3b")

    prompt_lines = [
        f"Current active projects: {json.dumps(active_projects)}",
        f"Has extracted date/time: {has_date} ({extracted_date_str or 'none'})"
    ]
    if explicit_entity_type:
        prompt_lines.append(f"Explicit user commanded entity type: {explicit_entity_type}")
    if explicit_tier:
        prompt_lines.append(f"Explicit user commanded task tier: {explicit_tier}")
    prompt_lines.append(f'Input text: "{cleaned_text}"')
    prompt_lines.append("")
    prompt_lines.append("Return JSON classification:")
    prompt = "\n".join(prompt_lines)

    payload = {
        "model": model_name,
        "prompt": prompt,
        "system": SYSTEM_PROMPT,
        "format": "json",
        "stream": False,
        "options": {
            "temperature": 0.1,
            "num_predict": 180
        }
    }

    for ollama_url in candidate_urls:
        try:
            async with httpx.AsyncClient(timeout=timeout_seconds) as client:
                resp = await client.post(f"{ollama_url}/api/generate", json=payload)
                if resp.status_code == 200:
                    data = resp.json()
                    raw_response = data.get("response", "{}")
                    parsed = json.loads(raw_response)
                    
                    # Validate schema fields
                    entity_type = explicit_entity_type or parsed.get("entity_type", "task")
                    if entity_type not in ("project", "task", "event", "reminder", "unorganized"):
                        entity_type = "task"

                    raw_title = parsed.get("title") or cleaned_text
                    # Clean prefix "new task" or "task" if LLM left it in title
                    cleaned_title = re.sub(r'^(?:(?:new\s+)?task|todo|add\s+task)\s*[:\-]?\s*', '', raw_title, flags=re.IGNORECASE).strip(' :-,')
                    if not cleaned_title:
                        cleaned_title = raw_title

                    proj_name = parsed.get("project_name")
                    is_new_proj = bool(parsed.get("is_new_project", False))
                    # If entity is an event, prevent spurious new project creation unless explicitly commanded
                    if entity_type == "event" and is_new_proj:
                        if not re.search(rf'\bproject\s+{re.escape(proj_name or "")}\b', cleaned_text, re.IGNORECASE):
                            proj_name = None
                            is_new_proj = False

                    conf = float(parsed.get("confidence", 0.9))
                    if explicit_entity_type:
                        conf = max(conf, 0.95)
                    elif proj_name and entity_type == "task":
                        conf = max(conf, 0.95)

                    task_tier = explicit_tier or parsed.get("task_tier")

                    return {
                        "entity_type": entity_type,
                        "title": cleaned_title,
                        "description": parsed.get("description", ""),
                        "project_name": proj_name,
                        "project_category": parsed.get("project_category"),
                        "is_new_project": is_new_proj,
                        "task_tier": task_tier,
                        "confidence": conf,
                        "reasoning": parsed.get("reasoning", "Classified by local LLM"),
                        "engine": f"ollama ({model_name})"
                    }
        except Exception:
            continue

    # Fallback to deterministic heuristic classifier
    heuristic_res = heuristic_classify(
        cleaned_text,
        has_date,
        active_projects,
        explicit_entity_type=explicit_entity_type,
        explicit_tier=explicit_tier
    )
    heuristic_res["engine"] = "heuristic_fallback"
    return heuristic_res
