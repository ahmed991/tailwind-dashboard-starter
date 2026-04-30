import secrets
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from pydantic import BaseModel, EmailStr
from typing import Optional

from database.connection import get_db
from database.models import User
from auth.jwt import hash_password, verify_password, create_access_token, get_current_user
from services.email_service import send_approval_request, send_approval_confirmation

router = APIRouter(prefix="/auth", tags=["auth"])


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str
    full_name: Optional[str] = None
    organisation: Optional[str] = None
    role: Optional[str] = None       # "brand" | "regulatory" | "farmer"
    role_data: Optional[dict] = None # full role-specific profile


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user_id: int
    email: str
    full_name: Optional[str]
    role: Optional[str] = None


class RegisterResponse(BaseModel):
    message: str
    pending_approval: bool = True


class UserResponse(BaseModel):
    id: int
    email: str
    full_name: Optional[str]
    organisation: Optional[str]
    role: Optional[str]
    is_active: bool

    class Config:
        from_attributes = True


@router.post("/register", response_model=RegisterResponse, status_code=201)
def register(payload: RegisterRequest, db: Session = Depends(get_db)):
    existing = db.query(User).filter(User.email == payload.email).first()
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")

    approval_token = secrets.token_urlsafe(32)

    user = User(
        email=payload.email,
        hashed_password=hash_password(payload.password),
        full_name=payload.full_name,
        organisation=payload.organisation,
        role=payload.role,
        role_data=payload.role_data,
        is_active=True,
        is_approved=False,
        approval_token=approval_token,
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    try:
        send_approval_request(
            user_email=user.email,
            full_name=user.full_name or user.email,
            organisation=user.organisation or "",
            role=user.role or "",
            token=approval_token,
        )
    except Exception as e:
        print(f"[email] Failed to send approval request: {e}")

    return RegisterResponse(
        message="Registration successful. Your account is pending admin approval. You will receive an email once approved.",
        pending_approval=True,
    )


@router.get("/approve/{token}")
def approve_user(token: str, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.approval_token == token).first()
    if not user:
        raise HTTPException(status_code=404, detail="Invalid or expired approval link")

    user.is_approved = True
    user.approval_token = None
    db.commit()

    try:
        send_approval_confirmation(
            user_email=user.email,
            full_name=user.full_name or user.email,
        )
    except Exception as e:
        print(f"[email] Failed to send approval confirmation to user: {e}")

    return {"message": f"Account for {user.email} has been approved. The user can now log in."}


@router.post("/login", response_model=TokenResponse)
def login(form: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == form.username).first()
    if not user or not verify_password(form.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    if not user.is_active:
        raise HTTPException(status_code=400, detail="Account is disabled")
    if not user.is_approved:
        raise HTTPException(
            status_code=403,
            detail="Your account is pending admin approval. You will receive an email once your account is approved.",
        )

    token = create_access_token({"sub": str(user.id)})
    return TokenResponse(
        access_token=token,
        user_id=user.id,
        email=user.email,
        full_name=user.full_name,
        role=user.role,
    )


@router.get("/me", response_model=UserResponse)
def get_me(current_user: User = Depends(get_current_user)):
    return current_user


@router.post("/logout")
def logout():
    # JWT is stateless — client just deletes the token
    return {"message": "Logged out successfully"}
