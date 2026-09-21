"""
Payment router: Finik payment creation, webhook handling, offer listing, promo validation.
"""
import os
import uuid
import json
import time
import logging
from pathlib import Path
from datetime import datetime, timezone

import httpx
from urllib.parse import urlparse
from fastapi import APIRouter, HTTPException, Depends, Request
from fastapi.responses import FileResponse, JSONResponse
from pydantic import BaseModel
from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, or_

from app.database import get_db
from app.models.user import User
from app.models.finik_payment import FinikPayment
from app.models.promo_code import PromoCode, PromoCodeUsage
from app.models.payment_offer import PaymentOffer
from app.models.token_transaction import TokenTransaction, TransactionTypeEnum
from app.auth.security import get_current_user
from app.utils.finik_signature import sign_request, verify_webhook, canonicalize_body

logger = logging.getLogger(__name__)
router = APIRouter()

OFFERS_DIR = Path(__file__).resolve().parent.parent.parent / "uploads" / "offers"
OFFERS_DIR.mkdir(parents=True, exist_ok=True)

STORAGE_DIR = Path(__file__).resolve().parent.parent.parent / "storage"
STORAGE_DIR.mkdir(parents=True, exist_ok=True)


# ── Schemas ──────────────────────────────────────────────────────────────────
class CreatePaymentRequest(BaseModel):
    amount_usd: float  # Amount in USD
    promo_code: Optional[str] = None


class ValidatePromoRequest(BaseModel):
    code: str


