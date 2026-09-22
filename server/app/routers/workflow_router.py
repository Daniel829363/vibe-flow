import os
import uuid
from pathlib import Path
from fastapi import APIRouter, HTTPException, Request, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_, func, desc
from datetime import datetime, timezone
import logging
from typing import Optional

from app.database import get_db
from app.models.user import User
from app.models.workflow_meta import WorkflowMeta, VisibilityEnum
from app.models.workflow_share import WorkflowShare, AccessLevelEnum, TokenSourceEnum
from app.models.token_transaction import TokenTransaction, TransactionTypeEnum
from app.models.media_file import MediaFile
from app.models.workflow_run_log import WorkflowRunLog, RunTypeEnum
from app.models.workflow_run_log import TokenSourceEnum as LogTokenSourceEnum
from app.auth.security import get_current_user_optional

from app.utils.workflow_helper import (
    create_or_update_workflow, 
    get_node_schemas_helper, 
    get_api_node_schemas_helper,
    get_workflow_def_helper,
    run_workflow_helper,
    get_run_status_helper,
    run_node_helper,
    publish_workflow_helper,
    template_workflow_helper,
    cloudfront_signed_url_helper,
    generate_thumbnail_helper,
    get_workflow_defs_helper,
    delete_workflow_def_by_id,
    update_workflow_name_helper,
    get_workflow_last_run,
    architect_workflow_helper,
    poll_architect_result_helper,
    delete_node_run_by_id_helper,
    update_workflow_category_helper,
    get_workflow_api_inputs_helper,
    execute_workflow_via_api_helper,
    get_workflow_api_outputs_helper,
    calculate_dynamic_cost_helper,
)

logger = logging.getLogger(__name__)
router = APIRouter()


async def _get_workflow_access(workflow_id: str, current_user: Optional[User], db: AsyncSession) -> dict:
    stmt = select(WorkflowMeta).where(
        or_(
            WorkflowMeta.remote_workflow_id == workflow_id,
            WorkflowMeta.id == workflow_id,
        )
    )
    result = await db.execute(stmt)
    wf_meta = result.scalar_one_or_none()

    if not wf_meta:
        return {
            "wf_meta": None,
            "is_owner": True if current_user else False,
            "access_level": "owner" if current_user else "view_only",
            "is_published": False,
            "can_edit": True if current_user else False,
            "can_run": True if current_user else False,
            "share": None,
        }

    is_published = wf_meta.visibility == VisibilityEnum.PUBLIC

    if current_user and (current_user.is_superadmin or wf_meta.owner_id == current_user.id):
        return {
            "wf_meta": wf_meta,
            "is_owner": True,
            "access_level": "owner",
            "is_published": is_published,
            "can_edit": True,
            "can_run": True,
            "share": None,
        }

    share = None
    if current_user:
        share_res = await db.execute(
            select(WorkflowShare).where(
                WorkflowShare.workflow_meta_id == wf_meta.id,
                WorkflowShare.shared_with_user_id == current_user.id,
            )
        )
        share = share_res.scalar_one_or_none()

    if share:
        if str(share.access_level).lower() == "full_access":
            return {
                "wf_meta": wf_meta,
                "is_owner": True,
                "access_level": "full_access",
                "is_published": is_published,
                "can_edit": True,
                "can_run": True,
                "share": share,
            }
        else:
            return {
                "wf_meta": wf_meta,
                "is_owner": False,
                "access_level": "view_only",
                "is_published": is_published,
                "can_edit": False,
                "can_run": False,
                "share": share,
            }

    if is_published:
        return {
            "wf_meta": wf_meta,
            "is_owner": False,
            "access_level": "view_only",
            "is_published": True,
            "can_edit": False,
            "can_run": False,
            "share": None,
        }

    return {
        "wf_meta": wf_meta,
        "is_owner": False,
        "access_level": "forbidden",
        "is_published": False,
        "can_edit": False,
        "can_run": False,
        "share": None,
    }


