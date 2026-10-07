import re
import datetime
from typing import Optional, Dict, Any, Tuple
import parsedatetime as pdt

DAY_MAP = {
    "monday": "MO",
    "mon": "MO",
    "tuesday": "TU",
    "tue": "TU",
    "wednesday": "WE",
    "wed": "WE",
    "thursday": "TH",
    "thu": "TH",
    "friday": "FR",
    "fri": "FR",
    "saturday": "SA",
    "sat": "SA",
    "sunday": "SU",
    "sun": "SU"
}

RECURRING_REGEX = re.compile(
    r'\b(?:every|each)\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday|mon|tue|wed|thu|fri|sat|sun|day|weekday|week|month)(?:\s+(morning|afternoon|evening|night))?(?:\s+(?:at\s+)?(\d{1,2}(?::\d{2})?(?:am|pm)?|\d{4}))?\b',
    re.IGNORECASE
)

# Military time like "2359", "0930", "1400"
MILITARY_TIME_REGEX = re.compile(r'\b([01]\d|2[0-3])([0-5]\d)\b')

def parse_deterministic_date(text: str, ref_datetime: Optional[datetime.datetime] = None) -> Dict[str, Any]:
    """
    Deterministically parses dates, times, and recurrence rules from text.
    Never uses an LLM for relative dates or times.
    
    Returns a dictionary:
    {
        "has_date": bool,
        "datetime": Optional[datetime.datetime],
        "datetime_str": Optional[str], # YYYY-MM-DD HH:MM:SS
        "is_recurring": bool,
        "rrule": Optional[str],
        "matched_token": Optional[str],
        "cleaned_text": str
    }
    """
    if ref_datetime is None:
        ref_datetime = datetime.datetime.now()

    cal = pdt.Calendar()
    original_text = text.strip()
    
    # 1. Check for recurring pattern (e.g. "every Tuesday night")
    recurring_match = RECURRING_REGEX.search(original_text)
    is_recurring = False
    rrule = None
    recurring_token = None
    target_dt = None

    if recurring_match:
        is_recurring = True
        recurring_token = recurring_match.group(0)
        unit = recurring_match.group(1).lower()
        time_of_day = recurring_match.group(2)
        at_time = recurring_match.group(3)

        if unit in DAY_MAP:
            rrule = f"FREQ=WEEKLY;BYDAY={DAY_MAP[unit]}"
            # Parse next occurrence for target_dt
            parse_phrase = f"next {unit}"
            if time_of_day:
                parse_phrase += f" {time_of_day}"
            elif at_time:
                parse_phrase += f" at {at_time}"
            dt_tuple, flag = cal.parseDT(parse_phrase, sourceTime=ref_datetime)
            if flag > 0:
                target_dt = dt_tuple
        elif unit == "day":
            rrule = "FREQ=DAILY"
            target_dt = ref_datetime
        elif unit == "weekday":
            rrule = "FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR"
            target_dt = ref_datetime
        elif unit == "week":
            rrule = "FREQ=WEEKLY"
            target_dt = ref_datetime
        elif unit == "month":
            rrule = "FREQ=MONTHLY"
            target_dt = ref_datetime

        # Strip recurring token
        cleaned_text = original_text[:recurring_match.start()] + original_text[recurring_match.end():]
        cleaned_text = re.sub(r'\s+', ' ', cleaned_text).strip(' .,;:-')
        
        return {
            "has_date": True,
            "datetime": target_dt,
            "datetime_str": target_dt.strftime("%Y-%m-%d %H:%M:%S") if target_dt else None,
            "is_recurring": True,
            "rrule": rrule,
            "matched_token": recurring_token,
            "cleaned_text": cleaned_text,
            "flag": 3
        }

    # 1b. Smart Upcoming Time Resolver (e.g. "due today at 9", "at 9", "tonight at 8")
    time_explicit_regex = re.compile(
        r'\b(?:due\s+)?(today|tonight|tomorrow)?\s*(?:due\s+)?(?:at|by)\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\b',
        re.IGNORECASE
    )
    time_match = time_explicit_regex.search(original_text)
    if time_match:
        day_word, h_str, m_str, ampm = time_match.group(1), time_match.group(2), time_match.group(3), time_match.group(4)
        h = int(h_str)
        minute = int(m_str) if m_str else 0
        if 0 <= h <= 24 and 0 <= minute <= 59:
            day_offset = 0
            is_tonight = False
            if day_word:
                dw = day_word.lower()
                if dw == "tomorrow":
                    day_offset = 1
                elif dw == "tonight":
                    is_tonight = True

            target_date = ref_datetime.date() + datetime.timedelta(days=day_offset)

            if ampm:
                if ampm.lower() == "pm" and h < 12:
                    h += 12
                elif ampm.lower() == "am" and h == 12:
                    h = 0
            elif is_tonight and h < 12:
                h += 12
            else:
                # Discern whether it refers to 9am or 9pm based on current time
                if target_date == ref_datetime.date() and h < 12:
                    candidate_am = datetime.datetime.combine(target_date, datetime.time(h, minute))
                    if candidate_am <= ref_datetime:
                        # Morning hour has already passed today -> must be an upcoming evening time
                        h += 12

            final_dt = datetime.datetime.combine(target_date, datetime.time(min(h, 23), minute))
            cleaned_text = original_text[:time_match.start()] + original_text[time_match.end():]
            cleaned_text = re.sub(r'\s+', ' ', cleaned_text).strip(' .,;:-')
            flag = 3 if day_word else 2
            return {
                "has_date": True,
                "datetime": final_dt,
                "datetime_str": final_dt.strftime("%Y-%m-%d %H:%M:%S"),
                "is_recurring": False,
                "rrule": None,
                "matched_token": time_match.group(0),
                "cleaned_text": cleaned_text,
                "flag": flag
            }

    # 2. Check for explicit NLP date/time spans using parsedatetime
    nlp_results = cal.nlp(original_text, sourceTime=ref_datetime)
    
    if nlp_results:
        # nlp_results returns tuples of: (datetime, flag, start_idx, end_idx, matched_text)
        best = nlp_results[0]
        parsed_dt, flag, start_idx, end_idx, matched_token = best

        # Guard against parsedatetime greedily consuming alphanumeric identifiers like "1D", "3D"
        # as relative days (e.g. "Social Science 1D today" -> "1D today")
        code_match = re.match(r'^([0-9]+[A-Z]+|[A-Z]+[0-9]+)\s+(.+)$', matched_token)
        if code_match:
            id_prefix = code_match.group(1)
            actual_token = code_match.group(2)
            start_idx += len(id_prefix) + 1
            matched_token = actual_token
            # Re-parse the actual temporal token
            parsed_dt, flag = cal.parseDT(matched_token, sourceTime=ref_datetime)
        
        # Check if the matched token actually looks like a date/time (flag > 0)
        if flag > 0 and len(matched_token.strip()) > 1:
            # Handle military time if token ends with 4 digits e.g. "Tonight 2359"
            cleaned_text = original_text[:start_idx] + original_text[end_idx:]
            cleaned_text = re.sub(r'\s+', ' ', cleaned_text).strip(' .,;:-')
            
            return {
                "has_date": True,
                "datetime": parsed_dt,
                "datetime_str": parsed_dt.strftime("%Y-%m-%d %H:%M:%S"),
                "is_recurring": False,
                "rrule": None,
                "matched_token": matched_token,
                "cleaned_text": cleaned_text,
                "flag": flag
            }

    # 3. Fallback check for relative time regex like "in 30 mins", "in 2 hours", "today", "tomorrow"
    rel_match = re.search(r'\b(today|tonight|tomorrow|in \d+\s*(?:mins|minutes|hours|days))\b', original_text, re.IGNORECASE)
    if rel_match:
        token = rel_match.group(0)
        dt_res, flag = cal.parseDT(token, sourceTime=ref_datetime)
        if flag > 0:
            cleaned = original_text[:rel_match.start()] + original_text[rel_match.end():]
            cleaned = re.sub(r'\s+', ' ', cleaned).strip(' .,;:-')
            return {
                "has_date": True,
                "datetime": dt_res,
                "datetime_str": dt_res.strftime("%Y-%m-%d %H:%M:%S"),
                "is_recurring": False,
                "rrule": None,
                "matched_token": token,
                "cleaned_text": cleaned,
                "flag": flag
            }

    # No date found
    return {
        "has_date": False,
        "datetime": None,
        "datetime_str": None,
        "is_recurring": False,
        "rrule": None,
        "matched_token": None,
        "cleaned_text": original_text,
        "flag": 0
    }

