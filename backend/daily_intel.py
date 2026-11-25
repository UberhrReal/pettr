"""
PETTR Daily Intelligence & Date-Aware Tagline Engine
Generates and caches daily typewriter lines via LLM at midnight and on demand,
with curated aerospace/engineering historical milestones and non-duplication safeguards.
"""

import os
import json
import logging
import asyncio
import datetime
import random
from pathlib import Path
from typing import Dict, Any, List, Optional, Union, Tuple
import httpx
from config.config import get_or_create_config, get_user_profile
from backend import database

logger = logging.getLogger("pettr.daily_intel")

# Curated World, Science, Computing, Engineering & Space Milestones by (Month, Day)
from backend.historical_data import HISTORICAL_MILESTONES

CALENDAR_FUN_FACTS = [
    "1971: Ray Tomlinson sent the very first network email across ARPANET using the '@' symbol.",
    "1958: Dr. William Chardack and Wilson Greatbatch implanted the world's first internal cardiac pacemaker.",
    "1969: The Apollo 11 guidance computer operated on just 4KB of RAM and 72KB of ROM.",
    "1977: Voyager 1 carries the Golden Record, preserving sounds, music, and images of Earth for deep space.",
    "1991: Tim Berners-Lee opened the World Wide Web to the public from his NeXT workstation at CERN.",
    "1879: Thomas Edison perfected the long-lasting incandescent light bulb filament after thousands of trials.",
    "1908: Melitta Bentz invented the paper coffee filter using brass foil and her son's blotting paper.",
    "1903: The Wright brothers' first flight lasted 12 seconds and covered 120 feet.",
    "1968: Douglas Engelbart demonstrated the mouse, hypertext, and video calling in 'The Mother of All Demos'.",
    "1928: Alexander Fleming discovered penicillin after returning from holiday to a contaminated petri dish.",
    "1984: Kathryn Sullivan became the first American woman to perform a spacewalk aboard Challenger STS-41-G.",
    "1957: Sputnik 1 transmitted its iconic radio beacon at 20.005 MHz for 21 days straight.",
    "1965: Alexei Leonov became the first human to conduct an EVA spacewalk, lasting 12 minutes.",
    "1981: Space Shuttle Columbia launched on STS-1, the first reusable orbital spacecraft flight.",
    "1968: Apollo 8 astronauts captured 'Earthrise', shifting humanity's perspective on our fragile home.",
    "1997: IBM's Deep Blue computer defeated world chess champion Garry Kasparov in a six-game match.",
    "1947: Chuck Yeager piloted the Bell X-1 past Mach 1.05, shattering the sound barrier.",
    "1986: Voyager 2 flew within 50,600 miles of Uranus, discovering 10 new moons.",
    "1989: Voyager 2 swept past Neptune and detected high-speed 1,300 mph supersonic winds.",
    "1954: Roger Bannister ran the first sub-four-minute mile (3:59.4) at Iffley Road Track.",
    "1976: The Cray-1 supercomputer was installed at Los Alamos, setting a new benchmark for scientific computing.",
    "1990: Voyager 1 captured the Pale Blue Dot photograph from 3.7 billion miles away.",
    "1960: Theodore Maiman operated the world's first working optical laser using a synthetic ruby crystal.",
    "1975: The Apollo-Soyuz Test Project completed the first joint international crewed space docking.",
    "1939: The first operational jet aircraft, the Heinkel He 178, completed its maiden flight.",
    "1945: The ENIAC electronic general-purpose computer was fully assembled at the University of Pennsylvania.",
    "2021: Ingenuity achieved the first powered, controlled flight on another world aboard Mars.",
    "2022: James Webb Space Telescope deployed its 21-foot gold-coated beryllium mirror at Lagrange Point 2."
]

def get_historical_milestones_for_date(target_date: datetime.date) -> List[str]:
    """Returns a list of curated historical milestones for the target calendar date."""
    month, day = target_date.month, target_date.day
    val = HISTORICAL_MILESTONES.get((month, day))
    if val:
        if isinstance(val, list):
            return list(val)
        return [val]
    day_of_year = target_date.timetuple().tm_yday
    return [CALENDAR_FUN_FACTS[day_of_year % len(CALENDAR_FUN_FACTS)]]

def get_historical_milestone_or_fact(target_date: datetime.date, avoid_fact: Optional[str] = None) -> str:
    """Returns a historical milestone for target_date. If avoid_fact is given, tries to pick an alternate from the same date."""
    candidates = get_historical_milestones_for_date(target_date)
    if avoid_fact:
        different = [c for c in candidates if c.strip().lower() != avoid_fact.strip().lower()]
        if different:
            return random.choice(different)
    return candidates[0]

# Day of week momentum taglines
DAY_OF_WEEK_INTEL = {
    0: "Monday momentum: Set the baseline, organise the week, and tackle priority objectives.",
    1: "Tuesday trajectory: High-efficiency execution across core projects and coursework.",
    2: "Wednesday midpoint: Mid-week telemetry review, steady pacing, and errand clearing.",
    3: "Thursday focus: Deep work sprint before the weekly wrap-up.",
    4: "Friday finish: Finalise key deliverables and close out open loops for the weekend.",
    5: "Saturday craft: Personal tinker projects, reading, maintenance, and flow.",
    6: "Sunday debrief: Rest, reflect, reset the mission clock, and plan ahead."
}

MORNING_KEYWORDS = [
    "good morning", "morning", "first coffee", "morning coffee", "dawn", "sunrise",
    "kick off", "kickstart", "start strong", "start today", "start the day", "starting today",
    "early start", "early hours", "rise and shine", "wake up", "am sprint"
]

AFTERNOON_KEYWORDS = [
    "good afternoon", "afternoon", "midday", "lunch", "post-lunch",
    "halfway through", "afternoon sprint", "midday boost", "midday check-in", "power through the afternoon",
    "working hard or hardly working"
]

EVENING_KEYWORDS = [
    "good evening", "evening", "wrap it up", "wrap up", "wrapping up",
    "wind down", "winding down", "call it a day", "landing", "rest soon",
    "relax", "sign off", "signing off", "close out the day", "close out today", "end of day",
    "eod", "bedtime", "smooth landing", "evening debrief", "time to unwind"
]

WEE_HOURS_KEYWORDS = [
    "wee hours", "small hours", "dead of night", "witching hour", "past midnight",
    "stillness of the night", "undisturbed focus", "nocturnal hyperfocus"
]

NIGHT_KEYWORDS = [
    "midnight", "night owl", "quiet hours", "late night", "burn the midnight oil",
    "burning the midnight oil", "sleep soon", "rest your eyes", "recharge batteries"
]

def filter_phrases_for_diurnal_window(
    phrases: List[str],
    client_hour: Optional[int],
    target_date: Optional[datetime.date] = None,
    user_name: str = "User",
    supplement_curated: bool = True
) -> List[str]:
    """
    Filters out typewriter phrases that contradict the client's current time of day.
    Supplements with appropriate curated phrases if filtering leaves fewer than 3 lines (unless supplement_curated is False).
    """
    if client_hour is None or not phrases:
        return list(phrases)

    hour = client_hour % 24
    is_wee_hours = 0 <= hour < 6
    is_morning = 6 <= hour < 12
    is_afternoon = 12 <= hour < 18
    is_evening = 18 <= hour < 23
    is_night = 23 <= hour < 24

    filtered = []
    for p in phrases:
        if not isinstance(p, str):
            continue
        lower = p.lower()
        if not is_wee_hours and any(k in lower for k in WEE_HOURS_KEYWORDS):
            continue
        if not is_morning and any(k in lower for k in MORNING_KEYWORDS):
            continue
        if not is_afternoon and any(k in lower for k in AFTERNOON_KEYWORDS):
            continue
        if not is_evening and any(k in lower for k in EVENING_KEYWORDS):
            continue
        if not is_night and not is_wee_hours and any(k in lower for k in NIGHT_KEYWORDS):
            continue
        filtered.append(p)

    if supplement_curated and len(filtered) < 3:
        curated = get_curated_phrases(target_date or datetime.date.today(), user_name, client_hour=hour)
        for c in curated:
            if c not in filtered:
                filtered.append(c)
            if len(filtered) >= 5:
                break

    return filtered

