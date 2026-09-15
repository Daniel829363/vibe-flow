import os
import re
import math
import uuid
import shutil
import logging
import urllib.parse
from pathlib import Path
from datetime import datetime, timezone
from typing import Optional

import httpx
from fastapi import APIRouter, HTTPException, Depends, Query, UploadFile, File, Form
from fastapi.responses import StreamingResponse, FileResponse
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, desc, or_, and_, case
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.models.user import User
from app.models.media_file import MediaFile
from app.models.workflow_meta import WorkflowMeta, VisibilityEnum
from app.models.workflow_share import WorkflowShare
from app.auth.security import get_current_user
from app.utils.workflow_helper import (
    upload_file_helper,
    get_api_key,
    get_workflow_def_helper,
    get_run_status_helper,
)

logger = logging.getLogger(__name__)
router = APIRouter()

UPLOAD_DIR = Path(__file__).resolve().parent.parent.parent / "uploads"
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)


def detect_file_type(filename: str, mime_type: Optional[str] = None) -> str:
    """Classify file into image, video, audio, or other."""
    if mime_type:
        mime_lower = mime_type.lower()
        if mime_lower.startswith("image/"):
            return "image"
        if mime_lower.startswith("video/"):
            return "video"
        if mime_lower.startswith("audio/"):
            return "audio"

    ext = Path(filename or "").suffix.lower()
    image_exts = {".jpg", ".jpeg", ".png", ".webp", ".gif", ".svg", ".avif", ".bmp", ".ico"}
    video_exts = {".mp4", ".webm", ".mov", ".avi", ".mkv", ".flv", ".wmv", ".m4v"}
    audio_exts = {".mp3", ".wav", ".ogg", ".m4a", ".aac", ".flac", ".wma", ".opus"}

    if ext in image_exts:
        return "image"
    if ext in video_exts:
        return "video"
    if ext in audio_exts:
        return "audio"
    return "other"


async def get_accessible_workflow_ids(user: User, db: AsyncSession) -> tuple[list[str], list[str]]:
    """Returns (accessible_remote_ids, accessible_local_ids) for a given user."""
    stmt = select(WorkflowMeta.id, WorkflowMeta.remote_workflow_id).where(
        or_(
            WorkflowMeta.owner_id == user.id,
            WorkflowMeta.id.in_(
                select(WorkflowShare.workflow_meta_id).where(
                    WorkflowShare.shared_with_user_id == user.id
                )
            ),
            WorkflowMeta.visibility == VisibilityEnum.PUBLIC,
        )
    )
    res = await db.execute(stmt)
    rows = res.all()
    local_ids = [r[0] for r in rows if r[0]]
    remote_ids = [r[1] for r in rows if r[1]]
    return remote_ids, local_ids


class RegisterMediaRequest(BaseModel):
    url: str
    filename: Optional[str] = None
    file_type: Optional[str] = None
    source: Optional[str] = "generation"
    size_bytes: Optional[int] = None
    mime_type: Optional[str] = None
    workflow_id: Optional[str] = None
    workflow_name: Optional[str] = None


