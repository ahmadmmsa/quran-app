from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session
from sqlalchemy import text
from typing import Any
import jwt

from backend.app.session import get_db
from backend.app.config import get_settings
from backend.app.services.auth import (
    create_altcha_challenge,
    verify_altcha_payload,
    get_password_hash,
    verify_password,
    create_access_token,
    verify_google_token
)
from pydantic import BaseModel

settings = get_settings()
router = APIRouter(prefix="/auth", tags=["auth"])
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")

def get_current_admin_user(token: str = Depends(oauth2_scheme)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, settings.jwt_secret_key, algorithms=[settings.jwt_algorithm])
        email: str = payload.get("sub")
        is_admin: bool = payload.get("is_admin")
        if email is None or not is_admin:
            raise credentials_exception
    except jwt.InvalidTokenError:
        raise credentials_exception
    return email

class AltchaPayload(BaseModel):
    altcha: str

class RegisterRequest(BaseModel):
    email: str
    password: str
    altcha: str

class LoginRequest(BaseModel):
    email: str
    password: str

class GoogleLoginRequest(BaseModel):
    token: str

@router.get("/altcha-challenge")
def get_altcha_challenge():
    return create_altcha_challenge()

@router.post("/register")
def register(request: RegisterRequest, db: Session = Depends(get_db)):
    if not verify_altcha_payload(request.altcha):
        raise HTTPException(status_code=400, detail="Invalid Altcha payload")
    
    # Check if user exists
    user_exists = db.execute(text("SELECT id FROM users WHERE email = :email"), {"email": request.email}).first()
    if user_exists:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    try:
        hashed_pwd = get_password_hash(request.password)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))

    # Insert new user. Self-registration never grants admin; admins are created
    # out-of-band via create_admin.py.
    db.execute(
        text("INSERT INTO users (email, hashed_password, is_admin) VALUES (:email, :hashed_password, :is_admin)"),
        {"email": request.email, "hashed_password": hashed_pwd, "is_admin": False}
    )
    db.commit()
    
    return {"message": "User registered successfully"}

@router.post("/login")
def login(request: LoginRequest, db: Session = Depends(get_db)):
    user = db.execute(text("SELECT id, email, hashed_password, is_admin FROM users WHERE email = :email"), {"email": request.email}).first()
    
    if not user or not user.hashed_password:
        raise HTTPException(status_code=400, detail="Incorrect email or password")
    
    if not verify_password(request.password, user.hashed_password):
        raise HTTPException(status_code=400, detail="Incorrect email or password")
    
    access_token = create_access_token(data={"sub": user.email, "is_admin": user.is_admin})
    return {"access_token": access_token, "token_type": "bearer"}

@router.post("/google")
def google_login(request: GoogleLoginRequest, db: Session = Depends(get_db)):
    idinfo = verify_google_token(request.token)
    if not idinfo:
        raise HTTPException(status_code=400, detail="Invalid Google token")
    
    email = idinfo.get("email")
    if not email:
        raise HTTPException(status_code=400, detail="No email provided in Google token")
    
    user = db.execute(text("SELECT id, email, is_admin FROM users WHERE email = :email"), {"email": email}).first()
    
    if not user:
        # Implicit registration via Google OAuth never grants admin.
        db.execute(
            text("INSERT INTO users (email, hashed_password, is_admin) VALUES (:email, :hashed_password, :is_admin)"),
            {"email": email, "hashed_password": None, "is_admin": False}
        )
        db.commit()
        is_admin = False
    else:
        is_admin = user.is_admin
        
    access_token = create_access_token(data={"sub": email, "is_admin": is_admin})
    return {"access_token": access_token, "token_type": "bearer"}
