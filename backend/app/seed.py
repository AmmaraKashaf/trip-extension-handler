"""Reset and seed demo data. Run with `python -m app.seed` or POST /demo/reset.

Dates are relative to today so the demo never goes stale.
Each vehicle demonstrates one outcome (see Spec.md section 7).
"""

from datetime import datetime, timedelta, timezone
from decimal import Decimal
from typing import Any

from app.db import supabase

# Supabase refuses unfiltered deletes, so match every row with a filter no id can fail.
NIL_UUID = "00000000-0000-0000-0000-000000000000"


def today_at_10_utc() -> datetime:
    now = datetime.now(timezone.utc)
    return now.replace(hour=10, minute=0, second=0, microsecond=0)


def booking_row(
    vehicle: dict[str, Any], renter: str, start: datetime, days: int, status: str,
) -> dict[str, Any]:
    total = days * Decimal(str(vehicle["daily_rate"]))
    return {
        "vehicle_id": vehicle["id"],
        "renter_name": renter,
        "start_at": start.isoformat(),
        "end_at": (start + timedelta(days=days)).isoformat(),
        "status": status,
        "total_amount": str(total),
    }


def reset_demo_data() -> None:
    supabase.table("bookings").delete().neq("id", NIL_UUID).execute()
    supabase.table("vehicles").delete().neq("id", NIL_UUID).execute()

    vehicles = supabase.table("vehicles").insert([
        {"name": "Tesla Model 3", "plate": "EV-3001", "daily_rate": "90.00"},
        {"name": "Jeep Wrangler", "plate": "JP-4410", "daily_rate": "110.00"},
        {"name": "Toyota RAV4", "plate": "RV-7520", "daily_rate": "75.00"},
        {"name": "Honda Civic", "plate": "HC-5503", "daily_rate": "55.00"},
    ]).execute().data
    by_name = {v["name"]: v for v in vehicles}
    tesla, jeep = by_name["Tesla Model 3"], by_name["Jeep Wrangler"]
    rav4, civic = by_name["Toyota RAV4"], by_name["Honda Civic"]

    t = today_at_10_utc()
    day = timedelta(days=1)
    active_start = t - day  # every active trip lasts 2 days and ends at T+1d

    bookings = [
        # Tesla: only a cancelled booking follows, which must be ignored -> accept.
        booking_row(tesla, "Priya Shah", t - 10 * day, 3, "completed"),
        booking_row(tesla, "Ava Martinez", active_start, 2, "active"),
        booking_row(tesla, "Leo Fischer", t + day + timedelta(hours=2), 2, "cancelled"),
        # Jeep: next pickup T+4d -> 5 days counter-offers 2, 2 days accepts.
        booking_row(jeep, "Ben Carter", active_start, 2, "active"),
        booking_row(jeep, "Mia Rossi", t + 4 * day, 2, "upcoming"),
        # RAV4: next pickup only 4h after return -> decline.
        booking_row(rav4, "Chloe Nguyen", active_start, 2, "active"),
        booking_row(rav4, "Omar Haddad", t + day + timedelta(hours=4), 2, "upcoming"),
        # Civic: next pickup T+2d 13:00 -> 1 day hits the buffer exactly (accept), 2 counter-offers 1.
        booking_row(civic, "Dan Okafor", active_start, 2, "active"),
        booking_row(civic, "Sara Lindqvist", t + 2 * day + timedelta(hours=3), 2, "upcoming"),
    ]
    supabase.table("bookings").insert(bookings).execute()


if __name__ == "__main__":
    reset_demo_data()
    print("Demo data reset.")