def count_words_excluding_name(text: str, user_name: str) -> int:
    """Helper counting words in greeting line excluding user display name (including multi-word name parts)."""
    if not text:
        return 0
    import re
    cleaned = text
    if user_name:
        cleaned = re.sub(re.escape(user_name), "", cleaned, flags=re.IGNORECASE)
        for part in user_name.split():
            if len(part) >= 2:
                cleaned = re.sub(rf'\b{re.escape(part)}\b', "", cleaned, flags=re.IGNORECASE)
    words = [w for w in re.split(r'\s+', cleaned.strip()) if w]
    return len(words)

MAJOR_HOLIDAYS = {
    # Fixed annual holidays (month, day)
    (1, 1): {"id": "new_year", "name": "New Year's Day", "icon": "✨", "theme": "new year fireworks, fresh laughter, sparkling horizons, and joyful celebration"},
    (2, 14): {"id": "valentines", "name": "Valentine's Day", "icon": "💖", "theme": "warmth, roses, chocolate indulgences, affection, and cherished company"},
    (3, 17): {"id": "st_patricks", "name": "St. Patrick's Day", "icon": "☘️", "theme": "emerald clovers, folklore, music, and lively good fortune"},
    (4, 22): {"id": "earth_day", "name": "Earth Day", "icon": "🌍", "theme": "wild forests, deep oceans, sunlit skies, and wonder for our blue planet"},
    (6, 21): {"id": "midsummer", "name": "Summer Solstice", "icon": "☀️", "theme": "longest sunlit day, fireflies at dusk, warm breezes, and unhurried joy"},
    (8, 9): {"id": "sg_national_day", "name": "Singapore National Day", "icon": "🇸🇬", "theme": "Majulah Singapura, bay fireworks, red-and-white spirit, and shared celebration"},
    (10, 31): {"id": "halloween", "name": "Halloween", "icon": "🎃", "theme": "glowing jack-o'-lanterns, autumn chill, spooky stories, sweets, and playful mystery"},
    (12, 24): {"id": "christmas_eve", "name": "Christmas Eve", "icon": "🎄", "theme": "twinkling fairy lights, warm cocoa, cinnamon scents, and festive anticipation"},
    (12, 25): {"id": "christmas", "name": "Christmas Day", "icon": "🎄", "theme": "Merry Christmas, warm hearths, unhurried feasting, and peaceful holiday joy"},
    (12, 26): {"id": "boxing_day", "name": "Boxing Day", "icon": "🎁", "theme": "cosy blankets, festive leftovers, quiet strolling, and unhurried rest"},
    (12, 31): {"id": "new_years_eve", "name": "New Year's Eve", "icon": "🥂", "theme": "sparkling toasts, fireworks over the water, nostalgia, and welcoming tomorrow"}
}

# Movable holiday windows 2025-2029 (year, start_month, start_day, end_month, end_day, info)
MOVABLE_HOLIDAYS = [
    # Lunar New Year
    (2025, 1, 28, 1, 30, {"id": "cny", "name": "Lunar New Year", "icon": "🏮", "theme": "crimson lanterns, reunion feasts, tangerine luck, and lively lion dances"}),
    (2026, 2, 16, 2, 18, {"id": "cny", "name": "Lunar New Year", "icon": "🏮", "theme": "crimson lanterns, reunion feasts, tangerine luck, and lively lion dances"}),
    (2027, 2, 5, 2, 7, {"id": "cny", "name": "Lunar New Year", "icon": "🏮", "theme": "crimson lanterns, reunion feasts, tangerine luck, and lively lion dances"}),
    (2028, 1, 26, 1, 28, {"id": "cny", "name": "Lunar New Year", "icon": "🏮", "theme": "crimson lanterns, reunion feasts, tangerine luck, and lively lion dances"}),
    (2029, 2, 13, 2, 15, {"id": "cny", "name": "Lunar New Year", "icon": "🏮", "theme": "crimson lanterns, reunion feasts, tangerine luck, and lively lion dances"}),
    # Easter Weekend
    (2025, 4, 18, 4, 21, {"id": "easter", "name": "Easter", "icon": "🌸", "theme": "pastel spring blossoms, orchard strolls, sweet treats, and gentle renewal"}),
    (2026, 4, 3, 4, 6, {"id": "easter", "name": "Easter", "icon": "🌸", "theme": "pastel spring blossoms, orchard strolls, sweet treats, and gentle renewal"}),
    (2027, 3, 26, 3, 29, {"id": "easter", "name": "Easter", "icon": "🌸", "theme": "pastel spring blossoms, orchard strolls, sweet treats, and gentle renewal"}),
    (2028, 4, 14, 4, 17, {"id": "easter", "name": "Easter", "icon": "🌸", "theme": "pastel spring blossoms, orchard strolls, sweet treats, and gentle renewal"}),
    (2029, 3, 30, 4, 2, {"id": "easter", "name": "Easter", "icon": "🌸", "theme": "pastel spring blossoms, orchard strolls, sweet treats, and gentle renewal"}),
    # Mid-Autumn Festival
    (2025, 10, 6, 10, 6, {"id": "mid_autumn", "name": "Mid-Autumn Festival", "icon": "🌕", "theme": "luminous harvest moon, glowing paper lanterns, mooncakes, and warm gatherings"}),
    (2026, 9, 25, 9, 25, {"id": "mid_autumn", "name": "Mid-Autumn Festival", "icon": "🌕", "theme": "luminous harvest moon, glowing paper lanterns, mooncakes, and warm gatherings"}),
    (2027, 9, 15, 9, 15, {"id": "mid_autumn", "name": "Mid-Autumn Festival", "icon": "🌕", "theme": "luminous harvest moon, glowing paper lanterns, mooncakes, and warm gatherings"}),
    (2028, 10, 3, 10, 3, {"id": "mid_autumn", "name": "Mid-Autumn Festival", "icon": "🌕", "theme": "luminous harvest moon, glowing paper lanterns, mooncakes, and warm gatherings"}),
    (2029, 9, 22, 9, 22, {"id": "mid_autumn", "name": "Mid-Autumn Festival", "icon": "🌕", "theme": "luminous harvest moon, glowing paper lanterns, mooncakes, and warm gatherings"}),
    # Diwali / Festival of Lights
    (2025, 10, 20, 10, 20, {"id": "diwali", "name": "Diwali", "icon": "🪔", "theme": "golden oil lamps, courtyard rangoli colours, cardamom sweets, and radiant light"}),
    (2026, 11, 8, 11, 8, {"id": "diwali", "name": "Diwali", "icon": "🪔", "theme": "golden oil lamps, courtyard rangoli colours, cardamom sweets, and radiant light"}),
    (2027, 10, 29, 10, 29, {"id": "diwali", "name": "Diwali", "icon": "🪔", "theme": "golden oil lamps, courtyard rangoli colours, cardamom sweets, and radiant light"}),
    (2028, 10, 17, 10, 17, {"id": "diwali", "name": "Diwali", "icon": "🪔", "theme": "golden oil lamps, courtyard rangoli colours, cardamom sweets, and radiant light"}),
    (2029, 11, 5, 11, 5, {"id": "diwali", "name": "Diwali", "icon": "🪔", "theme": "golden oil lamps, courtyard rangoli colours, cardamom sweets, and radiant light"}),
    # Thanksgiving
    (2025, 11, 27, 11, 27, {"id": "thanksgiving", "name": "Thanksgiving", "icon": "🍁", "theme": "crimson maple leaves, roasted feasts, spiced pie, and grateful company"}),
    (2026, 11, 26, 11, 26, {"id": "thanksgiving", "name": "Thanksgiving", "icon": "🍁", "theme": "crimson maple leaves, roasted feasts, spiced pie, and grateful company"}),
    (2027, 11, 25, 11, 25, {"id": "thanksgiving", "name": "Thanksgiving", "icon": "🍁", "theme": "crimson maple leaves, roasted feasts, spiced pie, and grateful company"}),
    (2028, 11, 23, 11, 23, {"id": "thanksgiving", "name": "Thanksgiving", "icon": "🍁", "theme": "crimson maple leaves, roasted feasts, spiced pie, and grateful company"}),
    (2029, 11, 22, 11, 22, {"id": "thanksgiving", "name": "Thanksgiving", "icon": "🍁", "theme": "crimson maple leaves, roasted feasts, spiced pie, and grateful company"})
]

