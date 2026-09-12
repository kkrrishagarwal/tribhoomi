"""
Central place for settings. Everything can be overridden with an environment variable.

DATABASE_URL examples
  sqlite:///./tribhoomi.db                                  (default, zero setup)
  postgresql+psycopg://tribhoomi:tribhoomi@localhost:5432/tribhoomi   (docker-compose PostGIS)
"""
import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent  # backend/
DATABASE_URL = os.getenv("DATABASE_URL", f"sqlite:///{BASE_DIR / 'tribhoomi.db'}")
SAMPLE_DIR = BASE_DIR / "sample"
SEED_FILE = BASE_DIR / "seed" / "parcels.geojson"
AI_MODEL_ID = os.getenv("AI_MODEL_ID", "nvidia/segformer-b0-finetuned-ade-512-512")
CORS_ORIGINS = os.getenv("CORS_ORIGINS", "http://localhost:3000,http://127.0.0.1:3000").split(",")
