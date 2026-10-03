# Spec: Trip Extension Handler

A small tool for car rental operators (1Now-style). A renter asks to extend an active trip by N days. The system checks whether the car is free, prices the extra days, and answers with one of three decisions: **accept**, **counter_offer**, or **decline**. The operator can then confirm and the booking is updated.

**Stack:** Next.js (latest, App Router, TypeScript, Tailwind) + Python FastAPI + Supabase (Postgres).

---

## 0. Working agreement for Claude Code (read first)

- **Plan first, then build in small steps.** Show me a short plan, then follow the build order in section 9.
- **Commit after each step** with a clear message (e.g. `feat(api): add extension decision logic`). Keep the history readable.
- **Readable and easy to change beats clever.** I will walk through this code live and may edit it during a demo.
  - Small functions, one job each. Descriptive names. Type hints everywhere in Python, types everywhere in TypeScript.
  - Short comments explaining *why*, not *what*.
  - No ORMs, no repository/service-layer abstractions, no dependency injection frameworks, no state-management libraries, no extra dependencies unless truly needed.
  - Keep each file short (aim for under ~150 lines). Prefer a flat structure.
- **Don't overthink the logic.** Implement exactly what is written below. If something is ambiguous, pick the simplest option and note it in the README.
- **Ship the feature only.** No auth, no users, no payments, no emails/SMS, no infra, no Docker. Plain REST APIs plus a simple frontend.
- **Guards where needed** (section 6), but nothing beyond that.
- **Never invent secrets.** When you need an env value, stop and ask me. Never commit `.env`. Provide `.env.example` files.

---

## 1. Repo structure

```
/
├── Spec.md
├── README.md                  # how to run, what was left out and why
├── supabase/
│   └── schema.sql             # tables; I paste this into the Supabase SQL editor
├── backend/
│   ├── requirements.txt
│   ├── .env.example
│   ├── app/
│   │   ├── main.py            # FastAPI app, CORS, router include
│   │   ├── config.py          # env + business constants
│   │   ├── db.py              # Supabase client
│   │   ├── schemas.py         # Pydantic request/response models
│   │   ├── extension.py       # decide_extension(): pure function, no DB
│   │   ├── routes.py          # all endpoints
│   │   └── seed.py            # reset + seed demo data (also callable from API)
│   └── tests/
│       └── test_extension.py
└── frontend/
    ├── .env.example
    └── app/
        ├── page.tsx           # single page
        ├── lib/api.ts         # fetch helpers + types
        └── components/
            ├── VehicleCard.tsx
            └── ExtensionPanel.tsx
```

---

## 2. Business rules (keep these as named constants in `config.py`)

| Constant | Value | Meaning |
|---|---|---|
| `TURNAROUND_BUFFER_HOURS` | 3 | Minimum gap between a return and the next pickup (cleaning/handoff) |
| `MAX_EXTENSION_DAYS` | 14 | Largest extension a renter can request at once |

- Extensions are in **whole days** (1 to 14).
- Price of an extension = `approved_days * vehicle.daily_rate`.
- Only bookings with status `active` can be extended.
- Only bookings with status `upcoming` on the **same vehicle** block an extension. `cancelled` and `completed` bookings are ignored.

---

## 3. Decision logic

Implement as one pure function in `extension.py`, so it is trivial to read and unit test:

```python
def decide_extension(
    current_end: datetime,
    requested_days: int,
    next_pickup: datetime | None,   # start of the next upcoming booking on this vehicle
    daily_rate: Decimal,
) -> ExtensionDecision: ...
```

Logic:

1. `requested_end = current_end + requested_days days`
2. If `next_pickup` is `None` → **accept** (nothing blocks it).
3. `latest_allowed_end = next_pickup - TURNAROUND_BUFFER_HOURS`
4. If `requested_end <= latest_allowed_end` → **accept** (boundary is inclusive).
5. Otherwise `free_days = floor((latest_allowed_end - current_end) / 1 day)`, minimum 0.
   - If `free_days >= 1` → **counter_offer** with `approved_days = free_days`.
   - Else → **decline** with `approved_days = 0`.