# Priority recognition regex patterns
TOP_PRIORITY_REGEX = re.compile(
    r'\b(?:most\s+important|highest\s+priority|top\s+priority|number\s+one\s+priority|#1\s+priority|urgent\s+priority|critical|p0)\b',
    re.IGNORECASE
)
LOWEST_PRIORITY_REGEX = re.compile(
    r'\b(?:lowest\s+priority|least\s+important|bottom\s+priority|last\s+priority|p4)\b',
    re.IGNORECASE
)
HIGH_PRIORITY_REGEX = re.compile(
    r'\b(?:high\s+priority|high\s+importance|time\s+sensitive|time-sensitive|urgent|important|vital|crucial|p1|asap)\b',
    re.IGNORECASE
)
LOW_PRIORITY_REGEX = re.compile(
    r'\b(?:low\s+priority|low\s+importance|trivial\s+priority|someday|minor|p3|whenever|low-priority)\b',
    re.IGNORECASE
)

def extract_priority(text: str) -> Tuple[str, str, Optional[str]]:
    """
    Detects natural language priority intent from user text.
    Returns (cleaned_text, priority_level, matched_token).
    Priority levels: 'top', 'high', 'low', 'lowest', 'normal'.
    """
    s = text.strip()
    
    # 1. Top / P0
    m = TOP_PRIORITY_REGEX.search(s)
    if m:
        cleaned = s[:m.start()] + s[m.end():]
        cleaned = re.sub(r'\s+', ' ', cleaned).strip(' .,;:-')
        return cleaned, "top", m.group(0)

    # 2. Lowest / P4
    m = LOWEST_PRIORITY_REGEX.search(s)
    if m:
        cleaned = s[:m.start()] + s[m.end():]
        cleaned = re.sub(r'\s+', ' ', cleaned).strip(' .,;:-')
        return cleaned, "lowest", m.group(0)

    # 3. High / P1
    m = HIGH_PRIORITY_REGEX.search(s)
    if m:
        cleaned = s[:m.start()] + s[m.end():]
        cleaned = re.sub(r'\s+', ' ', cleaned).strip(' .,;:-')
        return cleaned, "high", m.group(0)

    # 4. Low / P3
    m = LOW_PRIORITY_REGEX.search(s)
    if m:
        cleaned = s[:m.start()] + s[m.end():]
        cleaned = re.sub(r'\s+', ' ', cleaned).strip(' .,;:-')
        return cleaned, "low", m.group(0)

    return s, "normal", None

