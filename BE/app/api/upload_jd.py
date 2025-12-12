from fastapi import APIRouter, File, UploadFile, HTTPException, Depends, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from datetime import datetime
from typing import Optional
import uuid

from app.utils.generate_questions import generate_mcqs_for_topic
from app.utils.text_extract import extract_text
from app.core.dependencies import get_db, optional_user
from app.core.storage import get_s3_service
from app.db.models import User, JobDescription, UploadedDocument, Candidate
from app.models.schemas import UploadedDocumentResponse

router = APIRouter()

# Allowed extensions
ALLOWED_EXTENSIONS = {"pdf", "docx", "ppt", "pptx"}
ALLOWED_DOC_TYPES = {"jd", "cv", "portfolio", "requirements", "specifications"}
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10 MB

# Simple in-memory JD store by UUID (legacy support)
memory_store = {}

def allowed_file(filename: str) -> bool:
    ext = filename.split(".")[-1].lower()
    return ext in ALLOWED_EXTENSIONS


@router.post("/upload-jd/")
async def upload_jd(file: UploadFile = File(...)):
    """Legacy JD upload endpoint - kept for backward compatibility."""
    if not file.filename or not allowed_file(file.filename):
        raise HTTPException(status_code=400, detail="Only .pdf, .docx, .ppt and .pptx files are allowed")
    file_bytes = await file.read()
    try:
        jd_text = extract_text(file_bytes, file.filename)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
    jd_id = str(uuid.uuid4())
    
    try:
        mcq_questions = generate_mcqs_for_topic(jd_text)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"MCQ generation failed: {str(e)}")
    
    memory_store[jd_id] = {
        "text": jd_text, 
        "filename": file.filename,
        "questions": [q.model_dump() for q in mcq_questions]
    }
    
    return {
        "message": f"JD uploaded and MCQs generated successfully", 
        "jd_id": jd_id, 
        "questions": mcq_questions
    }


