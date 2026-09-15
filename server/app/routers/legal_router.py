import logging
from pathlib import Path
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.legal_document import LegalDocument
from app.models.payment_offer import PaymentOffer

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/legal", tags=["legal"])

LEGAL_DIR = Path(__file__).resolve().parent.parent.parent / "uploads" / "legal"
OFFERS_DIR = Path(__file__).resolve().parent.parent.parent / "uploads" / "offers"
LEGAL_DIR.mkdir(parents=True, exist_ok=True)
OFFERS_DIR.mkdir(parents=True, exist_ok=True)


@router.get("/documents")
async def list_legal_documents(db: AsyncSession = Depends(get_db)):
    """List all available legal documents (user agreement, privacy policy, public offers)."""
    # Fetch legal documents
    doc_result = await db.execute(
        select(LegalDocument).order_by(LegalDocument.doc_type, LegalDocument.language)
    )
    docs = doc_result.scalars().all()

    # Also fetch payment offers for completeness
    offer_result = await db.execute(
        select(PaymentOffer).order_by(PaymentOffer.language)
    )
    offers = offer_result.scalars().all()

    return {
        "documents": [d.to_dict() for d in docs],
        "offers": [o.to_dict() for o in offers],
    }


@router.get("/documents/{doc_type}")
async def list_documents_by_type(doc_type: str, db: AsyncSession = Depends(get_db)):
    """List available languages for a specific document type."""
    normalized_type = doc_type.strip().lower()

    if normalized_type in ("offer", "payment_offer", "terms"):
        result = await db.execute(
            select(PaymentOffer).order_by(PaymentOffer.language)
        )
        offers = result.scalars().all()
        return {
            "doc_type": normalized_type,
            "languages": [o.to_dict() for o in offers],
        }

    result = await db.execute(
        select(LegalDocument)
        .where(LegalDocument.doc_type == normalized_type)
        .order_by(LegalDocument.language)
    )
    docs = result.scalars().all()
    return {
        "doc_type": normalized_type,
        "languages": [d.to_dict() for d in docs],
    }


@router.get("/documents/{doc_type}/{language}")
async def get_legal_document_pdf(
    doc_type: str,
    language: str,
    download: bool = False,
    db: AsyncSession = Depends(get_db),
):
    """View or download a legal document PDF (with fallback to 'ru' or first available)."""
    normalized_type = doc_type.strip().lower()
    lang = language.strip().lower()
    disposition = "attachment" if download else "inline"

    # Handle payment offer doc type
    if normalized_type in ("offer", "payment_offer", "terms"):
        # Check PaymentOffer table first
        result = await db.execute(
            select(PaymentOffer).where(PaymentOffer.language == lang)
        )
        offer = result.scalar_one_or_none()
        if not offer:
            # Fallback to RU
            result = await db.execute(
                select(PaymentOffer).where(PaymentOffer.language == "ru")
            )
            offer = result.scalar_one_or_none()
        if not offer:
            # Fallback to any
            result = await db.execute(select(PaymentOffer).limit(1))
            offer = result.scalar_one_or_none()

        if not offer:
            raise HTTPException(status_code=404, detail="Документ оферты не найден")

        file_path = OFFERS_DIR / offer.filename
        if not file_path.exists():
            raise HTTPException(status_code=404, detail="Файл оферты не найден на диске")

        return FileResponse(
            path=str(file_path),
            media_type="application/pdf",
            content_disposition_type=disposition,
            filename=offer.original_name or offer.filename,
        )

    # Handle standard legal documents (user_agreement, privacy_policy, etc.)
    result = await db.execute(
        select(LegalDocument).where(
            LegalDocument.doc_type == normalized_type,
            LegalDocument.language == lang,
        )
    )
    doc = result.scalar_one_or_none()

    if not doc:
        # Fallback to RU
        result = await db.execute(
            select(LegalDocument).where(
                LegalDocument.doc_type == normalized_type,
                LegalDocument.language == "ru",
            )
        )
        doc = result.scalar_one_or_none()

    if not doc:
        # Fallback to any language of this type
        result = await db.execute(
            select(LegalDocument).where(
                LegalDocument.doc_type == normalized_type
            ).limit(1)
        )
        doc = result.scalar_one_or_none()

    if not doc:
        doc_names = {
            "user_agreement": "Пользовательское соглашение",
            "privacy_policy": "Политика конфиденциальности",
        }
        name = doc_names.get(normalized_type, "Документ")
        raise HTTPException(status_code=404, detail=f"{name} не найден")

    file_path = LEGAL_DIR / doc.filename
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="Файл документа не найден на диске")

    return FileResponse(
        path=str(file_path),
        media_type="application/pdf",
        content_disposition_type=disposition,
        filename=doc.original_name or doc.filename,
    )