async def _cleanup_old_run_logs(workflow_id: str, db: AsyncSession):
    """Remove oldest run logs exceeding the configured limit per workflow."""
    limit = int(os.getenv("WORKFLOW_RUN_LOG_LIMIT", "100"))
    if limit <= 0:
        return

    count_res = await db.execute(
        select(func.count()).select_from(WorkflowRunLog).where(
            WorkflowRunLog.workflow_id == workflow_id
        )
    )
    total = count_res.scalar_one()

    if total > limit:
        excess = total - limit
        oldest_res = await db.execute(
            select(WorkflowRunLog.id)
            .where(WorkflowRunLog.workflow_id == workflow_id)
            .order_by(WorkflowRunLog.created_at.asc())
            .limit(excess)
        )
        old_ids = [row[0] for row in oldest_res.all()]
        if old_ids:
            from sqlalchemy import delete as sa_delete
            await db.execute(
                sa_delete(WorkflowRunLog).where(WorkflowRunLog.id.in_(old_ids))
            )


@router.post("/create")
async def create_workflow(
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional),
):
    try:
        payload = await request.json()
        req_wf_id = payload.get("workflow_id")
        if req_wf_id:
            access = await _get_workflow_access(req_wf_id, current_user, db)
            if not access["can_edit"]:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="У вас нет прав на сохранение этого процесса (режим только для чтения). Создайте копию.",
                )

        result = await create_or_update_workflow(payload)
        remote_id = result.get("workflow_id")
        name = payload.get("name")

        if current_user and remote_id:
            existing = await db.execute(
                select(WorkflowMeta).where(WorkflowMeta.remote_workflow_id == remote_id)
            )
            wf_meta = existing.scalar_one_or_none()
            if wf_meta:
                if name:
                    wf_meta.name = name
                wf_meta.updated_at = datetime.now(timezone.utc)
            else:
                wf_meta = WorkflowMeta(
                    remote_workflow_id=remote_id,
                    owner_id=current_user.id,
                    name=name or "Untitled Workflow",
                    visibility=VisibilityEnum.PRIVATE,
                )
                db.add(wf_meta)

            try:
                await _auto_register_input_media(payload, current_user.id, remote_id, name or (wf_meta.name if wf_meta else None), db)
            except Exception as reg_err:
                logger.warning(f"Could not auto-record input media from workflow payload: {reg_err}")

            await db.commit()

        return result
    except HTTPException as e:
        raise e
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/get-workflow-defs")
async def get_workflow_defs():
    try:
        return await get_workflow_defs_helper()
    except Exception as e:
        if isinstance(e, HTTPException): raise e
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/get-workflow-def/{workflow_id}")
async def get_workflow_def(
    workflow_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional),
):
    access = await _get_workflow_access(workflow_id, current_user, db)
    if access["access_level"] == "forbidden":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Доступ к этому процессу ограничен (приватный процесс)",
        )

    try:
        wf_data = await get_workflow_def_helper(workflow_id)
        if isinstance(wf_data, dict):
            wf_data["is_owner"] = access["is_owner"]
            wf_data["access_level"] = access["access_level"]
            wf_data["is_published"] = access["is_published"]
            if access["wf_meta"] and access["wf_meta"].name:
                wf_data["name"] = access["wf_meta"].name
        return wf_data
    except HTTPException as e:
        if e.status_code in (400, 404) and access["wf_meta"]:
            return {
                "workflow_id": access["wf_meta"].remote_workflow_id,
                "name": access["wf_meta"].name or "Untitled Workflow",
                "edges": [],
                "data": {"nodes": []},
                "is_owner": access["is_owner"],
                "access_level": access["access_level"],
                "is_published": access["is_published"],
                "category": "General",
            }
        raise e
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/{workflow_id}/node-schemas")
async def get_node_schemas(workflow_id: str):
    try:
        return await get_node_schemas_helper(workflow_id)
    except HTTPException as e:
        if e.status_code in (400, 404):
            try:
                return await get_node_schemas_helper("new")
            except Exception:
                pass
        raise e
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.delete("/delete-workflow-def/{workflow_id}")
async def delete_workflow_def(
    workflow_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional),
):
    if not current_user:
        raise HTTPException(status_code=401, detail="Требуется авторизация")

    stmt = select(WorkflowMeta).where(
        or_(
            WorkflowMeta.remote_workflow_id == workflow_id,
            WorkflowMeta.id == workflow_id,
        )
    )
    result = await db.execute(stmt)
    wf_meta = result.scalar_one_or_none()
    if wf_meta and not current_user.is_superadmin and wf_meta.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="У вас нет прав на удаление этого процесса")

    # 1. Try remote deletion
    try:
        await delete_workflow_def_by_id(workflow_id)
    except Exception as e:
        logger.warning(f"Remote delete for {workflow_id} failed or already deleted: {e}")

    # 2. Delete from local DB
    try:
        if wf_meta:
            await db.delete(wf_meta)
            await db.commit()
    except Exception as e:
        logger.error(f"Error deleting workflow from local DB: {e}")

    return {"message": "Workflow deleted successfully", "workflow_id": workflow_id}

