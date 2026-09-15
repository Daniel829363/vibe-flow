import os
import uuid
import logging
from pathlib import Path
from typing import Optional
from datetime import datetime, timezone
from pydantic import BaseModel, EmailStr
from fastapi import APIRouter, HTTPException, Depends, status, Query, UploadFile, File, Form
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, desc, or_, and_
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.models.user import User
from app.models.workflow_meta import WorkflowMeta, VisibilityEnum
from app.models.token_transaction import TokenTransaction, TransactionTypeEnum
from app.models.promo_code import PromoCode, PromoCodeUsage
from app.models.payment_offer import PaymentOffer
from app.models.legal_document import LegalDocument
from app.auth.security import (
    get_current_user,
    hash_password,
    create_access_token,
    create_refresh_token,
)
from app.utils.workflow_helper import delete_workflow_def_by_id

OFFERS_DIR = Path(__file__).resolve().parent.parent.parent / "uploads" / "offers"
OFFERS_DIR.mkdir(parents=True, exist_ok=True)

LEGAL_DIR = Path(__file__).resolve().parent.parent.parent / "uploads" / "legal"
LEGAL_DIR.mkdir(parents=True, exist_ok=True)

logger = logging.getLogger(__name__)
router = APIRouter()


# ── Dependency: Superadmin only ──────────────────────────────────────────────
async def get_superadmin(current_user: User = Depends(get_current_user)) -> User:
    if not current_user.is_superadmin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Доступ запрещен. Требуются права суперадмина.",
        )
    return current_user


# ── Pydantic Schemas ─────────────────────────────────────────────────────────
class CreateUserRequest(BaseModel):
    email: EmailStr
    password: str
    name: Optional[str] = None
    phone: Optional[str] = None
    initial_balance_usd: Optional[float] = 0.0


class UpdateUserRequest(BaseModel):
    email: Optional[EmailStr] = None
    name: Optional[str] = None
    phone: Optional[str] = None
    password: Optional[str] = None
    is_email_verified: Optional[bool] = None


class AdjustTokensRequest(BaseModel):
    amount_usd: float
    description: Optional[str] = None
    coefficient: Optional[float] = None  # Override coefficient; defaults to TOKEN_PRICE_COEFFICIENT from env


class CreatePromoCodeRequest(BaseModel):
    code: str
    cashback_percent: float
    max_uses: int = 100
    valid_from: str  # ISO datetime string
    valid_until: str  # ISO datetime string


class UpdatePromoCodeRequest(BaseModel):
    code: Optional[str] = None
    cashback_percent: Optional[float] = None
    max_uses: Optional[int] = None
    valid_from: Optional[str] = None
    valid_until: Optional[str] = None
    is_active: Optional[bool] = None


class UpdateWorkflowVisibilityRequest(BaseModel):
    visibility: str  # "public" or "private"


# ── Config Endpoint ──────────────────────────────────────────────────────────
@router.get("/config")
async def get_admin_config(admin: User = Depends(get_superadmin)):
    rate = float(os.getenv("TOKEN_RATE_PER_DOLLAR", "100"))
    coefficient = float(os.getenv("TOKEN_PRICE_COEFFICIENT", "1"))
    super_email = os.getenv("SUPER_ADMIN_EMAIL", "").strip()
    return {
        "super_admin_email": super_email,
        "token_rate_per_dollar": rate,
        "token_price_coefficient": coefficient,
    }


