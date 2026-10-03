"""All HTTP endpoints. Thin layer: load data, call decide_extension, write back."""

from datetime import datetime
from decimal import Decimal
from uuid import UUID

from fastapi import APIRouter, HTTPException

from app.db import supabase
from app.extension import decide_extension
from app.schemas import Booking, ConfirmResponse, ExtensionDecision, ExtensionRequest, Vehicle
from app.seed import reset_demo_data

router = APIRouter()


@router.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@router.get("/vehicles")
def list_vehicles() -> list[Vehicle]:
    rows = supabase.table("vehicles").select("*, bookings(*)").order("name").execute().data
    vehicles = [Vehicle.model_validate(row) for row in rows]
    for vehicle in vehicles:
        vehicle.bookings.sort(key=lambda b: b.start_at)
    return vehicles


@router.post("/bookings/{booking_id}/extension/quote")
def quote_extension(booking_id: UUID, body: ExtensionRequest) -> ExtensionDecision:
    _, decision = quote(booking_id, body.days)
    return decision


@router.post("/bookings/{booking_id}/extension/confirm")
def confirm_extension(booking_id: UUID, body: ExtensionRequest) -> ConfirmResponse:
    # Re-run the decision right before writing, so a stale quote can't double-book the car.
    booking, decision = quote(booking_id, body.days)
    if decision.decision != "accept":
        raise HTTPException(status_code=409, detail=decision.reason)

    row = (
        supabase.table("bookings")
        .update({
            "end_at": decision.new_end_at.isoformat(),
            "total_amount": str(booking.total_amount + decision.extra_amount),
        })
        .eq("id", booking.id)
        .execute()
        .data[0]
    )
    return ConfirmResponse(booking=Booking.model_validate(row), decision=decision)


@router.post("/demo/reset")
def reset_demo() -> dict[str, str]:
    reset_demo_data()
    return {"status": "ok"}


def quote(booking_id: UUID, days: int) -> tuple[Booking, ExtensionDecision]:
    """Shared by quote and confirm: load, guard, find next pickup, decide."""
    booking, daily_rate = load_active_booking(booking_id)
    next_pickup = find_next_pickup(booking)
    decision = decide_extension(booking.end_at, days, next_pickup, daily_rate)
    return booking, decision


def load_active_booking(booking_id: UUID) -> tuple[Booking, Decimal]:
    rows = (
        supabase.table("bookings")
        .select("*, vehicles(daily_rate)")
        .eq("id", str(booking_id))
        .limit(1)
        .execute()
        .data
    )
    if not rows:
        raise HTTPException(status_code=404, detail="Booking not found.")

    booking = Booking.model_validate(rows[0])
    if booking.status != "active":
        raise HTTPException(
            status_code=409,
            detail=f"Only active bookings can be extended (this one is {booking.status}).",
        )
    return booking, Decimal(str(rows[0]["vehicles"]["daily_rate"]))


def find_next_pickup(booking: Booking) -> datetime | None:
    # Only 'upcoming' bookings block; cancelled and completed ones are ignored.
    rows = (
        supabase.table("bookings")
        .select("start_at")
        .eq("vehicle_id", booking.vehicle_id)
        .eq("status", "upcoming")
        .gte("start_at", booking.end_at.isoformat())
        .order("start_at")
        .limit(1)
        .execute()
        .data
    )
    return datetime.fromisoformat(rows[0]["start_at"]) if rows else None