@router.post("/update-name/{workflow_id}")
async def update_workflow_name(
    workflow_id: str,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional),
):
    access = await _get_workflow_access(workflow_id, current_user, db)
    if not access["can_edit"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="У вас нет прав на переименование этого процесса",
        )

    try:
        payload = await request.json()
        name = payload.get("name")

        # 1. Update in local DB
        stmt = select(WorkflowMeta).where(
            or_(
                WorkflowMeta.remote_workflow_id == workflow_id,
                WorkflowMeta.id == workflow_id,
            )
        )
        result = await db.execute(stmt)
        wf_meta = result.scalar_one_or_none()
        if wf_meta:
            if name:
                wf_meta.name = name
            wf_meta.updated_at = datetime.now(timezone.utc)
            await db.commit()

        # 2. Try remote update
        try:
            return await update_workflow_name_helper(workflow_id, payload)
        except HTTPException as e:
            logger.warning(f"Remote update-name for {workflow_id} returned {e.status_code}: {e.detail}")
            if wf_meta:
                return {"message": "Workflow name updated successfully", "name": name, "workflow_id": workflow_id}
            raise e
    except HTTPException as e:
        raise e
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/{workflow_id}/api-node-schemas")
async def get_api_node_schemas(workflow_id: str):
    try:
        return await get_api_node_schemas_helper(workflow_id)
    except Exception as e:
        if isinstance(e, HTTPException): raise e
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/{workflow_id}/run")
async def run_workflow(
    workflow_id: str,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional),
):
    access = await _get_workflow_access(workflow_id, current_user, db)
    if not access["can_run"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Запуск процесса доступен только владельцу или пользователям с полным доступом. Вы можете создать копию процесса для запуска.",
        )
    try:
        payload = await request.json()
        rate = float(os.getenv("TOKEN_RATE_PER_DOLLAR", "100"))
        cost_usd = float(payload.get("cost") or 0.0)
        required_tokens = round(cost_usd * rate, 4)

        # Determine token source and charged user
        share = access.get("share")
        wf_meta = access.get("wf_meta")
        is_shared_run = access["access_level"] == "full_access" and share is not None
        token_source_value = "runner"
        charged_user_id = current_user.id if current_user else None

        if is_shared_run and share:
            ts = share.token_source
            token_source_value = ts.value if isinstance(ts, TokenSourceEnum) else str(ts or "runner").lower()

        # Token balance check
        db_user = None
        db_charged_user = None
        if current_user:
            user_res = await db.execute(select(User).where(User.id == current_user.id))
            db_user = user_res.scalar_one_or_none()

            if is_shared_run and token_source_value == "owner" and wf_meta:
                owner_res = await db.execute(select(User).where(User.id == wf_meta.owner_id))
                db_charged_user = owner_res.scalar_one_or_none()
                charged_user_id = wf_meta.owner_id
            else:
                db_charged_user = db_user
                charged_user_id = current_user.id

            if db_charged_user and cost_usd > 0:
                if db_charged_user.token_balance < required_tokens or db_charged_user.token_balance <= 0:
                    who = "владельца процесса" if token_source_value == "owner" else "вашем"
                    raise HTTPException(
                        status_code=status.HTTP_402_PAYMENT_REQUIRED,
                        detail=f"Недостаточно токенов на балансе {who} для запуска процесса. Требуется: {required_tokens:g} токенов (${cost_usd:.3f}), баланс: {db_charged_user.token_balance:g} токенов.",
                    )

        result = await run_workflow_helper(workflow_id, payload)

        # Collect model chain from payload nodes
        model_chain = []
        nodes_data = payload.get("nodes") or (payload.get("data") or {}).get("nodes") or []
        if isinstance(nodes_data, list):
            for node in nodes_data:
                if isinstance(node, dict):
                    node_data = node.get("data") or {}
                    model_name = node_data.get("model") or node_data.get("task_name") or node.get("type")
                    if model_name:
                        model_chain.append({
                            "node_id": node.get("id"),
                            "model": str(model_name),
                            "label": (node_data.get("label") or node.get("id") or ""),
                        })

        # Deduct tokens if run was initiated successfully
        if db_charged_user and cost_usd > 0:
            db_charged_user.token_balance = max(0.0, db_charged_user.token_balance - required_tokens)

            wf_name = wf_meta.name if wf_meta else None

            description_prefix = ""
            if is_shared_run and token_source_value == "owner":
                runner_name = db_user.name or db_user.email if db_user else "unknown"
                description_prefix = f"[Shared запуск от {runner_name}] "

            tx = TokenTransaction(
                user_id=charged_user_id,
                amount_tokens=-required_tokens,
                amount_usd=-cost_usd,
                type=TransactionTypeEnum.USAGE,
                description=f"{description_prefix}Запуск процесса: {wf_name or workflow_id}",
                workflow_id=workflow_id,
                workflow_name=wf_name,
            )
            db.add(tx)

        # Create run log entry
        if current_user:
            wf_name = wf_meta.name if wf_meta else None
            owner_id = wf_meta.owner_id if wf_meta else current_user.id
            run_log = WorkflowRunLog(
                workflow_id=workflow_id,
                workflow_name=wf_name,
                run_id=result.get("run_id") if isinstance(result, dict) else None,
                run_type="workflow",
                runner_id=current_user.id,
                owner_id=owner_id,
                is_shared_run=is_shared_run,
                token_source=token_source_value,
                charged_user_id=charged_user_id or current_user.id,
                model_chain=json.dumps(model_chain, ensure_ascii=False) if model_chain else None,
                tokens_total=required_tokens,
                cost_usd_total=cost_usd,
            )
            db.add(run_log)

            await db.commit()

            # Cleanup old logs
            try:
                await _cleanup_old_run_logs(workflow_id, db)
                await db.commit()
            except Exception as cleanup_err:
                logger.warning(f"Run log cleanup note: {cleanup_err}")

        return result
    except HTTPException as e:
        raise e
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

