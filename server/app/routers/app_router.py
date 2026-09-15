import os
import uuid
import logging
from typing import Optional
from pathlib import Path
from fastapi import APIRouter, HTTPException, Request, UploadFile, File, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.database import get_db
from app.models.user import User
from app.models.media_file import MediaFile
from app.auth.security import get_current_user_optional
from app.utils.workflow_helper import (
    get_file_upload_url_helper,
    calculate_dynamic_cost_helper,
    upload_file_helper,
)

logger = logging.getLogger(__name__)
router = APIRouter()


def detect_file_type(filename: str, mime_type: Optional[str] = None) -> str:
    """Classify file into image, video, audio, or other."""
    if mime_type:
        mime_lower = mime_type.lower()
        if mime_lower.startswith("image/"): return "image"
        if mime_lower.startswith("video/"): return "video"
        if mime_lower.startswith("audio/"): return "audio"

    ext = Path(filename or "").suffix.lower()
    image_exts = {".jpg", ".jpeg", ".png", ".webp", ".gif", ".svg", ".avif", ".bmp", ".ico"}
    video_exts = {".mp4", ".webm", ".mov", ".avi", ".mkv", ".flv", ".wmv", ".m4v"}
    audio_exts = {".mp3", ".wav", ".ogg", ".m4a", ".aac", ".flac", ".wma", ".opus"}

    if ext in image_exts: return "image"
    if ext in video_exts: return "video"
    if ext in audio_exts: return "audio"
    return "other"


@router.get("/get_file_upload_url")
async def get_file_upload_url(request: Request):
    try:
        params = dict(request.query_params)
        return await get_file_upload_url_helper(params)
    except Exception as e:
        if isinstance(e, HTTPException): raise e
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/upload_file")
@router.post("/upload")
async def upload_file(
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional),
):
    try:
        original_filename = file.filename or "uploaded_file"
        content_type = file.content_type
        
        # Upload to storage (MuAPI / S3)
        res = await upload_file_helper(file)
        
        # Determine uploaded URL
        uploaded_url = None
        if isinstance(res, dict):
            uploaded_url = res.get("url") or res.get("file_url") or res.get("download_url")
        elif isinstance(res, str):
            uploaded_url = res

        # Automatically record uploaded input file for the authenticated user
        if current_user and uploaded_url:
            try:
                exist_check = await db.execute(
                    select(MediaFile.id).where(
                        MediaFile.user_id == current_user.id,
                        MediaFile.url == uploaded_url,
                    )
                )
                if not exist_check.scalar_one_or_none():
                    clean_name = os.path.basename(uploaded_url.split("?")[0]) or original_filename
                    media_record = MediaFile(
                        user_id=current_user.id,
                        filename=original_filename or clean_name,
                        url=uploaded_url,
                        file_type=detect_file_type(original_filename, content_type),
                        source="upload",
                        mime_type=content_type,
                    )
                    db.add(media_record)
                    await db.commit()
            except Exception as save_err:
                logger.warning(f"Could not auto-record uploaded file to media_files: {save_err}")

        return res
    except Exception as e:
        if isinstance(e, HTTPException): raise e
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/calculate_dynamic_cost")
async def calculate_dynamic_cost(request: Request):
    try:
        payload = await request.json()
        return await calculate_dynamic_cost_helper(payload)
    except Exception as e:
        if isinstance(e, HTTPException): raise e
        raise HTTPException(status_code=400, detail=str(e))
