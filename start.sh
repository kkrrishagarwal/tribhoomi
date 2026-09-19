#!/bin/sh
# Container entry point: FastAPI on 127.0.0.1:8000, Next.js on $PORT (proxies /api/* to it).
# If EITHER process exits, the whole container exits so the host (Render / HF Spaces) restarts
# it cleanly, instead of serving a site whose API is silently dead.
set -u
(cd backend && exec uvicorn app.main:app --host 127.0.0.1 --port 8000) &
API=$!

# Do not accept traffic until the API answers (first start also seeds the database).
PY=$(command -v python || command -v python3)
i=0
until "$PY" -c "import urllib.request,sys; urllib.request.urlopen('http://127.0.0.1:8000/api/health', timeout=2)" 2>/dev/null; do
  kill -0 "$API" 2>/dev/null || { echo "start.sh: API failed to start" >&2; exit 1; }
  i=$((i + 1)); [ "$i" -gt 90 ] && { echo "start.sh: API not healthy after 90s" >&2; exit 1; }
  sleep 1
done

(cd frontend && exec node node_modules/next/dist/bin/next start -p "${PORT:-7860}") &
WEB=$!
trap 'kill "$API" "$WEB" 2>/dev/null' INT TERM

while kill -0 "$API" 2>/dev/null && kill -0 "$WEB" 2>/dev/null; do sleep 2; done
echo "start.sh: a process exited (api alive: $(kill -0 "$API" 2>/dev/null && echo yes || echo no)); stopping container" >&2
kill "$API" "$WEB" 2>/dev/null
exit 1
