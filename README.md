# PETTR: Personal Errands, Task Tracker & Repository

A 24/7 self-hosted, lightweight personal productivity hub designed to run on a low-cost home mini PC, accessible securely from any browser or phone over Tailscale.

---

## Key Features

- **24/7 Always-On Self-Hosted Node**: Runs on your home mini PC with zero router ports opened; accessible securely anywhere over Tailscale WireGuard mesh.
- **Hybrid Parsing Engine**:
  - Deterministic natural date/time parser: military time (`2359`, `Tonight 2359`), relative intervals (`in 30 mins`, `tomorrow morning`), explicit commands (`!task`, `!event`, `!reminder`, `!project`), and recurring schedules (`every Tuesday night`).
  - Small local LLM layer (Ollama) with strictly enforced JSON schema output for intent categorisation and project matching.
  - Safe Heuristic Fallback: Automatically handles input if the local model is offline.
  - **Unorganized Queue**: Automatic safety net if classification is ambiguous. Items can be triaged or returned to the queue anytime with one click.
- **Cross-Device Tasking Priority Sequence**:
  - Drag and drop tasks, events, and projects into the execution order list.
  - Synchronized in real time across desktop, laptop, and mobile devices via persistent database storage (`daily_orders`).
  - Sequenced tasks are cleanly indicated in the left-hand snapshot view and sync status automatically when completed or reopened.
- **Evening Debrief & Immutable Day Sealing**:
  - End-of-day guided review triaging unfinished tasks (rollover to tomorrow, reschedule, or discard).
  - **Baseline Completion Rate Freeze**: Captures and records your day's actual completion metrics into `day_seals` *before* rollover occurs, preventing artificial 100% inflation.
  - **Day Sealing**: Permanently seals past/wrapped days from mutations, deletions, or late task insertions, preserving historical productivity score integrity.
- **Diurnal Solar Theming & Golden Hour Engine**:
  - **4 Diurnal Stages**:
    - 🌅 **Morning Dawn** (06:00 – 11:59): Crisp sunrise daylight (`[data-theme="morning"]`)
    - ☀️ **Daylight** (12:00 – 17:59): Balanced warm daylight (`[data-theme="light"]`)
    - 🌇 **Golden Hour Dusk** (18:00 – 21:59): Warm amber, honey, and roasted umber twilight with velvety blue undertone shadows (`[data-theme="evening"]`)
    - 🌙 **Obsidian Night** (22:00 – 05:59): Deep obsidian dark mode (`[data-theme="dark"]`)
  - **Atmospheric Blowing Leaves Canvas**: Atmospheric gusts of wind blow tumbling, 3D-fluttering autumn leaves across the canvas during Golden Hour.
  - **Interactive Solar Slider**: Scrub time of day from 00:00 to 23:00 with one click or set specific hour presets.
- **Daily Contextual Intel Typewriter Banner**:
  - Generates date-specific typewriter intelligence lines via local LLM at midnight every day (e.g., historical milestones, mission briefings).
  - SQLite daily cache prevents redundant LLM calls; top and bottom typewriter phrases never duplicate each other.
- **Intelligent Classification & Organization**:
  - **Projects**: Auto-added to the global pool on first mention (e.g. `"Social Science 1D"`, `"IDEA-1 Concept"`), segregated into **School** 🎓 and **External** 🌐 pools with distinct untaken colors.
  - **Redesigned Split View Pool Pills**: Capsule pill headers for School (Academic Violet/Indigo) and External (Radiant Amber/Gold) pools with theme-adaptive high contrast and subtle breathing pulses.
  - **Tasks**: Divided into **Focus** (deep work, exams, CAD, design) and **Trivial** (errands, chores, parcel pickup).
  - **Decoupled 'TIME SENSITIVE' Marker**: Manually toggled tag with distinct glowing orange badge to highlight time-critical tasks independently from raw due times.
  - **Urgency Color Coding**:
    - 🟧 **Bright Orange**: Due within $\le 2$ days ($\le 48\text{h}$) or overdue.
    - 🟩 **Green**: Due in $> 2$ days.
    - ⬜ **Grey**: No due date given.
- **Interactive Multi-Scale Timeline**:
  - Merged graphic timeline and detailed list views across **Day**, **Month**, and **Year** scales with zero clipping on mobile screens.
- **Exploded View (Global Project Pool)**:
  - **3D Constellation Cloud**: Interactive force-directed spherical graph visualizing project clusters and task dependencies with full mobile touch rotation and touch-scrollable filter pills dock.
  - **Structured Project Cards**: Progress bars, collapsible descriptions, task backlogs, and category sorting (`🎓 School 1st`, `🌐 External 1st`, `A–Z`).
- **Rich Scratchpad / Notes Tab**:
  - Inline WYSIWYG editing surface with immediate formatting.
  - Full markdown toolbar: Bold, Italic, Strikethrough, Headings, Bullet Lists, Interactive Checklists, Code Blocks, Quotes, and Tables.
  - Direct clipboard pasting (`Ctrl+V`) and drag-and-drop media uploads, permanently stored in `./data/media/` and served via `/static/media/`.
  - 1-click **"Send to PETTR Parser"** button to convert note content directly into organized tasks and events.
- **Mobile Simplified Mode**:
  - Lightweight, clutter-free mobile view presenting only today's tasks, events, and reminders with full drag-to-rearrange support and quick status toggling.
- **Overseas Travel-Proof Timezone Handling**:
  - Automatic browser timezone detection via `X-Client-Timezone` headers with manual override option in the top navigation bar.
