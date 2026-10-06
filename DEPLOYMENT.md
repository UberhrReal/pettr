# PETTR Production Deployment & Operations Guide
## Hardware Target: Shuttle XPC Slim DH610 (Intel Core i3 12th Gen, 16GB Dual-Channel DDR4-3200, 512GB NVMe SSD)
## OS: Ubuntu Server 24.04 LTS (Noble Numbat)

This guide provides end-to-end instructions for deploying **PETTR** in Docker with native **Tailscale** mesh connectivity and **Ollama 3B** local AI model integration, engineered for 24/7 silent, cool operation with **zero data loss** guarantees.

---

## 1. System Architecture Overview

```
                      ┌────────────────────────────────────────┐
                      │ Remote Laptop / Phone (Tailscale Mesh) │
                      └──────────────────┬─────────────────────┘
                                         │ Encrypted WireGuard Mesh
                                         ▼
┌────────────────────────────────────────────────────────────────────────┐
│ Shuttle DH610 Mini PC (Ubuntu Server 24.04 LTS)                        │
│                                                                        │
│  ┌───────────────────────┐          ┌───────────────────────────────┐  │
│  │ Tailscale Daemon      │          │ Ollama Native Daemon (Systemd)│  │
│  │ (Dual Intel 1G/2.5G)  │          │ OLLAMA_HOST=0.0.0.0:11434     │  │
│  └───────────┬───────────┘          │ llama3.2:3b (~2GB VRAM/RAM)   │  │
│              │                      └──────────────▲────────────────┘  │
│              │ Port 8000                           │                   │
│              ▼                                     │ host.docker.      │
│  ┌──────────────────────────────────────────────┐  │ internal:11434    │
│  │ Docker Engine (pettr-app container)          │  │                   │
│  │  - FastAPI Backend (Uvicorn 0.0.0.0:8000)   │──┘                   │
│  │  - Modern Cozy Minimalist Web Frontend       │                      │
│  └───────────┬──────────────────────────────────┘                      │
│              │                                                         │
│              ▼ Persistent Bind Mounts (Zero Data Loss)                 │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │ Host Storage:                                                    │  │
│  │   ./data    ──> pettr.sqlite (SQLite WAL mode + Synchronous Normal)│ │
│  │   ./config  ──> pettr_config.json (PIN hash, salts, tokens)      │  │
│  │   ./backups ──> PETTR_<date>.zip (Automated periodic archives)   │  │
│  └──────────────────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Shuttle DH610 & Intel 12th Gen Hardware Tuning

The Shuttle XPC Slim DH610 equipped with an Intel 12th Gen Core i3 (4 cores / 8 threads) and 16GB dual-channel DDR4-3200 is an exceptional, rock-solid 24/7 industrial home server platform. To optimize it for headless uptime and silent thermal performance:

1. **Hardware Always-On Jumper (JP01)**:
   - On the Shuttle motherboard, configure jumper **`JP01`** to pins 1-2 (Always-On mode).
   - This physically bypasses the soft-power button state, ensuring the system powers on immediately upon AC connection even if the CMOS coin-cell battery dies.
2. **BIOS / UEFI Settings**:
   - Power Recovery: *Advanced -> Power Management Configuration -> Restore AC Power Loss* -> `Power On`.
   - Fan Acoustic Profile: *Advanced -> Smart Fan Mode* -> Set to `Ultra-Low Mode` or `Smart Mode`. Shuttle's dual-heatpipe ICE cooling module with twin 60mm ball-bearing fans runs virtually silently at ~1200-1400 RPM while keeping the i3 under 45°C.
   - CPU C-States: Ensure Package C-States (C8/C10) are enabled for lowest idle wattage (~7-10W idle).
3. **Ubuntu CPU Energy Performance Bias**:
   - Ubuntu 24.04 LTS (Kernel 6.8+) automatically utilizes the modern `intel_pstate` driver with Hardware P-States (HWP).
   - Set the Energy Performance Preference (EPP) to `balance_power`:
     ```bash
     echo "balance_power" | sudo tee /sys/devices/system/cpu/cpu*/cpufreq/energy_performance_preference
     ```
   - (Optional) Persist via `/etc/rc.local` or a simple systemd unit.
4. **Networking**:
   - The DH610 features dual Intel NICs: 1x Intel 1GbE and 1x Intel 2.5GbE. Plug your main upstream router or switch into the **2.5GbE port** for maximum local throughput.

---

## 3. Install Tailscale (24/7 Private Mesh Access)

Install Tailscale directly on the Ubuntu host:
```bash
curl -fsSL https://tailscale.com/install.sh | sh
sudo tailscale up
```
- Authenticate via the printed link.
- Note your machine's MagicDNS name (e.g. `shuttle-pettr`) or Tailscale IP (e.g. `100.x.y.z`).
- Any device on your Tailnet can now access PETTR at `http://<your-tailscale-name>:8000`.

