#!/usr/bin/env bash
#
# Regenerate backend/data/quran_embeddings.dump from quran_full.dump.
#
# quran_full.dump is the source of truth for the base content (already migrated,
# minus the embeddings table). This re-embeds every verse and writes a fresh
# embeddings dump — run it after changing the embedding model. The app picks up
# the new dump on next start (it restores it when the embeddings table is empty).
#
# RESUMABLE: the build DB lives in a named volume and the backfill runs DETACHED,
# so an interrupted run just resumes on re-run. Throwaway DB/volume are removed
# only after a successful dump.
#
# Reset from scratch: `docker rm -f quran_dumpbuild_db quran_dumpbuild_app;
#                      docker volume rm quran_dumpbuild_pgdata` then run this.
set -euo pipefail
cd "$(dirname "$0")/../.."   # repo root

SOURCE_DUMP="backend/data/quran_full.dump"               # migrated base (input + source of truth)
OUT_EMB_DUMP="backend/data/quran_embeddings.dump"  # regenerated output
PG_IMAGE="pgvector/pgvector:pg18"
APP_IMAGE="quran-app"
NET="quran_dumpbuild_net"
DB="quran_dumpbuild_db"
VOL="quran_dumpbuild_pgdata"
APP="quran_dumpbuild_app"

dbexec()      { docker exec "$DB" "$@"; }
emb_count()   { dbexec psql -U quran -d quran -tAc "SELECT count(*) FROM quran_verse_embeddings" 2>/dev/null || echo 0; }
verse_count() { dbexec psql -U quran -d quran -tAc "SELECT count(*) FROM quran_verses" 2>/dev/null || echo 0; }
running()     { docker ps --format '{{.Names}}' | grep -qx "$1"; }

[ -f "$SOURCE_DUMP" ] || { echo "FATAL: $SOURCE_DUMP not found" >&2; exit 1; }
docker image inspect "$APP_IMAGE" >/dev/null 2>&1 || docker compose build app

# --- Persistent build DB (resumable across runs) ---
docker network inspect "$NET" >/dev/null 2>&1 || docker network create "$NET" >/dev/null
if ! running "$DB"; then
  docker rm -f "$DB" >/dev/null 2>&1 || true
  docker run -d --name "$DB" --network "$NET" \
    -e POSTGRES_USER=quran -e POSTGRES_PASSWORD=quran \
    -v "$VOL:/var/lib/postgresql/18/docker" \
    "$PG_IMAGE" >/dev/null
fi
echo "==> Waiting for Postgres..."
until dbexec pg_isready -U quran -d quran >/dev/null 2>&1; do sleep 1; done

# --- Restore the base (only if not already loaded). Piped via stdin so the
#     source file is never bind-mounted (it's also a sibling of the output). ---
if [ "$(verse_count)" -lt 1 ]; then
  echo "==> Restoring base from $SOURCE_DUMP..."
  docker exec -i "$DB" pg_restore -U quran --no-owner --no-privileges -d quran < "$SOURCE_DUMP" || true
  [ "$(verse_count)" -ge 1 ] || { echo "FATAL: base restore failed" >&2; exit 1; }
fi

# --- Ensure the embeddings table exists (quran_full.dump excludes it, and its
#     alembic state is already at head so a migration won't recreate it). ---
dbexec psql -U quran -d quran -v ON_ERROR_STOP=1 \
  -c "CREATE EXTENSION IF NOT EXISTS vector;" \
  -c "CREATE TABLE IF NOT EXISTS quran_verse_embeddings (verse_id INTEGER PRIMARY KEY REFERENCES quran_verses(id) ON DELETE CASCADE, embedding vector(1024) NOT NULL);" \
  -c "CREATE INDEX IF NOT EXISTS ix_quran_verse_embeddings_embedding ON quran_verse_embeddings USING hnsw (embedding vector_cosine_ops);" >/dev/null

TARGET="$(verse_count)"
echo "    base: $TARGET verses, $(emb_count)/$TARGET embeddings so far"

# --- Backfill, DETACHED + resumable ---
if [ "$(emb_count)" -lt "$TARGET" ]; then
  if ! running "$APP"; then
    echo "==> Starting backfill (detached; survives interruptions)..."
    docker rm -f "$APP" >/dev/null 2>&1 || true
    docker run -d --name "$APP" --network "$NET" \
      -e DB_HOST="$DB" -e DB_PORT=5432 -e DB_USER=quran -e DB_PASSWORD=quran -e DB_NAME=quran \
      -e APP_ENV=development -e HF_HUB_OFFLINE=1 -e AUTO_BOOTSTRAP=false \
      -e EMBEDDING_THREADS="${EMBEDDING_THREADS:-6}" \
      "$APP_IMAGE" python -m backend.scripts.backfill_verse_embeddings >/dev/null
  else
    echo "==> Backfill already running; following progress..."
  fi
  while [ "$(emb_count)" -lt "$TARGET" ]; do
    if ! running "$APP"; then
      echo "FATAL: backfill exited early ($(emb_count)/$TARGET). Last logs:" >&2
      docker logs --tail 40 "$APP" 2>&1 || true
      exit 1
    fi
    echo "    embeddings: $(emb_count)/$TARGET"
    sleep 20
  done
fi
echo "    embeddings complete: $(emb_count)/$TARGET"

# --- Write the embeddings dump ---
echo "==> Writing embeddings dump..."
dbexec pg_dump -U quran -Fc --no-owner -t public.quran_verse_embeddings -d quran > "$OUT_EMB_DUMP"

echo "==> Cleaning up throwaway DB/volume..."
docker rm -f "$APP" "$DB" >/dev/null 2>&1 || true
docker volume rm "$VOL" >/dev/null 2>&1 || true
docker network rm "$NET" >/dev/null 2>&1 || true

echo "==> Done. $(du -h "$OUT_EMB_DUMP" | cut -f1) -> $OUT_EMB_DUMP"
