import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from adminui.api.routers import auth, home

app = FastAPI(title="MetrANOVA Admin UI API")

# Frontend is served by a separate static file server (see Makefile), so allow
# cross-origin requests during local development. The session cookie only
# travels with credentials, and browsers refuse credentials against a "*"
# origin, so the allowed origins are listed explicitly (ADMINUI_CORS_ORIGINS
# to add more). Tighten this once the real deployment topology is known.
app.add_middleware(
    CORSMiddleware,
    allow_origins=os.environ.get(
        "ADMINUI_CORS_ORIGINS", "http://localhost:5001,http://127.0.0.1:5001"
    ).split(","),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(home.router, prefix="/api")
app.include_router(auth.router, prefix="/api")
