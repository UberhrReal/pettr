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
from pathlib import Path
from typing import Dict, Any, List, Optional
import httpx
from config.config import get_or_create_config, get_user_profile
from backend import database

logger = logging.getLogger("pettr.daily_intel")

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

def get_curated_phrases(today: datetime.date, user_name: str, milestone: Optional[str] = None) -> List[str]:
    """Generates curated time-of-day phrases as resilient fallback."""
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
        top_phrases = list(morning_phrases)
    elif 12 <= hour < 18:
        top_phrases = list(afternoon_phrases)
    elif 18 <= hour < 23:
        top_phrases = list(evening_phrases)
    else:
        top_phrases = list(night_phrases)

    if milestone:
        top_phrases.insert(1, f"Special milestone today, {user_name}.")

    return top_phrases

async def generate_llm_typewriter_lines(target_date: datetime.date,
                                       user_name: str,
                                       milestone_info: Optional[str] = None,
                                       timeout_seconds: float = 8.0) -> Optional[Any]:
    """
    Prompts the configured local/remote LLM to generate fresh, date-aware typewriter greeting lines
    and a fascinating fun fact relevant to today's date in history.
    Returns a dict with {"phrases": [...], "fact": "..."} or list of lines, or None if LLM is offline.
    """
    config = get_or_create_config()
    ollama_url = os.environ.get("OLLAMA_URL") or config.get("ollama_url", "http://localhost:11434")
    model_name = os.environ.get("OLLAMA_MODEL") or config.get("ollama_model", "llama3.2:3b")

    date_str = target_date.strftime("%A, %B %d, %Y")
    weekday_name = target_date.strftime("%A")
    milestone_ctx = f"Historical anniversary / milestone today: {milestone_info}" if milestone_info else f"Day of the week: {weekday_name}"

    system_prompt = (
        "You are the witty, sharp, tech-forward onboard AI companion for PETTR "
        "(Personal Errands, Task Tracker & Repository), an aerospace-grade personal mission dashboard. "
        "Your task is to generate:\n"
        "1. Exactly 5 distinctive, punchy typewriter greeting lines for the user's dashboard banner.\n"
        "2. Exactly 1 fascinating, genuine fun fact or significant historical event specifically relevant to today's date.\n"
        "Return ONLY a valid JSON object: {\"phrases\": [\"line 1\", \"line 2\", \"line 3\", \"line 4\", \"line 5\"], \"fact\": \"Fun fact string...\"}."
    )

    user_prompt = (
        f"Today is {date_str}.\n"
        f"{milestone_ctx}\n"
        f"User's name: {user_name}\n\n"
        "Requirements:\n"
        f"1. In 'phrases': generate exactly 5 short, witty, and motivating typewriter phrases tailored to today's date and {user_name}.\n"
        "2. Keep each phrase punchy (4 to 9 words, under 50 characters each).\n"
        "3. Blend subtle space exploration / engineering telemetry flavor, high-performance focus, and date-relevant humor.\n"
        "4. Cover different daily momentum perspectives (morning launch, deep work focus, evening orbit wrap-up).\n"
        f"5. Mention {user_name} naturally in at least two lines.\n"
        "6. In 'fact': provide 1 fascinating, genuine historical event, scientific breakthrough, or quirky fun fact that happened on this calendar date in history. Keep it concise (1 to 2 sentences, 15 to 30 words).\n"
        "7. Return ONLY a valid JSON object matching: {\"phrases\": [...], \"fact\": \"...\"}, no explanation or markdown fences."
    )

    payload = {
        "model": model_name,
        "prompt": user_prompt,
        "system": system_prompt,
        "format": "json",
        "stream": False,
        "options": {
            "temperature": 0.75,
            "num_predict": 260
        }
    }

    try:
        async with httpx.AsyncClient(timeout=timeout_seconds) as client:
            resp = await client.post(f"{ollama_url}/api/generate", json=payload)
            if resp.status_code == 200:
                data = resp.json()
                raw_response = data.get("response", "").strip()
                
                # Strip markdown json code fences if present
                if raw_response.startswith("```"):
                    raw_response = raw_response.strip("`")
                    if raw_response.startswith("json"):
                        raw_response = raw_response[4:].strip()

                parsed = json.loads(raw_response)
                raw_phrases = []
                fact_str = None
                if isinstance(parsed, dict):
                    raw_phrases = parsed.get("phrases") or parsed.get("lines") or parsed.get("greetings") or []
                    fact_str = parsed.get("fact") or parsed.get("fun_fact") or parsed.get("milestone")
                elif isinstance(parsed, list):
                    raw_phrases = parsed

                cleaned = []
                for p in raw_phrases:
                    if isinstance(p, str):
                        s = p.strip().strip('"').strip("'")
                        # Clean leading numbering if any (e.g. "1. ")
                        if s and len(s) > 3 and len(s) < 80:
                            cleaned.append(s)

                if isinstance(fact_str, str):
                    fact_str = fact_str.strip().strip('"').strip("'")
                    if len(fact_str) < 5 or len(fact_str) > 250:
                        fact_str = None

                if len(cleaned) >= 3:
                    logger.info(f"Successfully generated {len(cleaned)} daily typewriter lines and fun fact via LLM ({model_name})")
                    return {
                        "phrases": cleaned,
                        "fact": fact_str
                    }
    except Exception as e:
        logger.debug(f"LLM typewriter generation unavailable ({e}), using curated engine.")
        pass

    return None