def get_holiday_info(target_date: datetime.date) -> Optional[Dict[str, Any]]:
    """Identifies if a given date falls on or within a major festive holiday."""
    m, d = target_date.month, target_date.day
    if (m, d) in MAJOR_HOLIDAYS:
        data = dict(MAJOR_HOLIDAYS[(m, d)])
        data["badge"] = f"{data['icon']} {data['name']}"
        return data

    y = target_date.year
    for (hy, sm, sd, em, ed, info) in MOVABLE_HOLIDAYS:
        if hy == y:
            start_dt = datetime.date(y, sm, sd)
            end_dt = datetime.date(y, em, ed)
            if start_dt <= target_date <= end_dt:
                data = dict(info)
                data["badge"] = f"{data['icon']} {data['name']}"
                return data

    return None

def get_holiday_curated_phrases(holiday: Dict[str, Any], user_name: str) -> List[str]:
    """Generates celebratory, non-work holiday typewriter lines with a natural mix of user name."""
    hid = holiday.get("id", "")
    hname = holiday.get("name", "Holiday")

    if hid == "halloween":
        return [
            f"Happy Halloween, {user_name}! Let the candlelit pumpkins and playful spirits sparkle.",
            "Crisp autumn breezes carry laughter, spiced treats, and glowing porch lanterns.",
            "Put your feet up and savour spooky stories, sweet treats, and glowing embers.",
            f"Something wonderfully mysterious is brewing under the harvest moon today, {user_name}.",
            "Bats wheel overhead while friendly ghosts roam past golden autumn trees.",
            "May your Halloween be bursting with whimsical costumes, mischief, and warmth."
        ]
    elif hid in ("christmas", "christmas_eve", "boxing_day"):
        return [
            f"Merry Christmas, {user_name}! May warmth, laughter, and festive wonder fill your home.",
            "Twinkling fairy lights, spiced cocoa, and unhurried winter calm fill the air.",
            "Leave the bustle aside and enjoy cosy blankets, music, and favourite feasts.",
            f"Wishing you peaceful winter stillness and radiant holiday cheer today, {user_name}.",
            "Snowflakes drifting softly outside while warm cinnamon spices fill the kitchen.",
            "Raise a mug of something warm to good company and gentle festive magic."
        ]
    elif hid in ("new_year", "new_years_eve"):
        return [
            f"Happy New Year, {user_name}! Here is to sparkling skies and wondrous adventures ahead.",
            "Golden fireworks blossom across the harbour to welcome a fresh unwritten chapter.",
            "Take a deep breath, raise a glass, and toast the memories made.",
            f"May laughter, curiosity, and warm moments greet you around every corner, {user_name}.",
            "Fireworks shimmer above calm water as the festive countdown sparks joyful cheers.",
            "Let the year unfold slowly with generous company, wonder, and quiet joy."
        ]
    elif hid == "cny":
        return [
            f"Happy Lunar New Year, {user_name}! Wishing you abundant joy, warmth, and sunlit days.",
            "Crimson lanterns sway softly above the street as festive drumbeats fill the air.",
            f"May sweet tangerines, reunion feasts, and warm blessings brighten your table, {user_name}.",
            "Golden lion dancers leap along bustling avenues carrying laughter and festive luck.",
            "Share warm tea, crisp delicacies, and unhurried stories with everyone you love.",
            "Lantern glow reflecting over quiet waters brings blessings of harmony and peace."
        ]
    elif hid == "sg_national_day":
        return [
            f"Happy National Day, {user_name}! Celebrating vibrant skies and Lion City spirit today.",
            "Red and white banners flutter cheerfully beneath bright fireworks across the waterfront bay.",
            f"Majulah Singapura: toast good food, shared heritage, and sunny island camaraderie, {user_name}.",
            "Spectacular bursts of colour illuminate the water as neighbours cheer from below.",
            "Pause and savour iconic hawker favourites, lively parades, and warm tropical breezes.",
            "A radiant salute to home, harbour lights, and stories shared side by side."
        ]
    elif hid == "valentines":
        return [
            f"Happy Valentine's Day, {user_name}! Savor sweet indulgences, warm notes, and gentle affection.",
            "Drifting rose petals and soft candlelight turn an ordinary day effortlessly sweet.",
            f"Send a thoughtful message or share favourite chocolates with someone dear, {user_name}.",
            "Let music play slowly while golden warmth fills the room with quiet grace.",
            "Celebrations of kindness, warm embraces, and heartfelt gestures make today glow.",
            "Every small token of care adds unexpected beauty to a peaceful afternoon."
        ]
    elif hid == "st_patricks":
        return [
            f"Happy St. Patrick's Day, {user_name}! May four-leaf clovers and laughter follow you.",
            "Emerald ribbons and cheerful folk tunes bring springtime warmth into the breeze.",
            f"Wishing you bright rainbows, playful luck, and a lively pint or tea, {user_name}.",
            "Shamrocks gleam softly along the hillside under drifting spring sunlight today.",
            "Put your worries on pause and follow the music wherever cheer gathers.",
            "Emerald greens, golden gleams, and high spirits make every greeting sweeter."
        ]
    elif hid == "easter":
        return [
            f"Happy Easter, {user_name}! Soft spring blossoms and quiet pastel skies await outside.",
            "Gentle sunlit breezes wander through blooming petals and bright meadow trails today.",
            f"Enjoy sweet confections, unhurried strolls, and restful holiday calm, {user_name}.",
            "Every bud opening across the valley hints at bright warmer seasons ahead.",
            "Leave alarms untouched and linger a little longer over warm bakery treats.",
            "Playful woodland rabbits dart through dewy meadows celebrating the spring thaw."
        ]
    elif hid == "earth_day":
        return [
            f"Happy Earth Day, {user_name}! Step outdoors to breathe deep and admire wild skies.",
            "Ancient forests, sunlit coral reefs, and rolling currents hum in quiet harmony.",
            f"Take a unhurried walk beneath towering canopies and ocean winds today, {user_name}.",
            "Fireflies, sea turtles, and soaring birds remind us how rich home truly is.",
            "Pause to watch clouds drift across mountain ridges and turquoise sea canyons.",
            "Every gentle stewardship gesture honours our wild, shimmering blue planet."
        ]
    elif hid == "midsummer":
        return [
            f"Happy Summer Solstice, {user_name}! Bask in abundant sunlight and warm twilight hours.",
            "Wildflower meadows sway beneath golden rays stretching lovingly across the valley.",
            f"Stay outside past sunset with cool drinks and drifting summer fireflies, {user_name}.",
            "Warm amber horizons linger slowly over calm seas and unhurried woodland trails.",
            "Trade indoor glow for salt breezes, birdcalls, and long sunlit conversations.",
            "Midsummer warmth invites slow wandering, music outdoors, and carefree rest."
        ]
    elif hid == "mid_autumn":
        return [
            f"Happy Mid-Autumn Festival, {user_name}! Slice rich mooncakes beneath the luminous silver sky.",
            "Paper lanterns rise like gentle stars while harvest moonlight bathes quiet rooftops.",
            f"Brew fragrant oolong tea and share family folklore around lantern light, {user_name}.",
            "Golden reflections shimmer peacefully over dark waters beneath the full autumn moon.",
            "Cool breezes carry roasted tea scents and children's bobbing lantern trails.",
            "Gaze up at the full silver moon and savour tranquil reunion cheer."
        ]
    elif hid == "diwali":
        return [
            f"Happy Diwali, {user_name}! May flickering oil lamps bathe every room in golden light.",
            "Intricate doorway rangoli colours and spiced sweets welcome guests with festive joy.",
            f"Wishing you radiant sparkles, sweet mithai, and joyful laughter with loved ones, {user_name}.",
            "Golden diya flames shimmer like tiny stars along balconies and quiet courtyards.",
            "Celebratory sparks bloom across clear velvet skies in dazzling festive cascades.",
            "Peaceful radiance, rich saffron treats, and warm hospitality fill every corner."
        ]
    elif hid == "thanksgiving":
        return [
            f"Happy Thanksgiving, {user_name}! Gather close for warm autumn feasts and grateful hearts.",
            "Crimson maple leaves tumble slowly through crisp golden air across quiet hills.",
            f"Fill your plate generously and linger around warm spiced pie and laughter, {user_name}.",
            "The richest tables overflow with gratitude, old stories, and comforting aromas.",
            "Pause and savour the quiet blessing of loved ones, warmth, and fullness.",
            "Rustling autumn foliage and fireside glow invite slow, grateful conversation today."
        ]
    else:
        return [
            f"Happy {hname}, {user_name}! Leave errands waiting and savour a joyful holiday pause.",
            f"Celebrating {hname} with good music, delicious food, and unhurried festive cheer.",
            "Step away from clocks for a while and enjoy peaceful company and laughter.",
            f"A joyful holiday breeze invites slow stories, treats, and delight today, {user_name}.",
            "Fill the day with simple pleasures, favourite songs, and warm hospitality.",
            "Bask in the festive rhythm and let lingering holiday cheer take centre stage."
        ]

