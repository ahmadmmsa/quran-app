"""Create (or promote) the bootstrap admin user.

Credentials come from the [admin] section of quran.conf (ADMIN_EMAIL /
ADMIN_PASSWORD), or the equivalent environment variables.

Usage (inside the app container):
    docker compose exec app python -m backend.scripts.create_admin
"""
import sys

from sqlalchemy import text

from backend.app.config import get_settings
from backend.app.services.auth import get_password_hash
from backend.app.session import SessionLocal


def main() -> None:
    settings = get_settings()
    email = settings.admin_email
    password = settings.admin_password
    if not email or not password:
        sys.exit("Set ADMIN_EMAIL and ADMIN_PASSWORD in quran.conf [admin] (or the environment).")

    db = SessionLocal()
    try:
        existing = db.execute(text("SELECT id FROM users WHERE email = :email"), {"email": email}).first()
        if existing:
            db.execute(text("UPDATE users SET is_admin = TRUE WHERE email = :email"), {"email": email})
            db.commit()
            print(f"Existing account {email} promoted to admin.")
        else:
            db.execute(
                text("INSERT INTO users (email, hashed_password, is_admin) VALUES (:email, :password, TRUE)"),
                {"email": email, "password": get_password_hash(password)},
            )
            db.commit()
            print(f"Admin created: {email}")
    finally:
        db.close()


if __name__ == "__main__":
    main()