# ── Users CRUD ───────────────────────────────────────────────────────────────
@router.get("/users")
async def list_users(
    search: Optional[str] = None,
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=100),
    admin: User = Depends(get_superadmin),
    db: AsyncSession = Depends(get_db),
):
    query = select(User)
    if search:
        s = f"%{search.strip()}%"
        query = query.where(
            or_(
                User.email.ilike(s),
                User.name.ilike(s),
                User.phone.ilike(s),
            )
        )

    # Count total
    count_query = select(func.count()).select_from(query.subquery())
    total_result = await db.execute(count_query)
    total = total_result.scalar_one()

    # Pagination
    offset = (page - 1) * limit
    query = query.order_by(desc(User.created_at)).offset(offset).limit(limit)
    result = await db.execute(query)
    users = result.scalars().all()

    # Calculate overall stats
    total_tokens_result = await db.execute(select(func.sum(User.token_balance)))
    total_tokens = total_tokens_result.scalar_one() or 0.0

    total_wf_result = await db.execute(select(func.count(WorkflowMeta.id)))
    total_workflows = total_wf_result.scalar_one() or 0

    return {
        "users": [u.to_dict() for u in users],
        "total": total,
        "page": page,
        "limit": limit,
        "stats": {
            "total_users": total,
            "total_tokens": round(total_tokens, 2),
            "total_workflows": total_workflows,
            "token_rate": float(os.getenv("TOKEN_RATE_PER_DOLLAR", "100")),
        },
    }


@router.post("/users", status_code=status.HTTP_201_CREATED)
async def create_user(
    payload: CreateUserRequest,
    admin: User = Depends(get_superadmin),
    db: AsyncSession = Depends(get_db),
):
    # Check if email exists
    existing = await db.execute(select(User).where(User.email == payload.email))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Пользователь с таким email уже существует")

    rate = float(os.getenv("TOKEN_RATE_PER_DOLLAR", "100"))
    initial_tokens = round((payload.initial_balance_usd or 0.0) * rate, 4)

    user = User(
        email=payload.email,
        name=payload.name,
        phone=payload.phone,
        hashed_password=hash_password(payload.password),
        is_email_verified=True,
        token_balance=initial_tokens,
    )
    db.add(user)
    await db.flush()

    # If initial balance > 0, create transaction
    if initial_tokens > 0:
        tx = TokenTransaction(
            user_id=user.id,
            amount_tokens=initial_tokens,
            amount_usd=payload.initial_balance_usd,
            type=TransactionTypeEnum.TOPUP,
            description="Стартовый баланс при создании аккаунта",
            admin_id=admin.id,
        )
        db.add(tx)

    await db.commit()
    await db.refresh(user)

    return {"message": "Пользователь успешно создан", "user": user.to_dict()}


@router.get("/users/{user_id}")
async def get_user_details(
    user_id: str,
    admin: User = Depends(get_superadmin),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(User)
        .options(selectinload(User.workflows))
        .where(User.id == user_id)
    )
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="Пользователь не найден")

    # Recent transactions
    tx_result = await db.execute(
        select(TokenTransaction)
        .where(TokenTransaction.user_id == user_id)
        .order_by(desc(TokenTransaction.created_at))
        .limit(20)
    )
    transactions = tx_result.scalars().all()

    return {
        "user": user.to_dict(),
        "workflows": [w.to_dict() for w in user.workflows],
        "recent_transactions": [tx.to_dict() for tx in transactions],
    }


@router.put("/users/{user_id}")
async def update_user(
    user_id: str,
    payload: UpdateUserRequest,
    admin: User = Depends(get_superadmin),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="Пользователь не найден")

    if payload.email and payload.email != user.email:
        existing = await db.execute(select(User).where(User.email == payload.email))
        if existing.scalar_one_or_none():
            raise HTTPException(status_code=400, detail="Этот email уже используется другим пользователем")
        user.email = payload.email

    if payload.name is not None:
        user.name = payload.name
    if payload.phone is not None:
        user.phone = payload.phone
    if payload.is_email_verified is not None:
        user.is_email_verified = payload.is_email_verified
    if payload.password:
        if len(payload.password) < 6:
            raise HTTPException(status_code=400, detail="Пароль должен содержать минимум 6 символов")
        user.hashed_password = hash_password(payload.password)

    user.updated_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(user)

    return {"message": "Пользователь обновлен", "user": user.to_dict()}