IMAGE_EXTS = {".jpg", ".jpeg", ".png", ".webp", ".gif", ".svg", ".avif", ".bmp"}
VIDEO_EXTS = {".mp4", ".webm", ".mov", ".avi", ".mkv", ".flv", ".wmv", ".m4v"}
AUDIO_EXTS = {".mp3", ".wav", ".ogg", ".m4a", ".aac", ".flac", ".opus"}


def _detect_file_type(fname_or_url: str) -> str:
    ext = Path(fname_or_url.split("?")[0]).suffix.lower()
    if ext in IMAGE_EXTS: return "image"
    if ext in VIDEO_EXTS: return "video"
    if ext in AUDIO_EXTS: return "audio"
    return "other"


async def _auto_register_input_media(payload: dict, user_id: str, remote_id: str, wf_name: Optional[str], db: AsyncSession):
    """Automatically record input/uploaded media files found in workflow nodes."""
    nodes = payload.get("nodes") or (payload.get("data") or {}).get("nodes") or []
    if not isinstance(nodes, list):
        return

    extracted_urls = []
    for node in nodes:
        if not isinstance(node, dict):
            continue
        data = node.get("data") if isinstance(node.get("data"), dict) else {}
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
                for _, val in container.items():
                    if isinstance(val, str) and val.startswith(("http://", "https://", "/api/uploads/")) and "{{" not in val:
                        extracted_urls.append(val)
                    elif isinstance(val, list):
                        for item in val:
                            if isinstance(item, str) and item.startswith(("http://", "https://", "/api/uploads/")) and "{{" not in item:
                                extracted_urls.append(item)
            elif isinstance(container, list):
                for item in container:
                    if isinstance(item, str) and item.startswith(("http://", "https://", "/api/uploads/")) and "{{" not in item:
                        extracted_urls.append(item)

    added = False
    for u in set(extracted_urls):
        exist_stmt = select(MediaFile.id).where(
            MediaFile.user_id == user_id, MediaFile.url == u
        )
        exist_res = await db.execute(exist_stmt)
        if not exist_res.scalar_one_or_none():
            clean_url = u.split("?")[0]
            fname = os.path.basename(clean_url) or f"upload_{uuid.uuid4().hex[:8]}"
            db.add(
                MediaFile(
                    user_id=user_id,
                    filename=fname,
                    url=u,
                    file_type=_detect_file_type(fname),
                    source="upload",
                    workflow_id=str(remote_id) if remote_id else None,
                    workflow_name=wf_name,
                )
            )
            added = True
    if added:
        await db.commit()


