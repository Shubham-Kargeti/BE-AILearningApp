"""Skills and Roles API endpoints."""
from fastapi import APIRouter, HTTPException, Depends, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from datetime import datetime
from typing import List, Optional

from app.core.dependencies import get_db
from app.db.models import Skill, Role, JobDescription, UploadedDocument
from app.models.schemas import SkillResponse, RoleResponse

router = APIRouter(prefix="/api/v1", tags=["skills-roles"])


@router.get("/skills", response_model=List[SkillResponse])
async def list_skills(
    db: AsyncSession = Depends(get_db),
    category: Optional[str] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
) -> List[SkillResponse]:
    """
    List all available skills for auto-suggestion.
    
    Query Parameters:
    - category: Filter by skill category (technical, soft, language, etc.)
    - skip, limit: Pagination
    """
    query = select(Skill).where(Skill.is_active == True)
    
    if category:
        query = query.where(Skill.category == category)
    
    query = query.order_by(Skill.name).offset(skip).limit(limit)
    
    result = await db.execute(query)
    skills = result.scalars().all()
    
    return [
        SkillResponse(
            id=s.id,
            skill_id=s.skill_id,
            name=s.name,
            description=s.description,
            category=s.category,
            is_active=s.is_active,
        )
        for s in skills
    ]


@router.get("/roles", response_model=List[RoleResponse])
async def list_roles(
    db: AsyncSession = Depends(get_db),
    department: Optional[str] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
) -> List[RoleResponse]:
    """
    List all available job roles for auto-suggestion.
    
    Query Parameters:
    - department: Filter by department
    - skip, limit: Pagination
    """
    query = select(Role).where(Role.is_active == True)
    
    if department:
        query = query.where(Role.department == department)
    
    query = query.order_by(Role.name).offset(skip).limit(limit)
    
    result = await db.execute(query)
    roles = result.scalars().all()
    
    return [
        RoleResponse(
            id=r.id,
            role_id=r.role_id,
            name=r.name,
            description=r.description,
            department=r.department,
            required_skills=r.required_skills,
            is_active=r.is_active,
        )
        for r in roles
    ]


@router.get("/job-descriptions/{jd_id}", response_model=dict)
async def get_jd_extraction_results(
    jd_id: str,
    db: AsyncSession = Depends(get_db),
) -> dict:
    """
    Get extracted data from uploaded JD for auto-suggestion.
    
    Returns:
    - title: Job title from JD
    - extracted_skills: List of extracted skills with categories
    - extracted_roles: List of extracted roles
    - extracted_text: Full extracted text preview
    - suggested_questions: Pre-generated questions from JD
    """
    stmt = select(JobDescription).where(JobDescription.jd_id == jd_id)
    result = await db.execute(stmt)
    jd = result.scalars().first()
    
    if not jd:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Job description not found"
        )
    
    # Extract skills and roles from the JD title/description
    extracted_skills = extract_skills_from_text(jd.description or "")
    extracted_roles = extract_roles_from_text(jd.title or "", jd.description or "")
    
    return {
        "jd_id": jd.jd_id,
        "title": jd.title,
        "description": jd.description,
        "extracted_text": jd.extracted_text[:500] if jd.extracted_text else "",  # Preview
        "extracted_skills": extracted_skills,
        "extracted_roles": extracted_roles,
        "file_name": jd.file_name,
        "file_size": jd.file_size,
        "created_at": jd.created_at,
    }


@router.get("/extract-from-upload/{file_id}", response_model=dict)
async def extract_skills_from_uploaded_file(
    file_id: str,
    db: AsyncSession = Depends(get_db),
) -> dict:
    """
    Extract skills and roles from an uploaded document (JD, Requirements, Specifications).
    
    Supports JD, requirements, and specifications documents.
    
    Returns:
    - extracted_skills: Suggested skills with categories
    - extracted_roles: Suggested roles
    - extracted_text_preview: Text extracted from the document
    - confidence_scores: How confident the extraction is (0-1)
    """
    # Get uploaded document
    stmt = select(UploadedDocument).where(UploadedDocument.file_id == file_id)
    result = await db.execute(stmt)
    doc = result.scalars().first()
    
    if not doc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Uploaded document not found"
        )
    
    # Only extract from certain document types
    if doc.document_category not in ["jd", "requirements", "specifications"]:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Cannot extract skills from {doc.document_category} documents. Supported: jd, requirements, specifications"
        )
    
    # Extract text and skills
    extracted_text = doc.extracted_text or doc.extraction_preview or ""
    extracted_skills = extract_skills_from_text(extracted_text)
    extracted_roles = extract_roles_from_text(doc.original_filename, extracted_text)
    
    return {
        "file_id": file_id,
        "file_name": doc.original_filename,
        "document_category": doc.document_category,
        "extracted_text_preview": extracted_text[:500],
        "extracted_skills": extracted_skills,
        "extracted_roles": extracted_roles,
        "extraction_confidence": 0.75,  # Placeholder - would be calculated by NLP
        "extraction_timestamp": doc.created_at,
    }


