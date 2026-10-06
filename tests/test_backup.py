import zipfile
import datetime
from pathlib import Path
from backend import database
from backend.backup import run_backup

def test_backup_generation(tmp_path):
    db_file = tmp_path / "test_backup.sqlite"
    database.init_db(db_file)
    
    # Add dummy project and task
    database.create_task(
        title="Prepare for finals",
        tier="focus",
        project_name="Degree Capstone",
        due_date="2026-09-27 23:59:00",
        db_path=db_file
    )
    database.save_note("Remember to check email", title="Important Note", db_path=db_file)

    backup_folder = tmp_path / "gdrive_backups"
    res = run_backup(target_dir=backup_folder, db_path=db_file)

    assert res["status"] == "success"
    zip_path = Path(res["path"])
    assert zip_path.exists()
    assert zip_path.name.startswith("PETTR_")
    assert zip_path.suffix == ".zip"

    # Inspect zip contents
    with zipfile.ZipFile(zip_path, "r") as z:
        files = z.namelist()
        assert "pettr.sqlite" in files
        assert "PETTR_summary.md" in files
        assert "PETTR_export.json" in files
        
        md_content = z.read("PETTR_summary.md").decode("utf-8")
        assert "Degree Capstone" in md_content
        assert "Prepare for finals" in md_content
        assert "Remember to check email" in md_content