- **Automated Cloud Backup Pipeline (3-2-1 Strategy)**:
  - Automated weekly `.zip` archives containing an SQLite snapshot, human-readable Markdown digest, and JSON export.
  - Integrated `rclone` syncs backups directly to Google Drive (`gdrive:PETTR_Backups`).
  - In-app **"Backup to Google Drive Now"** button with verified cloud sync status line, plus standalone direct browser download button.
- **4-Digit PIN Security**:
  - Rate-limited brute-force protection (lockout after 5 failed attempts).
  - Headless server PIN update support via CLI, Docker exec, or direct config.

---

## Mini PC Hardware Recommendations (Low-Cost & Power-Efficient)

For running PETTR and a lightweight local LLM 24/7 smoothly at home:

| Component | Recommendation | Why |
|---|---|---|
| **Form Factor** | **Shuttle XPC Slim DH610** or Mini PC (Beelink, GMKtec, Minisforum) | Shuttle DH610 features dual Intel NICs (1G + 2.5G), ICE twin-fan heatpipe cooling, and hardware always-on jumper (`JP01`). |
| **CPU** | **Intel Core i3-12100 / 12th Gen** or **Intel N100 / N97** | High single-thread speed for SQLite, AVX2 support for Ollama 3B inference (~15-25 tok/s), ultra-low idle wattage (~8-12W). |
| **RAM** | **16 GB DDR4/DDR5** (Dual-Channel) | 3B models need ~2.5 GB of RAM. 16 GB leaves ample headroom for Linux/Docker, Tailscale, Ollama, and SQLite caching without swap. |
| **Storage** | **256 GB - 512 GB NVMe SSD** | Fast boot, silent operation, plenty of room for WAL-mode SQLite, uploaded media, and local model weights. |
| **OS** | **Ubuntu Server 26.04.1 LTS** (Recommended) or Windows 11 | Ubuntu + Docker Compose provides zero-maintenance 24/7 reliability, automated rclone sync, and instant container updates. |

---

## Setup & Quickstart

### Deployment Options

- **Production (24/7 Ubuntu Server / Docker)**: See the comprehensive [DEPLOYMENT.md](DEPLOYMENT.md) for full guide (hardware jumper tuning, Tailscale mesh, native Ollama bridge, Docker Compose, systemd, and rclone).
  ```bash
  git clone https://github.com/UberhrReal/pettr.git ~/pettr
  cd ~/pettr
  docker compose up -d --build
  ```
- **Local Development (Windows / macOS / Linux)**:
  1. Clone repository and navigate into the folder:
     ```bash
     git clone https://github.com/UberhrReal/pettr.git
     cd pettr
     ```
  2. Create a virtual environment and install dependencies:
     ```bash
     python -m venv venv
     # Windows:
     .\venv\Scripts\activate
     # macOS/Linux:
     source venv/bin/activate

     pip install -r requirements.txt
     ```
  3. Start the application:
     ```bash
     # Windows batch launcher:
     .\run_server.bat

     # Or run directly via Python:
     python run_server.py
     ```

Open your browser to:
- **Local:** `http://127.0.0.1:8000`
- **Tailscale (from phone/laptop):** `http://<your-tailscale-name>:8000` or `http://100.x.y.z:8000`

---

## Managing Your PIN Headless

Default 4-digit code: **`1234`**

Because PETTR is designed to run headlessly on your server without a desktop GUI, you can update your PIN anytime via the terminal:

1. **Via Docker (Recommended)**:
   ```bash
   docker compose exec pettr python -m backend.cli set-pin <NEW_PIN>
   ```
2. **Via Local Python CLI**:
   ```bash
   python -m backend.cli set-pin <NEW_PIN>
   ```
3. **Direct Configuration File Edit**:
   ```bash
   nano config/pettr_config.json
   # Update "pin": "<NEW_PIN>"
   ```
4. **Via Settings UI**: If accessing from the hosting PC localhost directly (`127.0.0.1`), PIN change is also available in the Settings tab.

---

## Local LLM (Ollama) Setup

To enable local AI classification and daily typewriter intelligence:
- **Linux**: `curl -fsSL https://ollama.com/install.sh | sh`
- **Windows**: `winget install Ollama.Ollama`

Pull the recommended fast 3B model:
```bash
ollama pull llama3.2:3b
```
PETTR will automatically detect Ollama and route task intent classification through structured JSON schemas, falling back gracefully to heuristic parsing if Ollama is unreachable.

---

## Tailscale Remote Access

1. Install Tailscale on your server (`sudo tailscale up` on Linux or via desktop app).
2. Install Tailscale on your mobile phone / remote laptop and log into the same Tailnet.
3. Access PETTR securely from anywhere without port forwarding:
   `http://<your-tailscale-name>:8000`

---

## Automated Cloud Backups (3-2-1 Strategy)

- **Headless Linux (`rclone` + cron) — Recommended for 24/7 servers**:
  Configure `rclone` with Google Drive and add a nightly cron sync:
  ```bash
  # Test sync
  rclone copy ~/pettr/backups gdrive:PETTR_Backups -v

  # Nightly cron (via crontab -e)
  30 3 * * * /usr/bin/rclone copy /home/$USER/pettr/backups gdrive:PETTR_Backups --min-age 15m >> /home/$USER/rclone_backup.log 2>&1
  ```
- **In-App Cloud Trigger**: Click **"Backup to Google Drive Now"** in the Settings tab. PETTR generates a timestamped `.zip` containing the SQLite database snapshot, JSON export, and Markdown digest, and immediately syncs it to Google Drive with on-screen verification.
- **Direct Device Download**: Click **"Download Latest Backup (.zip)"** to download the archive directly to your current device without accessing Google Drive.