async def _auto_register_run_media(data: dict, user_id: str, db: AsyncSession):
    """Automatically record generated media outputs into media_files."""
    nodes = data.get("nodes")
    if not isinstance(nodes, dict):
        return

    wf_id = data.get("workflow_id") or data.get("id")
    wf_name = None
    if wf_id:
        try:
            wf_res = await db.execute(
                select(WorkflowMeta.name).where(
                    or_(
                        WorkflowMeta.remote_workflow_id == str(wf_id),
                        WorkflowMeta.id == str(wf_id),
                    )
                )
            )
            wf_name = wf_res.scalar_one_or_none()
        except Exception as e:
            logger.debug(f"Could not resolve workflow name: {e}")

    added = False
    for _, runs in nodes.items():
        if not isinstance(runs, list):
            continue
        for run in runs:
            if not isinstance(run, dict):
                continue
            if run.get("status") not in ("succeeded", "completed"):
                continue
            res = run.get("result") or {}
            outputs = res.get("outputs") or []
            for out in outputs:
                val = out.get("value") if isinstance(out, dict) else None
                urls = []
                if isinstance(val, str) and val.startswith(("http://", "https://", "/api/uploads/")):
                    urls.append(val)
                elif isinstance(val, list):
                    for item in val:
                        if isinstance(item, str) and item.startswith(("http://", "https://", "/api/uploads/")):
                            urls.append(item)

                for u in urls:
                    exist_stmt = select(MediaFile.id).where(
                        MediaFile.user_id == user_id, MediaFile.url == u
                    )
                    exist_res = await db.execute(exist_stmt)
                    if not exist_res.scalar_one_or_none():
                        clean_url = u.split("?")[0]
                        fname = os.path.basename(clean_url) or f"output_{uuid.uuid4().hex[:8]}"
                        db.add(
                            MediaFile(
                                user_id=user_id,
                                filename=fname,
                                url=u,
                                file_type=_type(fname),
                                source="generation",
                                workflow_id=str(wf_id) if wf_id else None,
                                workflow_name=wf_name,
                            )
                        )
                        added = True
    if added:
        await db.commit()