@router.delete("/users/{user_id}")
async def delete_user(
    user_id: str,
    admin: User = Depends(get_superadmin),
    db: AsyncSession = Depends(get_db),
):
    if user_id == admin.id:
        raise HTTPException(status_code=400, detail="Нельзя удалить самого себя")

    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="Пользователь не найден")

    await db.delete(user)
    await db.commit()

    return {"message": "Пользователь удален", "user_id": user_id}


# ── Impersonate User ─────────────────────────────────────────────────────────
@router.post("/users/{user_id}/impersonate")
async def impersonate_user(
    user_id: str,
    admin: User = Depends(get_superadmin),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="Пользователь не найден")

    access_token = create_access_token(user.id)
    refresh_token = create_refresh_token(user.id)

    logger.info(f"Admin {admin.email} impersonated user {user.email} ({user.id})")

    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "bearer",
        "user": user.to_dict(),
        "impersonated_by": admin.email,
    }


# ── Token Management ─────────────────────────────────────────────────────────
@router.post("/users/{user_id}/tokens")
async def adjust_user_tokens(
    user_id: str,
    payload: AdjustTokensRequest,
    admin: User = Depends(get_superadmin),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="Пользователь не найден")

    if payload.amount_usd == 0:
        raise HTTPException(status_code=400, detail="Сумма должна быть отличной от нуля")

    rate = float(os.getenv("TOKEN_RATE_PER_DOLLAR", "100"))
    # Use provided coefficient or default from env
    coefficient = payload.coefficient if payload.coefficient is not None else float(os.getenv("TOKEN_PRICE_COEFFICIENT", "1"))
    if coefficient <= 0:
        coefficient = 1.0

    # Apply coefficient: tokens = usd * rate / coefficient
    amount_tokens = round(payload.amount_usd * rate / coefficient, 4)

    # If deducting, check balance doesn't go below 0
    new_balance = user.token_balance + amount_tokens
    if new_balance < 0:
        new_balance = 0.0

    user.token_balance = new_balance

    tx_type = TransactionTypeEnum.TOPUP if payload.amount_usd > 0 else TransactionTypeEnum.DEDUCTION
    coeff_info = f" (коэф. {coefficient})" if coefficient != 1.0 else ""
    desc_default = (
        f"Пополнение администратором ({admin.email}): +${abs(payload.amount_usd):.2f}{coeff_info}"
        if payload.amount_usd > 0
        else f"Списание администратором ({admin.email}): -${abs(payload.amount_usd):.2f}{coeff_info}"
    )

    transaction = TokenTransaction(
        user_id=user.id,
        amount_tokens=amount_tokens,
        amount_usd=payload.amount_usd,
        type=tx_type,
        description=payload.description or desc_default,
        admin_id=admin.id,
    )
    db.add(transaction)
    await db.commit()
    await db.refresh(user)
    await db.refresh(transaction)

    return {
        "message": "Баланс успешно изменен",
        "token_balance": user.token_balance,
        "amount_usd": payload.amount_usd,
        "amount_tokens": amount_tokens,
        "rate": rate,
        "coefficient": coefficient,
        "transaction": transaction.to_dict(),
    }


@router.get("/users/{user_id}/transactions")
async def get_user_transactions(
    user_id: str,
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=100),
    type_filter: Optional[str] = Query(None, alias="type"),
    admin: User = Depends(get_superadmin),
    db: AsyncSession = Depends(get_db),
):
    query = select(TokenTransaction).where(TokenTransaction.user_id == user_id)
    if type_filter:
        if type_filter == "admin":
            query = query.where(
                TokenTransaction.type.in_([TransactionTypeEnum.TOPUP, TransactionTypeEnum.DEDUCTION])
            )
        else:
            query = query.where(TokenTransaction.type == type_filter)

    count_query = select(func.count()).select_from(query.subquery())
    total_result = await db.execute(count_query)
    total = total_result.scalar_one()

    offset = (page - 1) * limit
    query = query.order_by(desc(TokenTransaction.created_at)).offset(offset).limit(limit)
    result = await db.execute(query)
    transactions = result.scalars().all()

    return {
        "transactions": [t.to_dict() for t in transactions],
        "total": total,
        "page": page,
        "limit": limit,
    }