Result fields:

```
decision:       "accept" | "counter_offer" | "decline"
requested_days: int
approved_days:  int            # = requested for accept, free_days for counter_offer, 0 for decline
new_end_at:     datetime|null  # current_end + approved_days, null on decline
extra_amount:   decimal        # approved_days * daily_rate
reason:         str            # plain English, shown in the UI
```

Example reasons:
- accept: `"No booking follows this trip. Extension approved."`
- accept (with next booking): `"The car is free for the extra days, including the 3h turnaround buffer."`
- counter_offer: `"Only 2 day(s) are available before the next pickup (Fri 10:00). Offering 2 instead of 5."`
- decline: `"The next pickup is too close. A 3h turnaround buffer is required."`

---

## 4. Database (Supabase / Postgres)

Write `supabase/schema.sql` (I will run it in the SQL editor). No RLS needed; the backend uses the service role key.

**vehicles**
- `id` uuid PK default `gen_random_uuid()`
- `name` text not null
- `plate` text not null
- `daily_rate` numeric(10,2) not null

**bookings**
- `id` uuid PK default `gen_random_uuid()`
- `vehicle_id` uuid not null references vehicles(id) on delete cascade
- `renter_name` text not null
- `start_at` timestamptz not null
- `end_at` timestamptz not null
- `status` text not null check (status in ('upcoming','active','completed','cancelled'))
- `total_amount` numeric(10,2) not null default 0
- check (`end_at` > `start_at`)

Add an index on `bookings(vehicle_id, start_at)`.

---

## 5. API (FastAPI)

All JSON. CORS allows the frontend origin only.

| Method | Path | Purpose |
|---|---|---|
| GET | `/vehicles` | Each vehicle with its bookings (ordered by `start_at`) for the UI |
| POST | `/bookings/{booking_id}/extension/quote` | Body `{ "days": int }`. Runs the decision. **Read-only**, writes nothing |
| POST | `/bookings/{booking_id}/extension/confirm` | Body `{ "days": int }`. Re-runs the decision; applies only if it is `accept` |
| POST | `/demo/reset` | Wipes and re-seeds demo data |
| GET | `/health` | `{ "status": "ok" }` |

**Quote flow:** load booking → guards → find next pickup → `decide_extension` → return result.

**Confirm flow:** same as quote, but if the decision for the given `days` is `accept`, update `bookings.end_at = new_end_at` and `bookings.total_amount += extra_amount`, then return the updated booking and the decision. For a counter-offer, the frontend calls confirm with the **approved** days, so confirm only ever applies a clean `accept`. If the re-check is not `accept` → `409` with the reason.

**Finding the next pickup** (one Supabase query): bookings where `vehicle_id` = this vehicle, `status = 'upcoming'`, `start_at >= booking.end_at`, ordered by `start_at` ascending, limit 1.

---

## 6. Guards (only these)

- Booking id not found → `404`.
- Booking status is not `active` → `409` with a clear message.
- `days` must be an integer from 1 to `MAX_EXTENSION_DAYS` → `422` (enforce with Pydantic `Field(ge=1, le=...)`).
- Confirm re-checks availability right before writing (guards against stale quotes) → `409` if it no longer fits.
- Supabase/DB errors → a clean `502` JSON error, not a stack trace.
- Frontend: disable buttons while a request is in flight; show errors from the API in plain text.

---

## 7. Seed data (`seed.py`)

Seed relative to "now" so the demo never goes stale. `reset` deletes bookings then vehicles, then inserts. Run via `python -m app.seed` and also through `POST /demo/reset`.

Use 4 vehicles. Each one demonstrates a different outcome. Let `T` = today at 10:00 UTC.