# ── Create Payment ───────────────────────────────────────────────────────────
@router.post("/finik/create")
async def create_finik_payment(
    payload: CreatePaymentRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Create a Finik payment. Converts USD to KGS and initiates payment."""
    if payload.amount_usd < 0.01:
        raise HTTPException(status_code=400, detail="Минимальная сумма: $0.01")

    kurs = float(os.getenv("FINIK_KURS_DOLLARA", "87.5"))
    coefficient = float(os.getenv("TOKEN_PRICE_COEFFICIENT", "1"))
    rate = float(os.getenv("TOKEN_RATE_PER_DOLLAR", "100"))

    # Amount in KGS = USD amount * exchange rate
    amount_kgs = round(payload.amount_usd * kurs, 2)

    # Tokens user will receive = USD / coefficient * rate
    tokens_to_credit = round(payload.amount_usd * rate / coefficient, 4)

    # Validate promo code if provided
    promo = None
    cashback_tokens = 0.0
    if payload.promo_code:
        promo_result = await db.execute(
            select(PromoCode).where(
                and_(
                    PromoCode.code == payload.promo_code.strip().upper(),
                    PromoCode.is_active == True,
                )
            )
        )
        promo = promo_result.scalar_one_or_none()
        if not promo:
            raise HTTPException(status_code=400, detail="Промокод недействителен")

        now = datetime.now(timezone.utc)
        if now < promo.valid_from or now > promo.valid_until:
            raise HTTPException(status_code=400, detail="Срок действия промокода истёк")
        if promo.current_uses >= promo.max_uses:
            raise HTTPException(status_code=400, detail="Промокод исчерпал лимит использований")

        # Check if user already used this promo
        usage_check = await db.execute(
            select(PromoCodeUsage).where(
                and_(
                    PromoCodeUsage.promo_code_id == promo.id,
                    PromoCodeUsage.user_id == current_user.id,
                )
            )
        )
        if usage_check.scalar_one_or_none():
            raise HTTPException(status_code=400, detail="Вы уже использовали этот промокод")

        cashback_tokens = round(tokens_to_credit * promo.cashback_percent / 100, 4)

    payment_uuid = str(uuid.uuid4())
    app_url = os.getenv("APP_URL", "http://localhost:5000")

    # Create DB record
    payment = FinikPayment(
        user_id=current_user.id,
        payment_id=payment_uuid,
        amount_kgs=amount_kgs,
        amount_usd=payload.amount_usd,
        status="PENDING",
        redirect_url=f"{app_url}/tokens",
        request_date=int(time.time() * 1000),
        tokens_credited=tokens_to_credit,
        promo_code_id=promo.id if promo else None,
        cashback_tokens=cashback_tokens,
        price_coefficient=coefficient,
    )
    db.add(payment)
    await db.flush()

    # Build Finik API request body
    base_url = os.getenv("FINIK_BASE_URL", "https://api.acquiring.averspay.kg").strip('"\' ')
    api_key = os.getenv("FINIK_API_KEY", "").strip('"\' ')
    account_id = os.getenv("FINIK_ACCOUNT_ID", "").strip('"\' ')
    host = os.getenv("FINIK_HOST", "api.acquiring.averspay.kg").strip('"\' ')
    mcc = os.getenv("FINIK_MERCHANT_CATEGORY_CODE", "0742").strip('"\' ')
    qr_name = os.getenv("FINIK_QR_NAME", "Payment").strip('"\' ')
    webhook_url = f"{app_url}/api/payment/finik/webhook"

    # In JS/JSON, whole numbers must not have trailing .0 (e.g. 890 instead of 890.0)
    amount_normalized = int(amount_kgs) if float(amount_kgs).is_integer() else round(float(amount_kgs), 2)

    body = {
        "Amount": amount_normalized,
        "CardType": "FINIK_QR",
        "PaymentId": payment_uuid,
        "RedirectUrl": f"{app_url}/tokens",
        "Data": {
            "accountId": account_id,
            "merchantCategoryCode": mcc,
            "name_en": qr_name,
            "webhookUrl": webhook_url,
            "description": f"Payment for user #{current_user.id}",
        },
    }

    timestamp = str(int(time.time() * 1000))

    try:
        signature = sign_request(
            http_method="post",
            path="/v1/payment",
            timestamp=timestamp,
            body=body,
            host=host,
            api_key=api_key,
        )
    except Exception as e:
        logger.error(f"Failed to sign Finik request: {e}")
        await db.rollback()
        raise HTTPException(status_code=500, detail="Ошибка подписи запроса")

    canonical_body = canonicalize_body(body)
    json_body = json.dumps(canonical_body, ensure_ascii=False, separators=(",", ":"))

    logger.info(f"Sending Finik payment request: PaymentId={payment_uuid}, Amount={amount_normalized}, Timestamp={timestamp}")

    # Send request to Finik (don't follow redirects)
    try:
        async with httpx.AsyncClient(follow_redirects=False) as client:
            response = await client.post(
                f"{base_url}/v1/payment",
                content=json_body,
                headers={
                    "Host": host,
                    "Content-Type": "application/json",
                    "x-api-key": api_key,
                    "x-api-timestamp": timestamp,
                    "signature": signature,
                },
                timeout=30.0,
            )
    except Exception as e:
        logger.error(f"Finik API request failed: {e}")
        await db.rollback()
        raise HTTPException(status_code=502, detail="Ошибка связи с платёжной системой")

    if response.status_code == 302:
        payment_url = response.headers.get("location")
        if payment_url:
            payment.redirect_url = payment_url
            await db.commit()
            return {
                "payment_url": payment_url,
                "payment_id": payment_uuid,
                "amount_kgs": amount_kgs,
                "amount_usd": payload.amount_usd,
                "tokens_to_receive": tokens_to_credit,
                "cashback_tokens": cashback_tokens,
            }

    logger.error(f"Finik API returned unexpected status {response.status_code}: {response.text}")
    await db.rollback()
    raise HTTPException(status_code=502, detail="Ошибка генерации счёта Finik")


# ── Webhook Handler ──────────────────────────────────────────────────────────
@router.post("/finik/webhook")
async def handle_finik_webhook(
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """Handle incoming Finik payment webhook."""
    signature = (request.headers.get("signature") or "").strip()
    timestamp = (request.headers.get("x-api-timestamp") or "").strip()

    if not signature or not timestamp:
        logger.warning(
            f"Finik webhook missing headers: signature={'present' if signature else 'missing'}, "
            f"timestamp={'present' if timestamp else 'missing'}"
        )
        return JSONResponse({"error": "Missing headers"}, status_code=400)

    try:
        body = await request.json()
    except Exception as e:
        logger.error(f"Finik webhook invalid JSON body: {e}")
        return JSONResponse({"error": "Invalid JSON"}, status_code=400)

    # Check account ID if set in environment
    account_id = os.getenv("FINIK_ACCOUNT_ID", "").strip('"\' ')
    if account_id and body.get("accountId") and body["accountId"] != account_id:
        logger.warning(f"Finik webhook accountId mismatch: expected {account_id}, got {body.get('accountId')}")
        return JSONResponse({"error": "Invalid accountId"}, status_code=403)

    # Collect candidate hosts for proxy / reverse-proxy / domain transparency
    candidate_hosts: list[str] = []

    # 1. Forwarded host from Next.js rewrites or Nginx
    x_forwarded_host = request.headers.get("x-forwarded-host")
    if x_forwarded_host:
        for h in x_forwarded_host.split(","):
            h_clean = h.strip()
            if h_clean and h_clean not in candidate_hosts:
                candidate_hosts.append(h_clean)
                if ":" in h_clean:
                    candidate_hosts.append(h_clean.split(":")[0])

    # 2. Direct Host header in request
    req_host = request.headers.get("host")
    if req_host:
        req_host_clean = req_host.strip()
        if req_host_clean not in candidate_hosts:
            candidate_hosts.append(req_host_clean)
        if ":" in req_host_clean:
            candidate_hosts.append(req_host_clean.split(":")[0])

    # 3. Host from APP_URL env
    app_url = os.getenv("APP_URL", "").strip()
    if app_url:
        parsed_url = urlparse(app_url)
        parsed_host = parsed_url.netloc or parsed_url.hostname
        if parsed_host and parsed_host not in candidate_hosts:
            candidate_hosts.append(parsed_host)
            if ":" in parsed_host:
                candidate_hosts.append(parsed_host.split(":")[0])

    # 4. Host from FINIK_HOST env
    finik_host = os.getenv("FINIK_HOST", "").strip('"\' ')
    if finik_host and finik_host not in candidate_hosts:
        candidate_hosts.append(finik_host)

    # Collect x-api-* headers
    x_api_headers = {}
    for name, value in request.headers.items():
        lower = name.lower()
        if lower.startswith("x-api-"):
            x_api_headers[lower] = value
    x_api_headers["x-api-timestamp"] = timestamp

    # Query params if present
    query_params = dict(request.query_params) if request.query_params else None

    # Candidate paths
    req_path = request.url.path
    candidate_paths = [req_path, "/api/payment/finik/webhook", "/finik/webhook"]

    # Verify signature
    is_valid = verify_webhook(
        http_method="post",
        path=candidate_paths,
        timestamp=timestamp,
        signature_b64=signature,
        body=body,
        host=candidate_hosts,
        x_api_headers=x_api_headers,
        query_params=query_params,
    )

    if not is_valid:
        logger.warning(f"Finik webhook invalid signature. Headers: {dict(request.headers)}, Body: {body}")
        return JSONResponse({"error": "Invalid signature"}, status_code=401)

    # Extract payment identification
    fields = body.get("fields") if isinstance(body.get("fields"), dict) else {}

    possible_payment_ids = [
        fields.get("PaymentId"),
        fields.get("paymentId"),
        body.get("paymentId"),
        body.get("PaymentId"),
        body.get("transactionId"),
        fields.get("qrTransactionId"),
        body.get("id"),
    ]
    possible_payment_ids = [str(pid).strip() for pid in possible_payment_ids if pid]

    status_raw = str(body.get("status") or "").lower()
    status_map = {
        "succeeded": "SUCCEEDED",
        "success": "SUCCEEDED",
        "ok": "SUCCEEDED",
        "failed": "FAILED",
        "fail": "FAILED",
        "error": "FAILED",
    }
    payment_status = status_map.get(status_raw, "PENDING")

    # Find payment record in database
    payment = None
    if possible_payment_ids:
        result = await db.execute(
            select(FinikPayment).where(
                or_(
                    FinikPayment.payment_id.in_(possible_payment_ids),
                    FinikPayment.transaction_id.in_(possible_payment_ids),
                )
            )
        )
        payment = result.scalar_one_or_none()

    if not payment:
        logger.warning(f"Finik payment not found for candidate IDs: {possible_payment_ids}")
        return JSONResponse({"error": "Payment not found"}, status_code=404)

    was_succeeded = payment.status == "SUCCEEDED"

    # Update payment record
    if body.get("transactionId"):
        payment.transaction_id = str(body.get("transactionId"))
    payment.status = payment_status
    if body.get("net") is not None:
        try:
            payment.net = float(body.get("net"))
        except (ValueError, TypeError):
            pass
    elif payment.net is None:
        payment.net = payment.amount_kgs

    if body.get("receiptNumber"):
        payment.receipt_number = str(body.get("receiptNumber"))
    if body.get("transactionDate"):
        try:
            payment.transaction_date = int(body.get("transactionDate"))
        except (ValueError, TypeError):
            pass
    payment.webhook_payload = json.dumps(body, ensure_ascii=False)

    # Credit tokens to user balance if newly succeeded
    if payment_status == "SUCCEEDED" and not was_succeeded:
        # Fetch user
        user_result = await db.execute(select(User).where(User.id == payment.user_id))
        user = user_result.scalar_one_or_none()
        if user:
            # Credit main tokens
            tokens = float(payment.tokens_credited or 0.0)
            user.token_balance = float(user.token_balance or 0.0) + tokens

            # Create token transaction
            tx = TokenTransaction(
                user_id=user.id,
                amount_tokens=tokens,
                amount_usd=payment.amount_usd,
                type=TransactionTypeEnum.TOPUP,
                description=f"Пополнение через FINIK: ${payment.amount_usd:.2f} (коэф. {payment.price_coefficient})",
            )
            db.add(tx)

            # Handle promo code cashback
            if payment.promo_code_id and payment.cashback_tokens and payment.cashback_tokens > 0:
                cashback = float(payment.cashback_tokens)
                user.token_balance += cashback

                rate = float(os.getenv("TOKEN_RATE_PER_DOLLAR", "100"))
                cashback_usd = round(cashback / rate, 4) if rate > 0 else 0.0

                cashback_tx = TokenTransaction(
                    user_id=user.id,
                    amount_tokens=cashback,
                    amount_usd=cashback_usd,
                    type=TransactionTypeEnum.TOPUP,
                    description=f"Кешбек по промокоду: +{cashback:.2f} токенов",
                )
                db.add(cashback_tx)

                # Record promo usage
                usage = PromoCodeUsage(
                    promo_code_id=payment.promo_code_id,
                    user_id=user.id,
                    payment_id=payment.id,
                    cashback_amount_tokens=cashback,
                    cashback_amount_usd=cashback_usd,
                )
                db.add(usage)

                # Increment promo uses
                promo_result = await db.execute(
                    select(PromoCode).where(PromoCode.id == payment.promo_code_id)
                )
                promo = promo_result.scalar_one_or_none()
                if promo:
                    promo.current_uses += 1

            logger.info(f"Successfully credited {tokens} tokens to user #{user.id} for Finik payment {payment.payment_id}")

    await db.commit()
    return {"success": True}


# ── Promo Code Validation ────────────────────────────────────────────────────
@router.post("/promo/validate")
async def validate_promo_code(
    payload: ValidatePromoRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Validate a promo code and return cashback percentage."""
    result = await db.execute(
        select(PromoCode).where(
            and_(
                PromoCode.code == payload.code.strip().upper(),
                PromoCode.is_active == True,
            )
        )
    )
    promo = result.scalar_one_or_none()
    if not promo:
        raise HTTPException(status_code=404, detail="Промокод не найден")

    now = datetime.now(timezone.utc)
    if now < promo.valid_from or now > promo.valid_until:
        raise HTTPException(status_code=400, detail="Срок действия промокода истёк")
    if promo.current_uses >= promo.max_uses:
        raise HTTPException(status_code=400, detail="Промокод исчерпал лимит использований")

    # Check if user already used it
    usage_check = await db.execute(
        select(PromoCodeUsage).where(
            and_(
                PromoCodeUsage.promo_code_id == promo.id,
                PromoCodeUsage.user_id == current_user.id,
            )
        )
    )
    if usage_check.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Вы уже использовали этот промокод")

    return {
        "valid": True,
        "cashback_percent": promo.cashback_percent,
        "code": promo.code,
    }


# ── Offers ───────────────────────────────────────────────────────────────────
@router.get("/offers")
async def list_offers(db: AsyncSession = Depends(get_db)):
    """List all available payment offer documents."""
    result = await db.execute(select(PaymentOffer).order_by(PaymentOffer.language))
    offers = result.scalars().all()
    return {"offers": [o.to_dict() for o in offers]}


@router.get("/offers/{language}")
async def get_offer_pdf(
    language: str,
    download: bool = False,
    db: AsyncSession = Depends(get_db),
):
    """Download/view offer PDF for a specific language."""
    result = await db.execute(
        select(PaymentOffer).where(PaymentOffer.language == language.strip().lower())
    )
    offer = result.scalar_one_or_none()

    if not offer:
        # Fallback to Russian
        result = await db.execute(
            select(PaymentOffer).where(PaymentOffer.language == "ru")
        )
        offer = result.scalar_one_or_none()

    if not offer:
        raise HTTPException(status_code=404, detail="Оферта не найдена")

    file_path = OFFERS_DIR / offer.filename
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="Файл оферты не найден")

    disposition = "attachment" if download else "inline"
    return FileResponse(
        path=str(file_path),
        media_type="application/pdf",
        content_disposition_type=disposition,
        filename=offer.original_name or offer.filename,
    )


# ── Payment history ──────────────────────────────────────────────────────────
@router.get("/history")
async def get_payment_history(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get current user's Finik payment history."""
    result = await db.execute(
        select(FinikPayment)
        .where(FinikPayment.user_id == current_user.id)
        .order_by(FinikPayment.created_at.desc())
        .limit(50)
    )
    payments = result.scalars().all()
    return {"payments": [p.to_dict() for p in payments]}