def extract_skills_from_text(text: str) -> dict:
    """
    Extract skills from JD, requirements, or specifications text.
    
    Returns dict with skill categories:
    - technical: Programming languages, frameworks, tools
    - soft: Leadership, communication, etc.
    - language: Languages
    
    In production, this would use:
    - NER (Named Entity Recognition) for skill extraction
    - LLM-based extraction with confidence scores
    - Skill taxonomy matching from database
    """
    if not text:
        return {}
    
    text_lower = text.lower()
    
    # Common technical skills to look for
    technical_skills = {
        "python": "advanced",
        "javascript": "advanced",
        "typescript": "advanced",
        "java": "advanced",
        "react": "intermediate",
        "vue": "intermediate",
        "angular": "intermediate",
        "node": "intermediate",
        "django": "intermediate",
        "fastapi": "intermediate",
        "sql": "advanced",
        "postgresql": "advanced",
        "mongodb": "intermediate",
        "redis": "intermediate",
        "aws": "intermediate",
        "gcp": "intermediate",
        "azure": "intermediate",
        "docker": "intermediate",
        "kubernetes": "intermediate",
        "git": "advanced",
        "rest api": "advanced",
        "graphql": "intermediate",
        "microservices": "intermediate",
        "system design": "intermediate",
    }
    
    # Common soft skills
    soft_skills = {
        "communication": "intermediate",
        "leadership": "intermediate",
        "teamwork": "advanced",
        "problem solving": "advanced",
        "analytical": "advanced",
        "project management": "intermediate",
    }
    
    extracted = {}
    
    # Extract technical skills
    for skill, proficiency in technical_skills.items():
        if skill in text_lower:
            extracted[skill.title()] = proficiency
    
    # Extract soft skills
    for skill, proficiency in soft_skills.items():
        if skill in text_lower:
            extracted[skill.title()] = proficiency
    
    # If no skills found, return some common ones as defaults
    if not extracted:
        extracted = {
            "Communication": "intermediate",
            "Problem Solving": "advanced",
            "Teamwork": "advanced",
        }
    
    return extracted


def extract_roles_from_text(title: str = "", text: str = "") -> list:
    """
    Extract job roles from JD title and description.
    
    Returns list of matched role names.
    
    In production, this would use:
    - Role taxonomy matching
    - NLP/LLM-based extraction with confidence
    """
    if not title and not text:
        return []
    
    combined_text = f"{title} {text}".lower()
    
    # Common role patterns to look for
    role_patterns = {
        "backend": ["backend engineer", "backend developer"],
        "frontend": ["frontend engineer", "frontend developer", "ui developer"],
        "fullstack": ["full stack engineer", "full stack developer", "fullstack"],
        "devops": ["devops engineer", "devops", "infrastructure"],
        "data": ["data engineer", "data scientist", "analytics engineer"],
        "qa": ["qa engineer", "quality assurance", "test engineer"],
        "product": ["product engineer", "product manager"],
        "security": ["security engineer", "security specialist"],
    }
    
    extracted_roles = []
    
    for role_category, patterns in role_patterns.items():
        for pattern in patterns:
            if pattern in combined_text:
                # Convert to title case and avoid duplicates
                role_title = " ".join(word.title() for word in pattern.split())
                if role_title not in extracted_roles:
                    extracted_roles.append(role_title)
    
    # If no specific roles found, extract from title if it exists
    if not extracted_roles and title:
        # Return the title as a suggested role
        role_title = title.split(" - ")[0].strip()  # Get first part if separated by dash
        if role_title:
            extracted_roles.append(role_title)
    
    # If still nothing, return generic roles
    if not extracted_roles:
        extracted_roles = ["Backend Engineer", "Senior Developer"]
    
    return list(set(extracted_roles))  # Remove duplicates
