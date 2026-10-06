import os
import json
import re
from typing import Dict, Any, List, Optional
import httpx
from config.config import get_or_create_config

SYSTEM_PROMPT = """You are PETTR's intelligent task and project intent classification engine.
Your job is to understand natural language logs and transform them into structured JSON with contextual reasoning.

Entities:
1. "task": An actionable todo.
   - tier: "focus" (deep work, studying, design, exams, CAD, coding, complex reports, hardware) OR "trivial" (errands, chores, quick calls, picking up parcels, purchasing items, groceries).
2. "event": A scheduled appointment, class, or meeting at a specific time.
3. "reminder": A short informational note to self that may attach to a task later (e.g. "Class administered by Prof Collins", "Bring spare batteries").
4. "project": A new high-level initiative or major endeavor.
5. "unorganized": Used ONLY if the input is completely incoherent or meaningless gibberish.

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
                       active_projects: List[str]) -> Dict[str, Any]:
    """
    Fast rule-based classifier used as an instant offline fallback
    when Ollama is not yet running or during initial setup.
    """
    text = cleaned_text.strip()
    lower = text.lower()

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
            tier = "focus" if re.search(focus_cues, clean_task.lower()) else ("trivial" if len(clean_task.split()) <= 4 else "focus")

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
            tier = "focus" if re.search(focus_cues, clean_task.lower()) else ("trivial" if len(clean_task.split()) <= 4 else "focus")

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
                    "task_tier": "focus",
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

    # 1. Project detection from prefix pattern, active projects, or preposition cues
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
            
    # C. Check pattern like "for <Project>" or "project <Project>"
    if not matched_project:
        proj_match = re.search(r'\b(?:for|on|project)\s+([A-Z0-9][A-Za-z0-9\s\-]{2,25})\b', text)
        if proj_match:
            candidate = proj_match.group(1).strip()
            # Exclude common false positives
            if candidate.lower() not in ("tomorrow", "today", "tonight", "myself", "dinner", "lunch", "breakfast"):
                matched_project = candidate
                is_new = True
                sub_text = re.sub(r'\b(?:for|on|project)\s+' + re.escape(candidate), '', text, flags=re.IGNORECASE).strip(' :-,')
                if sub_text:
                    cleaned_task_title = sub_text

    # 2. Check for reminders (e.g. "administered by...", "note to self:", "remember that...")
    if re.search(r'\b(administered by|remember to|remember that|note:|note to self|bring |dont forget)\b', lower):
        return {
            "entity_type": "reminder",
            "title": text,
            "description": "",
            "project_name": matched_project,
            "is_new_project": is_new,
            "task_tier": None,
            "confidence": 0.85,
            "reasoning": "Heuristic matched reminder phrasing"
        }

    # 3. Check for events (e.g. "meeting", "class", "doctor appointment", "dentist", "lunch with")
    if re.search(r'\b(meeting|appointment|call with|sync with|interview|class|flight|lecture)\b', lower) and has_date:
        return {
            "entity_type": "event",
            "title": text,
            "description": "",
            "project_name": matched_project,
            "is_new_project": is_new,
            "task_tier": None,
            "confidence": 0.90,
            "reasoning": "Heuristic matched scheduled event with date"
        }

    # 4. Check for tasks: Focus vs Trivial
    # Focus keywords: exam, study, design, cad, code, program, write paper, report, thesis, analysis, research
    focus_keywords = r'\b(exam|study|design|cad|model|thesis|paper|report|write|build|develop|analysis|research|prepare for)\b'
    # Trivial keywords: trash, parcel, package, laundry, grocery, groceries, buy, milk, dishes, clean, pickup, pick up
    trivial_keywords = r'\b(trash|parcel|package|laundry|groceries|grocery|buy|clean|dishes|pickup|pick up|mail|errand)\b'

    if re.search(focus_keywords, lower):
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
                           timeout_seconds: float = 12.0) -> Dict[str, Any]:
    """
    Classifies intent using local Ollama model with structured JSON enforcement.
    Falls back seamlessly to the heuristic classifier if Ollama is unreachable.
    """
    config = get_or_create_config()
    ollama_url = os.environ.get("OLLAMA_URL") or config.get("ollama_url", "http://localhost:11434")
    model_name = os.environ.get("OLLAMA_MODEL") or config.get("ollama_model", "llama3.2:3b")

    prompt = f"""Current active projects: {json.dumps(active_projects)}
Has extracted date/time: {has_date} ({extracted_date_str or 'none'})
Input text: "{cleaned_text}"

Return JSON classification:"""

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

    try:
        async with httpx.AsyncClient(timeout=timeout_seconds) as client:
            resp = await client.post(f"{ollama_url}/api/generate", json=payload)
            if resp.status_code == 200:
                data = resp.json()
                raw_response = data.get("response", "{}")
                parsed = json.loads(raw_response)
                
                # Validate schema fields
                entity_type = parsed.get("entity_type", "task")
                if entity_type not in ("project", "task", "event", "reminder", "unorganized"):
                    entity_type = "task"

                raw_title = parsed.get("title") or cleaned_text
                # Clean prefix "new task" or "task" if LLM left it in title
                cleaned_title = re.sub(r'^(?:(?:new\s+)?task|todo|add\s+task)\s*[:\-]?\s*', '', raw_title, flags=re.IGNORECASE).strip(' :-,')
                if not cleaned_title:
                    cleaned_title = raw_title

                proj_name = parsed.get("project_name")
                conf = float(parsed.get("confidence", 0.9))
                # If a project is identified, ensure confidence is high so pipeline doesn't route to unorganized
                if proj_name and entity_type == "task":
                    conf = max(conf, 0.95)

                return {
                    "entity_type": entity_type,
                    "title": cleaned_title,
                    "description": parsed.get("description", ""),
                    "project_name": proj_name,
                    "project_category": parsed.get("project_category"),
                    "is_new_project": bool(parsed.get("is_new_project", False)),
                    "task_tier": parsed.get("task_tier"),
                    "confidence": conf,
                    "reasoning": parsed.get("reasoning", "Classified by local LLM"),
                    "engine": f"ollama ({model_name})"
                }
    except Exception:
        pass

    # Fallback to deterministic heuristic classifier
    heuristic_res = heuristic_classify(cleaned_text, has_date, active_projects)
    heuristic_res["engine"] = "heuristic_fallback"
    return heuristic_res
