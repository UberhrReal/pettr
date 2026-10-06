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
    r'\b(?:high\s+priority|high\s+importance|urgent|important|vital|crucial|p1|asap)\b',
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

