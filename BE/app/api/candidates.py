"""Candidates API endpoints."""
from fastapi import APIRouter, HTTPException, Depends, status, Query, Request
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import func, or_
from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, Field, validator
import re

from app.core.dependencies import get_db, get_current_user, admin_required
from app.core.security import get_password_hash
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


def to_candidate_response(candidate: Candidate, include_password: bool = False) -> CandidateResponse:
    """Map a Candidate ORM object to the public API schema."""
    return CandidateResponse(
        id=candidate.id,
        candidate_id=candidate.candidate_id,
        full_name=candidate.full_name,
        email=candidate.email,
        password=candidate.password if include_password else None,
        phone=candidate.phone,
        current_role=candidate.current_role,
        team=candidate.team,
        location=candidate.location,
        education=candidate.education,
        linkedin_url=candidate.linkedin_url,
        github_url=candidate.github_url,
        portfolio_url=candidate.portfolio_url,
        experience_years=candidate.experience_years,
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
    normalized_email = email.lower().strip()
    stmt = select(Candidate).where(func.lower(Candidate.email) == normalized_email)
    result = await db.execute(stmt)
    existing = result.scalars().first()
    
    if existing:
        return EmailValidationResponse(
            email=normalized_email,
            is_available=False,
            existing_candidate_id=existing.candidate_id,
            message=f"Email already registered for candidate: {existing.full_name}"
        )
    
    return EmailValidationResponse(
        email=normalized_email,
        is_available=True,
        existing_candidate_id=None,
        message="Email is available for registration"
    )


@router.post("", response_model=CandidateResponse, status_code=status.HTTP_201_CREATED)
async def create_candidate(
    request: CandidateCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(admin_required),
) -> CandidateResponse:
    """
    Create a new candidate profile.

    - Admin-only endpoint for provisioning candidate credentials
    - Email validation: Must be valid format
    - Experience level: junior, mid, senior, lead, executive, etc.
    """
    if not request.password:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Candidate password is required"
        )

    # Check if candidate with same email already exists
    normalized_email = request.email.lower().strip()
    stmt = select(Candidate).where(func.lower(Candidate.email) == normalized_email)
    existing = await db.execute(stmt)
    if existing.scalars().first():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Candidate with email {normalized_email} already exists"
        )
    
    candidate = Candidate(
        user_id=None,
        full_name=request.full_name,
        email=normalized_email,
        password=request.password,
        password_hash=get_password_hash(request.password),
        phone=request.phone,
        current_role=request.current_role,
        team=request.team,
        location=request.location,
        education=request.education,
        linkedin_url=request.linkedin_url,
        github_url=request.github_url,
        portfolio_url=request.portfolio_url,
        experience_years=request.experience_years,
        experience_level=request.experience_level,
        skills=request.skills,
        availability_percentage=min(100, max(0, request.availability_percentage)),
    )
    
    db.add(candidate)
    await db.commit()
    await db.refresh(candidate)
    
    return to_candidate_response(candidate, include_password=True)


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
    
    return to_candidate_response(result)


@router.get("", response_model=List[CandidateResponse])
async def list_candidates(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    search: Optional[str] = Query(None, description="Search candidates by name or email"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(admin_required),
) -> List[CandidateResponse]:
    """List candidates provisioned by admin."""
    stmt = select(Candidate)

    normalized_search = search.strip().lower() if search else ""
    if normalized_search:
        search_term = f"%{normalized_search}%"
        stmt = stmt.where(
            or_(
                func.lower(Candidate.full_name).like(search_term),
                func.lower(Candidate.email).like(search_term),
            )
        )

    stmt = stmt.order_by(Candidate.created_at.desc()).offset(skip).limit(limit)
    result = await db.execute(stmt)
    candidates = result.scalars().all()

    return [
        to_candidate_response(candidate, include_password=True)
        for candidate in candidates
    ]


@router.get("/{candidate_id}", response_model=CandidateResponse)
async def get_candidate(
    candidate_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(admin_required),
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
    
    return to_candidate_response(candidate, include_password=True)


@router.patch("/{candidate_id}", response_model=CandidateResponse)
@router.put("/{candidate_id}", response_model=CandidateResponse)
async def update_candidate(
    candidate_id: str,
    request: CandidateUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(admin_required),
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
    if request.password is not None:
        if not request.password:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Candidate password cannot be empty"
            )
        candidate.password = request.password
        candidate.password_hash = get_password_hash(request.password)
    if request.phone is not None:
        candidate.phone = request.phone
    if request.current_role is not None:
        candidate.current_role = request.current_role
    if request.team is not None:
        candidate.team = request.team
    if request.location is not None:
        candidate.location = request.location
    if request.education is not None:
        candidate.education = request.education
    if request.linkedin_url is not None:
        candidate.linkedin_url = request.linkedin_url
    if request.github_url is not None:
        candidate.github_url = request.github_url
    if request.portfolio_url is not None:
        candidate.portfolio_url = request.portfolio_url
    if request.experience_years is not None:
        candidate.experience_years = request.experience_years
    if request.experience_level is not None:
        candidate.experience_level = request.experience_level
    if request.skills is not None:
        candidate.skills = request.skills
    if request.availability_percentage is not None:
        candidate.availability_percentage = min(100, max(0, request.availability_percentage))
    
    candidate.updated_at = datetime.utcnow()
    await db.commit()
    await db.refresh(candidate)
    
    return to_candidate_response(candidate, include_password=True)


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
    
    return to_candidate_response(candidate)


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
    
    return to_candidate_response(candidate)
