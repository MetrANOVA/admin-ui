import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from adminui.api.routers import home, metadata, tables, transformers

app = FastAPI(title="MetrANOVA Admin UI API")

# Frontend is served by a separate static file server (see Makefile), so allow
# cross-origin requests during local development. The pages fetch with
# credentials (for a session cookie), and browsers refuse credentials against
# a "*" origin, so the allowed origins are listed explicitly
# (ADMINUI_CORS_ORIGINS to add more). Tighten this once the real deployment
# topology is known.
app.add_middleware(
    CORSMiddleware,
    allow_origins=os.environ.get(
        "ADMINUI_CORS_ORIGINS", "http://localhost:5001,http://127.0.0.1:5001"
    ).split(","),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    # The list endpoints report their total here; without this the browser
    # hides the header from the page.
    expose_headers=["X-Total-Count"],
)

app.include_router(home.router, prefix="/api")
app.include_router(metadata.router, prefix="/api")
app.include_router(metadata.type_router, prefix="/api")
app.include_router(tables.router, prefix="/api")
app.include_router(transformers.router, prefix="/api")
