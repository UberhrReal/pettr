# PETTR: Personal Errands, Task Tracker & Repository

A 24/7 self-hosted, lightweight personal productivity hub designed to run on a low-cost home mini PC, accessible securely from any browser or phone over Tailscale.

---

## Key Features

- **24/7 Always-On Self-Hosted Node**: Runs on your home mini PC with zero router ports opened; accessible anywhere over Tailscale.
- **Hybrid Parsing Engine**:
  - Deterministic natural date/time parser: military time (`2359`, `Tonight 2359`), relative intervals (`in 30 mins`, `tomorrow morning`), and recurring schedules (`every Tuesday night`).
  - Small local LLM layer (Ollama) with strictly enforced JSON schema output for intent categorisation and project matching.
  - Safe Heuristic Fallback: Automatically kicks in if the local model is offline.
  - **Unorganized Queue**: Automatic safety net if classification is uncertain.
- **Intelligent Classification & Organization**:
  - **Projects**: Auto-added to the global pool on first mention (e.g. `"Social Science 1D"`, `"IDEA-1 Concept"`), categorized into **School** 🎓 and **External** 🌐 pools with distinct untaken colors.
  - **Tasks**: Divided into **Focus** (deep work, exams, CAD, design) and **Trivial** (errands, chores, parcel pickup).
  - **Urgency Color Coding**:
    - 🟧 **Bright Orange**: Due within $\le 2$ days ($\le 48\text{h}$) or overdue.
    - 🟩 **Green**: Due in $> 2$ days.
    - ⬜ **Grey**: No due date given.
  - **Drag-and-Drop Reordering**: Hold and drag `≡` on each day to reorder priority.
  - **Events & Reminders**: Dedicated daily sections; reminders can be appended under tasks.
- **Top Daily Briefing**: Active focus/trivial counts, events, and a concise "Tomorrow's Outlook" blurb.
- **Exploded View (Global Project Pool)**:
  - **3D Constellation Cloud**: Interactive force-directed spherical graph visualizing project clusters and task dependencies with full mobile touch rotation and pinch-to-zoom.
  - **Structured Project Cards**: Progress bars, collapsible descriptions, task backlogs, and category-first sorting (`🎓 School 1st`, `🌐 External 1st`, `A–Z`).
- **Mobile Simplified Mode**: Lightweight, clutter-free mobile view presenting only today's tasks, events, and reminders with full drag-to-rearrange support.
- **Notes Tab**: Auto-saving scratchpad with a 1-click **"Send to PETTR Parser"** button.
- **Audit History**: Complete log of how deterministic parsing and LLM classification routed every raw input.
- **Weekly Google Drive Backup**: Automated weekly `.zip` archive containing a clean SQLite snapshot, human-readable Markdown digest, and JSON export.
- **4-Digit PIN Security**: Rate-limited brute-force protection (lockout after 5 attempts); PIN can **only** be changed directly on the hosting PC.

---

## Mini PC Hardware Recommendations (Low-Cost & Power-Efficient)

For running PETTR and a lightweight local LLM 24/7 smoothly at home:

| Component | Recommendation | Why |
|---|---|---|
| **Form Factor** | **Shuttle XPC Slim DH610** or Mini PC (Beelink, GMKtec, Minisforum) | Shuttle DH610 features dual Intel NICs (1G + 2.5G), ICE twin-fan heatpipe cooling, and hardware always-on jumper (`JP01`). |
| **CPU** | **Intel Core i3-12100 / 12th Gen** or **Intel N100 / N97** | High single-thread speed for SQLite, AVX2 support for Ollama 3B inference (~15-25 tok/s), ultra-low idle wattage (~8-12W). |
| **RAM** | **16 GB DDR4/DDR5** (Dual-Channel) | 3B models need ~2.5 GB of RAM. 16 GB leaves ample headroom for Linux/Docker, Tailscale, Ollama, and SQLite caching without swap. |
| **Storage** | **256 GB - 512 GB NVMe SSD** | Fast boot, silent operation, plenty of room for WAL-mode SQLite and local model weights. |
| **OS** | **Ubuntu Server 24.04 LTS** (Recommended) or Windows 11 | Ubuntu + Docker Compose provides zero-maintenance 24/7 reliability, automated cron rclone sync, and instant container updates. |

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

### Default PIN
- Default 4-digit code: **`1234`**
- Change your PIN anytime in **Settings** (when connected directly on the host PC) or via CLI:
  ```powershell
  python -m backend.cli set-pin 5678
  ```

### Local LLM (Ollama) Setup
To use local model classification, install Ollama:
- **Linux**: `curl -fsSL https://ollama.com/install.sh | sh`
- **Windows**: `winget install Ollama.Ollama`

Pull the recommended fast 3B model:
```bash
ollama pull llama3.2:3b
```
PETTR will automatically detect Ollama and route task intent classification through structured JSON schemas.

### Tailscale Remote Access
1. Install Tailscale on your server (`sudo tailscale up` on Linux or via desktop app).
2. Install Tailscale on your mobile phone / remote laptop and log into the same Tailnet.
3. Access PETTR securely from anywhere without port forwarding.

### Automated Cloud Backups (3-2-1 Strategy)

- **Option A: Headless Linux (`rclone` + cron) — Recommended for 24/7 servers**:
  Configure `rclone` with Google Drive and add a nightly cron sync:
  ```bash
  # Test sync
  rclone copy ~/pettr/backups gdrive:PETTR-Backups -v

  # Nightly cron (via crontab -e)
  30 3 * * * /usr/bin/rclone copy /home/$USER/pettr/backups gdrive:PETTR-Backups --min-age 15m >> /home/$USER/rclone_backup.log 2>&1
  ```
- **Option B: Windows (Google Drive for Desktop)**:
  Install Google Drive for Desktop and set `backup_dir` in `config/pettr_config.json`:
  ```json
  "backup_dir": "G:\\My Drive\\PETTR_Backups"
  ```
- **In-App Trigger**: Click **"📦 Create Backup Now"** in the Settings tab to instantly generate and archive a timestamped `.zip` containing the SQLite database, JSON export, and Markdown digest.

