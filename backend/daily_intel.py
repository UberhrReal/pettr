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

# Curated World, Science, Computing, Engineering & Space Milestones by (Month, Day)
HISTORICAL_MILESTONES = {
    (1, 1): "New Year's Day · System epoch reset and trajectory baseline initialized.",
    (1, 15): "1889: The Coca-Cola Company was incorporated in Atlanta, Georgia.",
    (1, 28): "1986: Challenger STS-51-L remembrance · Honoring space pioneers.",
    (2, 1): "2003: Columbia STS-107 remembrance · Engineering vigilance and duty.",
    (2, 11): "1847: Thomas Edison was born in Milan, Ohio, going on to hold 1,093 patents.",
    (2, 14): "1990: Voyager 1 took the iconic 'Pale Blue Dot' portrait of Earth.",
    (2, 28): "1953: James Watson and Francis Crick announced the double-helix structure of DNA.",
    (3, 10): "1876: Alexander Graham Bell made the first telephone call: 'Mr. Watson, come here.'",
    (3, 14): "Pi Day (3.14) · Celebrating mathematics and aerospace precision.",
    (3, 21): "Vernal Equinox · Equal light and dark across the planet.",
    (4, 12): "1961: Yuri Gagarin became the first human in space aboard Vostok 1.",
    (4, 24): "1990: Hubble Space Telescope launched into orbit aboard Discovery.",
    (4, 25): "1953: The landmark paper describing the double-helix structure of DNA was published in Nature.",
    (5, 5): "1961: Alan Shepard became the first American in space.",
    (5, 6): "1954: Roger Bannister broke the four-minute mile barrier in Oxford (3:59.4).",
    (5, 29): "1953: Edmund Hillary and Tenzing Norgay became the first climbers to summit Mount Everest.",
    (5, 30): "2020: Crew Dragon Demo-2 restored commercial human spaceflight.",
    (6, 16): "1963: Valentina Tereshkova became the first woman in space.",
    (6, 23): "1912: Alan Turing was born in London, founding the mathematical basis of computing.",
    (7, 10): "1856: Nikola Tesla was born in Smiljan, pioneer of modern alternating current power.",
    (7, 20): "1969: Apollo 11 Lunar Module touched down on the Sea of Tranquility.",
    (8, 6): "1991: Tim Berners-Lee launched the world's very first website online at CERN.",
    (8, 9): "Singapore National Day · Majulah Singapura salute.",
    (8, 20): "1977: Voyager 2 launched on its interstellar grand tour.",
    (8, 25): "1991: Linus Torvalds announced the Linux kernel project.",
    (9, 12): "1958: Jack Kilby tested the world's first working integrated circuit microchip.",
    (9, 28): "1928: Alexander Fleming discovered penicillin, revolutionising medicine.",
    (10, 4): "1957: Sputnik 1 launched, inaugurating the Space Age.",
    (10, 7): "1959: Luna 3 transmitted the first photographs of the far side of the Moon.",
    (10, 8): "1958: Dr. William Chardack and Wilson Greatbatch tested the first internal cardiac pacemaker.",
    (10, 9): "1872: Aaron Montgomery Ward produced the first mail-order catalogue, pioneering modern consumer logistics.",
    (10, 10): "1967: The Outer Space Treaty entered into force, declaring space the province of all humankind.",
    (10, 11): "1968: Apollo 7 launched on the first crewed Apollo mission with Wally Schirra.",
    (10, 12): "1964: Voskhod 1 launched, carrying the first multi-person crew into orbit.",
    (10, 13): "1884: Greenwich was officially adopted as the universal Prime Meridian for world timezones.",
    (10, 14): "1947: Chuck Yeager broke the sound barrier aboard the Bell X-1 rocket plane.",
    (10, 15): "1997: Cassini-Huygens launched on its epic mission to explore Saturn and Titan.",
    (10, 18): "1989: Galileo spacecraft launched toward Jupiter aboard Atlantis STS-34.",
    (10, 29): "1969: The first message was transmitted across ARPANET between UCLA and Stanford.",
    (11, 3): "1957: Sputnik 2 launched into orbit.",
    (11, 8): "1895: Wilhelm Röntgen discovered X-rays, producing the first medical radiograph.",
    (11, 12): "2014: Rosetta's Philae lander achieved the first soft landing on a comet.",
    (11, 20): "1998: Zarya module launched, beginning ISS assembly in low Earth orbit.",
    (11, 30): "1609: Galileo Galilei first observed the Moon through a telescope and sketched its craters.",
    (12, 10): "1815: Ada Lovelace was born in London, celebrated as the first computer programmer.",
    (12, 14): "1972: Apollo 17 commander Gene Cernan stepped off the Moon.",
    (12, 17): "1903: Wright brothers achieved the first powered heavier-than-air flight at Kitty Hawk.",
    (12, 25): "2021: James Webb Space Telescope launched aboard Ariane 5.",
}

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
    "The human brain generates roughly 20 watts of electrical power while awake and processing thoughts.",
    "Octopuses possess three hearts, nine brains, and blue copper-based blood called hemocyanin.",
    "Honey never spoils: archaeologists have found 3,000-year-old still-edible honey in Egyptian tombs.",
    "The Eiffel Tower grows up to 15 cm taller in the summer heat due to the thermal expansion of iron.",
    "2021: Ingenuity achieved the first powered, controlled flight on another world aboard Mars.",
    "2022: James Webb Space Telescope deployed its 21-foot gold-coated beryllium mirror at Lagrange Point 2."
]

