"""Admin endpoints for bulk skill extraction from documents."""
from fastapi import APIRouter, File, UploadFile, HTTPException, Depends, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from datetime import datetime
from typing import List, Dict, Optional
import uuid
import re

from app.core.dependencies import get_db, get_current_user
from app.core.storage import get_s3_service
from app.utils.text_extract import extract_text
from app.db.models import User, UploadedDocument
from app.models.schemas import (
    AdminBulkSkillExtractionResponse,
    DocumentSkillExtractionResponse,
    ExtractedSkill,
)

router = APIRouter(prefix="/api/v1/admin", tags=["admin-skill-extraction"])

# Allowed extensions
ALLOWED_EXTENSIONS = {"pdf", "docx", "txt"}
ALLOWED_DOC_TYPES = {"jd", "cv", "portfolio", "requirements", "specifications"}
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10 MB


def allowed_file(filename: str) -> bool:
    """Check if file has allowed extension."""
    ext = filename.split(".")[-1].lower()
    return ext in ALLOWED_EXTENSIONS


def extract_skills_from_text_advanced(text: str, filename: str = "") -> Dict[str, tuple]:
    """
    Extract skills from text with proficiency levels and categories.
    
    Returns:
        Dict[skill_name] = (proficiency_level, category, confidence)
    """
    if not text:
        return {}
    
    text_lower = text.lower()
    extracted_skills = {}
    
    # Comprehensive technical skills dictionary
    technical_skills = {
        # Programming Languages
        "python": ("advanced", "technical", 0.95),
        "javascript": ("advanced", "technical", 0.95),
        "typescript": ("advanced", "technical", 0.95),
        "java": ("advanced", "technical", 0.95),
        "c++": ("advanced", "technical", 0.95),
        "c#": ("advanced", "technical", 0.95),
        "go": ("advanced", "technical", 0.92),
        "rust": ("advanced", "technical", 0.92),
        "kotlin": ("advanced", "technical", 0.90),
        "swift": ("advanced", "technical", 0.90),
        
        # Frontend Frameworks
        "react": ("intermediate", "technical", 0.95),
        "vue": ("intermediate", "technical", 0.95),
        "angular": ("intermediate", "technical", 0.93),
        "next.js": ("intermediate", "technical", 0.92),
        "svelte": ("intermediate", "technical", 0.90),
        "ember": ("intermediate", "technical", 0.85),
        
        # Backend Frameworks
        "django": ("intermediate", "technical", 0.93),
        "fastapi": ("intermediate", "technical", 0.93),
        "flask": ("intermediate", "technical", 0.93),
        "spring": ("intermediate", "technical", 0.93),
        "express": ("intermediate", "technical", 0.93),
        "nest.js": ("intermediate", "technical", 0.90),
        "rails": ("intermediate", "technical", 0.90),
        "laravel": ("intermediate", "technical", 0.90),
        
        # Databases
        "sql": ("advanced", "technical", 0.95),
        "postgresql": ("advanced", "technical", 0.95),
        "mysql": ("advanced", "technical", 0.95),
        "mongodb": ("intermediate", "technical", 0.93),
        "redis": ("intermediate", "technical", 0.93),
        "cassandra": ("intermediate", "technical", 0.90),
        "dynamodb": ("intermediate", "technical", 0.90),
        "elasticsearch": ("intermediate", "technical", 0.88),
        
        # Cloud & DevOps
        "aws": ("intermediate", "technical", 0.95),
        "gcp": ("intermediate", "technical", 0.95),
        "azure": ("intermediate", "technical", 0.95),
        "docker": ("intermediate", "technical", 0.95),
        "kubernetes": ("intermediate", "technical", 0.93),
        "jenkins": ("intermediate", "technical", 0.90),
        "gitlab": ("intermediate", "technical", 0.90),
        "github": ("intermediate", "technical", 0.90),
        "terraform": ("intermediate", "technical", 0.88),
        
        # Message Queues & Event Streaming
        "kafka": ("intermediate", "technical", 0.90),
        "rabbitmq": ("intermediate", "technical", 0.90),
        "celery": ("intermediate", "technical", 0.85),
        "redis queue": ("intermediate", "technical", 0.85),
        
        # APIs & Web Services
        "rest api": ("advanced", "technical", 0.95),
        "graphql": ("intermediate", "technical", 0.93),
        "grpc": ("intermediate", "technical", 0.85),
        "soap": ("beginner", "technical", 0.80),
        
        # Microservices & Architecture
        "microservices": ("intermediate", "technical", 0.90),
        "system design": ("intermediate", "technical", 0.88),
        "distributed systems": ("intermediate", "technical", 0.85),
        "event-driven": ("intermediate", "technical", 0.85),
        
        # Testing
        "pytest": ("intermediate", "technical", 0.90),
        "jest": ("intermediate", "technical", 0.90),
        "mocha": ("intermediate", "technical", 0.88),
        "junit": ("intermediate", "technical", 0.88),
        "selenium": ("intermediate", "technical", 0.85),
        
        # DevOps Tools
        "git": ("advanced", "technical", 0.95),
        "ci/cd": ("intermediate", "technical", 0.92),
        "monitoring": ("intermediate", "technical", 0.85),
        "logging": ("intermediate", "technical", 0.85),
        
        # Utilities
        "linux": ("advanced", "technical", 0.90),
        "bash": ("advanced", "technical", 0.90),
        "shell": ("advanced", "technical", 0.90),
        "powershell": ("intermediate", "technical", 0.85),
        "nginx": ("intermediate", "technical", 0.85),
        "apache": ("intermediate", "technical", 0.85),
    }
    
    # Soft skills
    soft_skills = {
        "communication": ("intermediate", "soft", 0.90),
        "leadership": ("intermediate", "soft", 0.90),
        "teamwork": ("advanced", "soft", 0.90),
        "problem solving": ("advanced", "soft", 0.90),
        "analytical": ("advanced", "soft", 0.90),
        "project management": ("intermediate", "soft", 0.88),
        "critical thinking": ("advanced", "soft", 0.85),
        "creativity": ("intermediate", "soft", 0.80),
        "collaboration": ("advanced", "soft", 0.85),
        "adaptability": ("intermediate", "soft", 0.80),
    }
    
    # Language skills
    language_skills = {
        "english": ("advanced", "language", 0.95),
        "spanish": ("intermediate", "language", 0.90),
        "german": ("intermediate", "language", 0.90),
        "french": ("intermediate", "language", 0.90),
        "mandarin": ("intermediate", "language", 0.90),
        "hindi": ("intermediate", "language", 0.90),
    }
    
    # Extract technical skills
    for skill, (proficiency, category, confidence) in technical_skills.items():
        # Create regex patterns to avoid partial matches
        # E.g., "Docker" should not match in "Dockyard"
        patterns = [
            rf'\b{re.escape(skill)}\b',  # Whole word match
            rf'\b{re.escape(skill)}\s+',  # Word followed by space
        ]
        for pattern in patterns:
            if re.search(pattern, text_lower, re.IGNORECASE):
                extracted_skills[skill.title()] = (proficiency, category, confidence)
                break
    
    # Extract soft skills
    for skill, (proficiency, category, confidence) in soft_skills.items():
        if re.search(rf'\b{re.escape(skill)}\b', text_lower, re.IGNORECASE):
            extracted_skills[skill.title()] = (proficiency, category, confidence)
    
    # Extract language skills
    for skill, (proficiency, category, confidence) in language_skills.items():
        if re.search(rf'\b{re.escape(skill)}\b', text_lower, re.IGNORECASE):
            extracted_skills[skill.title()] = (proficiency, category, confidence)
    
    return extracted_skills