EXPLICIT_ENTITY_REGEX = re.compile(
    r'^\s*(?:'
    r'(?P<event>event|appointment|meeting|calendar\s+item|sched(?:uled)?\s+event)'
    r'|(?P<reminder>reminder|memo|note\s+to\s+self|remind\s+me(?:\s+to)?)'
    r'|(?P<focus_task>focus\s+task|deep\s+work(?:\s+task)?)'
    r'|(?P<trivial_task>trivial\s+(?:task|errand)|errand|chore)'
    r'|(?P<task>task|todo)'
    r')\b\s*[:\-]?(?:\s+)?',
    re.IGNORECASE
)

def extract_explicit_entity_intent(text: str) -> Tuple[str, Optional[str], Optional[str]]:
    """
    Detects if the user explicitly commanded an entity type at the start of their input.
    e.g. "Event today 2pm meet Jodan" -> (cleaned="today 2pm meet Jodan", entity_type="event", tier=None)
         "meeting with space faculty this evening 7pm" -> (cleaned="meeting with space faculty this evening 7pm", entity_type="event", tier=None)
         "Event: meet Jodan for OpenRocket tutorial" -> ("meet Jodan for OpenRocket tutorial", "event", None)
         "Reminder: buy groceries" -> ("buy groceries", "reminder", None)
         "Reminder to feed the fish" -> ("Feed the fish", "reminder", None)
         "Focus task: design chassis" -> ("design chassis", "task", "focus")
    Returns (cleaned_text, explicit_entity_type, explicit_tier).
    """
    s = text.strip()
    m = EXPLICIT_ENTITY_REGEX.match(s)
    if not m:
        return s, None, None
    
    raw_match = m.group(0)
    has_separator = any(sep in raw_match for sep in (":", "-"))
    after = s[m.end():].strip(' .,;:-')
    # If stripping leaves an empty string, revert to original
    if not after:
        return s, None, None

    # If user typed "meeting with..." or "appointment with..." without a colon/dash,
    # preserve the full phrase in the title rather than stripping it to "with..."
    if not has_separator and after.lower().startswith("with "):
        if m.group("event"):
            return s, "event", None
    
    if m.group("event"):
        return after, "event", None
    elif m.group("reminder"):
        cleaned_reminder = re.sub(r'^(?:to|that|about)\s+', '', after, flags=re.IGNORECASE).strip()
        if cleaned_reminder:
            after = cleaned_reminder[0].upper() + cleaned_reminder[1:] if len(cleaned_reminder) > 1 else cleaned_reminder.upper()
        return after, "reminder", None
    elif m.group("focus_task"):
        return after, "task", "focus"
    elif m.group("trivial_task"):
        return after, "task", "trivial"
    elif m.group("task"):
        return after, "task", None
    
    return s, None, None

