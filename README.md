# PETTR: Personal Errands, Task Tracker & Repository

A 24/7 self-hosted, lightweight personal productivity hub designed to run on a low-cost home mini PC, accessible securely from any browser or phone over Tailscale.

---

## Key Features

- **24/7 Self-Hosted Node**: Runs on your home mini PC with zero router ports opened; accessible securely from any device via Tailscale WireGuard mesh.
- **Hybrid Parsing Engine**: Deterministic date/time parsing (`2359`, `in 30 mins`, `every Tuesday`) paired with a local Ollama LLM for structured intent categorisation, heuristic fallbacks, and an unorganised triage buffer.
- **Cross-Device Tasking Priority Sequence**: Drag-and-drop daily execution order enforcing single-focus tasking, synchronised in real time across mobile and desktop.
- **Evening Debrief & Day Sealing**: Guided end-of-day triage that freezes baseline completion rates before rollover, permanently sealing past days to preserve historical score integrity.
- **Diurnal Solar Theming**: Dynamic theme transitions across 4 diurnal stages (Dawn, Daylight, Golden Hour, Obsidian Night) with an interactive time-scrubbing solar slider.
- **Local AI Companion (`Alt+H`)**: Collapsible slide-out chat drawer powered by local Ollama models, featuring persistent multi-turn SQLite memory, live server telemetry, and real-time task schedule context.
- **Intelligent Categorisation**: Projects automatically segregated into School 🎓 and External 🌐 pools with distinct colours, Focus vs Trivial task tiers, and visual urgency indicators.
- **Interactive Timeline & 3D Constellation Cloud**: Unified Day, Month, and Year scale timelines paired with a force-directed 3D spherical constellation graph visualising project clusters and dependencies.
- **Rich Scratchpad & Media Folder**: WYSIWYG note editor with full Markdown formatting, 1-click parser triage, and a dedicated media manager with lightbox previews, direct note embeds, and file deletion.
- **Mobile Simplified Mode**: Clean, distraction-free view presenting only today's priority tasks and events with drag-to-rearrange support.
- **Automated Cloud Backup Pipeline**: 3-2-1 backup strategy with scheduled SQLite snapshots, Markdown digests, and direct `rclone` sync to Google Drive.
- **4-Digit PIN Security**: Rate-limited brute-force lockout with headless CLI configuration support.

---

## Hardware Recommendations

Optimised for low power draw (~8–12W idle) and 24/7 silent operation:

| Component | Recommendation | Details |
|---|---|---|
| **Form Factor** | **Shuttle XPC Slim DH610** or Mini PC (Intel N100 / Beelink) | Dual Intel NICs, robust heatpipe cooling, and always-on power jumper (`JP01`). |
| **CPU** | **Intel Core i3 (12th Gen+)** or **Intel N100 / N97** | Fast single-thread SQLite performance, AVX2 support for Ollama 3B inference (~15–25 tok/s). |
| **RAM** | **16 GB DDR4/DDR5** | ~2.5 GB reserved for 3B LLM weights; leaves ample headroom for Docker, Tailscale, and OS caching. |
| **Storage** | **256 GB – 512 GB NVMe SSD** | Fast WAL-mode SQLite database operations, media storage, and local model weights. |
| **OS** | **Ubuntu Server 24.04+ LTS** or Windows 11 | Ubuntu + Docker Compose provides zero-maintenance 24/7 reliability and automated systemd management. |

---

## Quickstart

### 1. Production (Docker Compose — Recommended)
See [DEPLOYMENT.md](DEPLOYMENT.md) for the complete production setup guide (Tailscale, systemd, and automated rclone backups).

```bash
git clone https://github.com/UberhrReal/pettr.git ~/pettr
cd ~/pettr
docker compose up -d --build
```

### 2. Local Development (Python)

```bash
git clone https://github.com/UberhrReal/pettr.git
cd pettr

# Set up virtual environment
python -m venv venv
# Windows:
.\venv\Scripts\activate
# macOS/Linux:
source venv/bin/activate

pip install -r requirements.txt

# Start server
python run_server.py
```

Access PETTR at:
- **Local:** `http://127.0.0.1:8000`
- **Tailscale:** `http://<your-tailscale-node>:8000`

---

## Local LLM (Ollama) Setup

PETTR integrates with local Ollama models for natural language task classification, midnight typewriter briefings, and local chat assistance.

1. **Install Ollama**:
   - **Linux**: `curl -fsSL https://ollama.com/install.sh | sh`
   - **Windows**: `winget install Ollama.Ollama`
   - **macOS**: `brew install ollama`

2. **Pull Preferred Model**:
   ```bash
   # Recommended fast 3B model (~2 GB RAM footprint):
   ollama pull llama3.2:3b
   ```

3. **Usage**:
   - The parser automatically uses the model for ambiguous input and falls back to heuristic parsing if Ollama is offline.
   - Press <kbd>Alt+H</kbd> or click the robot icon in the navigation bar to open the chat drawer.
   - Models can be switched anytime in Settings or via `/api/llm/select`.

---

## Managing Your PIN Headless

Default PIN: **`1234`**

Update your PIN from the terminal without desktop access:

```bash
# Docker:
docker compose exec pettr python -m backend.cli set-pin <NEW_PIN>

# Native Python:
python -m backend.cli set-pin <NEW_PIN>
```

Alternatively, edit `"pin": "<NEW_PIN>"` in `config/pettr_config.json`, or update it via the Settings tab when accessing from localhost.

---

## Tailscale Remote Access

1. Install Tailscale on your server host (`sudo tailscale up`).
2. Install Tailscale on your phone or laptop and authenticate on the same Tailnet.
3. Access PETTR securely from any network without port forwarding:
   `http://<your-tailscale-node>:8000`

---

## Automated Backups (3-2-1 Strategy)

- **Headless Linux (`rclone` + cron)**:
  ```bash
  # Nightly sync to Google Drive (via crontab -e)
  30 3 * * * /usr/bin/rclone copy /home/$USER/pettr/backups gdrive:PETTR_Backups --min-age 15m >> /home/$USER/rclone_backup.log 2>&1
  ```
- **In-App Trigger**: Click **"Backup to Google Drive Now"** in the Settings tab to generate a timestamped `.zip` (SQLite snapshot, JSON export, and Markdown digest) with immediate cloud sync verification.
- **Direct Download**: Click **"Download Latest Backup (.zip)"** in Settings to save an archive directly to your current device.
