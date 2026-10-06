@echo off
cd /d "%~dp0"
title PETTR Home Server (24/7)
echo Starting PETTR in virtual environment...
call venv\Scripts\activate.bat
python run_server.py
pause
