"""FastAPI app: CORS, DB error handling, routes."""

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from httpx import HTTPError
from postgrest.exceptions import APIError

from app.config import FRONTEND_ORIGIN
from app.routes import router

app = FastAPI(title="Trip Extension Handler")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[FRONTEND_ORIGIN],
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type"],
)


# Supabase errors (bad query) and network errors become a clean 502, not a stack trace.
@app.exception_handler(APIError)
@app.exception_handler(HTTPError)
async def database_error(_: Request, exc: Exception) -> JSONResponse:
    message = exc.message if isinstance(exc, APIError) else str(exc)
    return JSONResponse(status_code=502, content={"detail": f"Database error: {message}"})


app.include_router(router)