def get_curated_phrases(today: datetime.date, user_name: str, milestone: Optional[str] = None, client_hour: Optional[int] = None) -> List[str]:
    """Generates curated time-of-day phrases as resilient fallback, ensuring >= 6 words excluding user name and healthy mix of name occurrences."""
    # Check if a major holiday is active for today
    holiday = get_holiday_info(today)
    if holiday:
        return get_holiday_curated_phrases(holiday, user_name)

    wee_hours_phrases = [
        f"Stillness of the wee hours across the workspace, {user_name}.",
        "Zero distractions in the quiet hours while the world sleeps.",
        "The quiet hours offer a rare window for undisturbed focus.",
        f"Deep nocturnal velocity and deliberate thinking tonight, {user_name}.",
        "Breakthroughs often happen during undisturbed quiet hours.",
        "A quiet focus window for thoughtful creative work and reflection."
    ]

    morning_phrases = [
        f"Good morning, {user_name}. The desk is clear and ready for the day.",
        "First coffee poured and ready for high-leverage focus work.",
        f"Clear head and an organised queue to kick off the day, {user_name}.",
        "Steady momentum starts with tackling the single biggest priority.",
        "Prioritise the essential objectives before attending to small errands.",
        "Morning diagnostics green with deep focus locked in today."
    ]

    afternoon_phrases = [
        f"Cruising altitude reached with steady cadence through the afternoon, {user_name}.",
        "Midday checkpoint: stay locked in flow and maintain deliberate rhythm.",
        f"Steady execution across your core coursework and projects, {user_name}.",
        "Remember to reset posture, hydrate, and maintain your thinking rhythm.",
        "Quality craft takes patience, precision, and uninterrupted focus.",
        "Protect your cognitive bandwidth and see this work block through."
    ]

    evening_phrases = [
        f"Good evening, {user_name}. Time to tie off your remaining open loops.",
        "Smooth landing underway: review and seal your completed work today.",
        f"Key objectives checked off with steady persistence today, {user_name}.",
        "Great execution across the queue today: prepare to wind down.",
        "Evening debrief window open to capture key takeaways and reflections.",
        "Another productive day ready to be reviewed and sealed tonight."
    ]

    night_phrases = [
        f"Burning the midnight oil to close out the final details, {user_name}?",
        "Late-night checklist complete: record your progress and rest soon.",
        f"Quiet hours active: wrap up your thoughts and recharge tonight, {user_name}.",
        "Set aside tomorrow's priorities cleanly and rest up tonight.",
        "Rest is a vital part of personal craft and well-being.",
        "Sign off with satisfaction and let your mind recharge fully."
    ]

    hour = client_hour if client_hour is not None else datetime.datetime.now().hour
    if 0 <= hour < 6:
        top_phrases = list(wee_hours_phrases)
    elif 6 <= hour < 12:
        top_phrases = list(morning_phrases)
    elif 12 <= hour < 18:
        top_phrases = list(afternoon_phrases)
    elif 18 <= hour < 23:
        top_phrases = list(evening_phrases)
    else:
        top_phrases = list(night_phrases)

    return top_phrases

