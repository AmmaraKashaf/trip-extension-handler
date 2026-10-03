// Fetch helpers and types matching the FastAPI backend.

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export type BookingStatus = "upcoming" | "active" | "completed" | "cancelled";
export type Decision = "accept" | "counter_offer" | "decline";

export type Booking = {
  id: string;
  vehicle_id: string;
  renter_name: string;
  start_at: string; // ISO datetime (UTC)
  end_at: string;
  status: BookingStatus;
  total_amount: number;
};

export type Vehicle = {
  id: string;
  name: string;
  plate: string;
  daily_rate: number;
  bookings: Booking[];
};

export type ExtensionDecision = {
  decision: Decision;
  requested_days: number;
  approved_days: number;
  new_end_at: string | null;
  extra_amount: number;
  reason: string;
};

export type ConfirmResponse = {
  booking: Booking;
  decision: ExtensionDecision;
};

export function getVehicles(): Promise<Vehicle[]> {
  return request("/vehicles");
}

export function quoteExtension(bookingId: string, days: number): Promise<ExtensionDecision> {
  return request(`/bookings/${bookingId}/extension/quote`, { days });
}

export function confirmExtension(bookingId: string, days: number): Promise<ConfirmResponse> {
  return request(`/bookings/${bookingId}/extension/confirm`, { days });
}

export function resetDemo(): Promise<{ status: string }> {
  return request("/demo/reset", {});
}

// GET when there is no body, POST JSON otherwise. Throws with the API's message on failure.
async function request<T>(path: string, body?: object): Promise<T> {
  const init: RequestInit = body
    ? { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }
    : { method: "GET" };

  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, init);
  } catch {
    throw new Error(`Cannot reach the API at ${API_URL}. Is the backend running?`);
  }

  const data = await response.json().catch(() => null);
  if (!response.ok) throw new Error(errorMessage(data, response.status));
  return data as T;
}

// FastAPI sends `detail` as a string (our errors) or a list (422 validation errors).
function errorMessage(data: unknown, status: number): string {
  const detail = (data as { detail?: unknown } | null)?.detail;
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) return detail.map((d: { msg: string }) => d.msg).join("; ");
  return `Request failed (${status}).`;
}

export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    weekday: "short", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

export function formatMoney(amount: number): string {
  return `$${amount.toFixed(2)}`;
}
