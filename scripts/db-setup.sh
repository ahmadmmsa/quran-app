#!/bin/sh
# Populate a database from the split dumps (base first, then embeddings — the
# embeddings table FKs to quran_verses and needs the vector type from base).
#
# Two ways it runs:
#   A) Docker db init hook (no argument): mounted into /docker-entrypoint-initdb.d,
#      Postgres runs it once on first init and it restores into the local DB.
#   B) External DB (Neon / Cloud SQL / local host Postgres): run it from a host
#      with a connection string:
#          ./scripts/db-setup.sh "postgresql://USER:PASS@HOST/quran?sslmode=require"
#      Uses local pg_restore if present, otherwise the pgvector docker image.
#      The target must support pgvector (Neon & Cloud SQL do; a local Postgres
#      needs the pgvector package installed).
set -e

TARGET="${1:-${DATABASE_URL:-}}"

# --- Mode A: Postgres init hook (inside the db container, no target given) ---
if [ -z "$TARGET" ]; then
    echo "Restoring base + embeddings into '$POSTGRES_DB'..."
    # -U is required: init scripts run as the OS 'postgres' user, not a DB role.
    pg_restore -U "$POSTGRES_USER" --no-owner --no-privileges -d "$POSTGRES_DB" /dump/quran_full.dump
    pg_restore -U "$POSTGRES_USER" --no-owner --no-privileges -d "$POSTGRES_DB" /dump/quran_verse_embeddings.dump
    echo "Restore complete."
    exit 0
fi

# --- Mode B: populate an external DB from the host ---
DUMPDIR="$(cd "$(dirname "$0")/../backend/data" && pwd)"
echo "Populating external DB from $DUMPDIR ..."
if command -v pg_restore >/dev/null 2>&1; then
    pg_restore --no-owner --no-privileges -d "$TARGET" "$DUMPDIR/quran_full.dump"
    pg_restore --no-owner --no-privileges -d "$TARGET" "$DUMPDIR/quran_verse_embeddings.dump"
else
    docker run --rm -e U="$TARGET" -v "$DUMPDIR:/dump:ro" pgvector/pgvector:pg18 sh -c '
        pg_restore --no-owner --no-privileges -d "$U" /dump/quran_full.dump &&
        pg_restore --no-owner --no-privileges -d "$U" /dump/quran_verse_embeddings.dump'
fi
echo "Done."
