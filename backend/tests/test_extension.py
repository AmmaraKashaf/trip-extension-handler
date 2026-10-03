from datetime import datetime, timedelta, timezone
from decimal import Decimal

from app.extension import decide_extension

TRIP_END = datetime(2026, 1, 10, 10, 0, tzinfo=timezone.utc)
RATE = Decimal("100.00")


def test_no_next_booking_accepts() -> None:
    result = decide_extension(TRIP_END, 3, None, RATE)

    assert result.decision == "accept"
    assert result.approved_days == 3
    assert result.new_end_at == TRIP_END + timedelta(days=3)
    assert result.extra_amount == Decimal("300.00")


def test_exact_buffer_boundary_accepts() -> None:
    # Return at +1d 10:00, next pickup at +1d 13:00: exactly the 3h buffer.
    next_pickup = TRIP_END + timedelta(days=1, hours=3)

    result = decide_extension(TRIP_END, 1, next_pickup, RATE)

    assert result.decision == "accept"
    assert result.approved_days == 1


def test_too_long_with_two_free_days_counter_offers() -> None:
    next_pickup = TRIP_END + timedelta(days=3)

    result = decide_extension(TRIP_END, 5, next_pickup, RATE)

    assert result.decision == "counter_offer"
    assert result.requested_days == 5
    assert result.approved_days == 2
    assert result.new_end_at == TRIP_END + timedelta(days=2)
    assert result.extra_amount == Decimal("200.00")


def test_inside_buffer_declines() -> None:
    # Only a 4h gap, so not even one full day fits before the 3h buffer.
    next_pickup = TRIP_END + timedelta(hours=4)

    result = decide_extension(TRIP_END, 1, next_pickup, RATE)

    assert result.decision == "decline"
    assert result.approved_days == 0
    assert result.new_end_at is None
    assert result.extra_amount == Decimal("0")
