# Abrahamic Scriptures

A split React plus FastAPI application for exploring Abrahamic scriptures against PostgreSQL.

## Architecture

- Frontend: Vite + React in `frontend/`
- Backend: FastAPI + SQLAlchemy in `backend/`
- Database: PostgreSQL only
- Default local ports: frontend `5173`, backend `8000`

## Prerequisites

- Node.js 18+
- Python 3.12+
- PostgreSQL reachable at `localhost:5432`
- or using neon
change .env
DATABASE_URL=postgresql://neondb_owner:npg_IgmQ9YCx2MHj@ep-polished-frog-al0uhsk4-pooler.c-3.eu-central-1.aws.neon.tech/neondb?sslmode=require

export to neon
```bash
sudo -u postgres pg_dump --no-owner --no-privileges -U postgres quran | psql "postgresql://neondb_owner:npg_IgmQ9YCx2MHj@ep-polished-frog-al0uhsk4.c-3.eu-central-1.aws.neon.tech/neondb?sslmode=require"
```

## First-Time Setup

```bash
npm install
npm --prefix frontend install
copy .env.example .env
python -m pip install -e .
```

## Run Commands

```bash
# backend only
npm run backend

# frontend only
npm run frontend

# frontend + backend together
npm run dev
```

Frontend runs at `http://localhost:5173` and backend runs at `http://localhost:8000`.

## Backend Utilities

```bash
# verify PostgreSQL connectivity
python backend/scripts/check_postgres.py

# apply schema
python backend/scripts/apply_schema.py

# run backend without reload
npm run backend:start

# run backend tests
npm run test:backend
```

## Project Structure

```text
/
├── backend/
│   ├── app/
│   ├── scripts/
│   ├── sql/
│   └── tests/
├── frontend/
│   ├── pages/
│   ├── styles/
│   ├── App.jsx
│   ├── api.js
│   ├── main.jsx
│   ├── package.json
│   └── vite.config.js
├── dist/
├── package.json
├── pyproject.toml
├── Dockerfile
├── docker-compose.yml
└── k8s.yaml
```

## API Surface

### Bible
- `GET /api/bible/books`
- `GET /api/bible/books/:id`
- `GET /api/bible/books/:id/chapters-count`
- `GET /api/bible/books/:id/chapters/:chapterId/verses`
- `GET /api/bible/search?q=`

### Quran
- `GET /api/quran/surahs`
- `GET /api/quran/surahs/:id/verses`
- `GET /api/quran/tafseer-books`
- `GET /api/quran/tafseer/:surah/:book/:verse`
- `GET /api/quran/related-verses/:surah/:verse`
- `GET /api/quran/search?q=`

## Container Workflow

```bash
docker compose up --build
```

This starts a backend container on `8000` and a frontend container on `5173`.
