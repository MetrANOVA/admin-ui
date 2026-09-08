from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from adminui.api.routers import home

app = FastAPI(title="MetrANOVA Admin UI API")

# Frontend is served by a separate static file server (see Makefile), so allow
# cross-origin requests during local development. Tighten this once the real
# deployment topology is known.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(home.router, prefix="/api")
