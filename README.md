# Abrahamic Scriptures

A full-stack application for exploring Abrahamic scriptures — the Qur'an, the Torah and the Gospel — with semantic (meaning-based) verse search, a conceptual ontology, and a trilingual reading experience.

## Features

- **Qur'an & Bible readers** with per-verse tafseer/commentary and verse-to-verse navigation.
- **Semantic search** — whole-verse, meaning-based search powered by sentence embeddings (`multilingual-e5-large` via [fastembed](https://github.com/qdrant/fastembed)) and `pgvector` similarity, alongside exact and root/lemma matching.
- **Ontology** — browse, visualize (interactive concept graph), and manage Qur'anic concepts and their related verses.
- **Trilingual UI** — English, Arabic, and Hebrew with full RTL support; UI copy is editable live from the admin panel.
- **Admin panel** — localization editor and ontology management, protected by JWT auth with Google OAuth and Altcha captcha.

## Architecture

- **Frontend**: React 18 + Vite + Tailwind (in `frontend/`)
- **Backend**: FastAPI + SQLAlchemy 2.0, Python 3.12 (in `backend/`)
- **Database**: PostgreSQL with the `pgvector` extension
- **Embeddings**: fastembed (ONNX runtime, no PyTorch)
- **Containerization**: Docker & Docker Compose

In production the FastAPI backend serves the built frontend assets under `/` and the API under `/api`.

## Prerequisites

- [Node.js](https://nodejs.org/) (v18 or higher)
- [Python](https://www.python.org/) (v3.12 or higher)
- [PostgreSQL](https://www.postgresql.org/) with `pgvector` (or use a managed instance like Neon / Cloud SQL)
- [Docker](https://www.docker.com/) (recommended — handles the database, embeddings model, and data seeding automatically)

## Configuration

Backend configuration lives in a single `quran.conf` file (odoo-style INI). Copy the example and edit it:

```bash
cp quran.conf.example quran.conf
```

It covers the app environment, database connection profile (`DB_TYPE`: `docker` | `local` | `neon` | `google` | `url`), JWT/Altcha secrets, the Google OAuth client ID, and embedding threads. Environment variables override values in `quran.conf`, which override the built-in defaults.

The root `.env` file is **only** for Docker Compose interpolation and local dev ports (backend port, Vite port, and the Vite → backend API proxy target).

> Backend secrets do **not** belong in `.env` — put them in `quran.conf`.

## Running with Docker (recommended)

Docker Compose builds the unified application image and starts a `pgvector`-enabled PostgreSQL service. On first startup the app **self-bootstraps the database**: it creates the database if missing, restores the baked data dumps (`backend/data/quran_full.dump` and `quran_embeddings.dump`), and runs Alembic migrations — no manual import needed.

```bash
# Build and start the app + database (exposed on http://localhost:8000 by default)
docker compose up -d --build

# Stop the containers
docker compose down
```

Create the bootstrap admin user once the stack is up:

```bash
docker compose exec app python -m backend.scripts.create_admin
```

The host port is configurable via `DOCKER_PORT` in `.env`.

## Running locally (without Docker)

You'll need a reachable PostgreSQL (with `pgvector`) configured in `quran.conf`.

1. **Install backend dependencies** (a virtualenv such as `.venv` is recommended):
   ```bash
   python -m pip install -e .
   ```

2. **Install frontend dependencies:**
   ```bash
   npm --prefix frontend install
   ```

3. **Start the backend** (the app bootstraps/migrates the DB on startup):
   ```bash
   uvicorn backend.app.main:app --reload --port 8060
   ```

4. **Start the frontend** (Vite proxies `/api` to the backend per `VITE_PROXY_TARGET` in `.env`):
   ```bash
   npm --prefix frontend run dev
   ```

The frontend dev server runs on the Vite port (default `5173`) and the backend on `8060`.

## Production build (single unified image)

For production (e.g. Kubernetes), the entire app is packaged into one image: the build bakes the embedding model into the image, compiles the frontend, and the FastAPI process serves both the static assets and the API.

```bash
# Build the unified image
docker build -t <your-registry>/quran-app:latest .

# Push it to your registry
docker push <your-registry>/quran-app:latest
```

## Database

The application seeds and migrates itself, so no manual import is normally required. The baked dumps under `backend/data/` (base content + vector extension, and precomputed verse embeddings) are restored automatically on first start. Set `AUTO_BOOTSTRAP=false` to skip this when the database is managed entirely out-of-band.

To regenerate the dumps from a populated database, see `backend/data/manual_dump.sh`. To (re)compute verse embeddings offline:

```bash
python -m backend.scripts.backfill_verse_embeddings
```
