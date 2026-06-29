"""Self-bootstrap the database on app startup.

Inspects the configured database and brings it to a ready state with no manual
steps, uniformly for the bundled docker DB and external targets (Neon / Cloud
SQL / local Postgres):

  1. DB exists?      else CREATE DATABASE (best-effort; managed providers pre-create it).
  2. Base present?   else restore quran_full.dump        (schema + base content + vector ext).
  3. Embeddings?     else restore quran_embeddings.dump.
  4. Migrations      -> alembic upgrade head (idempotent; applies anything newer than the dump).

A Postgres advisory lock serializes concurrent replicas.
"""
from __future__ import annotations

import logging
import subprocess
import time
from pathlib import Path

from sqlalchemy import text
from sqlalchemy.exc import OperationalError

from backend.app.config import get_settings
from backend.app.session import engine

logger = logging.getLogger(__name__)

_LOCK_KEY = 873242001  # arbitrary, stable across replicas
_BASE_DUMP = "quran_full.dump"
_EMBEDDINGS_DUMP = "quran_embeddings.dump"
_ALEMBIC_INI = Path(__file__).resolve().parents[1] / "alembic.ini"


def _ensure_database_exists(settings) -> None:
    """Best-effort CREATE DATABASE for DB_TYPE parts (docker/local). Skipped when
    DATABASE_URL is set (managed providers pre-create the database)."""
    if settings.database_url_override or not settings.db_name:
        return
    import psycopg2
    from psycopg2 import sql

    common = dict(host=settings.db_host, port=settings.db_port,
                  user=settings.db_user, password=settings.db_password, connect_timeout=3)
    try:
        psycopg2.connect(dbname=settings.db_name, **common).close()
        return  # already exists
    except psycopg2.OperationalError as exc:
        if "does not exist" not in str(exc):
            return  # not reachable yet for another reason; the retry loop handles it
    try:
        admin = psycopg2.connect(dbname="postgres", **common)
        admin.autocommit = True
        admin.cursor().execute(sql.SQL("CREATE DATABASE {}").format(sql.Identifier(settings.db_name)))
        admin.close()
        logger.info("Created database %r", settings.db_name)
    except Exception:
        logger.warning("Could not auto-create database %r (it may need to be created manually)",
                       settings.db_name, exc_info=True)


def _connect_with_retry(attempts: int = 20, delay: float = 2.0):
    for i in range(1, attempts + 1):
        try:
            return engine.connect().execution_options(isolation_level="AUTOCOMMIT")
        except OperationalError:
            if i == attempts:
                raise
            logger.info("Waiting for database… (%d/%d)", i, attempts)
            time.sleep(delay)


def _has_rows(conn, table: str) -> bool:
    reg = conn.execute(text("SELECT to_regclass(:t)"), {"t": f"public.{table}"}).scalar()
    if reg is None:
        return False
    return (conn.execute(text(f"SELECT count(*) FROM {table}")).scalar() or 0) > 0


def _restore(database_url: str, dump_path: Path) -> None:
    if not dump_path.exists():
        raise FileNotFoundError(f"Dump not found: {dump_path}")
    logger.info("Restoring %s …", dump_path.name)
    result = subprocess.run(
        ["pg_restore", "--no-owner", "--no-privileges", "-d", database_url, str(dump_path)],
        capture_output=True, text=True,
    )
    # pg_restore can exit non-zero on benign warnings; we verify by row count after.
    if result.returncode != 0:
        logger.debug("pg_restore warnings for %s:\n%s", dump_path.name, result.stderr.strip())


def _ensure_admin(conn, settings) -> None:
    """Idempotently create or promote the admin from quran.conf [admin], so a
    fresh DB (e.g. after `down -v`) never needs manual admin creation."""
    if not (settings.admin_email and settings.admin_password):
        return
    from backend.app.services.auth import get_password_hash

    email = settings.admin_email
    exists = conn.execute(text("SELECT 1 FROM users WHERE email = :e"), {"e": email}).first()
    if exists:
        conn.execute(text("UPDATE users SET is_admin = TRUE WHERE email = :e"), {"e": email})
        logger.info("Admin ensured (promoted): %s", email)
    else:
        conn.execute(
            text("INSERT INTO users (email, hashed_password, is_admin) VALUES (:e, :p, TRUE)"),
            {"e": email, "p": get_password_hash(settings.admin_password)},
        )
        logger.info("Admin created: %s", email)


def _alembic_upgrade() -> None:
    try:
        from alembic import command
        from alembic.config import Config

        command.upgrade(Config(str(_ALEMBIC_INI)), "head")
        logger.info("alembic upgrade head: ok")
    except Exception:
        logger.warning("alembic upgrade head failed (continuing; data is present)", exc_info=True)


def ensure_database_ready() -> None:
    settings = get_settings()
    if not settings.auto_bootstrap:
        logger.info("AUTO_BOOTSTRAP disabled; skipping database bootstrap")
        return

    _ensure_database_exists(settings)
    data_dir = Path(settings.data_dir)
    conn = _connect_with_retry()
    conn.execute(text("SELECT pg_advisory_lock(:k)"), {"k": _LOCK_KEY})
    try:
        if not _has_rows(conn, "quran_verses"):
            _restore(settings.database_url, data_dir / _BASE_DUMP)
            if not _has_rows(conn, "quran_verses"):
                raise RuntimeError("Base restore did not populate quran_verses")
            logger.info("Base content restored")

        if not _has_rows(conn, "quran_verse_embeddings"):
            _restore(settings.database_url, data_dir / _EMBEDDINGS_DUMP)
            logger.info("Embeddings restored")

        _alembic_upgrade()
        _ensure_admin(conn, settings)
        logger.info("Database ready.")
    finally:
        conn.execute(text("SELECT pg_advisory_unlock(:k)"), {"k": _LOCK_KEY})
        conn.close()