@router.get("/run/{run_id}/status")
async def get_run_status(
    run_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional),
):
    try:
        data = await get_run_status_helper(run_id)
        if current_user and isinstance(data, dict):
            try:
                await _auto_register_run_media(data, current_user.id, db)
            except Exception as reg_err:
                logger.debug(f"Media auto-reg note: {reg_err}")
        return data
    except Exception as e:
        if isinstance(e, HTTPException): raise e
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/{workflow_id}/node/{node_id}/run")
async def run_node(
    workflow_id: str,
    node_id: str,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional),
):
    access = await _get_workflow_access(workflow_id, current_user, db)
    if not access["can_run"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Запуск ноды доступен только владельцу или пользователям с полным доступом. Вы можете создать копию процесса.",
        )

    try:
        payload = await request.json()
        rate = float(os.getenv("TOKEN_RATE_PER_DOLLAR", "100"))
        cost_usd = float(payload.get("cost") or 0.0)

        # Re-verify dynamic cost with MuAPI based on actual model and params
        model = payload.get("model")
        params = payload.get("params") or {}
        API_MODEL_IDS = {"wavespeed", "straico", "runware", "genvr"}
        if model and not str(model).startswith("api-") and "passthrough" not in str(model) and str(model) not in API_MODEL_IDS:
            try:
                dynamic_res = await calculate_dynamic_cost_helper({
                    "task_name": model,
                    "payload": params
                })
                if dynamic_res and "cost" in dynamic_res and dynamic_res["cost"] is not None:
                    calculated_cost = float(dynamic_res["cost"])
                    if calculated_cost > 0 or cost_usd == 0:
                        cost_usd = calculated_cost
            except Exception as cost_err:
                logger.warning(f"Could not re-verify dynamic cost for {model}: {cost_err}")

        required_tokens = round(cost_usd * rate, 4)

        # Determine token source and charged user
        share = access.get("share")
        wf_meta = access.get("wf_meta")
        is_shared_run = access["access_level"] == "full_access" and share is not None
        token_source_value = "runner"
        charged_user_id = current_user.id if current_user else None

        if is_shared_run and share:
            ts = share.token_source
            token_source_value = ts.value if isinstance(ts, TokenSourceEnum) else str(ts or "runner").lower()

        # Token balance check
        db_user = None
        db_charged_user = None
        if current_user:
            user_res = await db.execute(select(User).where(User.id == current_user.id))
            db_user = user_res.scalar_one_or_none()

            if is_shared_run and token_source_value == "owner" and wf_meta:
                owner_res = await db.execute(select(User).where(User.id == wf_meta.owner_id))
                db_charged_user = owner_res.scalar_one_or_none()
                charged_user_id = wf_meta.owner_id
            else:
                db_charged_user = db_user
                charged_user_id = current_user.id

            if db_charged_user and cost_usd > 0:
                if db_charged_user.token_balance < required_tokens or db_charged_user.token_balance <= 0:
                    who = "владельца процесса" if token_source_value == "owner" else "вашем"
                    raise HTTPException(
                        status_code=status.HTTP_402_PAYMENT_REQUIRED,
                        detail=f"Недостаточно токенов на балансе {who} для запуска ноды. Требуется: {required_tokens:g} токенов (${cost_usd:.3f}), баланс: {db_charged_user.token_balance:g} токенов.",
                    )

        result = await run_node_helper(workflow_id, node_id, payload)

        # Deduct tokens if run was initiated successfully
        if db_charged_user and cost_usd > 0:
            db_charged_user.token_balance = max(0.0, db_charged_user.token_balance - required_tokens)

            wf_name = wf_meta.name if wf_meta else None
            node_label = payload.get("node_id") or payload.get("model") or "Нода"

            description_prefix = ""
            if is_shared_run and token_source_value == "owner":
                runner_name = db_user.name or db_user.email if db_user else "unknown"
                description_prefix = f"[Shared запуск от {runner_name}] "

            tx = TokenTransaction(
                user_id=charged_user_id,
                amount_tokens=-required_tokens,
                amount_usd=-cost_usd,
                type=TransactionTypeEnum.USAGE,
                description=f"{description_prefix}Генерация ({node_label}) в процессе {wf_name or workflow_id}",
                workflow_id=workflow_id,
                workflow_name=wf_name,
            )
            db.add(tx)

        # Create run log entry
        if current_user:
            wf_name = wf_meta.name if wf_meta else None
            owner_id = wf_meta.owner_id if wf_meta else current_user.id
            node_label = payload.get("node_id") or payload.get("model") or "Нода"

            model_chain = []
            if model:
                model_chain.append({
                    "node_id": node_id,
                    "model": str(model),
                    "label": str(node_label),
                    "cost_usd": cost_usd,
                    "tokens": required_tokens,
                })

            run_log = WorkflowRunLog(
                workflow_id=workflow_id,
                workflow_name=wf_name,
                run_id=result.get("run_id") if isinstance(result, dict) else None,
                run_type="node",
                runner_id=current_user.id,
                owner_id=owner_id,
                is_shared_run=is_shared_run,
                token_source=token_source_value,
                charged_user_id=charged_user_id or current_user.id,
                model_chain=json.dumps(model_chain, ensure_ascii=False) if model_chain else None,
                tokens_total=required_tokens,
                cost_usd_total=cost_usd,
                node_id=node_id,
                node_label=str(node_label),
            )
            db.add(run_log)

            await db.commit()

            # Cleanup old logs
            try:
                await _cleanup_old_run_logs(workflow_id, db)
                await db.commit()
            except Exception as cleanup_err:
                logger.warning(f"Run log cleanup note: {cleanup_err}")

        return result
    except HTTPException as e:
        raise e
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/workflow/{workflow_id}/publish")
async def publish_workflow(workflow_id: str, request: Request):
    try:
        payload = await request.json()
        return await publish_workflow_helper(workflow_id, payload)
    except Exception as e:
        if isinstance(e, HTTPException): raise e
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/workflow/{workflow_id}/template")
async def template_workflow(workflow_id: str, request: Request):
    try:
        payload = await request.json()
        return await template_workflow_helper(workflow_id, payload)
    except Exception as e:
        if isinstance(e, HTTPException): raise e
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/cloudfront-signed-url")
async def cloudfront_signed_url(request: Request):
    try:
        payload = await request.json()
        return await cloudfront_signed_url_helper(payload)
    except Exception as e:
        if isinstance(e, HTTPException): raise e
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/{workflow_id}/thumbnail")
async def generate_thumbnail(
    workflow_id: str,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional),
):
    access = await _get_workflow_access(workflow_id, current_user, db)
    if not access["can_edit"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="У вас нет прав на изменение обложки этого процесса",
        )

    try:
        payload = await request.json()
        thumbnail = payload.get("thumbnail")

        # 1. Update in local DB if found
        if thumbnail:
            stmt = select(WorkflowMeta).where(
                or_(
                    WorkflowMeta.remote_workflow_id == workflow_id,
                    WorkflowMeta.id == workflow_id,
                )
            )
            result = await db.execute(stmt)
            wf_meta = result.scalar_one_or_none()
            if wf_meta:
                wf_meta.thumbnail = thumbnail
                wf_meta.updated_at = datetime.now(timezone.utc)
                await db.commit()

        # 2. Try remote update
        try:
            return await generate_thumbnail_helper(workflow_id, payload)
        except Exception as remote_err:
            logger.warning(f"Remote thumbnail update for {workflow_id} failed: {remote_err}")
            return {"success": True, "message": "Thumbnail updated locally", "thumbnail": thumbnail}
    except Exception as e:
        if isinstance(e, HTTPException): raise e
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/get-workflow-last-run/{workflow_id}")
async def get_workflow_last_run_endpoint(
    workflow_id: str,
):
    try:
        return await get_workflow_last_run(workflow_id)
    except Exception as e:
        if isinstance(e, HTTPException): raise e
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/architect")
async def architect_workflow_endpoint(
    request: Request,
):
    try:
        payload = await request.json()
        return await architect_workflow_helper(payload)
    except Exception as e:
        if isinstance(e, HTTPException): raise e
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/poll-architect/{id}/result")
async def poll_architect_result(id: str):
    try:
        return await poll_architect_result_helper(id)
    except Exception as e:
        if isinstance(e, HTTPException): raise e
        raise HTTPException(status_code=400, detail=str(e))