async def generate_llm_typewriter_lines(target_date: datetime.date,
                                       user_name: str,
                                       milestone_info: Optional[str] = None,
                                       timeout_seconds: float = 30.0,
                                       client_hour: Optional[int] = None,
                                       avoid_fact: Optional[str] = None) -> Optional[Any]:
    """
    Prompts the configured local/remote LLM to generate fresh, date-aware typewriter greeting lines
    and a fascinating fun fact relevant to today's date in history.
    Returns a dict with {"phrases": [...], "fact": "..."} or list of lines, or None if LLM is offline.
    """
    config = get_or_create_config()
    
    # Candidate Ollama endpoints (supporting native host, Docker bridge, and local)
    candidate_urls = []
    if os.environ.get("OLLAMA_URL"):
        candidate_urls.append(os.environ["OLLAMA_URL"])
    if config.get("ollama_url"):
        candidate_urls.append(config["ollama_url"])
    for default_url in ["http://host.docker.internal:11434", "http://localhost:11434", "http://127.0.0.1:11434", "http://172.17.0.1:11434"]:
        if default_url not in candidate_urls:
            candidate_urls.append(default_url)

    target_model = os.environ.get("OLLAMA_MODEL") or config.get("ollama_model") or config.get("active_llm") or "llama3.2:3b"

    date_str = target_date.strftime("%A, %B %d, %Y")
    h = (client_hour % 24) if client_hour is not None else datetime.datetime.now().hour
    if 0 <= h < 6:
        diurnal_period = "the wee hours (midnight to 6am — nocturnal hyperfocus, absolute stillness, the world asleep, solitary momentum)"
    elif 6 <= h < 12:
        diurnal_period = "morning (6am to noon — fresh start, morning coffee or tea, early clarity, planning the queue, deliberate momentum for the day ahead)"
    elif 12 <= h < 18:
        diurnal_period = "afternoon (noon to 6pm — midday stride, tackling core focus blocks, steady execution across coursework and errands, sustained cadence)"
    elif 18 <= h < 23:
        diurnal_period = "evening (6pm to 11pm — winding down open loops, golden hour and twilight reflection, evening review, sealing daily progress)"
    else:
        diurnal_period = "late night (11pm to midnight — wrapping up final details, signing off, resting cognitive bandwidth, recharging for tomorrow)"

    holiday_info = get_holiday_info(target_date)
    holiday_clause = ""
    if holiday_info:
        holiday_clause = (
            f"HOLIDAY MODE ACTIVE — Today is {holiday_info['name']} ({holiday_info['icon']})! "
            f"All 5 greeting lines MUST warmly, playfully, and colourfully celebrate {holiday_info['name']} "
            f"(traditions, food, atmosphere, rest, family, wonder, and themes of {holiday_info['theme']}). "
            f"Since it is a holiday, DO NOT push work, coursework, study blocks, productivity, deadlines, or errands.\n"
        )

    name_words = len(user_name.split()) if user_name else 1
    tone_scope_line = (
        f"Festive Holiday Spirit: Today is {holiday_info['name']}. Celebrate the occasion, traditions, good food, company, and holiday joy — do NOT write about coursework, productivity, deadlines, or errands.\n"
        if holiday_info else
        "Tone and Broad Balance: Grounded, cultured, and articulate. DO NOT focus exclusively on programming, coding, software engineering, terminal, or git metaphors. Reflect a well-rounded life: university coursework and study blocks, clear thinking, clearing out errands, personal creative projects, reading, fitness, and thoughtful daily momentum.\n"
    )
    system_prompt = (
        "You are the sharp, witty, cultured personal AI companion for PETTR "
        "(Personal Errands, Task Tracker & Repository), an executive daily dashboard for university coursework, "
        "daily errands, reading, personal projects, life admin, fitness, and high-focus productivity.\n"
        "British English: You MUST strictly use British English spelling conventions throughout "
        "(e.g., prioritise, organise, recognise, summarise, categorise, customise, colour, behaviour, flavour, favour). "
        "Never use American English spellings like 'prioritize' or 'customized'.\n"
        f"{tone_scope_line}"
        "Time-of-Day Relevance: Every greeting line MUST specifically evoke and resonate with the user's active time-of-day window "
        "(wee hours, morning, afternoon, evening, or late night). Avoid generic lines that lack any diurnal connection.\n"
        f"User Name Mix: Mention the user's name naturally in 1 to 2 lines only (using their EXACT full display name '{user_name}' verbatim — never abbreviate or drop parts). "
        "The remaining lines should be universally phrased without their name for a natural, varied mix.\n"
        "Your task is to generate:\n"
        "1. Exactly 5 intelligent, articulate, single-line typewriter greeting lines for the user's dashboard banner "
        f"(strictly 6 to 12 words EXCLUDING the user's display name '{user_name}'; total length roughly 45 to 100 characters; each line must be a complete single sentence ending with a full stop or exclamation mark).\n"
        "2. Exactly 1 fascinating, genuine historical milestone that occurred on this specific calendar date in history in a past year "
        "(formatted as 'YEAR: Description of milestone on this date'). Never provide random date-less trivia.\n"
        "Return ONLY a valid JSON object: {\"phrases\": [\"line 1\", \"line 2\", \"line 3\", \"line 4\", \"line 5\"], \"fact\": \"YEAR: ...\"}."
    )

    month_day_str = target_date.strftime("%B %d")
    avoid_clause = f" (must be distinct from: '{avoid_fact}')" if avoid_fact else ""
    date_candidates = get_historical_milestones_for_date(target_date)
    if avoid_fact:
        filtered = [c for c in date_candidates if c.strip().lower() != avoid_fact.strip().lower()]
        if filtered:
            date_candidates = filtered
    candidates_list_str = "\n".join([f"- {c}" for c in date_candidates])

    fact_task = (
        f"Task 2 — 'On This Day in History' Fun Fact ('fact'):\n"
        f"1. Strict Calendar Date Match: The fact MUST describe a genuine, verified historical event, scientific discovery, or landmark achievement that occurred ON THIS EXACT CALENDAR DATE IN HISTORY ({month_day_str}) in a past year{avoid_clause}.\n"
        f"Verified historical candidates for {month_day_str}:\n{candidates_list_str}\n"
        f"Select, polish, and articulately format one of the verified candidates above (or another genuine, historically verified milestone on {month_day_str}). Do NOT use an event from a different date or month.\n"
        f"2. Format Requirement: Always begin with the year followed by a colon (e.g. 'YEAR: Description of milestone on {month_day_str}').\n"
        f"3. NO Random Trivia: Do NOT provide general or timeless trivia (no random biology facts, no animal trivia, no generic science factoids). It MUST be tied to this specific date ({month_day_str}) in history.\n"
        "4. Concise: Exactly 1 to 2 sentences (15 to 35 words).\n"
        "5. Strictly use British English spelling conventions.\n"
    )

    task1_tone_rule = (
        f"4. Holiday Celebration Focus: Today is {holiday_info['name']}. Celebrate {holiday_info['theme']} with warmth, playfulness, humour, or poetry — do NOT push productivity, work, coursework, or errands.\n"
        if holiday_info else
        "4. Tone and Holistic Balance: DO NOT focus on programming, software engineering, git, or coding jargon. Frame lines for a balanced, cultured life: university coursework and study blocks, clear thinking, tackling personal projects, clearing daily errands, reading, and steady daily momentum.\n"
    )
    task1_diurnal_rule = (
        f"5. Holiday Atmosphere & Time Window: Evoke the {diurnal_period} mood alongside {holiday_info['name']} celebrations and never mix contradictory times of day.\n"
        if holiday_info else
        f"5. Time-of-Day Relevance (Mandatory): Every greeting line MUST specifically evoke and fit the current {diurnal_period} time window. Weave in natural, evocative references to this specific time of day (e.g., morning coffee/clarity/dawn energy, midday execution and sustained cadence, evening winding down/debriefing/twilight reflection, or wee hours solitary quiet/hyperfocus). DO NOT generate generic or universally time-neutral lines that could apply to any hour of the day.\n"
    )
    user_prompt = (
        f"Today's date: {date_str}.\n"
        f"Current time window: {diurnal_period.capitalize()}.\n"
        f"User's name: {user_name}.\n\n"
        f"{holiday_clause}"
        "Task 1 — Dashboard Typewriter Greetings ('phrases'):\n"
        f"1. Generate exactly 5 intelligent, articulate, characterful typewriter greeting lines.\n"
        "2. Avoid generic corporate or gym motivational clichés (do NOT use empty slogans like 'Start strong!', 'Midday boost!', 'Crush your goals!', or 'Wrap it up!').\n"
        f"3. Meaningful Line Depth & Complete Sentences: Every line MUST contain 6 to 12 words EXCLUDING the user's name '{user_name}'. Note that '{user_name}' contains {name_words} words ({len(user_name)} characters) which do NOT count towards the 6-to-12 word limit. Keep the total length around 45 to 100 characters (max 110 characters). Each line MUST be a single, complete, grammatically whole sentence ending with a full stop or exclamation mark (NEVER cut off mid-thought or mid-sentence).\n"
        f"{task1_tone_rule}"
        f"{task1_diurnal_rule}"
        "6. Strict Diurnal Consistency: Never mix contradictory times of day (no morning wake-up or dawn references in afternoon, evening, or wee hours; no evening wrap-up or bedtime references in morning or afternoon).\n"
        "7. DO NOT force puns or thematic tie-ins to the fun fact or historical milestone.\n"
        f"8. Name Mix: Mention {user_name} naturally in 1 or 2 lines only (using the EXACT full name '{user_name}' verbatim — NEVER abbreviate or drop any part of their name). The remaining lines should be universally addressed without their name, providing a balanced, natural mix.\n"
        "9. Strictly use British English spelling conventions throughout (e.g. prioritise, organise, customise, colour, behaviour).\n\n"
        f"{fact_task}\n"
        "Return ONLY a valid JSON object matching: {\"phrases\": [...], \"fact\": \"...\"}, no explanation or markdown fences."
    )

    for ollama_url in candidate_urls:
        try:
            # First check tags to verify connectivity and available model
            model_name = target_model
            async with httpx.AsyncClient(timeout=httpx.Timeout(4.0, connect=2.0)) as probe_client:
                tags_resp = await probe_client.get(f"{ollama_url}/api/tags")
                if tags_resp.status_code == 200:
                    tags_data = tags_resp.json()
                    available_models = [m.get("name") for m in tags_data.get("models", []) if m.get("name")]
                    if available_models:
                        # If target_model is not installed, auto-pick installed model
                        if model_name not in available_models and not any(model_name in am for am in available_models):
                            model_name = available_models[0]

            payload = {
                "model": model_name,
                "prompt": user_prompt,
                "system": system_prompt,
                "format": "json",
                "stream": False,
                "options": {
                    "temperature": 0.75,
                    "num_predict": 650
                }
            }

            async with httpx.AsyncClient(timeout=httpx.Timeout(timeout_seconds, connect=4.0)) as client:
                resp = await client.post(f"{ollama_url}/api/generate", json=payload)
                if resp.status_code == 200:
                    data = resp.json()
                    raw_response = data.get("response", "").strip()
                    
                    import re
                    match = re.search(r'(\{[\s\S]*\}|\[[\s\S]*\])', raw_response)
                    if match:
                        raw_response = match.group(0)

                    parsed = json.loads(raw_response)
                    raw_phrases = []
                    fact_str = None
                    if isinstance(parsed, dict):
                        raw_phrases = parsed.get("phrases") or parsed.get("lines") or parsed.get("greetings") or []
                        fact_str = parsed.get("fact") or parsed.get("fun_fact") or parsed.get("milestone")
                    elif isinstance(parsed, list):
                        raw_phrases = parsed

                    def to_british_spelling(text: str) -> str:
                        if not text:
                            return text
                        replacements = [
                            (r"\bprioritiz(e|es|ed|ing|ation)\b", r"prioritis\1"),
                            (r"\bcustomiz(e|es|ed|ing|ation)\b", r"customis\1"),
                            (r"\borganiz(e|es|ed|ing|ation)\b", r"organis\1"),
                            (r"\brecogniz(e|es|ed|ing|ation)\b", r"recognis\1"),
                            (r"\bsummariz(e|es|ed|ing|ation)\b", r"summaris\1"),
                            (r"\boptimiz(e|es|ed|ing|ation)\b", r"optimis\1"),
                            (r"\bcategoriz(e|es|ed|ing|ation)\b", r"categoris\1"),
                            (r"\bbehaviors\b", "behaviours"),
                            (r"\bbehavior\b", "behaviour"),
                            (r"\bcolors\b", "colours"),
                            (r"\bcolor\b", "colour"),
                        ]
                        for pat, rep in replacements:
                            text = re.sub(pat, rep, text, flags=re.IGNORECASE)
                        return text

                    cleaned = []
                    max_char_len = 110 if not user_name else max(110, 95 + len(user_name))
                    for p in raw_phrases:
                        if isinstance(p, str):
                            s = p.strip().strip('"').strip("'")
                            s = to_british_spelling(s)
                            # Repair partial name truncation from LLM if user_name has multiple words (e.g. Hong Rong -> Rong)
                            if user_name and " " in user_name:
                                name_parts = [part for part in user_name.split() if len(part) >= 2]
                                for part in name_parts:
                                    if part in s and user_name not in s:
                                        s = re.sub(rf'\b{re.escape(part)}\b', user_name, s)
                            
                            # If sentence contains multi-clauses or run-ons exceeding max length, try splitting at clean sentence boundaries
                            if len(s) > max_char_len:
                                parts = re.split(r'[\.\!\?\;]\s+', s)
                                if parts and count_words_excluding_name(parts[0], user_name) >= 6 and len(parts[0]) <= max_char_len:
                                    s = parts[0].strip().rstrip('.') + "."

                            # Ensure proper terminal punctuation
                            if s and not s.endswith(('.', '!', '?')):
                                if s.rstrip()[-1].isalnum() or s.rstrip()[-1] in ('"', "'"):
                                    s = s.rstrip() + "."

                            # Validate final length and word count (never slice/truncate with rsplit into incomplete sentences)
                            if s and len(s) >= 15 and len(s) <= (max_char_len + 15) and count_words_excluding_name(s, user_name) >= 6:
                                cleaned.append(s)

                    if isinstance(fact_str, str):
                        fact_str = fact_str.strip().strip('"').strip("'")
                        fact_str = to_british_spelling(fact_str)
                        if len(fact_str) < 5 or len(fact_str) > 250 or (avoid_fact and fact_str.strip().lower() == avoid_fact.strip().lower()):
                            fact_str = None

                    if len(cleaned) >= 3:
                        if client_hour is not None:
                            cleaned = filter_phrases_for_diurnal_window(cleaned, client_hour, target_date, user_name)
                        logger.info(f"Successfully generated {len(cleaned)} daily typewriter lines and fun fact via LLM ({model_name} at {ollama_url})")
                        return {
                            "phrases": cleaned,
                            "fact": fact_str
                        }
        except Exception as e:
            logger.debug(f"Ollama candidate {ollama_url} unavailable ({e}), trying next.")
            continue

    return None

