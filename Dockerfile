# ONE container for the whole app (frontend + backend), e.g. a Hugging Face Space (Docker SDK)
# or any Docker host. Next.js listens on $PORT (7860 on HF Spaces) and proxies /api/* to the
# FastAPI process on 8000 inside the container, so there is a single public URL.
#
#   docker build -t tribhoomi . && docker run -p 7860:7860 -e NEXT_PUBLIC_CESIUM_TOKEN=... tribhoomi

# ---- stage 1: build the Next.js frontend ------------------------------------------------
FROM node:20-slim AS web
WORKDIR /web
COPY frontend/package.json frontend/package-lock.json ./
COPY frontend/scripts ./scripts
RUN npm ci --no-audit --no-fund
COPY frontend/ ./
# NEXT_PUBLIC_* values are baked in at build time
ARG NEXT_PUBLIC_CESIUM_TOKEN=""
ARG NEXT_PUBLIC_PUBLIC_URL=""
ENV NEXT_PUBLIC_CESIUM_TOKEN=$NEXT_PUBLIC_CESIUM_TOKEN NEXT_PUBLIC_PUBLIC_URL=$NEXT_PUBLIC_PUBLIC_URL API_URL=http://127.0.0.1:8000
RUN npm run build

# ---- stage 2: python + node runtime ------------------------------------------------------
FROM python:3.12-slim
# AI=1 installs CPU torch + transformers (needs ~2 GB RAM at runtime: Hugging Face Space yes, Render free no).
ARG AI=0
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 HF_HOME=/data/hf PORT=7860 NODE_ENV=production
RUN apt-get update && apt-get install -y --no-install-recommends curl ca-certificates \
 && curl -fsSL https://deb.nodesource.com/setup_20.x | bash - && apt-get install -y --no-install-recommends nodejs \
 && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY backend/requirements.txt backend/requirements-lite.txt backend/
RUN if [ "$AI" = "1" ]; then \
      pip install --no-cache-dir -r backend/requirements.txt && \
      pip install --no-cache-dir torch --index-url https://download.pytorch.org/whl/cpu ; \
    else pip install --no-cache-dir -r backend/requirements-lite.txt ; fi
COPY backend/ backend/
COPY --from=web /web/.next frontend/.next
COPY --from=web /web/public frontend/public
COPY --from=web /web/node_modules frontend/node_modules
COPY --from=web /web/package.json /web/next.config.mjs frontend/
RUN mkdir -p /data && chmod -R 777 /data && useradd -m app && chown -R app /app /data
USER app
ENV DATABASE_URL=sqlite:////data/tribhoomi.db API_URL=http://127.0.0.1:8000 CORS_ORIGINS=*
EXPOSE 7860
CMD ["sh", "-c", "(cd backend && uvicorn app.main:app --host 127.0.0.1 --port 8000 &) && cd frontend && npx next start -p ${PORT}"]
