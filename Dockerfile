# Prelegal: the statically exported Next.js frontend served by the FastAPI backend.
# Build from the repository root: docker build -t prelegal .

# --- Stage 1: build the frontend -------------------------------------------
FROM node:24-slim AS frontend

# The frontend reads ../templates at build time, so keep the repo layout.
WORKDIR /src/frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY templates /src/templates
COPY frontend ./
RUN npm run build

# --- Stage 2: the Python runtime -------------------------------------------
FROM python:3.13-slim

COPY --from=ghcr.io/astral-sh/uv:0.9.30 /uv /bin/uv
ENV UV_COMPILE_BYTECODE=1 \
    UV_LINK_MODE=copy \
    UV_PYTHON_DOWNLOADS=never

WORKDIR /app

# Install dependencies first so this layer is cached until the lockfile changes.
COPY backend/pyproject.toml backend/uv.lock backend/.python-version ./
RUN uv sync --frozen --no-dev --no-install-project

COPY backend/app ./app
COPY --from=frontend /src/frontend/out ./static

RUN useradd --create-home --uid 1000 prelegal \
    && mkdir -p /app/data \
    && chown prelegal:prelegal /app/data
USER prelegal

ENV PATH="/app/.venv/bin:$PATH" \
    PRELEGAL_DB_PATH=/app/data/prelegal.db \
    PRELEGAL_STATIC_DIR=/app/static

EXPOSE 8000
HEALTHCHECK --interval=10s --timeout=3s --start-period=10s --retries=3 \
    CMD ["python", "-c", "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8000/api/health', timeout=2)"]

# A single worker: the SQLite database is recreated when the app starts.
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
