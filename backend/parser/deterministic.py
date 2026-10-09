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

TIME_RANGE_REGEX = re.compile(
    r'\b(?:(?:from|between)\s+)?'
    r'(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\s*'
    r'(?:-|–|—|to|till|until|and)\s*'
    r'(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\b',
    re.IGNORECASE
)

DATE_TOKENS_REGEX = re.compile(
    r'\b(?:on\s+)?(today|tonight|tomorrow|this\s+[a-z]+|next\s+[a-z]+|monday|tuesday|wednesday|thursday|friday|saturday|sunday|mon|tue|wed|thu|fri|sat|sun)\b',
    re.IGNORECASE
)

def resolve_hours_and_minutes(h1_s: str, m1_s: Optional[str], ampm1_s: Optional[str],
                              h2_s: str, m2_s: Optional[str], ampm2_s: Optional[str]) -> Tuple[Tuple[int, int], Tuple[int, int]]:
    h1 = int(h1_s)
    h2 = int(h2_s)
    m1 = int(m1_s) if m1_s else 0
    m2 = int(m2_s) if m2_s else 0
    ampm1 = ampm1_s.lower() if ampm1_s else None
    ampm2 = ampm2_s.lower() if ampm2_s else None

    if ampm1 and ampm2:
        start_h = (0 if h1 == 12 else h1) if ampm1 == "am" else (12 if h1 == 12 else h1 + 12)
        end_h = (0 if h2 == 12 else h2) if ampm2 == "am" else (12 if h2 == 12 else h2 + 12)
    elif not ampm1 and ampm2:
        if ampm2 == "pm":
            end_h = 12 if h2 == 12 else h2 + 12
            if h1 == 12:
                start_h = 12
            elif h1 > (h2 % 12):
                start_h = h1
            else:
                start_h = h1 + 12
        else:
            end_h = 0 if h2 == 12 else h2
            start_h = 0 if h1 == 12 else h1
    elif ampm1 and not ampm2:
        start_h = (0 if h1 == 12 else h1) if ampm1 == "am" else (12 if h1 == 12 else h1 + 12)
        if ampm1 == "pm":
            end_h = 12 if h2 == 12 else h2 + 12
        else:
            end_h = h2 if h2 >= start_h else (12 if h2 == 12 else h2 + 12)
    else:
        start_h = h1
        end_h = h2

    return (min(start_h, 23), min(m1, 59)), (min(end_h, 23), min(m2, 59))

def parse_time_range(text: str, ref_datetime: datetime.datetime) -> Optional[Dict[str, Any]]:
    """
    Parses a time span or period (e.g. '4-6pm', '10am - 12pm', '14:00 - 16:00', 'from 2 to 4pm').
    Returns structured dictionary with start and end times, or None if no time range found.
    """
    cal = pdt.Calendar()
    m = TIME_RANGE_REGEX.search(text)
    if not m:
        return None
    h1, m1, ampm1, h2, m2, ampm2 = m.groups()
    if not ampm1 and not ampm2 and ':' not in m.group(0):
        return None

    range_matched = m.group(0)
    rem_text = text[:m.start()] + ' ' + text[m.end():]
    target_date = ref_datetime.date()
    matched_date_token = None

    dm = DATE_TOKENS_REGEX.search(rem_text)
    if dm:
        matched_date_token = dm.group(0)
        dt_res, flag = cal.parseDT(matched_date_token, sourceTime=ref_datetime)
        if flag > 0:
            target_date = dt_res.date()
        rem_text = rem_text[:dm.start()] + ' ' + rem_text[dm.end():]
    else:
        nlp_res = cal.nlp(rem_text, sourceTime=ref_datetime)
        if nlp_res:
            p_dt, flag, s_idx, e_idx, token = nlp_res[0]
            if flag in (1, 3) and len(token.strip()) > 1:
                target_date = p_dt.date()
                matched_date_token = token
                rem_text = rem_text[:s_idx] + ' ' + rem_text[e_idx:]

    cleaned = re.sub(r'\s+', ' ', rem_text).strip(' .,;:-')
    (start_h, start_m), (end_h, end_m) = resolve_hours_and_minutes(h1, m1, ampm1, h2, m2, ampm2)
    start_dt = datetime.datetime.combine(target_date, datetime.time(start_h, start_m))
    end_dt = datetime.datetime.combine(target_date, datetime.time(end_h, end_m))
    if end_dt <= start_dt:
        end_dt += datetime.timedelta(days=1)

    full_token = f"{matched_date_token} {range_matched}".strip() if matched_date_token else range_matched

    return {
        "has_date": True,
        "datetime": start_dt,
        "datetime_str": start_dt.strftime("%Y-%m-%d %H:%M:%S"),
        "end_datetime": end_dt,
        "end_datetime_str": end_dt.strftime("%Y-%m-%d %H:%M:%S"),
        "is_time_range": True,
        "is_recurring": False,
        "rrule": None,
        "matched_token": full_token,
        "cleaned_text": cleaned,
        "flag": 3
    }

def parse_deterministic_date(text: str, ref_datetime: Optional[datetime.datetime] = None) -> Dict[str, Any]:
    """
    Deterministically parses dates, times, and recurrence rules from text.
    Never uses an LLM for relative dates or times.
    
    Returns a dictionary:
    {
        "has_date": bool,
        "datetime": Optional[datetime.datetime],
        "datetime_str": Optional[str], # YYYY-MM-DD HH:MM:SS
        "end_datetime": Optional[datetime.datetime],
        "end_datetime_str": Optional[str],
        "is_time_range": bool,
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
    
    # 1. Check for time range / period (e.g. "4-6pm", "10am to 12pm", "14:00 - 16:00")
    range_res = parse_time_range(original_text, ref_datetime)
    if range_res:
        return range_res
    
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