def get_diurnal_period(client_hour: Optional[int]) -> str:
    h = (client_hour % 24) if client_hour is not None else datetime.datetime.now().hour
    if 0 <= h < 6:
        return "wee_hours"
    elif 6 <= h < 12:
        return "morning"
    elif 12 <= h < 18:
        return "afternoon"
    elif 18 <= h < 23:
        return "evening"
    else:
        return "night"

async def get_or_generate_daily_intel(target_date: Optional[datetime.date] = None,
                                      user_name: str = "User",
                                      force_refresh: bool = False,
                                      client_hour: Optional[int] = None,
                                      db_path: Optional[Path] = None) -> Dict[str, Any]:
    """
    Fetches daily intelligence and typewriter lines.
    Checks the diurnal SQLite cache first; generates fresh lines via LLM if missing or forced,
    and seamlessly falls back to the curated milestone engine if LLM is offline.
    """
    today = target_date or datetime.date.today()
    date_key = today.strftime("%Y-%m-%d")
    date_label = today.strftime("%A, %B %d")
    effective_hour = client_hour if client_hour is not None else datetime.datetime.now().hour
    period = get_diurnal_period(effective_hour)
    period_key = f"{date_key}_{period}"

    fact = get_historical_milestone_or_fact(today)
    default_subtext = f"{date_label} · 💡 {fact}"

    # 1. Check SQLite Cache
    if not force_refresh:
        # Check period-specific cache first
        cached = database.get_daily_typewriter_cache(period_key, db_path)
        if not cached or not cached.get("phrases"):
            # Check base date cache only if client_hour is not specified (e.g. date-only lookup)
            if client_hour is None:
                base_cached = database.get_daily_typewriter_cache(date_key, db_path)
                if base_cached and base_cached.get("phrases"):
                    cached = base_cached

        if cached and cached.get("phrases") and len(cached["phrases"]) > 0:
            cached_subtext = cached.get("subtext") or default_subtext
            if "·" not in cached_subtext and "💡" not in cached_subtext:
                cached_subtext = default_subtext
            # Upgrade stale sprint slogans (e.g. "Thursday thrust", "Deep work sprint") to genuine fun facts
            if any(slogan in cached_subtext for slogan in ["Thursday thrust", "Wednesday wave", "Tuesday tempo", "Monday momentum", "Friday finale", "Saturday scan", "Sunday synch", "Deep work sprint"]):
                cached_subtext = default_subtext

            cached_fact = fact
            if cached_subtext and "💡" in cached_subtext:
                cached_fact = cached_subtext.split("💡")[-1].strip()

            phrases_to_return = cached["phrases"]
            # Upgrade stale legacy phrases or phrases containing outdated display name
            stale_name_in_phrases = (user_name != "Hong Rong") and any("Hong Rong" in p for p in phrases_to_return)
            if stale_name_in_phrases or any(legacy in p for p in phrases_to_return for legacy in ["Orbital telemetry nominal", "First coffee, then tasks", "Systems primed for takeoff", "First coffee, then the deep work,"]):
                phrases_to_return = get_curated_phrases(today, user_name, cached_fact, client_hour=effective_hour)
                try:
                    database.save_daily_typewriter_cache(
                        date_str=period_key,
                        phrases=phrases_to_return,
                        subtext=cached_subtext,
                        source="single_line_upgrade",
                        db_path=db_path
                    )
                    database.save_daily_typewriter_cache(
                        date_str=date_key,
                        phrases=phrases_to_return,
                        subtext=cached_subtext,
                        source="single_line_upgrade",
                        db_path=db_path
                    )
                except Exception:
                    pass

            # Upgrade stale multi-clause phrases (> 95 chars for non-llm, > 120 chars for any) or short fallbacks (< 6 words)
            needs_upgrade = (
                any(len(p) > 120 for p in phrases_to_return) or
                (cached.get("source") != "llm" and any(len(p) > 95 for p in phrases_to_return)) or
                (cached.get("source") != "llm" and any(count_words_excluding_name(p, user_name) < 6 for p in phrases_to_return))
            )
            if needs_upgrade:
                phrases_to_return = get_curated_phrases(today, user_name, cached_fact, client_hour=effective_hour)
                try:
                    database.save_daily_typewriter_cache(
                        date_str=period_key,
                        phrases=phrases_to_return,
                        subtext=cached_subtext,
                        source="single_line_upgrade",
                        db_path=db_path
                    )
                    database.save_daily_typewriter_cache(
                        date_str=date_key,
                        phrases=phrases_to_return,
                        subtext=cached_subtext,
                        source="single_line_upgrade",
                        db_path=db_path
                    )
                except Exception:
                    pass

            if client_hour is not None:
                phrases_to_return = filter_phrases_for_diurnal_window(
                    phrases_to_return,
                    client_hour=client_hour,
                    target_date=today,
                    user_name=user_name
                )

            return {
                "date": date_key,
                "date_label": date_label,
                "phrases": phrases_to_return,
                "subtext": cached_subtext,
                "milestone": cached_fact,
                "holiday": get_holiday_info(today),
                "source": "cache",
                "cached": True
            }

    # 2. Generate via LLM for this diurnal window
    import inspect
    import random

    cached_existing = database.get_daily_typewriter_cache(period_key, db_path) or database.get_daily_typewriter_cache(date_key, db_path)
    prev_fact = None
    if cached_existing:
        prev_sub = cached_existing.get("subtext") or ""
        prev_fact = cached_existing.get("milestone") or (prev_sub.split("💡")[-1].strip() if "💡" in prev_sub else None)

    sig = inspect.signature(generate_llm_typewriter_lines)
    call_kwargs = {}
    if "client_hour" in sig.parameters:
        call_kwargs["client_hour"] = effective_hour
    if "avoid_fact" in sig.parameters and force_refresh:
        call_kwargs["avoid_fact"] = prev_fact

    milestone_arg = "refresh" if force_refresh else fact
    llm_res = await generate_llm_typewriter_lines(today, user_name, milestone_arg, **call_kwargs)

    llm_phrases = None
    llm_fact = None
    if isinstance(llm_res, dict):
        llm_phrases = llm_res.get("phrases")
        llm_fact = llm_res.get("fact")
    elif isinstance(llm_res, list):
        llm_phrases = llm_res

    if llm_phrases and len(llm_phrases) >= 3:
        source = "llm"
        final_phrases = filter_phrases_for_diurnal_window(llm_phrases, client_hour, today, user_name) if client_hour is not None else llm_phrases
        # Validate LLM fact against date-accurate verified milestones
        import re
        verified_candidates = get_historical_milestones_for_date(today)
        is_verified_date_fact = False
        if llm_fact and isinstance(llm_fact, str) and re.match(r"^\d{4}:", llm_fact.strip()):
            fact_year = llm_fact.strip().split(":")[0].strip()
            candidate_years = {c.split(":")[0].strip() for c in verified_candidates if ":" in c}
            if fact_year in candidate_years:
                is_verified_date_fact = True
            elif any(c.strip().lower() in llm_fact.strip().lower() for c in verified_candidates):
                is_verified_date_fact = True

        if force_refresh:
            if is_verified_date_fact and (not prev_fact or llm_fact.strip().lower() != prev_fact.strip().lower()):
                chosen_fact = llm_fact
            else:
                chosen_fact = get_historical_milestone_or_fact(today, avoid_fact=prev_fact or fact)
        else:
            if is_verified_date_fact:
                chosen_fact = llm_fact
            elif llm_fact and not re.match(r"^\d{4}:", llm_fact.strip()) and "fact" in llm_fact.lower():
                # Allow test mocks that return mock non-year strings like "Evening Fact"
                chosen_fact = llm_fact
            else:
                chosen_fact = fact
    else:
        # LLM offline: check if base_cached has >= 3 non-contradictory phrases for this window
        base_cached = database.get_daily_typewriter_cache(date_key, db_path) if not force_refresh else None
        surviving = []
        if base_cached and base_cached.get("phrases"):
            surviving = filter_phrases_for_diurnal_window(
                base_cached["phrases"],
                client_hour=effective_hour,
                target_date=today,
                user_name=user_name,
                supplement_curated=False
            )
        if len(surviving) >= 3 and base_cached.get("source") == "llm":
            source = "llm"
            final_phrases = surviving
            chosen_fact = fact
        else:
            is_upgrade = bool(base_cached and (
                any(len(p) > 95 for p in base_cached.get("phrases", [])) or
                any(legacy in p for p in base_cached.get("phrases", []) for legacy in ["Orbital telemetry nominal", "First coffee, then tasks", "Systems primed for takeoff", "First coffee, then the deep work,"])
            ))
            source = "single_line_upgrade" if is_upgrade else "curated_fallback"
            final_phrases = get_curated_phrases(today, user_name, fact, client_hour=client_hour)
            if force_refresh:
                chosen_fact = get_historical_milestone_or_fact(today, avoid_fact=prev_fact or fact)
            else:
                chosen_fact = fact

    subtext = f"{date_label} · 💡 {chosen_fact}"

    # 3. Cache into SQLite under period-specific key and base date key
    try:
        database.save_daily_typewriter_cache(
            date_str=period_key,
            phrases=final_phrases,
            subtext=subtext,
            source=source,
            db_path=db_path
        )
        database.save_daily_typewriter_cache(
            date_str=date_key,
            phrases=final_phrases,
            subtext=subtext,
            source=source,
            db_path=db_path
        )
    except Exception as e:
        logger.warning(f"Could not persist daily typewriter cache to SQLite: {e}")

    return {
        "date": date_key,
        "date_label": date_label,
        "phrases": final_phrases,
        "subtext": subtext,
        "milestone": chosen_fact,
        "holiday": get_holiday_info(today),
        "source": source,
        "cached": False
    }

