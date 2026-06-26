import hashlib
import hmac
import json
import logging
import secrets
import base64
import time
from datetime import datetime, timedelta, timezone
from typing import Optional
from urllib.parse import parse_qs

import jwt
import bcrypt
from google.auth.exceptions import GoogleAuthError
from google.oauth2 import id_token
from google.auth.transport import requests

from backend.app.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()

# bcrypt silently truncates anything past 72 bytes, so reject longer inputs
# rather than letting two distinct passwords collide.
BCRYPT_MAX_PASSWORD_BYTES = 72

# How long an Altcha challenge stays solvable before it must be re-issued.
ALTCHA_TTL_SECONDS = 300


def verify_password(plain_password: str, hashed_password: str) -> bool:
    try:
        return bcrypt.checkpw(plain_password.encode('utf-8'), hashed_password.encode('utf-8'))
    except ValueError:
        return False

def get_password_hash(password: str) -> str:
    if len(password.encode('utf-8')) > BCRYPT_MAX_PASSWORD_BYTES:
        raise ValueError(
            f"Password must be at most {BCRYPT_MAX_PASSWORD_BYTES} bytes."
        )
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(password.encode('utf-8'), salt).decode('utf-8')

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(minutes=settings.jwt_expire_minutes)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, settings.jwt_secret_key, algorithm=settings.jwt_algorithm)
    return encoded_jwt

# Altcha logic
def create_altcha_challenge() -> dict:
    # Embed an expiry in the salt (Altcha spec) so solved payloads cannot be
    # replayed indefinitely. The client hashes the full salt, so the expiry is
    # covered by both the proof-of-work and the HMAC signature.
    expires = int(time.time()) + ALTCHA_TTL_SECONDS
    salt = f"{secrets.token_hex(12)}?expires={expires}"
    number = secrets.randbelow(100000)

    challenge = hashlib.sha256(f"{salt}{number}".encode('utf-8')).hexdigest()
    
    # Calculate HMAC signature of the challenge
    signature = hmac.new(
        settings.altcha_hmac_key.encode('utf-8'),
        challenge.encode('utf-8'),
        hashlib.sha256
    ).hexdigest()

    return {
        "algorithm": "SHA-256",
        "challenge": challenge,
        "salt": salt,
        "signature": signature
    }

def verify_altcha_payload(payload_b64: str) -> bool:
    try:
        payload_json = base64.b64decode(payload_b64).decode('utf-8')
        payload = json.loads(payload_json)
        
        algorithm = payload.get("algorithm")
        challenge = payload.get("challenge")
        number = payload.get("number")
        salt = payload.get("salt")
        signature = payload.get("signature")

        if not all([algorithm, challenge, number is not None, salt, signature]):
            return False

        if algorithm != "SHA-256":
            return False

        # Reject expired challenges. The salt carries an `expires` unix timestamp.
        salt_query = salt.split('?', 1)[1] if '?' in salt else ''
        expires_values = parse_qs(salt_query).get('expires')
        if not expires_values:
            return False
        try:
            if int(expires_values[0]) < int(time.time()):
                return False
        except (TypeError, ValueError):
            return False

        # Verify signature
        expected_signature = hmac.new(
            settings.altcha_hmac_key.encode('utf-8'),
            challenge.encode('utf-8'),
            hashlib.sha256
        ).hexdigest()

        if not hmac.compare_digest(expected_signature, signature):
            return False

        # Verify PoW challenge
        expected_challenge = hashlib.sha256(f"{salt}{number}".encode('utf-8')).hexdigest()
        if expected_challenge != challenge:
            return False

        return True
    except Exception:
        return False

def verify_google_token(token: str) -> dict | None:
    try:
        # Specify the CLIENT_ID of the app that accesses the backend:
        idinfo = id_token.verify_oauth2_token(token, requests.Request(), settings.google_client_id)
        return idinfo
    except (ValueError, GoogleAuthError):
        # Invalid or unverifiable token
        return None