@router.get("/transactions")
async def list_all_transactions(
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=100),
    type_filter: Optional[str] = Query(None, alias="type"),
    search: Optional[str] = None,
    admin: User = Depends(get_superadmin),
    db: AsyncSession = Depends(get_db),
):
    query = select(TokenTransaction).join(User, TokenTransaction.user_id == User.id)

    if type_filter:
        if type_filter == "admin":
            query = query.where(
                TokenTransaction.type.in_([TransactionTypeEnum.TOPUP, TransactionTypeEnum.DEDUCTION])
            )
        else:
            query = query.where(TokenTransaction.type == type_filter)

    if search:
        s = f"%{search.strip()}%"
        query = query.where(
            or_(
                User.email.ilike(s),
                User.name.ilike(s),
                TokenTransaction.description.ilike(s),
                TokenTransaction.workflow_name.ilike(s),
            )
        )

    count_query = select(func.count()).select_from(query.subquery())
    total_result = await db.execute(count_query)
    total = total_result.scalar_one()

    offset = (page - 1) * limit
    query = query.order_by(desc(TokenTransaction.created_at)).offset(offset).limit(limit)
    result = await db.execute(query)
    transactions = result.scalars().all()

    # Enrich with user info
    enriched = []
    for tx in transactions:
        d = tx.to_dict()
        user_res = await db.execute(select(User).where(User.id == tx.user_id))
        u = user_res.scalar_one_or_none()
        d["user_email"] = u.email if u else "Неизвестный"
        d["user_name"] = u.name if u else None
        enriched.append(d)

    return {
        "transactions": enriched,
        "total": total,
        "page": page,
        "limit": limit,
    }


# ── Workflows Management ─────────────────────────────────────────────────────
@router.get("/workflows")
async def list_all_workflows(
    search: Optional[str] = None,
    visibility: Optional[str] = None,
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=100),
    admin: User = Depends(get_superadmin),
    db: AsyncSession = Depends(get_db),
):
    query = select(WorkflowMeta).options(selectinload(WorkflowMeta.owner))

    if search:
        s = f"%{search.strip()}%"
        query = query.where(
            or_(
                WorkflowMeta.name.ilike(s),
                WorkflowMeta.description.ilike(s),
                WorkflowMeta.remote_workflow_id.ilike(s),
            )
        )

    if visibility:
        query = query.where(WorkflowMeta.visibility == visibility)

    count_query = select(func.count()).select_from(query.subquery())
    total_result = await db.execute(count_query)
    total = total_result.scalar_one()

    offset = (page - 1) * limit
    query = query.order_by(desc(WorkflowMeta.updated_at)).offset(offset).limit(limit)
    result = await db.execute(query)
    workflows = result.scalars().all()

    items = []
    for wf in workflows:
        d = wf.to_dict()
        d["owner_email"] = wf.owner.email if wf.owner else "Без владельца"
        d["owner_name"] = wf.owner.name if wf.owner else None
        items.append(d)

    return {
        "workflows": items,
        "total": total,
        "page": page,
        "limit": limit,
    }