| Vehicle (rate/day) | Active booking | Following bookings | Expected result |
|---|---|---|---|
| Tesla Model 3 ($90) | Ava Martinez, ends `T+1d` | A **cancelled** booking starting `T+1d 12:00` (must be ignored) | Request 3 days → **accept** |
| Jeep Wrangler ($110) | Ben Carter, ends `T+1d` | Upcoming starting `T+4d` | Request 5 days → **counter_offer** (2 days). Request 2 → **accept** |
| Toyota RAV4 ($75) | Chloe Nguyen, ends `T+1d` | Upcoming starting `T+1d 14:00` (only 4h gap, buffer is 3h) | Request 1 day → **decline** |
| Honda Civic ($55) | Dan Okafor, ends `T+1d` | Upcoming starting `T+2d 13:00` | Request 1 day → **accept** (exact boundary), request 2 → **counter_offer** (1 day) |

Also add one `completed` booking in the past on the Tesla so the list looks realistic. `start_at` of each active booking is 2 days before its `end_at`. Set `total_amount` = days * rate for every seeded booking.

---

## 8. Frontend (Next.js, single page)

Keep it plain: one page, Tailwind, `"use client"` components, `fetch` only. No UI library, no state library.

**Page (`/`)**
- Title: "Trip Extension Handler".
- A "Reset demo data" button (calls `/demo/reset`, then reloads the list).
- A grid of `VehicleCard`s from `GET /vehicles`.

**VehicleCard**
- Vehicle name, plate, daily rate.
- A simple list of that vehicle's bookings: renter, start → end (local time), status badge. Highlight the active one.
- Under the active booking, render `ExtensionPanel`.

**ExtensionPanel**
- Number input for days (1 to 14) and a **Check extension** button → calls `quote`.
- Result box: decision badge (green accept / amber counter-offer / red decline), the `reason`, approved days, new return time, extra amount.
- If `accept` or `counter_offer`: a **Confirm** button → calls `confirm` with `approved_days`. On success, reload vehicles so the new end time shows.
- Loading and error states. Nothing fancier.

`lib/api.ts` holds the base URL (`NEXT_PUBLIC_API_URL`), TypeScript types matching the API, and one small function per endpoint.

---

## 9. Build order

1. Scaffold `backend/` and `frontend/`, add `.env.example` files, and **ask me for the env values** (section 10).
2. Write `supabase/schema.sql` and tell me when to run it.
3. `config.py`, `db.py`, `schemas.py`.
4. `extension.py` with `decide_extension` + `tests/test_extension.py`. Run the tests.
5. `seed.py`. Run it and verify the data in Supabase.
6. `routes.py` + `main.py`. Test each endpoint with curl against the seed scenarios in section 7.
7. Frontend: `api.ts`, then `VehicleCard`, then `ExtensionPanel`, then `page.tsx`.
8. Walk through all four seed scenarios end to end in the browser.
9. Write `README.md`.

**Unit tests (pytest, `decide_extension` only):** no next booking → accept; fits exactly at the buffer boundary → accept; too long but 2 free days → counter_offer; inside the buffer → decline. Keep them short and readable.

---

## 10. Environment variables

Ask me for these before using them:

- `backend/.env`: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `FRONTEND_ORIGIN` (default `http://localhost:3000`)
- `frontend/.env.local`: `NEXT_PUBLIC_API_URL` (default `http://localhost:8000`)

The service role key stays on the backend only and is never exposed to the frontend.

---

## 11. Definition of done

- `uvicorn app.main:app --reload` and `npm run dev` start cleanly.
- All four seed scenarios behave as listed in section 7, in the browser.
- Confirming an accepted extension updates the return time and total amount, visible after reload.
- Cancelled bookings never block an extension.
- Unit tests pass.
- README includes setup steps, a demo script, and a **"What I left out and why"** section: auth, real Turo/calendar sync, payment capture, notifying the renter, timezone handling per operator, concurrency locking (the confirm re-check is a lightweight guard, not a transaction), and a real pricing engine (flat daily rate only).
