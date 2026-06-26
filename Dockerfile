FROM python:3.12-slim AS backend
LABEL component="quran-app/backend"
WORKDIR /app
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
COPY requirements.txt ./
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt
COPY pyproject.toml ./
COPY backend ./backend
FROM node:20-alpine AS frontend
LABEL component="quran-app/frontend"
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend ./
RUN npm run build
FROM python:3.12-slim
WORKDIR /app
# onnxruntime (pulled in by fastembed) needs the OpenMP runtime at import time.
RUN apt-get update && apt-get install -y --no-install-recommends libgomp1 \
    && rm -rf /var/lib/apt/lists/*
COPY --from=backend /usr/local/lib/python3.12/site-packages /usr/local/lib/python3.12/site-packages
COPY --from=backend /usr/local/bin /usr/local/bin
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV EMBEDDING_MODEL_NAME=intfloat/multilingual-e5-large
ENV EMBEDDING_CACHE_DIR=/app/backend/data
# Bake the embedding model into the image at backend/data so there is no runtime
# download and no volume. Done before the source COPY so editing backend code
# doesn't invalidate this layer and re-trigger the ~2 GB download.
RUN python -c "from fastembed import TextEmbedding; TextEmbedding('${EMBEDDING_MODEL_NAME}', cache_dir='${EMBEDDING_CACHE_DIR}')"
COPY --from=backend /app/backend ./backend
COPY --from=frontend /app/frontend/dist ./frontend/dist
COPY pyproject.toml ./
EXPOSE 8000
CMD ["sh", "-c", "uvicorn backend.app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
