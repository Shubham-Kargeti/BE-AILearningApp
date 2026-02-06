"""Candidates API endpoints."""
from fastapi import APIRouter, HTTPException, Depends, status, Query, Request
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, Field, validator
import re

from app.core.dependencies import get_db, get_current_user, optional_user
from app.db.models import Candidate, User, UploadedDocument, Assessment, TestSession
from app.models.schemas import CandidateCreate, CandidateUpdate, CandidateResponse, FieldError, ValidationErrorResponse

# Response schemas for new endpoints
class EmailValidationResponse(BaseModel):
    email: str
    is_available: bool
    existing_candidate_id: Optional[str] = None
    message: str

class SkillsOverrideRequest(BaseModel):
    submitted_skills: dict  # {skill_name: proficiency_level}

router = APIRouter(prefix="/api/v1/candidates", tags=["candidates"])


@router.get("/check-email", response_model=EmailValidationResponse)
async def check_email_availability(
    email: str = Query(..., description="Email to validate"),
    db: AsyncSession = Depends(get_db),
) -> EmailValidationResponse:
    """
    Real-time email validation endpoint.
    
    Check if email is available for a new candidate profile.
    Returns existing candidate info if email already registered.
    
    Query Parameters:
    - email: Email address to validate
    
    Returns:
    - is_available: True if email can be used for new candidate
    - existing_candidate_id: If email exists, returns the candidate_id
    - message: Human-readable status message
    """
    stmt = select(Candidate).where(Candidate.email == email)
    result = await db.execute(stmt)
    existing = result.scalars().first()
    
    if existing:
        return EmailValidationResponse(
            email=email,
            is_available=False,
            existing_candidate_id=existing.candidate_id,
            message=f"Email already registered for candidate: {existing.full_name}"
        )
    
    return EmailValidationResponse(
        email=email,
        is_available=True,
        existing_candidate_id=None,
        message="Email is available for registration"
    )


@router.post("", response_model=CandidateResponse, status_code=status.HTTP_201_CREATED)
async def create_candidate(
    request: CandidateCreate,
    db: AsyncSession = Depends(get_db),
    current_user: Optional[User] = Depends(optional_user),
) -> CandidateResponse:
    """
    Create a new candidate profile.
    
    - Can be anonymous (no user_id) or linked to authenticated user
    - Email validation: Must be valid format
    - Experience level: junior, mid, senior, lead, executive, etc.
    """
    # Check if candidate with same email already exists
    stmt = select(Candidate).where(Candidate.email == request.email)
    existing = await db.execute(stmt)
    if existing.scalars().first():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Candidate with email {request.email} already exists"
        )
    
    candidate = Candidate(
        user_id=current_user.id if current_user else None,
        full_name=request.full_name,
        email=request.email,
        phone=request.phone,
        experience_level=request.experience_level,
        skills=request.skills,
        availability_percentage=min(100, max(0, request.availability_percentage)),
    )
    
    db.add(candidate)
    await db.commit()
    await db.refresh(candidate)
    
    return CandidateResponse(
        id=candidate.id,
        candidate_id=candidate.candidate_id,
        full_name=candidate.full_name,
        email=candidate.email,
        phone=candidate.phone,
        experience_level=candidate.experience_level,
        skills=candidate.skills,
        availability_percentage=candidate.availability_percentage,
        jd_file_id=candidate.jd_file_id,
        cv_file_id=candidate.cv_file_id,
        portfolio_file_id=candidate.portfolio_file_id,
        is_active=candidate.is_active,
        created_at=candidate.created_at,
        updated_at=candidate.updated_at,
    )


@router.get("/me", response_model=CandidateResponse)
async def get_current_candidate(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> CandidateResponse:
    """Get current authenticated user's candidate profile."""
    stmt = select(Candidate).where(Candidate.user_id == current_user.id)
    candidate = await db.execute(stmt)
    result = candidate.scalars().first()
    
    if not result:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Candidate profile not found"
        )
    
    return CandidateResponse(
        id=result.id,
        candidate_id=result.candidate_id,
        full_name=result.full_name,
        email=result.email,
        phone=result.phone,
        experience_level=result.experience_level,
        skills=result.skills,
        availability_percentage=result.availability_percentage,
        jd_file_id=result.jd_file_id,
        cv_file_id=result.cv_file_id,
        portfolio_file_id=result.portfolio_file_id,
        is_active=result.is_active,
        created_at=result.created_at,
        updated_at=result.updated_at,
    )


@router.get("/{candidate_id}", response_model=CandidateResponse)
async def get_candidate(
    candidate_id: str,
    db: AsyncSession = Depends(get_db),
) -> CandidateResponse:
    """Get candidate profile by ID."""
    stmt = select(Candidate).where(Candidate.candidate_id == candidate_id)
    result = await db.execute(stmt)
    candidate = result.scalars().first()
    
    if not candidate:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Candidate not found"
        )
    
    return CandidateResponse(
        id=candidate.id,
        candidate_id=candidate.candidate_id,
        full_name=candidate.full_name,
        email=candidate.email,
        phone=candidate.phone,
        experience_level=candidate.experience_level,
        skills=candidate.skills,
        availability_percentage=candidate.availability_percentage,
        jd_file_id=candidate.jd_file_id,
        cv_file_id=candidate.cv_file_id,
        portfolio_file_id=candidate.portfolio_file_id,
        is_active=candidate.is_active,
        created_at=candidate.created_at,
        updated_at=candidate.updated_at,
    )


