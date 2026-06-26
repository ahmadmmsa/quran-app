#!/usr/bin/env bash
#
# One-time generator for backend/data/quran_full.dump — the COMPLETE database
# image (base content + pgvector extension + all migrations + verse embeddings +
# alembic state) that the db container restores on every start.
#
# RESUMABLE: the build DB lives in a named volume and the migrate+backfill runs
# DETACHED, so if this script is interrupted (the embeddings backfill takes a
# while on CPU), just re-run it — it resumes from the partial state instead of
# starting over. Throwaway DB/volume are removed only after a successful dump.
#
# Re-run from scratch: `docker rm -f quran_dumpbuild_db quran_dumpbuild_app;
#                       docker volume rm quran_dumpbuild_pgdata` then run this.
set -euo pipefail
cd "$(dirname "$0")/.."   # repo root

BASE_DUMP="backend/data/postgresql_quran_backup.dump"
OUT_DUMP="backend/data/quran_full.dump"               # base content (no embeddings)
OUT_EMB_DUMP="backend/data/quran_verse_embeddings.dump"  # embeddings layer
PG_IMAGE="pgvector/pgvector:pg18"
APP_IMAGE="quran-app"
NET="quran_dumpbuild_net"
DB="quran_dumpbuild_db"
VOL="quran_dumpbuild_pgdata"
APP="quran_dumpbuild_app"
TARGET=6236

dbexec()      { docker exec "$DB" "$@"; }
emb_count()   { dbexec psql -U quran -d quran -tAc "SELECT count(*) FROM quran_verse_embeddings" 2>/dev/null || echo 0; }
verse_count() { dbexec psql -U quran -d quran -tAc "SELECT count(*) FROM quran_verses" 2>/dev/null || echo 0; }
running()     { docker ps --format '{{.Names}}' | grep -qx "$1"; }

[ -f "$BASE_DUMP" ] || { echo "FATAL: $BASE_DUMP not found" >&2; exit 1; }
docker image inspect "$APP_IMAGE" >/dev/null 2>&1 || docker compose build app

# --- Persistent build DB (resumable across runs) ---
docker network inspect "$NET" >/dev/null 2>&1 || docker network create "$NET" >/dev/null
if ! running "$DB"; then
  docker rm -f "$DB" >/dev/null 2>&1 || true
  docker run -d --name "$DB" --network "$NET" \
    -e POSTGRES_USER=quran -e POSTGRES_PASSWORD=quran \
    -v "$VOL:/var/lib/postgresql/18/docker" \
    -v "$PWD/$BASE_DUMP:/base.dump:ro" \
    "$PG_IMAGE" >/dev/null
fi
echo "==> Waiting for Postgres..."
until dbexec pg_isready -U quran -d quran >/dev/null 2>&1; do sleep 1; done

# --- Restore base content (only if not already loaded) ---
if [ "$(verse_count)" -lt 1 ]; then
  echo "==> Restoring base content..."
  # docker exec runs as root (not a DB role), so -U quran is required.
  dbexec pg_restore -U quran --no-owner --no-privileges -d quran /base.dump || true
  [ "$(verse_count)" -ge 1 ] || { echo "FATAL: base restore failed" >&2; exit 1; }
fi
echo "    base: $(verse_count) verses, $(emb_count)/$TARGET embeddings so far"

# --- Migrate + backfill, DETACHED + resumable ---
if [ "$(emb_count)" -lt "$TARGET" ]; then
  if ! running "$APP"; then
    echo "==> Starting migrate + backfill (detached; survives interruptions)..."
    docker rm -f "$APP" >/dev/null 2>&1 || true
    docker run -d --name "$APP" --network "$NET" \
      -e DB_HOST="$DB" -e DB_PORT=5432 -e DB_USER=quran -e DB_PASSWORD=quran -e DB_NAME=quran \
      -e APP_ENV=development -e HF_HUB_OFFLINE=1 -e EMBEDDING_THREADS="${EMBEDDING_THREADS:-6}" \
      "$APP_IMAGE" sh -c "alembic -c backend/alembic.ini upgrade head && python -m backend.scripts.backfill_verse_embeddings" >/dev/null
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

# --- Write the split dumps: light base (no embeddings) + embeddings layer ---
echo "==> Writing base dump (no embeddings)..."
dbexec pg_dump -U quran -Fc --no-owner --exclude-table=public.quran_verse_embeddings -d quran > "$OUT_DUMP"
echo "==> Writing embeddings dump..."
dbexec pg_dump -U quran -Fc --no-owner -t public.quran_verse_embeddings -d quran > "$OUT_EMB_DUMP"

echo "==> Cleaning up throwaway DB/volume..."
docker rm -f "$APP" "$DB" >/dev/null 2>&1 || true
docker volume rm "$VOL" >/dev/null 2>&1 || true
docker network rm "$NET" >/dev/null 2>&1 || true

echo "==> Done."
echo "    $(du -h "$OUT_DUMP" | cut -f1) -> $OUT_DUMP"
echo "    $(du -h "$OUT_EMB_DUMP" | cut -f1) -> $OUT_EMB_DUMP"
