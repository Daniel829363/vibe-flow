import os
import logging
from typing import Optional
from fastapi import APIRouter, HTTPException, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, desc

from app.database import get_db
from app.models.user import User
from app.models.token_transaction import TokenTransaction, TransactionTypeEnum
from app.auth.security import get_current_user, get_current_user_optional

logger = logging.getLogger(__name__)
router = APIRouter()


@router.get("/rate")
async def get_token_rate():
    """Get current token purchase rate per $1 USD (coefficient applied silently)."""
    rate = float(os.getenv("TOKEN_RATE_PER_DOLLAR", "100"))
    coefficient = float(os.getenv("TOKEN_PRICE_COEFFICIENT", "1"))
    if coefficient <= 0:
        coefficient = 1.0
    purchase_rate = round(rate / coefficient, 4)
    return {
        "rate": purchase_rate,
        "base_rate": rate,
        "description": f"$1.00 USD = {purchase_rate:g} токенов",
    }


@router.get("/balance")
async def get_user_token_balance(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get current user's token balance and USD equivalent."""
    # Refresh user to get latest balance
    result = await db.execute(select(User).where(User.id == current_user.id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="Пользователь не найден")

    rate = float(os.getenv("TOKEN_RATE_PER_DOLLAR", "100"))
    coefficient = float(os.getenv("TOKEN_PRICE_COEFFICIENT", "1"))
    if coefficient <= 0:
        coefficient = 1.0
    purchase_rate = round(rate / coefficient, 4)

    balance = user.token_balance or 0.0
    usd_equiv = round(balance / rate, 2) if rate > 0 else 0.0

    return {
        "token_balance": round(balance, 4),
        "usd_equivalent": usd_equiv,
        "rate": purchase_rate,
        "base_rate": rate,
    }


@router.get("/transactions")
async def get_my_transactions(
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=100),
    category: Optional[str] = Query(None, description="Filter: 'all', 'admin' (topup/deduction), or 'usage'"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get current user's transaction history."""
    query = select(TokenTransaction).where(TokenTransaction.user_id == current_user.id)

    if category == "admin":
        query = query.where(
            TokenTransaction.type.in_([TransactionTypeEnum.TOPUP, TransactionTypeEnum.DEDUCTION])
        )
    elif category == "usage":
        query = query.where(TokenTransaction.type == TransactionTypeEnum.USAGE)
    elif category and category in ("topup", "deduction", "usage"):
        query = query.where(TokenTransaction.type == category)

    count_query = select(func.count()).select_from(query.subquery())
    total_result = await db.execute(count_query)
    total = total_result.scalar_one()

    offset = (page - 1) * limit
    query = query.order_by(desc(TokenTransaction.created_at)).offset(offset).limit(limit)
    result = await db.execute(query)
    transactions = result.scalars().all()

    rate = float(os.getenv("TOKEN_RATE_PER_DOLLAR", "100"))
    coefficient = float(os.getenv("TOKEN_PRICE_COEFFICIENT", "1"))
    if coefficient <= 0:
        coefficient = 1.0
    purchase_rate = round(rate / coefficient, 4)

    return {
        "transactions": [t.to_dict() for t in transactions],
        "total": total,
        "page": page,
        "limit": limit,
        "token_balance": round(current_user.token_balance or 0.0, 4),
        "rate": purchase_rate,
        "base_rate": rate,
    }