@router.put("/workflows/{workflow_id}/visibility")
async def update_workflow_visibility_admin(
    workflow_id: str,
    payload: UpdateWorkflowVisibilityRequest,
    admin: User = Depends(get_superadmin),
    db: AsyncSession = Depends(get_db),
):
    stmt = select(WorkflowMeta).where(
        or_(
            WorkflowMeta.remote_workflow_id == workflow_id,
            WorkflowMeta.id == workflow_id,
        )
    )
    result = await db.execute(stmt)
    wf_meta = result.scalar_one_or_none()
    if not wf_meta:
        raise HTTPException(status_code=404, detail="Workflow не найден")

    try:
        wf_meta.visibility = VisibilityEnum(payload.visibility.lower())
    except ValueError:
        raise HTTPException(status_code=400, detail="Недопустимый статус видимости (public/private)")

    wf_meta.updated_at = datetime.now(timezone.utc)
    await db.commit()

    return {"message": "Видимость изменена", "workflow": wf_meta.to_dict()}


@router.delete("/workflows/{workflow_id}")
async def delete_workflow_admin(
    workflow_id: str,
    admin: User = Depends(get_superadmin),
    db: AsyncSession = Depends(get_db),
):
    # Try remote delete
    try:
        await delete_workflow_def_by_id(workflow_id)
    except Exception as e:
        logger.warning(f"Remote delete for {workflow_id} failed: {e}")

    # Delete local
    stmt = select(WorkflowMeta).where(
        or_(
            WorkflowMeta.remote_workflow_id == workflow_id,
            WorkflowMeta.id == workflow_id,
        )
    )
    result = await db.execute(stmt)
    wf_meta = result.scalar_one_or_none()
    if wf_meta:
        await db.delete(wf_meta)
        await db.commit()

    return {"message": "Workflow успешно удален", "workflow_id": workflow_id}


# ══════════════════════════════════════════════════════════════════════════════
# ── Promo Code Management ────────────────────────────────────────────────────
# ══════════════════════════════════════════════════════════════════════════════

@router.get("/promo-codes")
async def list_promo_codes(
    admin: User = Depends(get_superadmin),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(PromoCode).order_by(desc(PromoCode.created_at)))
    promos = result.scalars().all()
    return {"promo_codes": [p.to_dict() for p in promos]}


@router.post("/promo-codes", status_code=status.HTTP_201_CREATED)
async def create_promo_code(
    payload: CreatePromoCodeRequest,
    admin: User = Depends(get_superadmin),
    db: AsyncSession = Depends(get_db),
):
    code_upper = payload.code.strip().upper()
    existing = await db.execute(select(PromoCode).where(PromoCode.code == code_upper))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Промокод с таким кодом уже существует")

    if payload.cashback_percent <= 0 or payload.cashback_percent > 100:
        raise HTTPException(status_code=400, detail="Процент кешбека должен быть от 0.01 до 100")

    try:
        valid_from = datetime.fromisoformat(payload.valid_from.replace("Z", "+00:00"))
        valid_until = datetime.fromisoformat(payload.valid_until.replace("Z", "+00:00"))
    except ValueError:
        raise HTTPException(status_code=400, detail="Неверный формат даты")

    promo = PromoCode(
        code=code_upper,
        cashback_percent=payload.cashback_percent,
        max_uses=payload.max_uses,
        valid_from=valid_from,
        valid_until=valid_until,
    )
    db.add(promo)
    await db.commit()
    await db.refresh(promo)

    return {"message": "Промокод создан", "promo_code": promo.to_dict()}


@router.put("/promo-codes/{promo_id}")
async def update_promo_code(
    promo_id: str,
    payload: UpdatePromoCodeRequest,
    admin: User = Depends(get_superadmin),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(PromoCode).where(PromoCode.id == promo_id))
    promo = result.scalar_one_or_none()
    if not promo:
        raise HTTPException(status_code=404, detail="Промокод не найден")

    if payload.code is not None:
        new_code = payload.code.strip().upper()
        if new_code != promo.code:
            dup = await db.execute(select(PromoCode).where(PromoCode.code == new_code))
            if dup.scalar_one_or_none():
                raise HTTPException(status_code=400, detail="Такой код уже существует")
            promo.code = new_code
    if payload.cashback_percent is not None:
        promo.cashback_percent = payload.cashback_percent
    if payload.max_uses is not None:
        promo.max_uses = payload.max_uses
    if payload.valid_from is not None:
        promo.valid_from = datetime.fromisoformat(payload.valid_from.replace("Z", "+00:00"))
    if payload.valid_until is not None:
        promo.valid_until = datetime.fromisoformat(payload.valid_until.replace("Z", "+00:00"))
    if payload.is_active is not None:
        promo.is_active = payload.is_active

    await db.commit()
    await db.refresh(promo)
    return {"message": "Промокод обновлён", "promo_code": promo.to_dict()}


