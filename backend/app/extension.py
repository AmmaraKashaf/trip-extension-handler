"""Extension decision logic. Pure functions only: no DB, no HTTP, easy to test."""

from datetime import datetime, timedelta
from decimal import Decimal

from app.config import TURNAROUND_BUFFER_HOURS
from app.schemas import ExtensionDecision

ONE_DAY = timedelta(days=1)


def decide_extension(
    current_end: datetime,
    requested_days: int,
    next_pickup: datetime | None,  # start of the next upcoming booking on this vehicle
    daily_rate: Decimal,
) -> ExtensionDecision:
    requested_end = current_end + requested_days * ONE_DAY

    if next_pickup is None:
        return _accept(current_end, requested_days, daily_rate,
                       "No booking follows this trip. Extension approved.")

    latest_allowed_end = next_pickup - timedelta(hours=TURNAROUND_BUFFER_HOURS)

    # Inclusive: returning exactly at the buffer boundary is fine.
    if requested_end <= latest_allowed_end:
        return _accept(current_end, requested_days, daily_rate,
                       f"The car is free for the extra days, including the "
                       f"{TURNAROUND_BUFFER_HOURS}h turnaround buffer.")

    # Only whole days are offered, so round down.
    free_days = max(0, (latest_allowed_end - current_end) // ONE_DAY)

    if free_days >= 1:
        pickup_label = next_pickup.strftime("%a %H:%M UTC")
        return ExtensionDecision(
            decision="counter_offer",
            requested_days=requested_days,
            approved_days=free_days,
            new_end_at=current_end + free_days * ONE_DAY,
            extra_amount=free_days * daily_rate,
            reason=f"Only {free_days} day(s) are available before the next pickup "
                   f"({pickup_label}). Offering {free_days} instead of {requested_days}.",
        )

    return ExtensionDecision(
        decision="decline",
        requested_days=requested_days,
        approved_days=0,
        new_end_at=None,
        extra_amount=Decimal("0"),
        reason=f"The next pickup is too close. A {TURNAROUND_BUFFER_HOURS}h "
               "turnaround buffer is required.",
    )


def _accept(current_end: datetime, days: int, daily_rate: Decimal, reason: str) -> ExtensionDecision:
    return ExtensionDecision(
        decision="accept",
        requested_days=days,
        approved_days=days,
        new_end_at=current_end + days * ONE_DAY,
        extra_amount=days * daily_rate,
        reason=reason,
    )
