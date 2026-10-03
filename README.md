# Trip Extension Handler
**Live demo:** https://trip-extension-handler.vercel.app
A renter asks to extend an active trip by N days. The backend checks whether the car is free, prices the extra days, and answers **accept**, **counter_offer**, or **decline**. The operator can then confirm and the booking is updated.

Stack: Next.js (App Router, TypeScript, Tailwind) · FastAPI · Supabase (Postgres). Full spec: [Spec.md](Spec.md).

## Setup (Windows / PowerShell)

Requirements: Python 3.10+ (tested on 3.14), Node 20+, a Supabase project.

**1. Database.** Paste [supabase/schema.sql](supabase/schema.sql) into the Supabase SQL editor and run it.

**2. Backend.**

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
Copy-Item .env.example .env   # then fill in the values
python -m app.seed            # load demo data
uvicorn app.main:app --reload # http://localhost:8000
```

`backend/.env`:

| Name | Value |
|---|---|
| `SUPABASE_URL` | `https://<project-ref>.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase **secret key** (`sb_secret_...`). Supabase renamed the service role key; the env name is kept. Backend only. |
| `FRONTEND_ORIGIN` | `http://localhost:3000` (the only origin CORS allows) |

**3. Frontend.**

```powershell
cd frontend
npm install
Copy-Item .env.example .env.local   # NEXT_PUBLIC_API_URL=http://localhost:8000
npm run dev                         # http://localhost:3000
```

**Tests** (decision logic only):

```powershell
cd backend
.\.venv\Scripts\python -m pytest
```

## How it works

- [backend/app/extension.py](backend/app/extension.py): `decide_extension()`, a pure function with no DB access. All the business logic is here.
- [backend/app/routes.py](backend/app/routes.py): loads the booking, applies the guards, finds the next upcoming pickup on the same vehicle, then calls `decide_extension`.
- [backend/app/config.py](backend/app/config.py): business rules: `TURNAROUND_BUFFER_HOURS = 3`, `MAX_EXTENSION_DAYS = 14`.
- `quote` is read-only. `confirm` re-runs the decision and writes only on a clean `accept`. For a counter-offer, the UI confirms with the *approved* days.

| Method | Path | |
|---|---|---|
| GET | `/vehicles` | Vehicles with their bookings (ordered by start) |
| POST | `/bookings/{id}/extension/quote` | `{ "days": 1-14 }` → decision, writes nothing |
| POST | `/bookings/{id}/extension/confirm` | `{ "days": 1-14 }` → updated booking + decision, or `409` |
| POST | `/demo/reset` | Wipe and re-seed demo data |
| GET | `/health` | `{ "status": "ok" }` |

Errors: `404` unknown booking · `409` booking not active, or confirm no longer fits · `422` bad `days` or booking id · `502` Supabase/network error.

## Demo script

Click **Reset demo data** first. Seed dates are relative to today (T = today 10:00 UTC), and every active trip ends at T+1d.

1. **Tesla Model 3**: the next booking is *cancelled*, so it's ignored. Extend by **3** → green **Accept**, +$270. Confirm: the return time moves 3 days later and the total goes from $180 to $450.
2. **Jeep Wrangler**: next pickup at T+4d. Extend by **5** → amber **Counter-offer** for 2 days ($220). Confirm → the booking is extended by 2 days. (Extending by **2** from a fresh reset gives a straight Accept.)
3. **Toyota RAV4**: next pickup only 4h after return. Extend by **1** → red **Decline**, and no Confirm button.
4. **Honda Civic**: next pickup at T+2d 13:00. Extend by **1** → **Accept**: the new return is exactly 3h before the pickup, and the boundary counts as free. Extend by **2** → **Counter-offer** for 1 day.
5. Guards: after confirming the Jeep, check again: it now declines. Typing 0 or 15 days shows the validation error from the API.

## Decisions and assumptions

- **Seeded booking lengths.** The spec gives only start times for following bookings, so each one lasts 2 days. That keeps `total_amount = days × rate` a whole number of days.
- **Times.** Stored and computed in UTC. The UI shows local time. The counter-offer reason shows the next pickup in UTC (e.g. `Wed 10:00 UTC`), because the backend has no operator timezone.
- **Money.** `Decimal` in Python, a plain JSON number in responses so the frontend doesn't need to parse strings.
- **Invalid booking id** (not a UUID) returns `422` from FastAPI's path validation, instead of a DB error.
- **RLS.** `schema.sql` creates no policies. Enabling RLS in Supabase is fine: the backend's secret key bypasses it, and the frontend never talks to Supabase directly.
- **`MAX_DAYS` in the UI** mirrors the backend constant for the input's `max`. The backend remains the source of truth (422).

## What I left out and why

- **Auth / users.** Out of scope for the feature. In production, operators would log in and see only their own fleet.
- **Real Turo / calendar sync.** Availability comes only from this database. A real system would also pull external bookings and blocks.
- **Payment capture.** `total_amount` is updated, but no money moves. That would need a payment provider and a failure path.
- **Notifying the renter.** No email or SMS. The operator sees the reason text and would relay it.
- **Timezone handling per operator.** Everything is in UTC. Operators in different zones would want pickup and return times, and the "10:00" in reasons, in local time.
- **Concurrency locking.** The confirm re-check guards against stale quotes but isn't a transaction: two confirms at the same instant could both pass. The proper fix is a Postgres function with row locking, or an exclusion constraint on vehicle time ranges.
- **A real pricing engine.** Flat `days × daily_rate` only: no weekend rates, discounts, taxes, or deposits.
