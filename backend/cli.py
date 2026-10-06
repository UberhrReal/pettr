import sys
import argparse
from pathlib import Path
from config.config import update_pin, get_or_create_config, DEFAULT_CONFIG_PATH
from backend.backup import run_backup
from backend import database

def main():
    parser = argparse.ArgumentParser(description="PETTR Host Administration CLI")
    subparsers = parser.add_subparsers(dest="command", help="Available commands")

    # set-pin
    pin_parser = subparsers.add_parser("set-pin", help="Set or update the 4-digit security PIN")
    pin_parser.add_argument("pin", type=str, help="New 4-digit PIN (e.g. 1234)")

    # backup
    backup_parser = subparsers.add_parser("backup", help="Trigger an immediate manual backup")

    # status
    status_parser = subparsers.add_parser("status", help="Display PETTR system configuration and statistics")

    args = parser.parse_args()

    if args.command == "set-pin":
        success, msg = update_pin(args.pin)
        if success:
            print(f"[OK] {msg}")
        else:
            print(f"[ERROR] {msg}")
            sys.exit(1)

    elif args.command == "backup":
        print("[INFO] Initiating backup...")
        res = run_backup()
        print(f"[OK] Backup saved to: {res['path']} ({res['size_bytes']} bytes)")

    elif args.command == "status":
        cfg = get_or_create_config()
        briefing = database.get_daily_briefing()
        print("\n=== PETTR Host Status ===")
        print(f"Host:       {cfg.get('host')}:{cfg.get('port')}")
        print(f"Ollama URL: {cfg.get('ollama_url')} (Model: {cfg.get('ollama_model')})")
        print(f"Backup Dir: {cfg.get('backup_dir')}")
        print(f"Projects:   {briefing['active_projects_count']} active")
        print(f"Today:      {briefing['focus_count']} Focus, {briefing['trivial_count']} Trivial, {briefing['events_count']} Events")
        print(f"Unorg:      {briefing['unorganized_count']} in queue")
        print("=========================\n")

    else:
        parser.print_help()

if __name__ == "__main__":
    main()