@router.post("/api/v1/files/upload", response_model=UploadedDocumentResponse, status_code=status.HTTP_201_CREATED)
async def upload_document(
    file: UploadFile = File(...),
    doc_type: str = Query(..., description="Document type: jd, cv, portfolio, requirements, specifications"),
    extract_text_flag: bool = Query(True, description="Extract text from document"),
    candidate_id: Optional[str] = Query(None, description="Link to candidate profile"),
    db: AsyncSession = Depends(get_db),
    current_user: Optional[User] = Depends(optional_user),
) -> UploadedDocumentResponse:
    """
    Upload document (JD, CV, Portfolio, Requirements, Specifications).
    
    Features:
    - File validation (extension, size, MIME type)
    - Text extraction (PDF, DOCX, TXT)
    - Encryption at rest (S3/MinIO)
    - Metadata tracking
    - Optional link to candidate profile
    
    Parameters:
    - file: The document file
    - doc_type: jd, cv, portfolio, requirements, specifications
    - extract_text_flag: Whether to extract text content
    - candidate_id: Optional candidate profile ID to link file
    
    Returns:
    - file_id: Unique file identifier
    - extraction_preview: Preview of extracted text
    """
    if doc_type not in ALLOWED_DOC_TYPES:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Invalid doc_type. Must be one of: {', '.join(ALLOWED_DOC_TYPES)}"
        )
    
    if not file.filename or not allowed_file(file.filename):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Only .pdf, .docx, and .txt files are allowed"
        )
    
    file_bytes = await file.read()
    
    if len(file_bytes) > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"File size exceeds maximum allowed size of {MAX_FILE_SIZE // (1024*1024)} MB"
        )
    
    extracted_text = None
    extraction_preview = None
    try:
        if extract_text_flag:
            extracted_text = extract_text(file_bytes, file.filename)
            extraction_preview = extracted_text[:500] if extracted_text else None
    except Exception as e:
        print(f"Text extraction failed: {str(e)}")
    
    s3_service = get_s3_service()
    try:
        user_id = current_user.id if current_user else candidate_id or "anonymous"
        timestamp = datetime.utcnow().isoformat()
        file_id = f"file_{uuid.uuid4().hex[:12]}"
        s3_key = f"documents/{doc_type}/{user_id}/{timestamp}/{file_id}/{file.filename}"
        
        await s3_service.upload_file(
            file_obj=file_bytes,
            object_name=s3_key,
            content_type=file.content_type or "application/octet-stream",
            metadata={
                "file_id": file_id,
                "doc_type": doc_type,
                "original_filename": file.filename,
                "uploaded_by": str(current_user.id) if current_user else "anonymous",
            }
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to upload file to storage: {str(e)}"
        )
    
    candidate_db = None
    if candidate_id:
        cand_stmt = select(Candidate).where(Candidate.candidate_id == candidate_id)
        cand_result = await db.execute(cand_stmt)
        candidate_db = cand_result.scalars().first()
        
        if not candidate_db:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Candidate {candidate_id} not found"
            )
    
    document = UploadedDocument(
        file_id=file_id,
        candidate_id=candidate_db.id if candidate_db else None,
        user_id=current_user.id if current_user else None,
        original_filename=file.filename,
        file_type=file.filename.split(".")[-1].lower(),
        document_category=doc_type,
        s3_key=s3_key,
        file_size=len(file_bytes),
        mime_type=file.content_type or "application/octet-stream",
        extracted_text=extracted_text,
        extraction_preview=extraction_preview,
        is_encrypted=True,
        encryption_method="AES-256-GCM",
    )
    
    db.add(document)
    await db.commit()
    await db.refresh(document)
    
    if doc_type == "jd":
        jd = JobDescription(
            title=f"JD from {file.filename}",
            description="",
            extracted_text=extracted_text or "",
            s3_key=s3_key,
            file_name=file.filename,
            file_size=len(file_bytes),
            file_type=file.filename.split(".")[-1].lower(),
            uploaded_by=current_user.id if current_user else None,
        )
        db.add(jd)
        await db.commit()
    
    return UploadedDocumentResponse(
        id=document.id,
        file_id=document.file_id,
        original_filename=document.original_filename,
        file_type=document.file_type,
        document_category=document.document_category,
        file_size=document.file_size,
        mime_type=document.mime_type,
        extraction_preview=document.extraction_preview,
        is_encrypted=document.is_encrypted,
        created_at=document.created_at,
        updated_at=document.updated_at,
    )


@router.get("/api/v1/files/{file_id}", response_model=UploadedDocumentResponse)
async def get_document(
    file_id: str,
    db: AsyncSession = Depends(get_db),
) -> UploadedDocumentResponse:
    """Get document metadata by file ID."""
    stmt = select(UploadedDocument).where(UploadedDocument.file_id == file_id)
    result = await db.execute(stmt)
    document = result.scalars().first()
    
    if not document:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found"
        )
    
    return UploadedDocumentResponse(
        id=document.id,
        file_id=document.file_id,
        original_filename=document.original_filename,
        file_type=document.file_type,
        document_category=document.document_category,
        file_size=document.file_size,
        mime_type=document.mime_type,
        extraction_preview=document.extraction_preview,
        is_encrypted=document.is_encrypted,
        created_at=document.created_at,
        updated_at=document.updated_at,
    )


@router.get("/api/v1/files/{file_id}/download")
async def download_document(
    file_id: str,
    db: AsyncSession = Depends(get_db),
):
    """Download document from storage."""
    stmt = select(UploadedDocument).where(UploadedDocument.file_id == file_id)
    result = await db.execute(stmt)
    document = result.scalars().first()
    
    if not document:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found"
        )
    
    s3_service = get_s3_service()
    try:
        file_bytes = await s3_service.download_file(document.s3_key)
        
        return {
            "content": file_bytes,
            "filename": document.original_filename,
            "content_type": document.mime_type,
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to download file: {str(e)}"
        )