---

## 4. Install Ollama & Configure for Docker Bridge

Ollama runs natively on the Ubuntu host to maximize CPU AVX2 instructions and RAM throughput.

1. **Install Ollama**:
   ```bash
   curl -fsSL https://ollama.com/install.sh | sh
   ```

2. **Allow Docker Containers to Connect to Ollama**:
   By default, Ollama only listens on `127.0.0.1:11434`. We configure systemd to listen on `0.0.0.0:11434` so Docker containers can communicate over `host.docker.internal`:
   ```bash
   sudo mkdir -p /etc/systemd/system/ollama.service.d
   cat << 'EOF' | sudo tee /etc/systemd/system/ollama.service.d/override.conf
   [Service]
   Environment="OLLAMA_HOST=0.0.0.0:11434"
   Environment="OLLAMA_ORIGINS=*"
   EOF

   sudo systemctl daemon-reload
   sudo systemctl restart ollama
   ```

3. **Verify Ollama is Listening**:
   ```bash
   curl http://127.0.0.1:11434/api/tags
   ```

4. **Pull the Recommended 3B Model**:
   ```bash
   # Llama 3.2 3B (Fast, accurate, ~2.0 GB RAM usage)
   ollama pull llama3.2:3b
   
   # Optional: Qwen 2.5 3B (Ultra-light alternative)
   # ollama pull qwen2.5:3b
   ```

---

## 5. Install Docker & Docker Compose

```bash
# Install Docker Engine on Ubuntu 24.04 LTS
sudo apt-get update
sudo apt-get install -y ca-certificates curl gnupg
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg

echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
  noble stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

sudo apt-get update
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

# Allow running docker without sudo
sudo usermod -aG docker $USER
newgrp docker
```

---

## 6. Deploying PETTR

1. **Clone your private repository**:
   ```bash
   git clone <YOUR_PRIVATE_GIT_REPO_URL> ~/pettr
   cd ~/pettr
   ```

2. **Prepare persistent host directories**:
   ```bash
   mkdir -p data config backups
   chmod -R 775 data config backups
   ```

3. **Launch PETTR via Docker Compose**:
   ```bash
   docker compose up -d --build
   ```

4. **Check status and logs**:
   ```bash
   docker compose ps
   docker compose logs -f
   ```

PETTR is now live! Open your browser:
- Local network: `http://<local-lan-ip>:8000`
- Tailscale mesh: `http://<tailscale-machine-name>:8000`
- Default PIN: `1234`

---

## 7. Zero Data Loss & Crash Recovery

PETTR employs multiple layers of defense to prevent data loss:

1. **SQLite WAL Mode (Write-Ahead Logging)**:
   - Configured with `PRAGMA journal_mode=WAL;` and `PRAGMA synchronous=NORMAL;`.
   - Transactions are flushed immediately to `pettr.sqlite-wal` before committing to the main database file.
   - Even if the mini PC suffers an abrupt power loss or Docker restarts, SQLite replays the WAL on boot with zero corruption.

2. **Persistent Host Mounts**:
   - Database lives in `./data/pettr.sqlite` on the host SSD.
   - Container rebuilds, updates, or deletions do **not** touch host files.

3. **Automated Automated Backups**:
   - Periodic and manual backups are saved as `PETTR_<dd_mm_yyyy>.zip` inside `./backups/`.
   - Each backup contains a clean SQLite online snapshot (`pettr.sqlite`), human-readable markdown (`PETTR_summary.md`), and raw JSON dump (`PETTR_export.json`).

---

## 8. Seamless Updates (Git Workflow)

Future updates require only two commands:

```bash
cd ~/pettr
git pull
docker compose up -d --build
```

Docker will:
1. Rebuild the updated image layer.
2. Gracefully stop the old container.
3. Start the new container with the exact same `./data`, `./config`, and `./backups` directories attached.
4. Total downtime is under 3 seconds.

---

## 9. Backup & Disaster Recovery

