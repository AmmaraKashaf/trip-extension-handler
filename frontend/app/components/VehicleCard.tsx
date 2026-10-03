"use client";

import { type Booking, type BookingStatus, type Vehicle, formatDateTime, formatMoney } from "../lib/api";
import ExtensionPanel from "./ExtensionPanel";

const STATUS_STYLES: Record<BookingStatus, string> = {
  active: "bg-blue-100 text-blue-800",
  upcoming: "bg-violet-100 text-violet-800",
  completed: "bg-zinc-200 text-zinc-700",
  cancelled: "bg-zinc-100 text-zinc-500 line-through",
};

type Props = {
  vehicle: Vehicle;
  onExtended: () => void;
};

export default function VehicleCard({ vehicle, onExtended }: Props) {
  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-baseline justify-between">
        <div>
          <h2 className="text-lg font-semibold">{vehicle.name}</h2>
          <p className="text-sm text-zinc-500">{vehicle.plate}</p>
        </div>
        <p className="text-sm font-medium">{formatMoney(vehicle.daily_rate)} / day</p>
      </div>

      <ul className="space-y-2">
        {vehicle.bookings.map((booking) => (
          <li key={booking.id}>
            <BookingRow booking={booking} />
            {booking.status === "active" && (
              <ExtensionPanel booking={booking} onConfirmed={onExtended} />
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

function BookingRow({ booking }: { booking: Booking }) {
  const isActive = booking.status === "active";
  return (
    <div className={`rounded-md p-2 text-sm ${isActive ? "border border-blue-300 bg-blue-50" : ""}`}>
      <div className="flex items-center justify-between">
        <span className="font-medium">{booking.renter_name}</span>
        <span className={`rounded px-2 py-0.5 text-xs ${STATUS_STYLES[booking.status]}`}>
          {booking.status}
        </span>
      </div>
      <div className="text-zinc-600">
        {formatDateTime(booking.start_at)} → {formatDateTime(booking.end_at)}
        <span className="ml-2 text-zinc-400">({formatMoney(booking.total_amount)})</span>
      </div>
    </div>
  );
}