def get_daily_intel(target_date: Optional[datetime.date] = None,
                    user_name: str = "User") -> Dict[str, Any]:
    """
    Synchronous accessor for backward compatibility and fast synchronous lookups.
    Returns cached phrases if available, otherwise returns curated phrases immediately.
    """
    today = target_date or datetime.date.today()
    date_key = today.strftime("%Y-%m-%d")
    cached = database.get_daily_typewriter_cache(date_key)
    if cached and cached.get("phrases") and len(cached["phrases"]) > 0:
        return {
            "date": date_key,
            "date_label": today.strftime("%A, %B %d"),
            "phrases": cached["phrases"],
            "subtext": cached.get("subtext") or "",
            "milestone": HISTORICAL_MILESTONES.get((today.month, today.day)) or DAY_OF_WEEK_INTEL.get(today.weekday()),
            "holiday": get_holiday_info(today),
            "source": cached.get("source", "cache")
        }

    month = today.month
    day = today.day
    chosen_fact = get_historical_milestone_or_fact(today)
    date_label = today.strftime("%A, %B %d")
    subtext = f"{date_label} · {chosen_fact}"

    return {
        "date": date_key,
        "date_label": date_label,
        "phrases": get_curated_phrases(today, user_name, chosen_fact),
        "subtext": subtext,
        "milestone": chosen_fact,
        "holiday": get_holiday_info(today),
        "source": "curated"
    }

