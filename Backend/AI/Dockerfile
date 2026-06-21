# ATHLASX Compute — FastAPI/Uvicorn API image (production-shaped).
#
# ARM64 NOTE: the eventual deployment target is Oracle Cloud Ampere A1 (ARM64).
# python:3.12-slim is a multi-arch image with a confirmed linux/arm64 variant, and
# every pinned dependency in requirements.txt ships aarch64 wheels (or is pure
# Python), so this image builds natively on A1 with no source compilation.
FROM python:3.12-slim

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /app

# curl for the container HEALTHCHECK; build-essential is intentionally omitted
# (all wheels are prebuilt for both amd64 and arm64).
RUN apt-get update \
    && apt-get install -y --no-install-recommends curl \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install -r requirements.txt

COPY app/ ./app/
COPY alembic/ ./alembic/
COPY alembic.ini ./

RUN useradd -m appuser && chown -R appuser /app
USER appuser

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD curl -fsS http://localhost:8000/api/v1/compute/health || exit 1

# 2 Uvicorn workers per the architecture doc's compute-service sizing.
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "2"]
