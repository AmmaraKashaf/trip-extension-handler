"""Environment settings and business rules, all in one place."""

import os

from dotenv import load_dotenv

load_dotenv()

# --- Environment ---
SUPABASE_URL: str = os.environ["SUPABASE_URL"]
# Holds Supabase's "secret key" (sb_secret_...). Backend only.
SUPABASE_SERVICE_ROLE_KEY: str = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
FRONTEND_ORIGIN: str = os.getenv("FRONTEND_ORIGIN", "http://localhost:3000")

# --- Business rules ---
# Minimum gap between a return and the next pickup (cleaning/handoff).
TURNAROUND_BUFFER_HOURS: int = 3
# Largest extension a renter can request at once.
MAX_EXTENSION_DAYS: int = 14
