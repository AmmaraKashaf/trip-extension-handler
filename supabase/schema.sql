-- Trip Extension Handler schema.
-- Paste into the Supabase SQL editor and run once.
-- No RLS: only the backend talks to the database, using the secret (service role) key.

create table if not exists vehicles (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  plate       text not null,
  daily_rate  numeric(10,2) not null
);

create table if not exists bookings (
  id            uuid primary key default gen_random_uuid(),
  vehicle_id    uuid not null references vehicles(id) on delete cascade,
  renter_name   text not null,
  start_at      timestamptz not null,
  end_at        timestamptz not null,
  status        text not null check (status in ('upcoming', 'active', 'completed', 'cancelled')),
  total_amount  numeric(10,2) not null default 0,
  check (end_at > start_at)
);

-- Speeds up the "next upcoming booking on this vehicle" lookup.
create index if not exists bookings_vehicle_start_idx on bookings (vehicle_id, start_at);