@router.delete("/node-run/{node_run_id}")
async def delete_node_run(node_run_id: str):
    try:
        return await delete_node_run_by_id_helper(node_run_id)
    except Exception as e:
        if isinstance(e, HTTPException): raise e
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/update-category/{workflow_id}")
async def update_workflow_category(workflow_id: str, request: Request):
    try:
        payload = await request.json()
        return await update_workflow_category_helper(workflow_id, payload)
    except Exception as e:
        if isinstance(e, HTTPException): raise e
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/{workflow_id}/api-inputs")
async def get_workflow_api_inputs(workflow_id: str):
    try:
        return await get_workflow_api_inputs_helper(workflow_id)
    except Exception as e:
        if isinstance(e, HTTPException): raise e
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/{workflow_id}/api-execute")
async def execute_workflow_via_api(workflow_id: str, request: Request):
    try:
        payload = await request.json()
        return await execute_workflow_via_api_helper(workflow_id, payload)
    except Exception as e:
        if isinstance(e, HTTPException): raise e
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/run/{run_id}/api-outputs")
async def get_workflow_api_outputs(run_id: str):
    try:
        return await get_workflow_api_outputs_helper(run_id)
    except Exception as e:
        if isinstance(e, HTTPException): raise e
        raise HTTPException(status_code=400, detail=str(e))