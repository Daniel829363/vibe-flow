import os
import logging
import httpx
from fastapi import APIRouter, HTTPException, Depends, status, Response, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from datetime import datetime, timezone

from app.database import get_db
from app.models.user import User
from app.auth.security import (
    hash_password,
    verify_password,
    create_access_token,
    create_refresh_token,
    create_verification_token,
    create_password_reset_token,
    decode_token,
    get_current_user,
)
from app.auth.schemas import (
    RegisterRequest,
    LoginRequest,
    RefreshRequest,
    GoogleCompleteRequest,
    ForgotPasswordRequest,
    ResetPasswordRequest,
    VerifyEmailRequest,
)
from app.auth.email_service import send_verification_email, send_password_reset_email

logger = logging.getLogger(__name__)
router = APIRouter()

GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID", "")
GOOGLE_CLIENT_SECRET = os.getenv("GOOGLE_CLIENT_SECRET", "")
APP_URL = os.getenv("APP_URL", "http://localhost:5000")


# ─────────────────────────────────────────────
#  POST /api/auth/register
# ─────────────────────────────────────────────
@router.post("/register", status_code=status.HTTP_201_CREATED)
async def register(payload: RegisterRequest, db: AsyncSession = Depends(get_db)):
    # Check if email already taken
    existing = await db.execute(select(User).where(User.email == payload.email))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Email already registered")

    user = User(
        email=payload.email,
        name=payload.name,
        phone=payload.phone,
        hashed_password=hash_password(payload.password),
        is_email_verified=False,
    )
    db.add(user)
    await db.flush()  # get the ID

    # Create verification token and save it
    verification_token = create_verification_token(user.id)
    user.email_verification_token = verification_token
    await db.commit()
    await db.refresh(user)

    # Send verification email (non-blocking failure)
    try:
        await send_verification_email(user.email, verification_token)
    except Exception as e:
        logger.warning(f"Failed to send verification email: {e}")

    access_token = create_access_token(user.id)
    refresh_token = create_refresh_token(user.id)

    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "bearer",
        "user": user.to_dict(),
    }


# ─────────────────────────────────────────────
#  POST /api/auth/login
# ─────────────────────────────────────────────
@router.post("/login")
async def login(payload: LoginRequest, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.email == payload.email))
    user = result.scalar_one_or_none()

    if not user or not user.hashed_password:
        raise HTTPException(status_code=401, detail="Invalid email or password")
    if not verify_password(payload.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    access_token = create_access_token(user.id)
    refresh_token = create_refresh_token(user.id)

    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "bearer",
        "user": user.to_dict(),
    }


# ─────────────────────────────────────────────
#  POST /api/auth/refresh
# ─────────────────────────────────────────────
@router.post("/refresh")
async def refresh_token(payload: RefreshRequest, db: AsyncSession = Depends(get_db)):
    token_data = decode_token(payload.refresh_token)

    if token_data.get("type") != "refresh":
        raise HTTPException(status_code=401, detail="Invalid token type")

    user_id = token_data.get("sub")
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(status_code=401, detail="User not found")

    new_access_token = create_access_token(user.id)
    new_refresh_token = create_refresh_token(user.id)

    return {
        "access_token": new_access_token,
        "refresh_token": new_refresh_token,
        "token_type": "bearer",
    }


# ─────────────────────────────────────────────
#  GET /api/auth/me
# ─────────────────────────────────────────────
@router.get("/me")
async def get_me(current_user: User = Depends(get_current_user)):
    data = current_user.to_dict()
    data["require_email_verification"] = os.getenv("REQUIRE_EMAIL_VERIFICATION", "false").strip().lower() == "true"
    return data


# ─────────────────────────────────────────────
#  GET /api/auth/settings (public — no auth needed)
# ─────────────────────────────────────────────
@router.get("/settings")
async def get_auth_settings():
    """Return public auth-related configuration flags."""
    return {
        "require_email_verification": os.getenv("REQUIRE_EMAIL_VERIFICATION", "false").strip().lower() == "true",
    }