# ──────────────────────────────────────────────────────────────────────────────
#  GET /api/media/admin/filters — Admin Filter Options (Users & Workflows)
# ──────────────────────────────────────────────────────────────────────────────
@router.get("/admin/filters")
async def get_admin_media_filters(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Retrieve lists of users and workflows for admin filtering."""
    if not current_user.is_superadmin:
        raise HTTPException(status_code=403, detail="Доступ запрещен. Требуются права суперадмина.")

    # Users list with media count
    users_query = (
        select(
            User.id,
            User.email,
            User.name,
            User.avatar_url,
            func.count(MediaFile.id).label("media_count"),
        )
        .outerjoin(MediaFile, and_(MediaFile.user_id == User.id, MediaFile.deleted_at.is_(None)))
        .group_by(User.id)
        .order_by(desc("media_count"), User.email)
    )
    users_res = await db.execute(users_query)
    users_list = [
        {
            "id": r.id,
            "email": r.email,
            "name": r.name,
            "avatar_url": r.avatar_url,
            "media_count": int(r.media_count or 0),
        }
        for r in users_res.all()
    ]

    # Workflows list with owner info and media count
    wf_query = (
        select(
            WorkflowMeta.id,
            WorkflowMeta.remote_workflow_id,
            WorkflowMeta.name,
            WorkflowMeta.owner_id,
            User.email.label("owner_email"),
            User.name.label("owner_name"),
            func.count(MediaFile.id).label("media_count"),
        )
        .join(User, WorkflowMeta.owner_id == User.id)
        .outerjoin(
            MediaFile,
            and_(
                or_(
                    MediaFile.workflow_id == WorkflowMeta.remote_workflow_id,
                    MediaFile.workflow_id == WorkflowMeta.id,
                ),
                MediaFile.deleted_at.is_(None),
            ),
        )
        .group_by(WorkflowMeta.id, User.email, User.name)
        .order_by(desc("media_count"), WorkflowMeta.name)
    )
    wf_res = await db.execute(wf_query)
    wf_list = [
        {
            "id": r.id,
            "remote_workflow_id": r.remote_workflow_id,
            "name": r.name or "Без названия",
            "owner_id": r.owner_id,
            "owner_email": r.owner_email,
            "owner_name": r.owner_name,
            "media_count": int(r.media_count or 0),
        }
        for r in wf_res.all()
    ]

    return {
        "users": users_list,
        "workflows": wf_list,
    }


# ──────────────────────────────────────────────────────────────────────────────
#  GET /api/media/download — Proxy and stream media file as attachment
# ──────────────────────────────────────────────────────────────────────────────
@router.get("/download")
async def download_media_file(
    url: str = Query(..., description="URL of media to download"),
    filename: Optional[str] = Query(None, description="Filename for download"),
):
    """Proxy and stream media file download with Content-Disposition attachment."""
    if not url.startswith(("http://", "https://", "/api/uploads/")):
        raise HTTPException(status_code=400, detail="Invalid media URL")

    # Local uploads
    if url.startswith("/api/uploads/"):
        local_name = url.replace("/api/uploads/", "").split("?")[0]
        local_path = UPLOAD_DIR / local_name
        if not local_path.exists():
            raise HTTPException(status_code=404, detail="File not found")
        clean_filename = filename or local_path.name
        encoded_filename = urllib.parse.quote(clean_filename)
        headers = {
            "Content-Disposition": f'attachment; filename="{clean_filename}"; filename*=UTF-8\'\'{encoded_filename}',
        }
        return FileResponse(path=str(local_path), filename=clean_filename, headers=headers)

    # Remote URL (MuAPI / CDN / S3)
    clean_filename = filename or os.path.basename(url.split("?")[0]) or "download"
    encoded_filename = urllib.parse.quote(clean_filename)

    ext = Path(clean_filename).suffix.lower()
    mime_map = {
        ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
        ".webp": "image/webp", ".gif": "image/gif", ".svg": "image/svg+xml",
        ".mp4": "video/mp4", ".webm": "video/webm", ".mov": "video/quicktime",
        ".mp3": "audio/mpeg", ".wav": "audio/wav", ".ogg": "audio/ogg",
    }
    content_type = mime_map.get(ext, "application/octet-stream")

    headers = {
        "Content-Disposition": f'attachment; filename="{clean_filename}"; filename*=UTF-8\'\'{encoded_filename}',
        "Access-Control-Expose-Headers": "Content-Disposition",
    }

    async def stream_remote():
        async with httpx.AsyncClient(follow_redirects=True) as client:
            async with client.stream("GET", url, timeout=120.0) as resp:
                if resp.status_code >= 400:
                    raise HTTPException(status_code=resp.status_code, detail="Remote file could not be downloaded")
                async for chunk in resp.aiter_bytes(chunk_size=65536):
                    yield chunk

    return StreamingResponse(stream_remote(), media_type=content_type, headers=headers)


# ──────────────────────────────────────────────────────────────────────────────
#  GET /api/media — List media files with access control & admin filters
# ──────────────────────────────────────────────────────────────────────────────
@router.get("")
@router.get("/")
async def list_media_files(
    file_type: Optional[str] = Query(None, description="Filter: all, image, video, audio, other"),
    source: Optional[str] = Query(None, description="Filter: all, upload, generation"),
    search: Optional[str] = Query(None, description="Search by filename or workflow_name"),
    user_id: Optional[str] = Query(None, description="Superadmin only: filter by user ID"),
    workflow_id: Optional[str] = Query(None, description="Filter by workflow ID"),
    page: int = Query(1, ge=1),
    limit: int = Query(24, ge=1, le=100),
    include_deleted: bool = Query(False),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Retrieve paginated media files and summary statistics with strict access control and admin filtering."""
    base_conditions = []

    if current_user.is_superadmin:
        # Superadmin can view all media or filter by specific user / workflow
        if user_id and user_id != "all":
            base_conditions.append(MediaFile.user_id == user_id)
        if workflow_id and workflow_id != "all":
            base_conditions.append(
                or_(
                    MediaFile.workflow_id == workflow_id,
                    MediaFile.workflow_name == workflow_id,
                )
            )
    else:
        # Regular user: ONLY media they own or media in accessible workflows
        accessible_remote_ids, accessible_local_ids = await get_accessible_workflow_ids(current_user, db)
        accessible_wf_set = list(set(accessible_remote_ids + accessible_local_ids))

        user_access_conditions = [MediaFile.user_id == current_user.id]
        if accessible_wf_set:
            user_access_conditions.append(MediaFile.workflow_id.in_(accessible_wf_set))

        base_conditions.append(or_(*user_access_conditions))

        if workflow_id and workflow_id != "all":
            if workflow_id in accessible_wf_set:
                base_conditions.append(MediaFile.workflow_id == workflow_id)
            else:
                base_conditions.append(MediaFile.id == "00000000-0000-0000-0000-000000000000")

    if not include_deleted:
        base_conditions.append(MediaFile.deleted_at.is_(None))

    # Calculate statistics across matched scope
    stat_query = (
        select(
            func.count().label("total"),
            func.coalesce(func.sum(case((MediaFile.file_type == "image", 1), else_=0)), 0).label("images"),
            func.coalesce(func.sum(case((MediaFile.file_type == "video", 1), else_=0)), 0).label("videos"),
            func.coalesce(func.sum(case((MediaFile.file_type == "audio", 1), else_=0)), 0).label("audios"),
            func.coalesce(func.sum(case((MediaFile.source == "upload", 1), else_=0)), 0).label("uploads"),
            func.coalesce(func.sum(case((MediaFile.source == "generation", 1), else_=0)), 0).label("generations"),
            func.coalesce(func.sum(MediaFile.size_bytes), 0).label("total_size"),
        )
        .where(and_(*base_conditions))
    )
    stat_res = await db.execute(stat_query)
    stat_row = stat_res.one()
    stats = {
        "total": int(stat_row.total or 0),
        "images": int(stat_row.images or 0),
        "videos": int(stat_row.videos or 0),
        "audios": int(stat_row.audios or 0),
        "uploads": int(stat_row.uploads or 0),
        "generations": int(stat_row.generations or 0),
        "total_size_bytes": int(stat_row.total_size or 0),
    }

    # Filtered query
    filter_conditions = list(base_conditions)
    if file_type and file_type != "all":
        filter_conditions.append(MediaFile.file_type == file_type)

    if source and source != "all":
        filter_conditions.append(MediaFile.source == source)

    if search and search.strip():
        term = f"%{search.strip()}%"
        filter_conditions.append(
            or_(
                MediaFile.filename.ilike(term),
                MediaFile.workflow_name.ilike(term),
            )
        )

    # Total matching count
    count_query = select(func.count()).select_from(MediaFile).where(and_(*filter_conditions))
    count_res = await db.execute(count_query)
    total_matching = count_res.scalar_one()

    # Pagination with user eager loading
    offset = (page - 1) * limit
    main_query = (
        select(MediaFile)
        .options(selectinload(MediaFile.user))
        .where(and_(*filter_conditions))
        .order_by(desc(MediaFile.created_at))
        .offset(offset)
        .limit(limit)
    )
    res = await db.execute(main_query)
    items = res.scalars().all()

    total_pages = math.ceil(total_matching / limit) if limit > 0 else 1

    return {
        "items": [item.to_dict() for item in items],
        "total": total_matching,
        "page": page,
        "limit": limit,
        "pages": total_pages,
        "stats": stats,
    }


# ──────────────────────────────────────────────────────────────────────────────
#  POST /api/media/upload — Upload media file (MuAPI with local fallback)
# ──────────────────────────────────────────────────────────────────────────────
@router.post("/upload")
async def upload_media_file(
    file: UploadFile = File(...),
    workflow_id: Optional[str] = Form(None),
    workflow_name: Optional[str] = Form(None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Upload a media file, save to storage (MuAPI / local), and track in database."""
    original_filename = file.filename or "media_file"
    content_type = file.content_type
    detected_type = detect_file_type(original_filename, content_type)

    file_bytes = await file.read()
    size_bytes = len(file_bytes)

    if size_bytes > 100 * 1024 * 1024:  # 100MB max
        raise HTTPException(status_code=400, detail="Размер файла превышает лимит 100 МБ")

    # Try MuAPI upload first if API key configured
    file_url = None
    try:
        api_key = os.getenv("MU_API_KEY")
        if api_key:
            file.file.seek(0)
            mu_res = await upload_file_helper(file)
            if isinstance(mu_res, dict):
                file_url = mu_res.get("url") or mu_res.get("file_url") or mu_res.get("download_url")
            elif isinstance(mu_res, str):
                file_url = mu_res
    except Exception as e:
        logger.info(f"MuAPI upload skipped/failed ({e}), saving locally")

    # Fallback to local storage if MuAPI did not produce a URL
    if not file_url:
        clean_name = re.sub(r"[^a-zA-Z0-9_\-\.]", "_", original_filename)
        unique_filename = f"{uuid.uuid4().hex[:12]}_{clean_name}"
        save_path = UPLOAD_DIR / unique_filename
        try:
            with open(save_path, "wb") as buffer:
                buffer.write(file_bytes)
            file_url = f"/api/uploads/{unique_filename}"
        except Exception as e:
            logger.error(f"Failed to save uploaded file locally: {e}")
            raise HTTPException(status_code=500, detail=f"Не удалось сохранить файл: {str(e)}")

    media_record = MediaFile(
        user_id=current_user.id,
        filename=original_filename,
        url=file_url,
        file_type=detected_type,
        source="upload",
        size_bytes=size_bytes,
        mime_type=content_type,
        workflow_id=workflow_id,
        workflow_name=workflow_name,
    )
    db.add(media_record)
    await db.commit()
    await db.refresh(media_record)

    return {
        "message": "Файл успешно загружен",
        "file": media_record.to_dict(),
    }


# ──────────────────────────────────────────────────────────────────────────────
#  POST /api/media/register — Register generated media or external URL
# ──────────────────────────────────────────────────────────────────────────────
@router.post("/register")
async def register_media(
    payload: RegisterMediaRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Register an AI-generated or external media item for the user."""
    url = payload.url.strip()
    if not url:
        raise HTTPException(status_code=400, detail="URL не может быть пустым")

    filename = payload.filename
    if not filename:
        url_path = url.split("?")[0]
        basename = os.path.basename(url_path)
        filename = basename if basename and "." in basename else f"media_{uuid.uuid4().hex[:8]}"

    file_type = payload.file_type or detect_file_type(filename, payload.mime_type)

    media_record = MediaFile(
        user_id=current_user.id,
        filename=filename,
        url=url,
        file_type=file_type,
        source=payload.source or "generation",
        size_bytes=payload.size_bytes,
        mime_type=payload.mime_type,
        workflow_id=payload.workflow_id,
        workflow_name=payload.workflow_name,
    )
    db.add(media_record)
    await db.commit()
    await db.refresh(media_record)

    return {
        "message": "Медиафайл успешно зарегистрирован",
        "file": media_record.to_dict(),
    }


# ──────────────────────────────────────────────────────────────────────────────
#  GET /api/media/{media_id} — Get details for a single media file
# ──────────────────────────────────────────────────────────────────────────────
@router.get("/{media_id}")
async def get_media_file(
    media_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    query = select(MediaFile).options(selectinload(MediaFile.user)).where(MediaFile.id == media_id)
    result = await db.execute(query)
    media = result.scalar_one_or_none()
    if not media:
        raise HTTPException(status_code=404, detail="Файл не найден")

    if not current_user.is_superadmin and media.user_id != current_user.id:
        if media.workflow_id:
            accessible_remote_ids, accessible_local_ids = await get_accessible_workflow_ids(current_user, db)
            if media.workflow_id not in (accessible_remote_ids + accessible_local_ids):
                raise HTTPException(status_code=403, detail="Доступ к файлу запрещен")
        else:
            raise HTTPException(status_code=403, detail="Доступ к файлу запрещен")

    return media.to_dict()


# ──────────────────────────────────────────────────────────────────────────────
#  DELETE /api/media/{media_id} — Soft delete or hard delete
# ──────────────────────────────────────────────────────────────────────────────
@router.delete("/{media_id}")
async def delete_media_file(
    media_id: str,
    permanent: bool = Query(False),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    query = select(MediaFile).where(MediaFile.id == media_id)
    result = await db.execute(query)
    media = result.scalar_one_or_none()
    if not media:
        raise HTTPException(status_code=404, detail="Файл не найден")

    if not current_user.is_superadmin and media.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="У вас нет прав на удаление этого файла")

    if permanent:
        if media.url.startswith("/api/uploads/"):
            local_fname = media.url.replace("/api/uploads/", "")
            local_file = UPLOAD_DIR / local_fname
            if local_file.exists():
                try:
                    local_file.unlink()
                except Exception as e:
                    logger.warning(f"Could not remove local file {local_file}: {e}")
        await db.delete(media)
    else:
        media.deleted_at = datetime.now(timezone.utc)

    await db.commit()
    return {"success": True, "message": "Файл успешно удален"}


# ──────────────────────────────────────────────────────────────────────────────
#  POST /api/media/{media_id}/restore — Restore soft-deleted media file
# ──────────────────────────────────────────────────────────────────────────────
@router.post("/{media_id}/restore")
async def restore_media_file(
    media_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    query = select(MediaFile).options(selectinload(MediaFile.user)).where(MediaFile.id == media_id)
    result = await db.execute(query)
    media = result.scalar_one_or_none()
    if not media:
        raise HTTPException(status_code=404, detail="Файл не найден")

    if not current_user.is_superadmin and media.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="У вас нет прав на восстановление этого файла")

    media.deleted_at = None
    await db.commit()
    await db.refresh(media)

    return {"success": True, "message": "Файл восстановлен", "file": media.to_dict()}


# ──────────────────────────────────────────────────────────────────────────────
#  POST /api/media/sync — Scan and sync existing media from accessible workflows
# ──────────────────────────────────────────────────────────────────────────────
@router.post("/sync")
async def sync_media_from_workflows(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Scan accessible workflows and MuAPI graph definitions to discover and register generated and uploaded media."""
    synced_count = 0

    if current_user.is_superadmin:
        # Superadmin: sync all registered workflows in database, attributing each to its owner
        wf_res = await db.execute(select(WorkflowMeta))
        all_workflows = list(wf_res.scalars().all())
        wf_dict = {
            wf.remote_workflow_id: (wf.name or "Workflow", wf.owner_id)
            for wf in all_workflows
            if wf.remote_workflow_id
        }
    else:
        # Regular user: ONLY sync workflows owned by or shared with this user
        wf_res = await db.execute(
            select(WorkflowMeta).where(
                or_(
                    WorkflowMeta.owner_id == current_user.id,
                    WorkflowMeta.id.in_(
                        select(WorkflowShare.workflow_meta_id).where(
                            WorkflowShare.shared_with_user_id == current_user.id
                        )
                    ),
                )
            )
        )
        user_workflows = list(wf_res.scalars().all())
        wf_dict = {
            wf.remote_workflow_id: (wf.name or "Workflow", wf.owner_id)
            for wf in user_workflows
            if wf.remote_workflow_id
        }

    for remote_id, (wf_name, owner_id) in wf_dict.items():
        try:
            wf_def = await get_workflow_def_helper(remote_id)
            if not isinstance(wf_def, dict):
                continue

            nodes = wf_def.get("nodes") or (wf_def.get("data") or {}).get("nodes") or []
            if not isinstance(nodes, list):
                nodes = []

            urls_to_add = set()

            for node in nodes:
                if not isinstance(node, dict):
                    continue
                data = node.get("data") or {}
                if not isinstance(data, dict):
                    continue

                r_url = data.get("resultUrl")
                if isinstance(r_url, str) and r_url.startswith(("http://", "https://", "/api/uploads/")):
                    urls_to_add.add((r_url, "generation"))

                outputs = data.get("outputs") or []
                if isinstance(outputs, list):
                    for out in outputs:
                        if isinstance(out, dict):
                            val = out.get("value")
                            if isinstance(val, str) and val.startswith(("http://", "https://", "/api/uploads/")):
                                urls_to_add.add((val, "generation"))
                            elif isinstance(val, list):
                                for sub_val in val:
                                    if isinstance(sub_val, str) and sub_val.startswith(("http://", "https://", "/api/uploads/")):
                                        urls_to_add.add((sub_val, "generation"))

                history = data.get("outputHistory") or []
                if isinstance(history, list):
                    for hist in history:
                        if isinstance(hist, dict):
                            res = hist.get("result") or {}
                            h_outputs = res.get("outputs") or []
                            if isinstance(h_outputs, list):
                                for h_out in h_outputs:
                                    if isinstance(h_out, dict):
                                        val = h_out.get("value")
                                        if isinstance(val, str) and val.startswith(("http://", "https://", "/api/uploads/")):
                                            urls_to_add.add((val, "generation"))
                                        elif isinstance(val, list):
                                            for sub_val in val:
                                                if isinstance(sub_val, str) and sub_val.startswith(("http://", "https://", "/api/uploads/")):
                                                    urls_to_add.add((sub_val, "generation"))

                containers = [
                    data.get("formValues"),
                    data.get("params"),
                    data.get("input_params"),
                    data.get("inputs"),
                    node.get("params"),
                    node.get("input_params"),
                    node.get("inputs"),
                ]
                for container in containers:
                    if isinstance(container, dict):
                        for _, inp_val in container.items():
                            if isinstance(inp_val, str) and inp_val.startswith(("http://", "https://", "/api/uploads/")) and "{{" not in inp_val:
                                urls_to_add.add((inp_val, "upload"))
                            elif isinstance(inp_val, list):
                                for sub_inp in inp_val:
                                    if isinstance(sub_inp, str) and sub_inp.startswith(("http://", "https://", "/api/uploads/")) and "{{" not in sub_inp:
                                        urls_to_add.add((sub_inp, "upload"))
                    elif isinstance(container, list):
                        for sub_inp in container:
                            if isinstance(sub_inp, str) and sub_inp.startswith(("http://", "https://", "/api/uploads/")) and "{{" not in sub_inp:
                                urls_to_add.add((sub_inp, "upload"))

            run_ids = set()
            if wf_def.get("run_id"):
                run_ids.add(wf_def["run_id"])
            if (wf_def.get("last_run") or {}).get("run_id"):
                run_ids.add(wf_def["last_run"]["run_id"])

            run_hist = wf_def.get("run_history")
            if isinstance(run_hist, list):
                for rh in run_hist:
                    if isinstance(rh, dict) and rh.get("run_id"):
                        run_ids.add(rh["run_id"])
            elif isinstance(run_hist, dict):
                for _, rh in run_hist.items():
                    if isinstance(rh, dict) and rh.get("run_id"):
                        run_ids.add(rh["run_id"])

            for r_id in run_ids:
                try:
                    status_data = await get_run_status_helper(r_id)
                    if isinstance(status_data, dict):
                        st_nodes = status_data.get("nodes") or {}
                        if isinstance(st_nodes, dict):
                            for _, r_list in st_nodes.items():
                                if not isinstance(r_list, list):
                                    continue
                                for single_r in r_list:
                                    if not isinstance(single_r, dict):
                                        continue
                                    if single_r.get("status") not in ("succeeded", "completed"):
                                        continue
                                    r_res = single_r.get("result") or {}
                                    r_outs = r_res.get("outputs") or []
                                    if isinstance(r_outs, list):
                                        for ro in r_outs:
                                            if isinstance(ro, dict):
                                                val = ro.get("value")
                                                if isinstance(val, str) and val.startswith(("http://", "https://", "/api/uploads/")):
                                                    urls_to_add.add((val, "generation"))
                                                elif isinstance(val, list):
                                                    for sub_val in val:
                                                        if isinstance(sub_val, str) and sub_val.startswith(("http://", "https://", "/api/uploads/")):
                                                            urls_to_add.add((sub_val, "generation"))
                except Exception as run_err:
                    logger.debug(f"Note on run {r_id} status sync: {run_err}")

            for u, src in urls_to_add:
                exist_check = await db.execute(
                    select(MediaFile.id).where(
                        and_(MediaFile.user_id == owner_id, MediaFile.url == u)
                    )
                )
                if not exist_check.scalar_one_or_none():
                    clean_u = u.split("?")[0]
                    fname = os.path.basename(clean_u) or f"media_{uuid.uuid4().hex[:8]}"
                    ftype = detect_file_type(fname)
                    db.add(
                        MediaFile(
                            user_id=owner_id,
                            filename=fname,
                            url=u,
                            file_type=ftype,
                            source=src,
                            workflow_id=remote_id,
                            workflow_name=wf_name,
                        )
                    )
                    synced_count += 1
        except Exception as err:
            logger.warning(f"Error syncing media from workflow {remote_id}: {err}")

    if synced_count > 0:
        await db.commit()

    return {
        "success": True,
        "synced": synced_count,
        "message": f"Синхронизировано {synced_count} медиафайлов из ваших процессов",
    }
