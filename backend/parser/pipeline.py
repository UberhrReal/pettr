import datetime
from pathlib import Path
from typing import Dict, Any, Optional
from backend.parser.deterministic import parse_deterministic_date, extract_priority, extract_explicit_entity_intent
from backend.parser.llm_classifier import classify_with_llm
from backend import database

import re
from typing import Tuple

def check_date_validity(raw_text: str, temporal_data: Dict[str, Any], entity_type: str, project_name: Optional[str] = None) -> Tuple[bool, str]:
    """
    Validates that if a date/time was specified, it is valid and has at least a set day.
    If an invalid date format or out-of-bounds day/month/time is detected, or if a time
    was specified without a set day, returns (False, reason).
    """
    raw_lower = raw_text.lower()

    # 1. Invalid calendar day/month numbers (e.g. 32/13, 99/99)
    slash_dates = re.findall(r'\b(\d{1,4})[/-](\d{1,2})(?:[/-](\d{1,4}))?\b', raw_text)
    for parts in slash_dates:
        nums = [int(p) for p in parts if p]
        if any(n > 31 for n in nums if n < 100):
            return False, f"Invalid date numbers in '{'/'.join(parts)}' (out of range)"
        if len(nums) == 2 and nums[0] > 12 and nums[1] > 12:
            return False, f"Invalid date: no valid month in '{'/'.join(parts)}'"

    # 2. Check invalid day numbers for specific months (e.g. Feb 30, Apr 31)
    month_days = {
        "jan": 31, "january": 31, "feb": 29, "february": 29,
        "mar": 31, "march": 31, "apr": 30, "april": 30,
        "may": 31, "jun": 30, "june": 30, "jul": 31, "july": 31,
        "aug": 31, "august": 31, "sep": 30, "september": 30,
        "oct": 31, "october": 31, "nov": 30, "november": 30,
        "dec": 31, "december": 31
    }
    for m_name, max_d in month_days.items():
        m1 = re.search(rf'\b{m_name}\s+(\d{{1,2}})(?:st|nd|rd|th)?\b', raw_lower)
        if m1 and int(m1.group(1)) > max_d:
            return False, f"Invalid calendar day for {m_name.capitalize()}: {m1.group(1)} (max {max_d})"
        m2 = re.search(rf'\b(\d{{1,2}})(?:st|nd|rd|th)?\s+(?:of\s+)?{m_name}\b', raw_lower)
        if m2 and int(m2.group(1)) > max_d:
            return False, f"Invalid calendar day for {m_name.capitalize()}: {m2.group(1)} (max {max_d})"

    # 3. Invalid times (e.g. 25:00, 14:75)
    time_matches = re.findall(r'\b(\d{1,2}):(\d{2})\b', raw_text)
    for hh, mm in time_matches:
        if int(hh) > 24 or int(mm) > 59:
            return False, f"Invalid time specified: {hh}:{mm}"

    # 4. Date cue present but unparseable
    date_cues = re.search(r'\b(due\s+on|due\s+by|deadline\s+is|scheduled\s+for|on\s+date)\s+([^\s,]+)', raw_lower)
    if date_cues and not temporal_data.get("has_date"):
        return False, f"Unparseable date following '{date_cues.group(1)}'"

    # 5. Standalone Tasks and Events strictly require a set day or deadline
    # (Time-only specifications like '12pm' or 'at 14:00' default to today)
    # BUT: Project tasks do NOT need a due date to belong to their project!
    if entity_type == "task" and not project_name and not temporal_data.get("has_date"):
        return False, "Standalone task has no specified day or deadline — sent to unorganised queue for review"
    if entity_type == "event" and not temporal_data.get("has_date"):
        return False, "Scheduled event requires a date or time"

    return True, ""


