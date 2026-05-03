FROM python:3.12-slim AS backend

WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

# Copy backend files
COPY pyproject.toml ./
COPY backend ./backend

# Install Python dependencies
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir fastapi uvicorn pydantic pydantic-settings sqlalchemy psycopg2-binary python-dotenv

# Build frontend
FROM node:20-alpine AS frontend

WORKDIR /app/frontend

# Copy frontend files
COPY frontend/package*.json ./
RUN npm ci

COPY frontend ./
RUN npm run build

# Final stage
FROM python:3.12-slim

WORKDIR /app

# Copy backend from backend stage
COPY --from=backend /usr/local/lib/python3.12/site-packages /usr/local/lib/python3.12/site-packages
COPY --from=backend /usr/local/bin /usr/local/bin
COPY --from=backend /app/backend ./backend

# Copy built frontend from frontend stage
COPY --from=frontend /app/frontend/dist ./frontend/dist

# Copy any other necessary files
COPY pyproject.toml ./

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

EXPOSE 8000

# Start the application
CMD uvicorn backend.app.main:app --host 0.0.0.0 --port ${PORT:-8000}