@router.post(
    "/extract-skills-bulk",
    response_model=AdminBulkSkillExtractionResponse,
    status_code=status.HTTP_200_OK,
)
async def extract_skills_from_documents(
    files: List[UploadFile] = File(..., description="Upload JD, CV, Requirements, Specifications documents"),
    doc_type: str = Query("jd", description="Document type: jd, cv, portfolio, requirements, specifications"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> AdminBulkSkillExtractionResponse:
    """
    Admin endpoint to extract skills from multiple uploaded documents (JD, CV, etc.).
    
    Features:
    - Bulk upload support (single or multiple files)
    - Text extraction from PDF, DOCX, TXT
    - Intelligent skill pattern matching with confidence scores
    - Proficiency level detection (beginner, intermediate, advanced, expert)
    - Aggregated skill summary across all documents
    - Per-document extraction details
    
    Parameters:
    - files: List of documents to extract from
    - doc_type: Document type (jd, cv, portfolio, requirements, specifications)
    
    Returns:
    - Aggregated unique skills across all documents with proficiency levels
    - Per-document skill extraction results
    - Extraction summary with statistics
    
    Example:
        POST /api/v1/admin/extract-skills-bulk
        Form Data:
        - files: [jd.pdf, requirements.pdf]
        - doc_type: jd
        
        Response:
        {
            "success": true,
            "documents_processed": 2,
            "total_unique_skills": 15,
            "extracted_skills": [
                {
                    "skill_name": "Python",
                    "proficiency_level": "advanced",
                    "category": "technical",
                    "frequency": 2,
                    "confidence": 0.95
                },
                ...
            ],
            "extraction_summary": {
                "skills_by_category": {
                    "technical": 12,
                    "soft": 3
                },
                "proficiency_distribution": {
                    "advanced": 8,
                    "intermediate": 7
                }
            }
        }
    """
    # Verify admin role
    if current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admin users can extract skills from documents"
        )
    
    if not files:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="At least one file must be uploaded"
        )
    
    # Validate doc_type
    if doc_type not in ALLOWED_DOC_TYPES:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Invalid doc_type. Must be one of: {', '.join(ALLOWED_DOC_TYPES)}"
        )
    
    s3_service = get_s3_service()
    document_results = []
    all_extracted_skills = {}  # Aggregate skills across documents
    skills_by_category = {}
    proficiency_distribution = {}
    
    for file in files:
        # Validate file
        if not file.filename or not allowed_file(file.filename):
            continue  # Skip invalid files, don't fail entire operation
        
        file_bytes = await file.read()
        
        # Validate file size
        if len(file_bytes) > MAX_FILE_SIZE:
            continue  # Skip oversized files
        
        # Extract text
        extracted_text = None
        try:
            extracted_text = extract_text(file_bytes, file.filename)
        except Exception as e:
            print(f"Text extraction failed for {file.filename}: {str(e)}")
            continue
        
        # Extract skills from text
        extracted_skills_dict = extract_skills_from_text_advanced(extracted_text, file.filename)
        
        # Convert to ExtractedSkill objects
        document_skills = []
        for skill_name, (proficiency, category, confidence) in extracted_skills_dict.items():
            skill_obj = ExtractedSkill(
                skill_name=skill_name,
                proficiency_level=proficiency,
                category=category,
                confidence=confidence,
            )
            document_skills.append(skill_obj)
            
            # Aggregate into all_extracted_skills
            if skill_name in all_extracted_skills:
                # Increase frequency if skill already found
                existing = all_extracted_skills[skill_name]
                existing.frequency += 1
                # Keep highest confidence
                existing.confidence = max(existing.confidence, confidence)
            else:
                all_extracted_skills[skill_name] = ExtractedSkill(
                    skill_name=skill_name,
                    proficiency_level=proficiency,
                    category=category,
                    frequency=1,
                    confidence=confidence,
                )
            
            # Track statistics
            skills_by_category[category] = skills_by_category.get(category, 0) + 1
            proficiency_distribution[proficiency] = proficiency_distribution.get(proficiency, 0) + 1
        
        # Upload to S3
        try:
            file_id = f"file_{uuid.uuid4().hex[:12]}"
            timestamp = datetime.utcnow().isoformat()
            s3_key = f"documents/{doc_type}/admin/{timestamp}/{file_id}/{file.filename}"
            
            await s3_service.upload_file(
                file_obj=file_bytes,
                object_name=s3_key,
                content_type=file.content_type or "application/octet-stream",
                metadata={
                    "file_id": file_id,
                    "doc_type": doc_type,
                    "original_filename": file.filename,
                    "uploaded_by": str(current_user.id),
                }
            )
            
            # Store in database
            document = UploadedDocument(
                file_id=file_id,
                user_id=current_user.id,
                original_filename=file.filename,
                file_type=file.filename.split(".")[-1].lower(),
                document_category=doc_type,
                s3_key=s3_key,
                file_size=len(file_bytes),
                mime_type=file.content_type or "application/octet-stream",
                extracted_text=extracted_text,
                extraction_preview=extracted_text[:500] if extracted_text else None,
                is_encrypted=True,
                encryption_method="AES-256-GCM",
            )
            db.add(document)
            
        except Exception as e:
            print(f"Failed to upload {file.filename}: {str(e)}")
            continue
        
        # Add to document results
        document_results.append(
            DocumentSkillExtractionResponse(
                file_id=file_id,
                original_filename=file.filename,
                document_category=doc_type,
                extracted_skills=document_skills,
                total_skills_found=len(document_skills),
                extraction_preview=extracted_text[:500] if extracted_text else "",
            )
        )
    
    # Commit all database changes
    try:
        await db.commit()
    except Exception as e:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to save documents: {str(e)}"
        )
    
    if not document_results:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No valid files could be processed"
        )
    
    # Prepare response
    aggregated_skills = list(all_extracted_skills.values())
    
    return AdminBulkSkillExtractionResponse(
        success=True,
        message=f"Successfully extracted skills from {len(document_results)} document(s)",
        documents_processed=len(document_results),
        total_unique_skills=len(aggregated_skills),
        extracted_skills=aggregated_skills,
        documents=document_results,
        extraction_summary={
            "skills_by_category": skills_by_category,
            "proficiency_distribution": proficiency_distribution,
            "total_skills_found": len(aggregated_skills),
        },
    )


@router.post("/extract-skills", response_model=AdminBulkSkillExtractionResponse)
async def extract_skills_single_file(
    file: UploadFile = File(..., description="Upload a single document (JD, CV, Requirements, etc.)"),
    doc_type: str = Query("jd", description="Document type"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> AdminBulkSkillExtractionResponse:
    """
    Admin endpoint to extract skills from a single document.
    
    This is a convenience endpoint that wraps extract-skills-bulk for single file uploads.
    
    Parameters:
    - file: Document to extract from
    - doc_type: Document type (jd, cv, portfolio, requirements, specifications)
    
    Returns:
    - Extracted skills with proficiency levels and categories
    - Document metadata and extraction details
    """
    # Call the bulk endpoint with a single file
    files = [file]
    return await extract_skills_from_documents(
        files=files,
        doc_type=doc_type,
        current_user=current_user,
        db=db,
    )