def get_historical_milestone_or_fact(target_date: datetime.date) -> str:
    month, day = target_date.month, target_date.day
    if (month, day) in HISTORICAL_MILESTONES:
        return HISTORICAL_MILESTONES[(month, day)]
    day_of_year = target_date.timetuple().tm_yday
    return CALENDAR_FUN_FACTS[day_of_year % len(CALENDAR_FUN_FACTS)]

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
    user_name: str = "Hong Rong"
) -> List[str]:
    """
    Filters out typewriter phrases that contradict the client's current time of day.
    Supplements with appropriate curated phrases if filtering leaves fewer than 3 lines.
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

    if len(filtered) < 3:
        curated = get_curated_phrases(target_date or datetime.date.today(), user_name, client_hour=hour)
        for c in curated:
            if c not in filtered:
                filtered.append(c)
            if len(filtered) >= 5:
                break

    return filtered

def get_curated_phrases(today: datetime.date, user_name: str, milestone: Optional[str] = None, client_hour: Optional[int] = None) -> List[str]:
    """Generates curated time-of-day phrases as resilient fallback."""
    wee_hours_phrases = [
        f"In the stillness of the wee hours, {user_name} - true hyperfocus thrives when the rest of the world is asleep.",
        f"The small hours are where breakthroughs happen. Keep that train of thought rolling, {user_name}.",
        f"Dead of night, terminal glowing. Pure undisturbed concentration in the quietest hours, {user_name}.",
        f"Zero notifications, zero distractions. Just you and the craft in the wee hours, {user_name}.",
        f"Deep nocturnal velocity, {user_name} - capture the breakthrough, but remember to catch some sleep before dawn.",
        f"Operating on after-hours fuel: make these quiet wee-hours blocks count, {user_name}."
    ]

    morning_phrases = [
        f"Good morning, {user_name}. Let's tackle the highest-leverage task while focus is fresh.",
        f"First coffee brewed and workspace primed - ready to turn intentions into progress, {user_name}?",
        f"Clear head, clear queue: prioritise the essential objectives before the noise begins, {user_name}.",
        f"Telemetry nominal. Time to dive into the deep work and build steady momentum, {user_name}.",
        f"Systems synchronised, {user_name}. What's the one milestone that will make today count?",
        f"Morning diagnostics green: single-task focus beats context-switching every time."
    ]

    afternoon_phrases = [
        f"Cruising altitude reached, {user_name} - keep the momentum steady through the afternoon sprint.",
        f"Working hard or hardly working, {user_name}? Either way, let's close out that next priority.",
        f"Midday checkpoint: resist the urge to context-switch and see this focus block through, {user_name}.",
        f"Solid execution so far, {user_name}. Power through the remainder of the active queue.",
        f"Hydrate, reset posture, and lock back into the flow state for the afternoon stretch.",
        f"Steady cadence, {user_name} - quality engineering craft takes patience and deliberate focus."
    ]

    evening_phrases = [
        f"Good evening, {user_name}. Time to tie off open loops and review today's accomplishments.",
        f"Smooth landing approach active: review your completed tasks and shut down the terminal cleanly.",
        f"Great execution across today's sprint, {user_name}. The queue will keep until tomorrow.",
        f"Mission objectives checked off. Step away from the workstation and enjoy a well-earned evening.",
        f"Evening debrief window: log final notes, close active tabs, and wind down, {user_name}.",
        f"Another productive day sealed, {user_name}. Rest is just as critical as the hustle."
    ]

    night_phrases = [
        f"Burning the midnight oil, {user_name}? The quiet hours make for great breakthroughs.",
        f"Night owl session active: finish this last train of thought before fatigue sets in, {user_name}.",
        f"Deep work in the quiet stillness - just remember that good sleep is part of good engineering.",
        f"Late-night telemetry online, {user_name}. Wrap up this final sprint and get some proper rest.",
        f"Quiet hours focus window. Save your work, commit the progress, and rest soon, {user_name}."
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
                                       client_hour: Optional[int] = None) -> Optional[Any]:
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
    diurnal_period = "afternoon"
    if client_hour is not None:
        h = client_hour % 24
        if 0 <= h < 6:
            diurnal_period = "the wee hours (midnight to 6am — nocturnal hyperfocus while the world sleeps)"
        elif 6 <= h < 12:
            diurnal_period = "morning (6am to noon)"
        elif 12 <= h < 18:
            diurnal_period = "afternoon"
        elif 18 <= h < 23:
            diurnal_period = "evening"
        else:
            diurnal_period = "late night (approaching midnight)"

    system_prompt = (
        "You are the sharp, witty, cultured personal AI companion for PETTR "
        "(Personal Errands, Task Tracker & Repository), an executive dashboard for coursework, "
        "engineering craft, personal life, and high-focus productivity.\n"
        "Your task is to generate:\n"
        "1. Exactly 5 intelligent, articulate, slightly longer typewriter greeting lines for the user's dashboard banner "
        "that make genuine sense rather than generic slogans.\n"
        "2. Exactly 1 fascinating, genuine fun fact or historical event relevant to today's date "
        "(spanning science, computing, space, engineering, biology, history, or everyday human invention).\n"
        "Return ONLY a valid JSON object: {\"phrases\": [\"line 1\", \"line 2\", \"line 3\", \"line 4\", \"line 5\"], \"fact\": \"Fun fact string...\"}."
    )

    milestone_hint = f"Context / anniversary hint: {milestone_info}\n" if milestone_info else ""
    user_prompt = (
        f"Today's date: {date_str}.\n"
        f"Current time window: {diurnal_period.capitalize()}.\n"
        f"User's name: {user_name}.\n\n"
        "Task 1 — Dashboard Typewriter Greetings ('phrases'):\n"
        f"1. Generate exactly 5 intelligent, articulate, characterful typewriter greeting lines for {user_name}.\n"
        "2. Avoid generic corporate or gym motivational clichés (do NOT use empty slogans like 'Start strong!', 'Midday boost!', 'Crush your goals!', or 'Wrap it up!').\n"
        f"3. Allow lines to be slightly longer complete thoughts (8 to 16 words, roughly 45 to 95 characters) so they make genuine sense and have substance.\n"
        f"4. Frame them as a sharp, cultured, slightly witty personal companion: focus on engineering craft, deep problem-solving, coursework, deliberate focus, or wry observations about daily momentum.\n"
        f"5. Keep lines strictly appropriate for the current {diurnal_period} time window or universally time-neutral (high-leverage focus, flow state, steady cadence).\n"
        "6. DO NOT mix contradictory times of day (no morning wake-up phrases in afternoon/evening, no evening wrap-up phrases in morning/afternoon).\n"
        "7. DO NOT force puns or thematic tie-ins to the fun fact or historical milestone. Keep the greetings independently focused on personal momentum and craft.\n"
        f"8. Address or mention {user_name} naturally in at least two lines.\n\n"
        "Task 2 — Historical Fun Fact ('fact'):\n"
        f"1. Provide exactly 1 genuinely fascinating, true historical event, scientific breakthrough, or curious invention from this calendar date in history ({target_date.strftime('%B %d')}).\n"
        f"{milestone_hint}"
        "2. Keep it concise (1 to 2 sentences, 15 to 30 words).\n\n"
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
                    "num_predict": 450
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

                    cleaned = []
                    for p in raw_phrases:
                        if isinstance(p, str):
                            s = p.strip().strip('"').strip("'")
                            if s and len(s) > 5 and len(s) < 130:
                                cleaned.append(s)

                    if isinstance(fact_str, str):
                        fact_str = fact_str.strip().strip('"').strip("'")
                        if len(fact_str) < 5 or len(fact_str) > 250:
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

async def get_or_generate_daily_intel(target_date: Optional[datetime.date] = None,
                                      user_name: str = "Hong Rong",
                                      force_refresh: bool = False,
                                      client_hour: Optional[int] = None,
                                      db_path: Optional[Path] = None) -> Dict[str, Any]:
    """
    Fetches daily intelligence and typewriter lines.
    Checks the daily SQLite cache first; generates fresh lines via LLM if missing or forced,
    and seamlessly falls back to the curated milestone engine if LLM is offline.
    """
    today = target_date or datetime.date.today()
    date_key = today.strftime("%Y-%m-%d")
    date_label = today.strftime("%A, %B %d")

    fact = get_historical_milestone_or_fact(today)
    default_subtext = f"{date_label} · 💡 {fact}"

    # 1. Check SQLite Cache
    if not force_refresh:
        cached = database.get_daily_typewriter_cache(date_key, db_path)
        if cached and cached.get("phrases") and len(cached["phrases"]) > 0:
            cached_subtext = cached.get("subtext") or default_subtext
            if "·" not in cached_subtext and "💡" not in cached_subtext:
                cached_subtext = default_subtext
            # Upgrade stale sprint slogans (e.g. "Thursday thrust", "Deep work sprint") to genuine fun facts
            if any(slogan in cached_subtext for slogan in ["Thursday thrust", "Wednesday wave", "Tuesday tempo", "Monday momentum", "Friday finale", "Saturday scan", "Sunday synch", "Deep work sprint"]):
                cached_subtext = default_subtext

            phrases_to_return = cached["phrases"]
            # Upgrade stale legacy short fallback phrases if present
            if any(legacy in p for p in phrases_to_return for legacy in ["Orbital telemetry nominal", "First coffee, then tasks", "Systems primed for takeoff", "First coffee, then the deep work,"]):
                phrases_to_return = get_curated_phrases(today, user_name, fact, client_hour=client_hour)

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
                "milestone": fact,
                "source": "cache",
                "cached": True
            }

    # 2. Generate via LLM
    import inspect
    sig = inspect.signature(generate_llm_typewriter_lines)
    if "client_hour" in sig.parameters:
        llm_res = await generate_llm_typewriter_lines(today, user_name, fact, client_hour=client_hour)
    else:
        llm_res = await generate_llm_typewriter_lines(today, user_name, fact)

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
        chosen_fact = llm_fact or fact
    else:
        source = "curated_fallback"
        final_phrases = get_curated_phrases(today, user_name, fact, client_hour=client_hour)
        chosen_fact = fact

    subtext = f"{date_label} · 💡 {chosen_fact}"

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
        "milestone": chosen_fact,
        "source": source,
        "cached": False
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
    chosen_fact = get_historical_milestone_or_fact(today)
    date_label = today.strftime("%A, %B %d")
    subtext = f"{date_label} · {chosen_fact}"

    return {
        "date": date_key,
        "date_label": date_label,
        "phrases": get_curated_phrases(today, user_name, chosen_fact),
        "subtext": subtext,
        "milestone": chosen_fact,
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
