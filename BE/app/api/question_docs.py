from fastapi import APIRouter, UploadFile, File, HTTPException, Depends, status, Query
from typing import Optional
import uuid
import asyncio

from app.core.storage import get_s3_service
from app.utils.text_extract import extract_text
from app.core.dependencies import get_current_user
from app.core.security import is_admin_user
from app.services.doc_ingest import index_document

router = APIRouter(prefix="/admin/question-docs", tags=["admin"])


@router.get("/status/{task_id}")
async def get_ingestion_status(task_id: str, current_user=Depends(get_current_user)):
    """Admin-only: get ingestion task status by Celery task id or related doc id (exact match for task_id)."""
    if not current_user or not is_admin_user(current_user.email):
        raise HTTPException(status_code=403, detail="Admin access required")

    from app.db.session import async_session_maker
    from app.db.models import CeleryTask
    from sqlalchemy import select

    async with async_session_maker() as session:
        stmt = select(CeleryTask).where(CeleryTask.task_id == task_id)
        result = await session.execute(stmt)
        ct = result.scalars().first()

        # fallback: lookup by related_id (doc_id)
        if not ct:
            stmt2 = select(CeleryTask).where(CeleryTask.related_id == task_id)
            result2 = await session.execute(stmt2)
            ct = result2.scalars().first()

        if not ct:
            raise HTTPException(status_code=404, detail="Task not found")

        return {
            "task_id": ct.task_id,
            "task_name": ct.task_name,
            "status": ct.status,
            "result": ct.result,
            "error": ct.error,
            "related_type": ct.related_type,
            "related_id": ct.related_id,
            "created_at": ct.created_at,
            "updated_at": ct.updated_at,
        }


@router.post("/upload", status_code=status.HTTP_202_ACCEPTED)
async def upload_question_doc(
    file: UploadFile = File(...),
    assessment_id: Optional[str] = Query(None, description="Optional assessment_id this doc is associated with"),
    current_user=Depends(get_current_user),
):
    """Admin-only: upload a question document and schedule RAG ingestion.

    Notes:
    - This endpoint intentionally does NOT store the document in the relational DB.
    - The file is saved to S3 and a background ingestion task is scheduled to index the extracted text.
    """
    if not current_user or not is_admin_user(current_user.email):
        raise HTTPException(status_code=403, detail="Admin access required")

    file_bytes = await file.read()
    try:
        extracted_text = extract_text(file_bytes, file.filename)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Text extraction failed: {str(e)}")

    # Upload file to S3 for archival
    s3 = get_s3_service()
    doc_id = f"doc_{uuid.uuid4().hex[:12]}"
    s3_key = f"question_docs/{current_user.id}/{doc_id}/{file.filename}"
    # upload can be blocking (boto3 or local file IO) - run in threadpool
    try:
        await asyncio.to_thread(
            s3.upload_file,
            file_bytes,
            s3_key,
            file.content_type or "application/octet-stream",
        )
    except TypeError:
        # Fallback for implementations expecting keyword args
        await asyncio.to_thread(
            lambda: s3.upload_file(file_obj=file_bytes, object_name=s3_key, content_type=file.content_type or "application/octet-stream")
        )

    # Schedule background ingestion (non-blocking via Celery task)
    metadata = {"filename": file.filename, "s3_key": s3_key, "assessment_id": assessment_id}
    try:
        from app.core.tasks.question_generation import index_question_document_task
        # schedule task and get AsyncResult
        async_result = index_question_document_task.apply_async(args=(doc_id, extracted_text, metadata or {}))
        task_id = async_result.id

        # record a CeleryTask entry so we can query status from the API
        from app.db.session import get_db_sync_engine
        from sqlalchemy.orm import sessionmaker
        from app.db.models import CeleryTask

        engine = get_db_sync_engine()
        Session = sessionmaker(bind=engine)
        with Session() as session:
            ct = CeleryTask(
                task_id=task_id,
                task_name="index_question_document",
                status="PENDING",
                related_type="question_doc",
                related_id=doc_id,
                user_id=current_user.id if getattr(current_user, 'id', None) else None,
            )
            session.add(ct)
            session.commit()

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to schedule ingestion task: {e}")

    return {"message": "Uploaded and scheduled for ingestion", "doc_id": doc_id, "s3_key": s3_key, "task_id": task_id}