# ─────────────────────────────────────────────
#  POST /api/auth/verify-email
# ─────────────────────────────────────────────
@router.post("/verify-email")
async def verify_email(payload: VerifyEmailRequest, db: AsyncSession = Depends(get_db)):
    token_data = decode_token(payload.token)

    if token_data.get("type") != "email_verification":
        raise HTTPException(status_code=400, detail="Invalid verification token")

    user_id = token_data.get("sub")
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if user.is_email_verified:
        return {"message": "Email already verified"}

    user.is_email_verified = True
    user.email_verification_token = None
    await db.commit()

    return {"message": "Email verified successfully"}


# ─────────────────────────────────────────────
#  POST /api/auth/resend-verification
# ─────────────────────────────────────────────
@router.post("/resend-verification")
async def resend_verification(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if current_user.is_email_verified:
        return {"message": "Email already verified"}

    token = create_verification_token(current_user.id)
    current_user.email_verification_token = token
    await db.commit()

    try:
        await send_verification_email(current_user.email, token)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to send email: {str(e)}")

    return {"message": "Verification email sent"}


# ─────────────────────────────────────────────
#  POST /api/auth/forgot-password
# ─────────────────────────────────────────────
@router.post("/forgot-password")
async def forgot_password(payload: ForgotPasswordRequest, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.email == payload.email))
    user = result.scalar_one_or_none()

    # Always return 200 to prevent email enumeration
    if not user:
        return {"message": "If this email is registered, you will receive a reset link"}

    token = create_password_reset_token(user.id)
    user.password_reset_token = token
    user.password_reset_expires = datetime.now(timezone.utc).replace(
        hour=datetime.now(timezone.utc).hour + 1
    )
    await db.commit()

    try:
        await send_password_reset_email(user.email, token)
    except Exception as e:
        logger.warning(f"Failed to send reset email: {e}")

    return {"message": "If this email is registered, you will receive a reset link"}


# ─────────────────────────────────────────────
#  POST /api/auth/reset-password
# ─────────────────────────────────────────────
@router.post("/reset-password")
async def reset_password(payload: ResetPasswordRequest, db: AsyncSession = Depends(get_db)):
    token_data = decode_token(payload.token)

    if token_data.get("type") != "password_reset":
        raise HTTPException(status_code=400, detail="Invalid reset token")

    user_id = token_data.get("sub")
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if not user.password_reset_token:
        raise HTTPException(status_code=400, detail="Password reset token already used")

    if len(payload.new_password) < 8:
        raise HTTPException(status_code=400, detail="Password must be at least 8 characters")

    user.hashed_password = hash_password(payload.new_password)
    user.password_reset_token = None
    user.password_reset_expires = None
    await db.commit()

    return {"message": "Password reset successfully"}


# ─────────────────────────────────────────────
#  GET /api/auth/google  → redirect to Google
# ─────────────────────────────────────────────
@router.get("/google")
async def google_auth():
    if not GOOGLE_CLIENT_ID:
        raise HTTPException(status_code=500, detail="Google OAuth not configured")

    redirect_uri = f"{APP_URL}/auth/google/callback"
    google_auth_url = (
        "https://accounts.google.com/o/oauth2/v2/auth"
        f"?client_id={GOOGLE_CLIENT_ID}"
        f"&redirect_uri={redirect_uri}"
        "&response_type=code"
        "&scope=openid%20email%20profile"
        "&access_type=offline"
        "&prompt=consent"
    )
    from fastapi.responses import RedirectResponse
    return RedirectResponse(google_auth_url)


