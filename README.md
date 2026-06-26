# Abrahamic Scriptures (Quran App)

A full-stack application for exploring Abrahamic scriptures, featuring semantic search, ontology management, and a seamless bilingual reading experience.

## Architecture

- **Frontend**: React + Vite (located in `frontend/`)
- **Backend**: FastAPI + SQLAlchemy (located in `backend/`)
- **Database**: PostgreSQL
- **Containerization**: Docker & Docker Compose

## Prerequisites

- [Node.js](https://nodejs.org/) (v18 or higher)
- [Python](https://www.python.org/) (v3.12 or higher)
- [PostgreSQL](https://www.postgresql.org/) (or use a remote instance like Neon)
- [Docker](https://www.docker.com/) (optional, for containerized deployments)

## Environment Configuration

Configure your application by creating a `.env` file in the root directory based on `.env.example`.

### Key Variables:
- **Application Ports**: `APP_PORT` (Backend internal), `BACKEND_EXTERNAL_PORT` (Backend exposed via Docker), `FRONTEND_EXTERNAL_PORT` (Frontend exposed via Docker).
- **Database Configuration**: `DB_USER`, `DB_PASSWORD`, `DB_HOST`, `DB_PORT`, `DB_NAME` or provide a full `DATABASE_URL`.
- **API Configuration**: `VITE_API_URL` for frontend API requests.

*Note: Ensure your `docker-compose.yml` and `.env` ports align for a seamless startup, as there is a single source of truth for your dynamic ports.*

## Setup and Installation (Local)

1. **Install Frontend Dependencies:**
   ```bash
   npm --prefix frontend install
   ```

2. **Install Backend Dependencies:**
   ```bash
   python -m pip install -e .
   ```
   *(It is recommended to use a virtual environment like `.venv`)*

3. **Configure Environment Variables:**
   ```bash
   cp .env.example .env
   ```
   *Edit `.env` with your specific database credentials and port preferences.*

## Running the Application

You can start the backend and frontend using npm scripts defined in the root `package.json`:

```bash
# Start backend
npm run backend

# Start frontend
npm run frontend
```

## Docker Development & Deployment

### Local Development (Multi-Container)
For local development, Docker Compose builds separate frontend and backend containers. This enables features like hot-reloading when modifying code files.

```bash
# Start all containers in the background with live-reload
docker compose up -d --build

# Stop the containers
docker compose down
```

### Production Build (Unified Single-Image)
For production environments (like Kubernetes), the entire application is packaged into a single, unified Docker image. The FastAPI backend serves the frontend static assets under `/` and the API under `/api`.

```bash
# Build the unified image
docker build -t 192.168.8.25:5000/quran-app:latest .

# Push the image to your registry
docker push 192.168.8.25:5000/quran-app:latest
```

## Kubernetes Deployment
You can deploy the single unified image to your Kubernetes cluster using the provided [k8s.yaml](file:///home/ahmad/repositories/quran-app/k8s.yaml) manifest.

```bash
# Apply the namespace, secrets, deployment, service, and ingress
kubectl apply -f k8s.yaml
```

## Database Initialization
If using a managed PostgreSQL provider like Neon, you can import an existing database dump:
```bash
pg_dump --no-owner --no-privileges -U postgres quran | psql "postgresql://[user]:[password]@[host]/[dbname]?sslmode=require"
```
