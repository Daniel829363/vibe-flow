from fastapi import APIRouter, HTTPException, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.database import get_db
from app.models.user import User
from app.auth.security import get_current_user, hash_password, verify_password
from app.auth.schemas import UpdateProfileRequest, UpdateEmailRequest, ChangePasswordRequest

router = APIRouter()


# ─────────────────────────────────────────────
#  GET /api/profile
# ─────────────────────────────────────────────
@router.get("/")
async def get_profile(current_user: User = Depends(get_current_user)):
    return current_user.to_dict()


# ─────────────────────────────────────────────
#  PUT /api/profile
# ─────────────────────────────────────────────
@router.put("/")
async def update_profile(
    payload: UpdateProfileRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if payload.name is not None:
        current_user.name = payload.name
    if payload.phone is not None:
        current_user.phone = payload.phone

    await db.commit()
    await db.refresh(current_user)

    return current_user.to_dict()


# ─────────────────────────────────────────────
#  PUT /api/profile/password
# ─────────────────────────────────────────────
@router.put("/password")
async def change_password(
    payload: ChangePasswordRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if not current_user.hashed_password:
        raise HTTPException(
            status_code=400,
            detail="This account uses Google login and has no password. Set a password first."
        )

    if not verify_password(payload.old_password, current_user.hashed_password):
        raise HTTPException(status_code=400, detail="Current password is incorrect")

    if len(payload.new_password) < 8:
        raise HTTPException(status_code=400, detail="New password must be at least 8 characters")

    current_user.hashed_password = hash_password(payload.new_password)
    await db.commit()

    return {"message": "Password changed successfully"}


# ─────────────────────────────────────────────
#  PUT /api/profile/email
# ─────────────────────────────────────────────
@router.put("/email")
async def change_email(
    payload: UpdateEmailRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # Verify current password
    if not current_user.hashed_password:
        raise HTTPException(status_code=400, detail="Cannot change email for Google accounts without a password")

    if not verify_password(payload.password, current_user.hashed_password):
        raise HTTPException(status_code=400, detail="Password is incorrect")

    # Check if new email is taken
    existing = await db.execute(select(User).where(User.email == payload.email))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Email already in use")

    from app.auth.security import create_verification_token
    from app.auth.email_service import send_verification_email

    current_user.email = payload.email
    current_user.is_email_verified = False
    verification_token = create_verification_token(current_user.id)
    current_user.email_verification_token = verification_token
    await db.commit()
    await db.refresh(current_user)

    try:
        await send_verification_email(current_user.email, verification_token)
    except Exception:
        pass

    return {"message": "Email updated. Please verify your new email address.", "user": current_user.to_dict()}
