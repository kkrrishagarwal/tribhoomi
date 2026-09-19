"""
FastAPI entry point.
Run:  cd backend && .venv/bin/uvicorn app.main:app --reload --port 8000
Docs: http://localhost:8000/docs
"""
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from . import errors
from .config import CORS_ORIGINS, DATABASE_URL
from .db import Base, SessionLocal, engine
from .models import Parcel
from .routers import ai, analysis, dashboard, integrity, layouts, lifecycle, market, parcels, ulpin, units, validate


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Create tables and seed on first run so `uvicorn` alone gives a working demo.
    Base.metadata.create_all(engine)
    with SessionLocal() as db:
        if db.query(Parcel).count() == 0:
            from seed.seed import run
            run(reset=False)
    yield


app = FastAPI(
    title="Tribhoomi — 3D ULPIN & Vertical Property Mapping API",
    version="0.1.0",
    description="Prototype for SIH26011. Generates hierarchical 3D ULPINs, serves parcel/building/unit data, "
                "validates vertical topology, and runs a pretrained building-footprint model.",
    lifespan=lifespan,
)
app.add_middleware(CORSMiddleware, allow_origins=["*"] if "*" in CORS_ORIGINS else CORS_ORIGINS, allow_methods=["*"], allow_headers=["*"])
errors.install(app)

for r in (parcels, units, ulpin, validate, dashboard, ai, integrity, layouts, market, lifecycle, analysis):
    app.include_router(r.router)


@app.get("/api/health")
def health():
    return {"ok": True, "database": DATABASE_URL.split("://")[0]}
