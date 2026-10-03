"""Pydantic request/response models for the API."""

from datetime import datetime
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, Field

from app.config import MAX_EXTENSION_DAYS

BookingStatus = Literal["upcoming", "active", "completed", "cancelled"]
Decision = Literal["accept", "counter_offer", "decline"]


class ExtensionRequest(BaseModel):
    days: int = Field(ge=1, le=MAX_EXTENSION_DAYS)


class ExtensionDecision(BaseModel):
    decision: Decision
    requested_days: int
    approved_days: int
    new_end_at: datetime | None
    extra_amount: Decimal
    reason: str


class Booking(BaseModel):
    id: str
    vehicle_id: str
    renter_name: str
    start_at: datetime
    end_at: datetime
    status: BookingStatus
    total_amount: Decimal


class Vehicle(BaseModel):
    id: str
    name: str
    plate: str
    daily_rate: Decimal
    bookings: list[Booking]


class ConfirmResponse(BaseModel):
    booking: Booking
    decision: ExtensionDecision
