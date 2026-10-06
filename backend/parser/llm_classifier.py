import json
import re
from typing import Dict, Any, List, Optional
import httpx
from config.config import get_or_create_config

SYSTEM_PROMPT = """You are PETTR's intent classification engine.
Your job is to classify personal logging entries into structured JSON.

Entities:
1. "task": An actionable todo.
   - tier: "focus" (deep work, studying, design, exams, CAD, coding, complex reports) OR "trivial" (errands, chores, quick calls, picking up parcels, taking out trash).
2. "event": A scheduled appointment, class, or meeting at a specific time.
3. "reminder": A short informational note to self that may attach to a task later (e.g. "Class administered by Prof Collins", "Bring spare batteries").
4. "project": A new high-level initiative or major endeavor.
5. "unorganized": Used ONLY if the input is completely ambiguous or incomprehensible.

Matching Projects:
- You are provided with a list of CURRENT ACTIVE PROJECTS.
- If the input belongs to or mentions an existing project, specify that project name.
- If the input introduces a clearly new project name (e.g. "Make CAD for Social Science 1D"), set project_name to "Social Science 1D" and is_new_project to true.

Output MUST be valid JSON adhering strictly to this schema:
{
  "entity_type": "task" | "event" | "reminder" | "project" | "unorganized",
  "title": "<clean summary title without temporal phrases>",
  "description": "<optional details or empty string>",
  "project_name": "<project name or null>",
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

    # B. Check active projects pool
    if not matched_project:
        for proj in active_projects:
            if proj.lower() in lower:
                matched_project = proj
                pattern = re.compile(rf'\b(?:for|on|in|project)?\s*{re.escape(proj)}\b', re.IGNORECASE)
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
                           timeout_seconds: float = 3.5) -> Dict[str, Any]:
    """
    Classifies intent using local Ollama model with structured JSON enforcement.
    Falls back seamlessly to the heuristic classifier if Ollama is unreachable.
    """
    config = get_or_create_config()
    ollama_url = config.get("ollama_url", "http://localhost:11434")
    model_name = config.get("ollama_model", "llama3.2:3b")

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
            "num_predict": 150
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

                return {
                    "entity_type": entity_type,
                    "title": parsed.get("title") or cleaned_text,
                    "description": parsed.get("description", ""),
                    "project_name": parsed.get("project_name"),
                    "is_new_project": bool(parsed.get("is_new_project", False)),
                    "task_tier": parsed.get("task_tier"),
                    "confidence": float(parsed.get("confidence", 0.9)),
                    "reasoning": parsed.get("reasoning", "Classified by local LLM"),
                    "engine": f"ollama ({model_name})"
                }
    except Exception:
        pass

    # Fallback to deterministic heuristic classifier
    heuristic_res = heuristic_classify(cleaned_text, has_date, active_projects)
    heuristic_res["engine"] = "heuristic_fallback"
    return heuristic_res