async def process_user_input(raw_input: str,
                             ref_datetime: Optional[datetime.datetime] = None,
                             db_path: Optional[Path] = None,
                             today: Optional[datetime.date] = None) -> Dict[str, Any]:
    """
    Main 3-stage hybrid ingestion pipeline:
    1. Deterministic temporal extraction (never uses LLM for dates/times)
    2. Deterministic priority extraction & title cleaning
    3. LLM / Heuristic intent & project classification (strict JSON schema)
    4. Business logic execution (urgency, priority order, project pool, unorganized safety queue)
    5. Audit trail logging to history
    """
    db_path = database.resolve_db_path(db_path)
    if ref_datetime is None:
        if today is not None:
            ref_datetime = datetime.datetime.combine(today, datetime.time(12, 0, 0))
        else:
            ref_datetime = datetime.datetime.now()

    clean_raw = raw_input.strip()
    if not clean_raw:
        return {"status": "error", "message": "Input cannot be empty."}

    # Stage 0: Detect explicit entity declaration (e.g. "Event today 2pm...", "Reminder: ...", "Task: ...")
    text_after_explicit, explicit_type, explicit_tier = extract_explicit_entity_intent(clean_raw)
    input_for_date_parsing = text_after_explicit if explicit_type else clean_raw

    # Stage 1: Deterministic Date Parsing
    temporal_data = parse_deterministic_date(input_for_date_parsing, ref_datetime=ref_datetime)
    has_date = temporal_data["has_date"]
    due_date_str = temporal_data["datetime_str"]
    is_recurring = temporal_data["is_recurring"]
    rrule = temporal_data["rrule"]
    matched_token = temporal_data["matched_token"]
    cleaned_text = temporal_data["cleaned_text"]

    # If explicit type wasn't at the very start of raw, check if it was inside cleaned_text
    if not explicit_type:
        cleaned_text, explicit_type, explicit_tier = extract_explicit_entity_intent(cleaned_text)

    # If caller explicitly provided `today`, and no date was in text, set today as the target date
    if not has_date and today is not None:
        has_date = True
        due_date_str = f"{today.strftime('%Y-%m-%d')} 23:59:00"
        temporal_data["has_date"] = True
        temporal_data["datetime_str"] = due_date_str

    # Stage 1b: Natural Language Priority Extraction
    cleaned_text, priority_placement, priority_token = extract_priority(cleaned_text)

    # If the text is empty after stripping date and priority
    if not cleaned_text:
        cleaned_text = input_for_date_parsing or clean_raw

    # Capitalize title cleanly
    if cleaned_text:
        cleaned_text = cleaned_text[0].upper() + cleaned_text[1:]

    # Stage 2: Intent Classification
    active_projects = [p["name"] for p in database.get_all_projects(db_path)]
    classification = await classify_with_llm(
        cleaned_text=cleaned_text,
        has_date=has_date,
        extracted_date_str=due_date_str,
        active_projects=active_projects,
        explicit_entity_type=explicit_type,
        explicit_tier=explicit_tier
    )

    entity_type = explicit_type or classification.get("entity_type", "task")
    raw_title = classification.get("title", cleaned_text)
    # Ensure title is stripped of any remaining priority tokens or leading entity type labels
    clean_candidate, _, _ = extract_priority(raw_title)
    clean_candidate, _, _ = extract_explicit_entity_intent(clean_candidate)
    title = clean_candidate if clean_candidate else raw_title
    if title:
        title = title[0].upper() + title[1:]

    project_name = classification.get("project_name")
    is_new_project = classification.get("is_new_project", False)
    task_tier = explicit_tier or classification.get("task_tier") or "focus"
    confidence = classification.get("confidence", 0.9)
    reasoning = classification.get("reasoning", "")

    # Date Validation & Required Set Day Enforcement
    is_date_valid, date_invalid_reason = check_date_validity(clean_raw, temporal_data, entity_type, project_name=project_name)
    if not is_date_valid:
        confidence = 0.4
        reasoning = f"Uncertain date/time: {date_invalid_reason}. Sent to unorganised queue for manual review."
        entity_type = "unorganized"

    # Stage 3: Routing & Business Logic
    # Safety Net: If confidence is low or marked unorganized
    if confidence < 0.60 or entity_type == "unorganized":
        unorg_item = database.add_to_unorganized_queue(
            raw_input=clean_raw,
            parsed_date=due_date_str,
            suggested_type=entity_type,
            suggested_tier=task_tier,
            suggested_project=project_name,
            reasoning=reasoning,
            confidence=confidence,
            db_path=db_path
        )
        database.log_history(
            raw_input=clean_raw,
            extracted_date=due_date_str,
            llm_classification=classification,
            target_entity_type="unorganized",
            target_entity_id=unorg_item["id"],
            status="unorganized",
            db_path=db_path
        )
        return {
            "status": "unorganized",
            "message": "Entry placed in Unorganized Queue for manual review.",
            "reasoning": reasoning,
            "item": unorg_item,
            "temporal": temporal_data,
            "classification": classification
        }

    target_id = None
    created_entity = None

    # Handle Project auto-registration to global pool
    project_cat = classification.get("project_category") or "External"
    if project_name:
        database.get_or_create_project(project_name, category=project_cat, db_path=db_path)

    if entity_type == "project":
        created_entity = database.get_or_create_project(title, category=project_cat, db_path=db_path)
        target_id = created_entity["id"]

    elif entity_type == "event":
        start_time = due_date_str if due_date_str else ref_datetime.strftime("%Y-%m-%d %H:%M:%S")
        created_entity = database.create_event(
            title=title,
            start_time=start_time,
            description=classification.get("description", ""),
            project_name=project_name,
            recurrence=rrule,
            db_path=db_path
        )
        target_id = created_entity["id"]

    elif entity_type == "reminder":
        rem_date = due_date_str.split(" ")[0] if due_date_str else ref_datetime.strftime("%Y-%m-%d")
        created_entity = database.create_reminder(
            title=title,
            details=classification.get("description", ""),
            reminder_date=rem_date,
            db_path=db_path
        )
        target_id = created_entity["id"]

    else: # Default: Task
        is_time_sensitive = True if ("time sensitive" in clean_raw.lower() or "time-sensitive" in clean_raw.lower()) else False
        clean_task_title = re.sub(r'(?i)\btime[\s-]sensitive\b', '', title).strip()
        if clean_task_title:
            title = clean_task_title
        created_entity = database.create_task(
            title=title,
            description=classification.get("description", ""),
            project_name=project_name,
            tier=task_tier,
            due_date=due_date_str,
            due_date_raw=matched_token,
            recurrence=rrule,
            priority_placement=priority_placement,
            is_time_sensitive=is_time_sensitive,
            db_path=db_path
        )
        target_id = created_entity["id"]

    # Stage 4: History Logging
    database.log_history(
        raw_input=clean_raw,
        extracted_date=due_date_str,
        llm_classification=classification,
        target_entity_type=entity_type,
        target_entity_id=target_id,
        status="success",
        db_path=db_path
    )

    return {
        "status": "success",
        "entity_type": entity_type,
        "entity": created_entity,
        "temporal": temporal_data,
        "classification": classification
    }
