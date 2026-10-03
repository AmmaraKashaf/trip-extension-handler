# SPEC: Booking Risk Scorer

A small module for car-rental operators (the customers of 1Now). Before an operator hands the keys
to a renter, the module scores the booking request for fraud and risk, explains **why** in plain
language, and recommends: approve, manual review, or hold. A human always makes the final decision.

## 1. Problem

Direct-booking operators lose cars and money to stolen identities, stolen cards, expired licenses,
and chargebacks. Marketplaces like Turo screen renters for them; operators who go direct must do it
themselves. They need a fast, explainable check, not a black box.

## 2. Users

- **Operator / host** (primary): runs 5 to 50 cars, reviews bookings on a phone or laptop.
- **Ops manager** (secondary): wants to see which rules fire most often.

## 3. Scope

### In scope
- A pure scoring engine (no I/O) that takes a booking request and returns a risk result.
- Rules loaded from `rules.json` so thresholds and points can be changed without code changes.
- A tiny HTTP API and a single-page UI to try it.
- Sample booking requests (at least 6, covering low, medium and high risk).
- Unit tests and a README.

### Out of scope (list these in the README)
- Real ID verification, payment processing, or any third-party API calls.
- Login, database, multi-tenant accounts.
- Machine learning. Rules only, so every result is explainable.
- Automatically declining a renter. The module only recommends.

## 4. Input: booking request

| Field | Type | Notes |
|---|---|---|
| `account_age_hours` | number | Hours since the renter created an account |
| `id_verified` | `"passed"` / `"failed"` / `"not_done"` | Result of the ID check |
| `id_name` | string | Name on the ID |
| `card_name` | string | Name on the payment card |
| `license_expiry` | date (YYYY-MM-DD) | Driver license expiry |
| `insurance_confirmed` | boolean | Renter's own insurance verified |
| `car_value_usd` | number | Value of the requested car |
| `trip_start` | datetime | Pickup time |
| `trip_end` | datetime | Return time |
| `booked_at` | datetime | When the request was made |
| `billing_country` | string | ISO code |
| `license_country` | string | ISO code |
| `failed_payment_attempts` | integer | In this session |
| `accounts_using_same_card_30d` | integer | Distinct accounts that used this card |
| `email` | string | Used only for the disposable-domain check |
| `previous_chargebacks` | integer | On this renter's history |

Validate all fields. Return a clear 400 error naming the bad field.

## 5. Rules

Each rule has an `id`, `points`, a plain-language `reason`, and a `suggestion` for lowering the risk.
Defaults (all configurable in `rules.json`):

| Rule id | Fires when | Points |
|---|---|---|
| `id_failed` | `id_verified == "failed"` | 50 |
| `id_not_done` | `id_verified == "not_done"` | 30 |
| `name_mismatch` | ID name and card name differ after normalising case, accents, and punctuation | 30 |
| `license_expires_soon` | License expires before `trip_end` | hard stop (see below) |
| `insurance_unconfirmed` | `insurance_confirmed == false` | 25 |
| `new_account_expensive_car` | `account_age_hours < 24` and `car_value_usd >= 40000` | 20 |
| `last_minute_long_trip` | Pickup under 2 hours after `booked_at` and trip longer than 3 days | 15 |
| `country_mismatch` | `billing_country != license_country` | 15 |
| `payment_retries` | `failed_payment_attempts >= 3` | 25 |
| `shared_card` | `accounts_using_same_card_30d > 2` | 30 |
| `disposable_email` | Email domain is in a small built-in list | 10 |
| `prior_chargeback` | `previous_chargebacks >= 1` | 40 |

**Fairness rule:** do not use age, gender, nationality, ethnicity, religion, or postcode as signals.
Country mismatch compares two document fields only. Mention this in the README.

## 6. Output

```json
{
  "score": 0,
  "decision": "approve | review | hold",
  "hard_stop": false,
  "triggered": [
    {"id": "name_mismatch", "points": 30, "reason": "...", "suggestion": "..."}
  ],
  "summary": "One sentence an operator can read at a glance."
}
```

- Score is the sum of triggered points, capped at 100.
- `approve`: 0 to 29. `review`: 30 to 59. `hold`: 60 and above. Thresholds come from `rules.json`.
- **Hard stop:** if the license expires before `trip_end`, `decision` is `hold` and `hard_stop` is
  true regardless of score.
- `triggered` is sorted by points, highest first.
- `summary` names the decision and the top reason, e.g. "Review: ID name does not match card name."

## 7. API

Python standard library only (`http.server`), JSON in and out.

| Method | Path | Purpose |
|---|---|---|
| POST | `/api/score` | Score one booking request |
| GET | `/api/rules` | Current rules and thresholds |
| GET | `/api/samples` | Sample requests for the UI |

## 8. UI

Single page, vanilla JS, no build step.
- A form with every input field, plus buttons to load each sample request.
- A **Score** button that shows: the score, a colour-coded decision (green, amber, red), the
  summary, and a list of triggered rules with points, reason, and suggestion.
- Show "No risk signals found" clearly when nothing fires.
- Works on a phone-width screen.

## 9. Tests (minimum)

- Each rule fires on its trigger and does not fire just below it.
- The score is capped at 100.
- Threshold boundaries: 29 → approve, 30 → review, 59 → review, 60 → hold.
- Hard stop forces `hold` even with a score of 0 from other rules.
- Name matching ignores case, accents, and punctuation ("José  O'Neil" equals "jose oneil").
- Invalid input returns a 400 that names the bad field.
- A clean request scores 0 with `approve`.

## 10. Acceptance criteria

1. `python3 server.py` starts the app with no packages to install.
2. `python3 -m unittest discover -s tests -v` passes.
3. Each sample request produces the risk level its name claims.
4. Changing a point value in `rules.json` and restarting changes the result.
5. The README explains how to run it, how to read a result, and what was left out and why.

## 11. Project layout

```
risk_engine.py    pure scoring logic
rules.json        rules, points, thresholds
server.py         HTTP API + sample data
static/index.html UI
tests/test_risk.py
README.md
```