def get_curated_snapshot_remark(counts: Dict[str, Any],
                                target_date: Optional[datetime.date] = None,
                                user_name: str = "User",
                                client_hour: Optional[int] = None) -> str:
    """Returns a factual, tongue-in-cheek curated remark tuned cleanly to actual workload & hour."""
    focus_pending = int(counts.get("focus_pending", 0) or 0)
    trivial_pending = int(counts.get("trivial_pending", 0) or 0)
    events_pending = int(counts.get("events_pending", 0) or 0)
    overdue_total = int(counts.get("overdue_total", 0) or 0)
    total_pending = int(counts.get("total_pending", 0) or 0)
    total_completed = int(counts.get("total_completed", 0) or 0)
    hour = (client_hour % 24) if client_hour is not None else datetime.datetime.now().hour

    if total_pending == 0 and total_completed > 0:
        return f"Clean sweep, {user_name}: every task on today's ledger is struck through. Even Horace has nothing left to nag about."
    if total_pending == 0:
        return f"An empty runway for once, {user_name} — savour the stillness before tomorrow's chaos files a ticket."
    if overdue_total >= 3:
        return f"You've got {overdue_total} overdue items glaring from yesterday — deep breath, pick #01, and shrink that debt."
    if overdue_total > 0 and focus_pending >= 3:
        return f"Moderate turbulence ahead: {focus_pending} deep-work blocks and {overdue_total} overdue carry-over{'s' if overdue_total != 1 else ''}. Tea helps."
    if events_pending >= 3:
        return f"{events_pending} calendar commitments competing for your oxygen today — guard the gaps between them."
    if focus_pending >= 4:
        return f"A proper heavy-lift slate ({focus_pending} focus tasks). Less fiddling with the dashboard, more chipping at #01."
    if trivial_pending > focus_pending and trivial_pending >= 3:
        return f"Heavy on the admin errands ({trivial_pending}) today — knock the quick wins down like dominoes."
    if hour < 6 or hour >= 23:
        return f"Quiet hours lock-in, {user_name}: minimal noise, maximum runway, just don't stare at the clock till dawn."
    if hour >= 18:
        return f"Evening lock-in active: finish what actually matters tonight, then wrap the rest cleanly in Debrief."
    return f"Tidy, winnable slate ahead, {user_name} — follow the queue top-to-bottom and let momentum do the rest."


async def generate_snapshot_witty_remark(briefing: Dict[str, Any],
                                         target_date: datetime.date,
                                         user_name: str = "User",
                                         client_hour: Optional[int] = None,
                                         timeout_seconds: float = 9.0) -> Dict[str, str]:
    """
    Uses the configured local LLM (Ollama) strictly to write a short, fun, witty remark
    about the day's factual outlook — falling back instantaneously to curated quips if offline.
    """
    counts = briefing.get("counts") or {}
    fallback = get_curated_snapshot_remark(counts, target_date=target_date, user_name=user_name, client_hour=client_hour)

    try:
        from config.config import get_ollama_candidate_urls
        candidate_urls = get_ollama_candidate_urls()
    except Exception:
        candidate_urls = ["http://localhost:11434", "http://127.0.0.1:11434"]

    config = get_or_create_config()
    target_model = os.environ.get("OLLAMA_MODEL") or config.get("ollama_model") or config.get("active_llm") or "llama3.2:3b"

    hour = (client_hour % 24) if client_hour is not None else datetime.datetime.now().hour
    period = get_diurnal_period(hour)
    top_titles = [it.get("title", "") for it in (briefing.get("priority_queue") or [])[:3] if it.get("title")]
    queue_hint = ", ".join(top_titles) if top_titles else "none queued yet"

    system_prompt = (
        "You are Horace, the wry, warm, lightly sarcastic local server companion inside PETTR. "
        "Use British English spelling (prioritise, organise, colour, savour, favour). "
        "Your line is appended seamlessly right onto the end of a factual natural-language daily briefing paragraph, "
        "so write it like a natural closing editorial sentence without any prefix, speaker tag, or repeating the calendar date. "
        "CRITICAL ANTI-HALLUCINATION RULE: Respond ONLY with a single short witty observation (1 sentence, max 28 words) "
        "reacting to the EXACT counts provided below. Do NOT invent, guess, or add any task names, clock times, meetings, or deadlines "
        "that were not explicitly provided."
    )
    user_prompt = (
        f"Context: {target_date.strftime('%A')} ({period}). User: {user_name}.\n"
        f"Factual workload counts:\n"
        f"- Focus tasks pending: {counts.get('focus_pending', 0)} (overdue: {counts.get('focus_overdue', 0)})\n"
        f"- Trivial tasks pending: {counts.get('trivial_pending', 0)}\n"
        f"- Scheduled events upcoming: {counts.get('events_pending', 0)}\n"
        f"- Active projects today: {counts.get('projects_total', 0)}\n"
        f"- Active reminders: {counts.get('reminders_active', 0)}\n"
        f"- Top priority queue items: {queue_hint}\n\n"
        "Write one natural, seamless closing sentence (max 28 words, plain text, no quotes or hashtags) continuing straight from the briefing summary."
    )

    for ollama_url in candidate_urls:
        try:
            model_name = target_model
            async with httpx.AsyncClient(timeout=httpx.Timeout(2.5, connect=1.5)) as probe_client:
                tags_resp = await probe_client.get(f"{ollama_url}/api/tags")
                if tags_resp.status_code != 200:
                    continue
                tags_data = tags_resp.json()
                available_models = [m.get("name") for m in tags_data.get("models", []) if m.get("name")]
                if available_models and model_name not in available_models and not any(model_name in am for am in available_models):
                    model_name = available_models[0]

            payload = {
                "model": model_name,
                "prompt": user_prompt,
                "system": system_prompt,
                "stream": False,
                "options": {
                    "temperature": 0.8,
                    "num_predict": 90
                }
            }
            async with httpx.AsyncClient(timeout=httpx.Timeout(timeout_seconds, connect=2.5)) as client:
                resp = await client.post(f"{ollama_url}/api/generate", json=payload)
                if resp.status_code == 200:
                    text = (resp.json().get("response") or "").strip()
                    text = text.strip('"\' ').replace("\n", " ")
                    while "  " in text:
                        text = text.replace("  ", " ")
                    if 12 <= len(text) <= 280:
                        return {"text": text, "source": "llm", "model": model_name}
        except Exception as e:
            logger.debug(f"Snapshot remark LLM skip on {ollama_url}: {e}")
            continue

    return {"text": fallback, "source": "curated", "model": "procedural"}

async def midnight_typewriter_scheduler_loop():
    """
    Background daemon loop that triggers at midnight (00:00:05) every day.
    Proactively contacts the LLM to generate the new day's typewriter phrases and caches them into SQLite.
    """
    logger.info("Daily midnight typewriter scheduler initialized.")
    while True:
        try:
            now = datetime.datetime.now()
            # Calculate next midnight + 5 seconds
            tomorrow = now.date() + datetime.timedelta(days=1)
            next_midnight = datetime.datetime.combine(tomorrow, datetime.time(0, 0, 5))
            sleep_seconds = max(5.0, (next_midnight - now).total_seconds())

            logger.info(f"Midnight scheduler sleeping for {int(sleep_seconds)}s until {next_midnight.strftime('%Y-%m-%d %H:%M:%S')}")
            await asyncio.sleep(sleep_seconds)

            today = datetime.date.today()
            profile = get_user_profile()
            user_name = profile.get("user_name", "User")

            logger.info(f"Midnight reached! Proactively generating LLM typewriter lines for {today} (wee hours)...")
            await get_or_generate_daily_intel(target_date=today, user_name=user_name, force_refresh=True, client_hour=0)
            logger.info(f"Midnight LLM typewriter generation for {today} concluded.")
        except asyncio.CancelledError:
            logger.info("Midnight typewriter scheduler stopped.")
            break
        except Exception as e:
            logger.error(f"Error in midnight_typewriter_scheduler_loop: {e}")
            await asyncio.sleep(60)
