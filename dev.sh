#!/usr/bin/env bash
# Start backend (FastAPI :8000) and frontend (Next.js :3000) together. Ctrl+C stops both.
set -e
cd "$(dirname "$0")"
[ -d backend/.venv ] || { python3 -m venv backend/.venv && backend/.venv/bin/pip install -r backend/requirements.txt && backend/.venv/bin/pip install torch --index-url https://download.pytorch.org/whl/cpu; }
[ -d frontend/node_modules ] || (cd frontend && npm install)
(cd backend && .venv/bin/uvicorn app.main:app --reload --port 8000) &
(cd frontend && npm run dev) &
trap 'kill 0' INT TERM
wait
