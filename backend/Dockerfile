# Backend only (FastAPI + SQLite + optional AI). Used by Render / Railway / Fly / any Docker host.
#   docker build -t tribhoomi-api backend && docker run -p 8000:8000 tribhoomi-api
# Build arg AI=1 installs CPU torch + transformers (~1.5 GB image, needs ~2 GB RAM at runtime).
FROM python:3.12-slim
ARG AI=1
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 HF_HOME=/data/hf PORT=8000
WORKDIR /app
COPY requirements.txt requirements-lite.txt ./
RUN if [ "$AI" = "1" ]; then \
      pip install --no-cache-dir -r requirements.txt && \
      pip install --no-cache-dir torch --index-url https://download.pytorch.org/whl/cpu ; \
    else pip install --no-cache-dir -r requirements-lite.txt ; fi
COPY . .
RUN mkdir -p /data && chmod -R 777 /data
# SQLite lives on /data so a mounted volume (if any) keeps registry changes across restarts.
ENV DATABASE_URL=sqlite:////data/tribhoomi.db
EXPOSE 8000
CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT}"]
