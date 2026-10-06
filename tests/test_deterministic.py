import datetime
import pytest
from backend.parser.deterministic import parse_deterministic_date

@pytest.fixture
def ref_now():
    # Friday, Sept 25, 2026, 17:30
    return datetime.datetime(2026, 9, 25, 17, 30, 0)

def test_military_time_and_cleaned_text(ref_now):
    input_text = "Work on design for IDEA-1 Concept. Tonight 2359"
    result = parse_deterministic_date(input_text, ref_datetime=ref_now)
    assert result["has_date"] is True
    assert "2026-09-25 23:59:00" in result["datetime_str"]
    assert "IDEA-1 Concept" in result["cleaned_text"]
    assert result["is_recurring"] is False

def test_recurring_entry(ref_now):
    input_text = "Take trash out every Tuesday night"
    result = parse_deterministic_date(input_text, ref_datetime=ref_now)
    assert result["has_date"] is True
    assert result["is_recurring"] is True
    assert result["rrule"] == "FREQ=WEEKLY;BYDAY=TU"
    assert "Take trash out" in result["cleaned_text"]

def test_relative_interval(ref_now):
    input_text = "Pick up parcel in 30 mins"
    result = parse_deterministic_date(input_text, ref_datetime=ref_now)
    assert result["has_date"] is True
    assert "2026-09-25 18:00:00" == result["datetime_str"]
    assert "Pick up parcel" in result["cleaned_text"]

def test_no_date(ref_now):
    input_text = "Just some random thought about life and physics"
    result = parse_deterministic_date(input_text, ref_datetime=ref_now)
    assert result["has_date"] is False
    assert result["datetime"] is None
    assert result["cleaned_text"] == input_text
