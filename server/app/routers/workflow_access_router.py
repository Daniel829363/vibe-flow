from fastapi import APIRouter, HTTPException, Depends, status, UploadFile, File
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_
from pydantic import BaseModel
from typing import Optional
from pathlib import Path
import uuid
import shutil
import re
from datetime import datetime, timezone

import logging

from app.database import get_db
from app.models.user import User
from app.models.workflow_meta import WorkflowMeta, VisibilityEnum
from app.models.workflow_share import WorkflowShare, AccessLevelEnum
from app.auth.security import get_current_user
from app.utils.workflow_helper import create_or_update_workflow, get_workflow_def_helper

logger = logging.getLogger(__name__)
router = APIRouter()

UPLOAD_DIR = Path(__file__).resolve().parent.parent.parent / "uploads"
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)


class SetVisibilityRequest(BaseModel):
    visibility: str  # "public" | "private"


class SetThumbnailRequest(BaseModel):
    thumbnail: Optional[str] = None


class ShareRequest(BaseModel):
    email: str
    access_level: str  # "full_access" | "view_only"


# ─────────────────────────────────────────────
#  GET /api/workflows/my  — мои + расшаренные мне
# ─────────────────────────────────────────────
@router.get("/my")
async def get_my_workflows(
    search: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # My own workflows
    own_query = select(WorkflowMeta).where(WorkflowMeta.owner_id == current_user.id)
    if search and search.strip():
        own_query = own_query.where(WorkflowMeta.name.ilike(f"%{search.strip()}%"))
    own_result = await db.execute(own_query.order_by(WorkflowMeta.updated_at.desc()))
    own_workflows = own_result.scalars().all()

    # Workflows shared with me
    shared_query = (
        select(WorkflowShare, WorkflowMeta)
        .join(WorkflowMeta, WorkflowShare.workflow_meta_id == WorkflowMeta.id)
        .where(WorkflowShare.shared_with_user_id == current_user.id)
    )
    if search and search.strip():
        shared_query = shared_query.where(WorkflowMeta.name.ilike(f"%{search.strip()}%"))
    shared_result = await db.execute(shared_query.order_by(WorkflowMeta.updated_at.desc()))
    shared_rows = shared_result.all()

    result = []

    # Own workflows — always full access
    for wf in own_workflows:
        d = wf.to_dict(access_level="owner")
        result.append(d)

    # Shared workflows
    for share, wf in shared_rows:
        d = wf.to_dict(
            access_level=share.access_level.value
            if isinstance(share.access_level, AccessLevelEnum)
            else share.access_level
        )
        result.append(d)

    return result


# ─────────────────────────────────────────────
#  GET /api/workflows/public  — публичные
# ─────────────────────────────────────────────
@router.get("/public")
async def get_public_workflows(
    search: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
):
    query = (
        select(WorkflowMeta, User)
        .join(User, WorkflowMeta.owner_id == User.id)
        .where(WorkflowMeta.visibility == VisibilityEnum.PUBLIC)
    )
    if search and search.strip():
        query = query.where(WorkflowMeta.name.ilike(f"%{search.strip()}%"))
    query = query.order_by(WorkflowMeta.updated_at.desc())

    result = await db.execute(query)
    rows = result.all()

    return [
        {
            **wf.to_dict(access_level="view_only"),
            "owner_name": user.name or user.email,
            "owner_avatar": user.avatar_url,
        }
        for wf, user in rows
    ]


# ─────────────────────────────────────────────
#  POST /api/workflows/{remote_id}/register
#  Регистрация workflow в локальной БД после создания на muapi
# ─────────────────────────────────────────────
@router.post("/{remote_id}/register")
async def register_workflow(
    remote_id: str,
    name: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # Idempotent — if already exists, return it
    existing = await db.execute(
        select(WorkflowMeta).where(WorkflowMeta.remote_workflow_id == remote_id)
    )
    existing_wf = existing.scalar_one_or_none()
    if existing_wf:
        return existing_wf.to_dict(access_level="owner")

    wf_meta = WorkflowMeta(
        remote_workflow_id=remote_id,
        owner_id=current_user.id,
        name=name or "Untitled Workflow",
        visibility=VisibilityEnum.PRIVATE,
    )
    db.add(wf_meta)
    await db.commit()
    await db.refresh(wf_meta)

    return wf_meta.to_dict(access_level="owner")


# ─────────────────────────────────────────────
#  POST /api/workflows/{remote_id}/visibility
# ─────────────────────────────────────────────
@router.post("/{remote_id}/visibility")
async def set_visibility(
    remote_id: str,
    payload: SetVisibilityRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    wf = await _get_owned_workflow(remote_id, current_user.id, db)

    if payload.visibility not in ("public", "private"):
        raise HTTPException(status_code=400, detail="visibility must be 'public' or 'private'")

    wf.visibility = VisibilityEnum.PUBLIC if payload.visibility == "public" else VisibilityEnum.PRIVATE
    await db.commit()
    await db.refresh(wf)

    return wf.to_dict(access_level="owner")


# ─────────────────────────────────────────────
#  POST /api/workflows/{remote_id}/thumbnail
# ─────────────────────────────────────────────
@router.post("/{remote_id}/thumbnail")
async def set_thumbnail(
    remote_id: str,
    payload: SetThumbnailRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    wf = await _get_owned_workflow(remote_id, current_user.id, db)
    wf.thumbnail = payload.thumbnail.strip() if payload.thumbnail and payload.thumbnail.strip() else None
    wf.updated_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(wf)

    return {
        "message": "Thumbnail updated successfully",
        "thumbnail": wf.thumbnail,
        "workflow": wf.to_dict(access_level="owner"),
    }


# ─────────────────────────────────────────────
#  POST /api/workflows/{remote_id}/thumbnail/upload
# ─────────────────────────────────────────────
@router.post("/{remote_id}/thumbnail/upload")
async def upload_thumbnail(
    remote_id: str,
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    wf = await _get_owned_workflow(remote_id, current_user.id, db)

    # Validate content type / extension
    allowed_types = ["image/jpeg", "image/png", "image/webp", "image/gif", "image/svg+xml", "image/avif"]
    allowed_exts = [".jpg", ".jpeg", ".png", ".webp", ".gif", ".svg", ".avif"]
    
    file_ext = Path(file.filename or "").suffix.lower()
    if file.content_type not in allowed_types and file_ext not in allowed_exts:
        raise HTTPException(
            status_code=400,
            detail="Invalid image format. Supported formats: JPG, PNG, WEBP, GIF, SVG, AVIF."
        )

    # Clean filename and generate unique name
    clean_name = re.sub(r"[^a-zA-Z0-9_\-\.]", "_", file.filename or "cover")
    unique_filename = f"{uuid.uuid4().hex[:12]}_{clean_name}"
    save_path = UPLOAD_DIR / unique_filename

    try:
        with open(save_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to save image file: {str(e)}")

    thumbnail_url = f"/api/uploads/{unique_filename}"
    wf.thumbnail = thumbnail_url
    wf.updated_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(wf)

    return {
        "message": "Thumbnail uploaded successfully",
        "thumbnail": thumbnail_url,
        "workflow": wf.to_dict(access_level="owner"),
    }


# ─────────────────────────────────────────────
#  DELETE /api/workflows/{remote_id}/thumbnail
# ─────────────────────────────────────────────
@router.delete("/{remote_id}/thumbnail")
async def delete_thumbnail(
    remote_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    wf = await _get_owned_workflow(remote_id, current_user.id, db)
    wf.thumbnail = None
    wf.updated_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(wf)

    return {
        "message": "Thumbnail removed successfully",
        "thumbnail": None,
        "workflow": wf.to_dict(access_level="owner"),
    }


# ─────────────────────────────────────────────
#  GET /api/workflows/{remote_id}/shares
# ─────────────────────────────────────────────
@router.get("/{remote_id}/shares")
async def get_shares(
    remote_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    wf = await _get_owned_workflow(remote_id, current_user.id, db)

    result = await db.execute(
        select(WorkflowShare, User)
        .join(User, WorkflowShare.shared_with_user_id == User.id)
        .where(WorkflowShare.workflow_meta_id == wf.id)
    )
    rows = result.all()

    return [
        {
            "id": share.id,
            "user_id": user.id,
            "user_email": user.email,
            "user_name": user.name,
            "user_avatar": user.avatar_url,
            "access_level": share.access_level.value
            if isinstance(share.access_level, AccessLevelEnum)
            else share.access_level,
            "created_at": share.created_at.isoformat() if share.created_at else None,
        }
        for share, user in rows
    ]


# ─────────────────────────────────────────────
#  POST /api/workflows/{remote_id}/share
# ─────────────────────────────────────────────
@router.post("/{remote_id}/share")
async def share_workflow(
    remote_id: str,
    payload: ShareRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    wf = await _get_owned_workflow(remote_id, current_user.id, db)

    # Find the user to share with
    target_result = await db.execute(select(User).where(User.email == payload.email))
    target_user = target_result.scalar_one_or_none()

    if not target_user:
        raise HTTPException(status_code=404, detail="User with this email not found")

    if target_user.id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot share with yourself")

    if payload.access_level not in ("full_access", "view_only"):
        raise HTTPException(status_code=400, detail="access_level must be 'full_access' or 'view_only'")

    # Check if already shared
    existing_share = await db.execute(
        select(WorkflowShare).where(
            WorkflowShare.workflow_meta_id == wf.id,
            WorkflowShare.shared_with_user_id == target_user.id,
        )
    )
    share = existing_share.scalar_one_or_none()

    if share:
        # Update access level
        share.access_level = (
            AccessLevelEnum.FULL_ACCESS
            if payload.access_level == "full_access"
            else AccessLevelEnum.VIEW_ONLY
        )
    else:
        share = WorkflowShare(
            workflow_meta_id=wf.id,
            shared_with_user_id=target_user.id,
            access_level=AccessLevelEnum.FULL_ACCESS
            if payload.access_level == "full_access"
            else AccessLevelEnum.VIEW_ONLY,
        )
        db.add(share)

    await db.commit()

    return {
        "message": f"Workflow shared with {target_user.email}",
        "access_level": payload.access_level,
    }


# ─────────────────────────────────────────────
#  DELETE /api/workflows/{remote_id}/share/{user_id}
# ─────────────────────────────────────────────
@router.delete("/{remote_id}/share/{user_id}")
async def revoke_share(
    remote_id: str,
    user_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    wf = await _get_owned_workflow(remote_id, current_user.id, db)

    share_result = await db.execute(
        select(WorkflowShare).where(
            WorkflowShare.workflow_meta_id == wf.id,
            WorkflowShare.shared_with_user_id == user_id,
        )
    )
    share = share_result.scalar_one_or_none()

    if not share:
        raise HTTPException(status_code=404, detail="Share not found")

    await db.delete(share)
    await db.commit()

    return {"message": "Access revoked"}


# ─────────────────────────────────────────────
#  POST /api/workflows/{remote_id}/copy
#  Создать копию workflow (публичного, своего или расшаренного)
# ─────────────────────────────────────────────
@router.post("/{remote_id}/copy")
async def copy_workflow(
    remote_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # Verify the source is public, owned, or shared
    src_result = await db.execute(
        select(WorkflowMeta).where(
            or_(
                WorkflowMeta.remote_workflow_id == remote_id,
                WorkflowMeta.id == remote_id,
            )
        )
    )
    src_wf = src_result.scalar_one_or_none()

    actual_remote_id = src_wf.remote_workflow_id if src_wf else remote_id
    src_name = src_wf.name if src_wf else "Workflow"

    if src_wf:
        is_allowed = False
        if src_wf.visibility == VisibilityEnum.PUBLIC:
            is_allowed = True
        elif src_wf.owner_id == current_user.id or current_user.is_superadmin:
            is_allowed = True
        else:
            share_res = await db.execute(
                select(WorkflowShare).where(
                    WorkflowShare.workflow_meta_id == src_wf.id,
                    WorkflowShare.shared_with_user_id == current_user.id,
                )
            )
            if share_res.scalar_one_or_none():
                is_allowed = True

        if not is_allowed:
            raise HTTPException(status_code=403, detail="У вас нет доступа для копирования этого приватного процесса")

    # Fetch complete workflow definition from remote
    src_def = {}
    try:
        src_def = await get_workflow_def_helper(actual_remote_id)
    except Exception as e:
        logger.warning(f"Could not fetch workflow def for {actual_remote_id}: {e}")

    copy_name = f"Копия {src_def.get('name') or src_name or 'процесса'}"
    copy_payload = {
        "workflow_id": None,
        "name": copy_name,
        "edges": src_def.get("edges", []),
        "data": src_def.get("data", {"nodes": []}),
        "source_workflow_id": actual_remote_id,  # hint for muapi to clone
    }

    try:
        result = await create_or_update_workflow(copy_payload)
        new_remote_id = result.get("workflow_id")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to copy workflow: {str(e)}")

    # Register new workflow in local DB
    new_wf = WorkflowMeta(
        remote_workflow_id=new_remote_id,
        owner_id=current_user.id,
        name=copy_name,
        visibility=VisibilityEnum.PRIVATE,
    )
    db.add(new_wf)
    await db.commit()
    await db.refresh(new_wf)

    return {
        "message": "Workflow copied successfully",
        "workflow": new_wf.to_dict(access_level="owner"),
    }


# ─────────────────────────────────────────────
#  Helper
# ─────────────────────────────────────────────
async def _get_owned_workflow(remote_id: str, owner_id: str, db: AsyncSession) -> WorkflowMeta:
    result = await db.execute(
        select(WorkflowMeta).where(
            or_(
                WorkflowMeta.remote_workflow_id == remote_id,
                WorkflowMeta.id == remote_id,
            )
        )
    )
    wf = result.scalar_one_or_none()

    if not wf:
        raise HTTPException(status_code=404, detail="Workflow not found in local database")
    if wf.owner_id != owner_id:
        raise HTTPException(status_code=403, detail="You don't have permission to manage this workflow")

    return wf