@router.delete("/promo-codes/{promo_id}")
async def delete_promo_code(
    promo_id: str,
    admin: User = Depends(get_superadmin),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(PromoCode).where(PromoCode.id == promo_id))
    promo = result.scalar_one_or_none()
    if not promo:
        raise HTTPException(status_code=404, detail="Промокод не найден")

    await db.delete(promo)
    await db.commit()
    return {"message": "Промокод удалён", "promo_id": promo_id}


@router.get("/promo-codes/{promo_id}/stats")
async def get_promo_code_stats(
    promo_id: str,
    admin: User = Depends(get_superadmin),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(PromoCode).where(PromoCode.id == promo_id))
    promo = result.scalar_one_or_none()
    if not promo:
        raise HTTPException(status_code=404, detail="Промокод не найден")

    usages_result = await db.execute(
        select(PromoCodeUsage).where(PromoCodeUsage.promo_code_id == promo_id)
    )
    usages = usages_result.scalars().all()

    total_cashback_tokens = sum(u.cashback_amount_tokens for u in usages)
    total_cashback_usd = sum(u.cashback_amount_usd for u in usages)

    enriched_usages = []
    for u in usages:
        d = u.to_dict()
        user_res = await db.execute(select(User).where(User.id == u.user_id))
        usr = user_res.scalar_one_or_none()
        d["user_email"] = usr.email if usr else "Неизвестный"
        d["user_name"] = usr.name if usr else None
        enriched_usages.append(d)

    return {
        "promo_code": promo.to_dict(),
        "usages": enriched_usages,
        "total_uses": len(usages),
        "total_cashback_tokens": round(total_cashback_tokens, 4),
        "total_cashback_usd": round(total_cashback_usd, 4),
    }


# ══════════════════════════════════════════════════════════════════════════════
# ── Offer Management ─────────────────────────────────────────────────────────
# ══════════════════════════════════════════════════════════════════════════════

@router.get("/offers")
async def list_offers_admin(
    admin: User = Depends(get_superadmin),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(PaymentOffer).order_by(PaymentOffer.language))
    offers = result.scalars().all()
    return {"offers": [o.to_dict() for o in offers]}


@router.post("/offers", status_code=status.HTTP_201_CREATED)
async def upload_offer(
    language: str = Form(...),
    file: UploadFile = File(...),
    admin: User = Depends(get_superadmin),
    db: AsyncSession = Depends(get_db),
):
    lang = language.strip().lower()
    if not file.filename or not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Только PDF файлы разрешены")

    # Delete existing offer for this language
    existing_result = await db.execute(
        select(PaymentOffer).where(PaymentOffer.language == lang)
    )
    existing = existing_result.scalar_one_or_none()
    if existing:
        old_path = OFFERS_DIR / existing.filename
        if old_path.exists():
            old_path.unlink()
        await db.delete(existing)

    # Save file
    ext = Path(file.filename).suffix
    saved_name = f"offer_{lang}_{uuid.uuid4().hex[:8]}{ext}"
    file_path = OFFERS_DIR / saved_name

    content = await file.read()
    with open(file_path, "wb") as f:
        f.write(content)

    offer = PaymentOffer(
        language=lang,
        filename=saved_name,
        original_name=file.filename,
        uploaded_by=admin.id,
    )
    db.add(offer)
    await db.commit()
    await db.refresh(offer)

    return {"message": f"Оферта для языка '{lang}' загружена", "offer": offer.to_dict()}


