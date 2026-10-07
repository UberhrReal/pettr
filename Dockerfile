# PETTR Production Dockerfile (Ubuntu 26.04.1 LTS / Debian slim)
FROM python:3.12-slim

# Prevent Python from writing .pyc files and enable unbuffered logging
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PETTR_DATA_DIR=/app/data \
    PETTR_CONFIG_DIR=/app/config \
    PETTR_BACKUP_DIR=/app/backups \
    OLLAMA_URL=http://host.docker.internal:11434

WORKDIR /app

# Install minimal OS dependencies for healthchecks, rclone GDrive backups & SQLite tools
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    sqlite3 \
    rclone \
    && rm -rf /var/lib/apt/lists/*

# Install Python requirements
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application source
COPY backend/ ./backend/
COPY config/ ./config/
COPY frontend/ ./frontend/
COPY run_server.py .

# Create persistent storage directories
RUN mkdir -p /app/data /app/config /app/backups

# Binds to 0.0.0.0:8000 for local and Tailscale access
EXPOSE 8000

# Health check against PETTR network status API
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD curl -f http://localhost:8000/api/network/status || exit 1

CMD ["python", "run_server.py"]