# ─────────────────────────────────────────────
#  POST /api/auth/google/callback
# ─────────────────────────────────────────────
@router.post("/google/callback")
async def google_callback(request: Request, db: AsyncSession = Depends(get_db)):
    body = await request.json()
    code = body.get("code")
    redirect_uri = body.get("redirect_uri", f"{APP_URL}/auth/google/callback")

    if not code:
        raise HTTPException(status_code=400, detail="Authorization code is required")

    # Exchange code for tokens
    async with httpx.AsyncClient() as client:
        token_response = await client.post(
            "https://oauth2.googleapis.com/token",
            data={
                "code": code,
                "client_id": GOOGLE_CLIENT_ID,
                "client_secret": GOOGLE_CLIENT_SECRET,
                "redirect_uri": redirect_uri,
                "grant_type": "authorization_code",
            },
        )

    if not token_response.is_success:
        raise HTTPException(status_code=400, detail="Failed to exchange Google token")

    google_tokens = token_response.json()
    google_access_token = google_tokens.get("access_token")

    # Get user info from Google
    async with httpx.AsyncClient() as client:
        userinfo_response = await client.get(
            "https://www.googleapis.com/oauth2/v3/userinfo",
            headers={"Authorization": f"Bearer {google_access_token}"},
        )

    if not userinfo_response.is_success:
        raise HTTPException(status_code=400, detail="Failed to get Google user info")

    google_user = userinfo_response.json()
    google_id = google_user.get("sub")
    email = google_user.get("email")
    name = google_user.get("name")
    avatar_url = google_user.get("picture")

    # Check if user already exists by Google ID
    result = await db.execute(select(User).where(User.google_id == google_id))
    user = result.scalar_one_or_none()

    if user:
        # Existing Google user — log in directly
        access_token = create_access_token(user.id)
        refresh_token = create_refresh_token(user.id)
        return {
            "access_token": access_token,
            "refresh_token": refresh_token,
            "token_type": "bearer",
            "user": user.to_dict(),
            "requires_phone": False,
        }

    # Check if user exists by email (linked account)
    result = await db.execute(select(User).where(User.email == email))
    user = result.scalar_one_or_none()

    if user:
        # Link Google account to existing user
        user.google_id = google_id
        if not user.avatar_url:
            user.avatar_url = avatar_url
        await db.commit()
        await db.refresh(user)

        access_token = create_access_token(user.id)
        refresh_token = create_refresh_token(user.id)
        return {
            "access_token": access_token,
            "refresh_token": refresh_token,
            "token_type": "bearer",
            "user": user.to_dict(),
            "requires_phone": False,
        }

    # New user via Google — requires phone number
    # Return a temporary Google token to complete registration
    import jwt as pyjwt
    temp_token_payload = {
        "google_id": google_id,
        "email": email,
        "name": name,
        "avatar_url": avatar_url,
        "type": "google_registration",
    }
    from app.auth.security import JWT_SECRET_KEY, JWT_ALGORITHM
    temp_token = pyjwt.encode(temp_token_payload, JWT_SECRET_KEY, algorithm=JWT_ALGORITHM)

    return {
        "access_token": None,
        "refresh_token": None,
        "token_type": "bearer",
        "user": None,
        "requires_phone": True,
        "google_token": temp_token,
        "google_user": {"email": email, "name": name, "avatar_url": avatar_url},
    }


# ─────────────────────────────────────────────
#  POST /api/auth/google/complete
# ─────────────────────────────────────────────
@router.post("/google/complete")
async def google_complete(payload: GoogleCompleteRequest, db: AsyncSession = Depends(get_db)):
    """Complete Google registration by providing phone number."""
    import jwt as pyjwt
    from app.auth.security import JWT_SECRET_KEY, JWT_ALGORITHM

    try:
        token_data = pyjwt.decode(payload.google_token, JWT_SECRET_KEY, algorithms=[JWT_ALGORITHM])
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid or expired Google token")

    if token_data.get("type") != "google_registration":
        raise HTTPException(status_code=400, detail="Invalid token type")

    google_id = token_data["google_id"]
    email = token_data["email"]
    name = token_data.get("name")
    avatar_url = token_data.get("avatar_url")

    # Double check no user exists
    result = await db.execute(select(User).where(User.google_id == google_id))
    if result.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="User already exists")

    user = User(
        email=email,
        name=name,
        phone=payload.phone,
        google_id=google_id,
        avatar_url=avatar_url,
        is_email_verified=True,  # Google already verified the email
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)

    access_token = create_access_token(user.id)
    refresh_token = create_refresh_token(user.id)

    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "bearer",
        "user": user.to_dict(),
    }