async def get_or_generate_daily_intel(target_date: Optional[datetime.date] = None,
                                      user_name: str = "Hong Rong",
                                      force_refresh: bool = False,
                                      db_path: Optional[Path] = None) -> Dict[str, Any]:
    """
    Fetches daily intelligence and typewriter lines.
    Checks the daily SQLite cache first; generates fresh lines via LLM if missing or forced,
    and seamlessly falls back to the curated milestone engine if LLM is offline.
    """
    today = target_date or datetime.date.today()
    month = today.month
    day = today.day
    weekday = today.weekday()
    date_key = today.strftime("%Y-%m-%d")

    milestone = HISTORICAL_MILESTONES.get((month, day))
    weekday_intel = DAY_OF_WEEK_INTEL.get(weekday, "Execute daily priorities with focus.")
    date_label = today.strftime("%A, %B %d")
    fallback_fact = milestone or weekday_intel
    default_subtext = f"{date_label} · 💡 {fallback_fact}" if fallback_fact else date_label

    # 1. Check SQLite Cache
    if not force_refresh:
        cached = database.get_daily_typewriter_cache(date_key, db_path)
        if cached and cached.get("phrases") and len(cached["phrases"]) > 0:
            return {
                "date": date_key,
                "date_label": date_label,
                "phrases": cached["phrases"],
                "subtext": cached.get("subtext") or default_subtext,
                "milestone": milestone or weekday_intel,
                "source": "cache",
                "cached": True
            }

    # 2. Generate via LLM
    milestone_summary = milestone or weekday_intel
    llm_res = await generate_llm_typewriter_lines(today, user_name, milestone_summary)

    llm_phrases = None
    llm_fact = None
    if isinstance(llm_res, dict):
        llm_phrases = llm_res.get("phrases")
        llm_fact = llm_res.get("fact")
    elif isinstance(llm_res, list):
        llm_phrases = llm_res

    if llm_phrases and len(llm_phrases) >= 3:
        source = "llm"
        final_phrases = llm_phrases
        chosen_fact = llm_fact or fallback_fact
    else:
        source = "curated_fallback"
        final_phrases = get_curated_phrases(today, user_name, milestone)
        chosen_fact = fallback_fact

    subtext = f"{date_label} · 💡 {chosen_fact}" if chosen_fact else date_label

    # 3. Cache into SQLite
    try:
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
        "milestone": milestone or weekday_intel,
        "source": source
    }

def get_daily_intel(target_date: Optional[datetime.date] = None,
                    user_name: str = "Hong Rong") -> Dict[str, Any]:
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
            "source": cached.get("source", "cache")
        }

    month = today.month
    day = today.day
    weekday = today.weekday()
    milestone = HISTORICAL_MILESTONES.get((month, day))
    weekday_intel = DAY_OF_WEEK_INTEL.get(weekday, "Execute daily priorities with focus.")
    date_label = today.strftime("%A, %B %d")
    subtext = f"{date_label} · {milestone}" if milestone else f"{date_label} · {weekday_intel}"

    return {
        "date": date_key,
        "date_label": date_label,
        "phrases": get_curated_phrases(today, user_name, milestone),
        "subtext": subtext,
        "milestone": milestone or weekday_intel,
        "source": "curated"
    }

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
            user_name = profile.get("user_name", "Hong Rong")

            logger.info(f"Midnight reached! Proactively generating LLM typewriter lines for {today}...")
            await get_or_generate_daily_intel(target_date=today, user_name=user_name, force_refresh=True)
            logger.info(f"Midnight LLM typewriter generation for {today} concluded.")
        except asyncio.CancelledError:
            logger.info("Midnight typewriter scheduler stopped.")
            break
        except Exception as e:
            logger.error(f"Error in midnight_typewriter_scheduler_loop: {e}")
            await asyncio.sleep(60)