@router.put("/{candidate_id}", response_model=CandidateResponse)
async def update_candidate(
    candidate_id: str,
    request: CandidateUpdate,
    db: AsyncSession = Depends(get_db),
) -> CandidateResponse:
    """Update candidate profile."""
    stmt = select(Candidate).where(Candidate.candidate_id == candidate_id)
    result = await db.execute(stmt)
    candidate = result.scalars().first()
    
    if not candidate:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Candidate not found"
        )
    
    # Update fields if provided
    if request.full_name is not None:
        candidate.full_name = request.full_name
    if request.phone is not None:
        candidate.phone = request.phone
    if request.experience_level is not None:
        candidate.experience_level = request.experience_level
    if request.skills is not None:
        candidate.skills = request.skills
    if request.availability_percentage is not None:
        candidate.availability_percentage = min(100, max(0, request.availability_percentage))
    
    candidate.updated_at = datetime.utcnow()
    await db.commit()
    await db.refresh(candidate)
    
    return CandidateResponse(
        id=candidate.id,
        candidate_id=candidate.candidate_id,
        full_name=candidate.full_name,
        email=candidate.email,
        phone=candidate.phone,
        experience_level=candidate.experience_level,
        skills=candidate.skills,
        availability_percentage=candidate.availability_percentage,
        jd_file_id=candidate.jd_file_id,
        cv_file_id=candidate.cv_file_id,
        portfolio_file_id=candidate.portfolio_file_id,
        is_active=candidate.is_active,
        created_at=candidate.created_at,
        updated_at=candidate.updated_at,
    )


@router.post("/{candidate_id}/files/{file_type}", response_model=CandidateResponse)
async def link_uploaded_file(
    candidate_id: str,
    file_type: str,  # jd, cv, portfolio
    file_id: str,
    db: AsyncSession = Depends(get_db),
) -> CandidateResponse:
    """
    Link an uploaded document to candidate profile.
    
    - file_type: jd, cv, portfolio
    - file_id: The file_id of the uploaded document
    """
    # Validate file_type
    valid_types = ["jd", "cv", "portfolio"]
    if file_type not in valid_types:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Invalid file_type. Must be one of: {', '.join(valid_types)}"
        )
    
    # Get candidate
    stmt = select(Candidate).where(Candidate.candidate_id == candidate_id)
    result = await db.execute(stmt)
    candidate = result.scalars().first()
    
    if not candidate:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Candidate not found"
        )
    
    # Verify file exists
    file_stmt = select(UploadedDocument).where(UploadedDocument.file_id == file_id)
    file_result = await db.execute(file_stmt)
    if not file_result.scalars().first():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Uploaded file not found"
        )
    
    # Link file to candidate
    if file_type == "jd":
        candidate.jd_file_id = file_id
    elif file_type == "cv":
        candidate.cv_file_id = file_id
    elif file_type == "portfolio":
        candidate.portfolio_file_id = file_id
    
    candidate.updated_at = datetime.utcnow()
    await db.commit()
    await db.refresh(candidate)
    
    return CandidateResponse(
        id=candidate.id,
        candidate_id=candidate.candidate_id,
        full_name=candidate.full_name,
        email=candidate.email,
        phone=candidate.phone,
        experience_level=candidate.experience_level,
        skills=candidate.skills,
        availability_percentage=candidate.availability_percentage,
        jd_file_id=candidate.jd_file_id,
        cv_file_id=candidate.cv_file_id,
        portfolio_file_id=candidate.portfolio_file_id,
        is_active=candidate.is_active,
        created_at=candidate.created_at,
        updated_at=candidate.updated_at,
    )


@router.put("/{candidate_id}/skills", response_model=CandidateResponse)
async def override_candidate_skills(
    candidate_id: str,
    request: SkillsOverrideRequest,
    db: AsyncSession = Depends(get_db),
) -> CandidateResponse:
    """
    Manually override auto-extracted skills for a candidate.
    
    Allows candidates to correct or adjust the skills suggested from their JD.
    
    Parameters:
    - candidate_id: The candidate's unique ID
    - submitted_skills: Dict mapping skill names to proficiency levels
        Example: {"Python": "expert", "React": "intermediate"}
    
    Returns:
    - Updated candidate profile with new skills
    """
    stmt = select(Candidate).where(Candidate.candidate_id == candidate_id)
    result = await db.execute(stmt)
    candidate = result.scalars().first()
    
    if not candidate:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Candidate not found"
        )
    
    # Update skills
    candidate.skills = request.submitted_skills
    candidate.updated_at = datetime.utcnow()
    await db.commit()
    await db.refresh(candidate)
    
    return CandidateResponse(
        id=candidate.id,
        candidate_id=candidate.candidate_id,
        full_name=candidate.full_name,
        email=candidate.email,
        phone=candidate.phone,
        experience_level=candidate.experience_level,
        skills=candidate.skills,
        availability_percentage=candidate.availability_percentage,
        jd_file_id=candidate.jd_file_id,
        cv_file_id=candidate.cv_file_id,
        portfolio_file_id=candidate.portfolio_file_id,
        is_active=candidate.is_active,
        created_at=candidate.created_at,
        updated_at=candidate.updated_at,
    )