@router.delete("/offers/{offer_id}")
async def delete_offer(
    offer_id: str,
    admin: User = Depends(get_superadmin),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(PaymentOffer).where(PaymentOffer.id == offer_id))
    offer = result.scalar_one_or_none()
    if not offer:
        raise HTTPException(status_code=404, detail="Оферта не найдена")

    file_path = OFFERS_DIR / offer.filename
    if file_path.exists():
        file_path.unlink()

    await db.delete(offer)
    await db.commit()
    return {"message": "Оферта удалена", "offer_id": offer_id}


# ── Legal Documents (User Agreement, Privacy Policy) ─────────────────────────
@router.get("/legal-documents")
async def list_legal_documents_admin(
    admin: User = Depends(get_superadmin),
    db: AsyncSession = Depends(get_db),
):
    """List all legal documents for superadmin."""
    result = await db.execute(
        select(LegalDocument).order_by(LegalDocument.doc_type, LegalDocument.language)
    )
    docs = result.scalars().all()
    return {"documents": [d.to_dict() for d in docs]}


@router.post("/legal-documents", status_code=status.HTTP_201_CREATED)
async def upload_legal_document(
    doc_type: str = Form(...),
    language: str = Form(...),
    file: UploadFile = File(...),
    admin: User = Depends(get_superadmin),
    db: AsyncSession = Depends(get_db),
):
    """Upload or replace a legal document PDF for a given doc_type and language."""
    normalized_type = doc_type.strip().lower()
    lang = language.strip().lower()

    if normalized_type not in ("user_agreement", "privacy_policy", "offer"):
        raise HTTPException(
            status_code=400,
            detail="Недопустимый тип документа. Допустимые: user_agreement, privacy_policy, offer",
        )

    if not file.filename or not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Только PDF файлы разрешены")

    # Delete existing document for this doc_type and language
    existing_result = await db.execute(
        select(LegalDocument).where(
            LegalDocument.doc_type == normalized_type,
            LegalDocument.language == lang,
        )
    )
    existing = existing_result.scalar_one_or_none()
    if existing:
        old_path = LEGAL_DIR / existing.filename
        if old_path.exists():
            old_path.unlink()
        await db.delete(existing)

    # Save file to disk
    ext = Path(file.filename).suffix
    saved_name = f"{normalized_type}_{lang}_{uuid.uuid4().hex[:8]}{ext}"
    file_path = LEGAL_DIR / saved_name

    content = await file.read()
    with open(file_path, "wb") as f:
        f.write(content)

    doc = LegalDocument(
        doc_type=normalized_type,
        language=lang,
        filename=saved_name,
        original_name=file.filename,
        uploaded_by=admin.id,
    )
    db.add(doc)
    await db.commit()
    await db.refresh(doc)

    doc_labels = {
        "user_agreement": "Пользовательское соглашение",
        "privacy_policy": "Политика конфиденциальности",
        "offer": "Публичная оферта",
    }
    label = doc_labels.get(normalized_type, "Документ")

    return {
        "message": f"{label} для языка '{lang.upper()}' успешно загружен",
        "document": doc.to_dict(),
    }


@router.delete("/legal-documents/{doc_id}")
async def delete_legal_document(
    doc_id: str,
    admin: User = Depends(get_superadmin),
    db: AsyncSession = Depends(get_db),
):
    """Delete a legal document PDF."""
    result = await db.execute(
        select(LegalDocument).where(LegalDocument.id == doc_id)
    )
    doc = result.scalar_one_or_none()
    if not doc:
        raise HTTPException(status_code=404, detail="Документ не найден")

    file_path = LEGAL_DIR / doc.filename
    if file_path.exists():
        file_path.unlink()

    await db.delete(doc)
    await db.commit()
    return {"message": "Документ удален", "doc_id": doc_id}
