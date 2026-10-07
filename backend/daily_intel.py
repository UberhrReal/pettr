"""
PETTR Daily Intelligence & Date-Aware Tagline Engine
Provides date-relevant greetings, space/engineering historical milestones,
and productivity taglines that guarantee no duplication between top and bottom banners.
"""

import datetime
from typing import Dict, Any, List, Optional
import httpx
from config import config

# Curated Space, Engineering & World Milestones by (Month, Day)
HISTORICAL_MILESTONES = {
    (1, 1): "New Year's Day · System epoch reset and trajectory baseline initialized.",
    (1, 28): "Challenger STS-51-L remembrance · Honoring space pioneers.",
    (2, 1): "Columbia STS-107 remembrance · Engineering vigilance and duty.",
    (2, 14): "1990: Voyager 1 took the iconic 'Pale Blue Dot' portrait of Earth.",
    (3, 14): "Pi Day (3.14) · Celebrating mathematics and aerospace precision.",
    (4, 12): "1961: Yuri Gagarin became the first human in space aboard Vostok 1.",
    (4, 24): "1990: Hubble Space Telescope launched into orbit aboard Discovery.",
    (5, 5): "1961: Alan Shepard became the first American in space.",
    (5, 30): "2020: Crew Dragon Demo-2 restored commercial human spaceflight.",
    (6, 16): "1963: Valentina Tereshkova became the first woman in space.",
    (7, 20): "1969: Apollo 11 Lunar Module touched down on the Sea of Tranquility.",
    (8, 9): "Singapore National Day · Majulah Singapura orbital salute.",
    (8, 20): "1977: Voyager 2 launched on its interstellar grand tour.",
    (8, 25): "2012: Voyager 1 officially crossed the heliopause into interstellar space.",
    (9, 12): "1962: JFK delivered the 'We choose to go to the Moon' address.",
    (10, 4): "1957: Sputnik 1 launched, inaugurating the Space Age.",
    (10, 7): "1959: Luna 3 transmitted the first photographs of the far side of the Moon.",
    (10, 18): "1989: Galileo spacecraft launched toward Jupiter.",
    (11, 3): "1957: Sputnik 2 launched into orbit.",
    (11, 12): "2014: Rosetta's Philae lander achieved the first soft landing on a comet.",
    (11, 20): "1998: Zarya module launched, beginning ISS assembly in low Earth orbit.",
    (12, 14): "1972: Apollo 17 commander Gene Cernan stepped off the Moon.",
    (12, 17): "1903: Wright brothers achieved the first powered heavier-than-air flight.",
    (12, 25): "2021: James Webb Space Telescope launched aboard Ariane 5.",
}

# Day of week momentum taglines
DAY_OF_WEEK_INTEL = {
    0: "Monday ignition: Establish orbital velocity and lock priority objectives.",
    1: "Tuesday trajectory: High-efficiency execution across active projects.",
    2: "Wednesday midpoint: Mid-course telemetry review and errand clearing.",
    3: "Thursday thrust: Deep work sprint before weekly wrap-up.",
    4: "Friday circularization: Finalize deliverables and close out task queues.",
    5: "Saturday tactical: Personal research, hardware tinker, and maintenance.",
    6: "Sunday debrief: Rest, retrospective analysis, and mission planning."
}

def get_daily_intel(target_date: Optional[datetime.date] = None, user_name: str = "Hong Rong") -> Dict[str, Any]:
    today = target_date or datetime.date.today()
    month = today.month
    day = today.day
    weekday = today.weekday()

    milestone = HISTORICAL_MILESTONES.get((month, day))
    weekday_intel = DAY_OF_WEEK_INTEL.get(weekday, "Execute daily priorities with focus.")

    date_label = today.strftime("%A, %B %d")
    
    # Subtext is dedicated strictly to date context and intel (never duplicates top phrases)
    subtext = f"{date_label} · {milestone}" if milestone else f"{date_label} · {weekday_intel}"

    # Top typewriter phrases tailored to time-of-day and personal identity
    # None of these will ever equal the subtext!
    morning_phrases = [
        f"Good morning, {user_name}.",
        f"Orbital telemetry nominal, {user_name}.",
        f"First coffee, then tasks, {user_name}.",
        f"Ready to conquer today's agenda?",
        f"Hi, Me! Systems primed for takeoff."
    ]

    afternoon_phrases = [
        f"Working hard or hardly working, {user_name}?",
        f"Midday check-in, {user_name}.",
        f"Maintaining steady cruising velocity.",
        f"Deep focus block in progress.",
        f"Hi, Me! Clear through that queue."
    ]

    evening_phrases = [
        f"Good evening, {user_name}.",
        f"Entering dusk debrief window.",
        f"Reviewing completed objectives, {user_name}.",
        f"Preparing for smooth orbit wrap-up.",
        f"Hi, Me! Tying off open loops."
    ]

    night_phrases = [
        f"Burning the midnight oil, {user_name}?",
        f"Night owl session active.",
        f"Quiet hours telemetry online.",
        f"Remember to recharge batteries soon, {user_name}."
    ]

    hour = datetime.datetime.now().hour
    if 5 <= hour < 12:
        top_phrases = morning_phrases
    elif 12 <= hour < 18:
        top_phrases = afternoon_phrases
    elif 18 <= hour < 23:
        top_phrases = evening_phrases
    else:
        top_phrases = night_phrases

    # Inject milestone headline into top phrases if special day
    if milestone:
        top_phrases.insert(1, f"Special milestone today, {user_name}.")

    return {
        "date": today.strftime("%Y-%m-%d"),
        "date_label": date_label,
        "phrases": top_phrases,
        "subtext": subtext,
        "milestone": milestone or weekday_intel
    }
