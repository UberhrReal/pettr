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
  - **Projects**: Auto-added to the global pool on first mention (e.g. `"Social Science 1D"`, `"IDEA-1 Concept"`).
  - **Tasks**: Divided into **Focus** (deep work, exams, CAD, design) and **Trivial** (errands, chores, parcel pickup).
  - **Urgency Color Coding**:
    - 🟧 **Bright Orange**: Due within $\le 2$ days ($\le 48\text{h}$) or overdue.
    - 🟩 **Green**: Due in $> 2$ days.
    - ⬜ **Grey**: No due date given.
  - **Drag-and-Drop Reordering**: Hold and drag `≡` on each day to reorder priority.
  - **Events & Reminders**: Dedicated daily sections; reminders can be appended under tasks.
- **Top Daily Briefing**: Active focus/trivial counts, events, and a concise "Tomorrow's Outlook" blurb.
- **Exploded View**: Bird's-eye view of all projects, progress bars, and standalone backlog items.
- **Notes Tab**: Auto-saving scratchpad with a 1-click **"Send to PETTR Parser"** button.
- **Audit History**: Complete log of how deterministic parsing and LLM classification routed every raw input.
- **Weekly Google Drive Backup**: Automated weekly `.zip` archive containing a clean SQLite snapshot, human-readable Markdown digest, and JSON export.
- **4-Digit PIN Security**: Rate-limited brute-force protection (lockout after 5 attempts); PIN can **only** be changed directly on the hosting PC.

---

## Mini PC Hardware Recommendations (Low-Cost & Power-Efficient)

For running PETTR and a lightweight local LLM 24/7 smoothly at home:

| Component | Recommendation | Why |
|---|---|---|
| **CPU** | **Intel N100** / **N97** (e.g. Beelink S12 Pro, GMKtec G3, Minisforum UN100) or **AMD Ryzen 5 5500U/5560U** | Extremely low power draw (6W - 15W TDP idle/low load). Intel N100 runs ~$130-$160 USD and handles 3B quantized LLMs at ~8-15 tokens/sec. |
| **RAM** | **16 GB DDR4/DDR5** | 3B models need ~2.5 GB of RAM. 16 GB leaves ample headroom for Windows, background services, Tailscale, and PETTR without swap. |
| **Storage** | **256 GB - 512 GB NVMe SSD** | Fast boot, silent operation, plenty of room for SQLite and Ollama model weights (~2 GB). |
| **OS** | Windows 11 Home / Pro or Ubuntu Server | Windows runs Tailscale and Google Drive for Desktop out of the box. |

---

## Setup & Quickstart

### 1. Launching PETTR
On the host PC:
```powershell
cd C:\Users\User\.gemini\antigravity\scratch\pettr
.\run_server.bat
```
Or with Python:
```powershell
.\venv\Scripts\python.exe run_server.py
```
Open your browser to:
- **Local:** `http://127.0.0.1:8000`
- **Tailscale (from phone/laptop):** `http://<your-pc-tailscale-name>:8000`

### 2. Default PIN
- Default 4-digit code: **`1234`**
- Change your PIN anytime in **Settings** (when connected directly on the host PC) or via CLI:
  ```powershell
  .\venv\Scripts\python.exe -m backend.cli set-pin 5678
  ```

### 3. Local LLM (Ollama) Setup
To use local model classification, install Ollama:
1. Download from [ollama.com](https://ollama.com) or run:
   ```powershell
   winget install Ollama.Ollama
   ```
2. Pull the recommended fast 3B model:
   ```powershell
   ollama pull llama3.2:3b
   ```
   *(Alternative fast model: `ollama pull qwen2.5:3b`)*
3. Once running, PETTR will automatically route intent classification through Ollama with structured JSON outputs.

### 4. Tailscale Remote Access
1. Download Tailscale on your mini PC and log in (`tailscale up`).
2. Install Tailscale on your phone and laptop and log into the same account.
3. Access PETTR from anywhere on your phone by navigating to your mini PC's MagicDNS address or 100.x Tailnet IP:
   `http://minipc:8000`

### 5. Google Drive Weekly Backup (Option A)
1. Install **Google Drive for Desktop** on the host PC.
2. In `config/pettr_config.json`, set `backup_dir` to your Google Drive sync folder:
   ```json
   "backup_dir": "G:\\My Drive\\PETTR_Backups"
   ```
3. PETTR will automatically generate `PETTR_<dd_mm_yyyy>.zip` weekly, or click **"📦 Backup to Google Drive Now"** in the Settings tab anytime.