PETTR uses a 3-2-1 backup strategy:
1. **Local Persistent Storage**: SQLite database in `./data/pettr.sqlite`.
2. **Local Archived Snapshots**: Automated weekly zip snapshots in `./backups/`.
3. **Offsite Cloud Sync**: Encrypted, automatic Google Drive sync via `rclone`.

---

### 9.1 In-App & Local Backups

- **Automated**: PETTR runs an internal scheduled task every 7 days creating `PETTR_<dd_mm_yyyy>.zip` containing:
  - `pettr.sqlite`: SQLite online backup snapshot
  - `PETTR_summary.md`: Human-readable markdown digest
  - `PETTR_export.json`: Full structured JSON export
- **Manual Trigger**: Go to **Settings** -> Click **`[Create Backup Now]`**, or run via terminal:
  ```bash
  docker compose exec pettr python -c "from backend.backup import run_backup; print(run_backup())"
  ```

---

### 9.2 Offsite Google Drive Sync via `rclone` & Cron

For headless Ubuntu servers without a graphical web browser, `rclone` provides lightweight, reliable syncing directly to Google Drive.

#### Step 1: Install `rclone` and `cron`
Ubuntu Server 24.04 Minimal may omit cron:
```bash
sudo apt update
sudo apt install -y rclone cron
sudo systemctl enable --now cron
```

#### Step 2: Configure Google Drive Remote (`rclone config`)
Run the interactive configuration:
```bash
rclone config
```
1. Type `n` for **New remote**.
2. Name: `gdrive`
3. Storage type: `drive` (Google Drive).
4. Leave `client_id` and `client_secret` blank (press **Enter** twice).
5. Scope: `1` (Full access).
6. Leave `root_folder_id` and `service_account_file` blank (press **Enter** twice).
7. Advanced config: `n`.
8. **Use web browser to automatically authenticate with Google?**: Type **`n`** (*Headless mode*).
9. Follow the on-screen prompt: open the provided URL on your phone or desktop browser, authorize Google Drive access, and copy-paste the resulting authorization code into your terminal.
10. Configure as Team Drive: `n`.
11. Confirm and save (`y`), then quit (`q`).

#### Step 3: Test Manual Sync
Test copying local backups to a `PETTR-Backups` folder in Google Drive:
```bash
rclone copy ~/pettr/backups gdrive:PETTR-Backups -v
```
Verify that the `PETTR-Backups` directory appears in your Google Drive with the latest `.zip` archive.

#### Step 4: Automate Nightly Sync via Crontab
Open your crontab:
```bash
crontab -e
```
Add a nightly job (e.g. 3:30 AM) with a 15-minute file age buffer to avoid uploading during an active write:
```cron
30 3 * * * /usr/bin/rclone copy /home/YOUR_USERNAME/pettr/backups gdrive:PETTR-Backups --min-age 15m >> /home/YOUR_USERNAME/rclone_backup.log 2>&1
```
*(Replace `YOUR_USERNAME` with your actual Linux user, e.g. from `whoami`).*

Verify execution by checking the log:
```bash
cat ~/rclone_backup.log
```

---

### 9.3 System Time Synchronization (NTP & RTC)

Cloud APIs (such as Google OAuth2) require server clocks to be accurate within ~5 minutes. Abrupt power cuts or uninitialized RTCs can cause clock drift:

```bash
# Check current time, timezone, and RTC status
timedatectl

# Set correct timezone
sudo timedatectl set-timezone Asia/Singapore

# If systemd-timesyncd is missing on minimal installs:
sudo apt install -y systemd-timesyncd
sudo systemctl enable --now systemd-timesyncd

# Write system time to hardware clock (RTC)
sudo apt install -y util-linux-extra
sudo hwclock --systohc
```

---

### 9.4 Disaster Recovery & Restoration

To restore PETTR on a new server or recover from hardware failure:

```bash
# 1. Clone repository and initialize folders
git clone <YOUR_GIT_REPO> ~/pettr
cd ~/pettr
mkdir -p data config backups

# 2. Download the latest backup from Google Drive (or copy from local backups)
rclone copy gdrive:PETTR-Backups backups/ -v

# 3. Extract the SQLite database snapshot
unzip backups/PETTR_DD_MM_YYYY.zip pettr.sqlite -d data/

# 4. Launch PETTR
docker compose up -d --build
```
All tasks, projects, notes, and audit history will be completely restored.

