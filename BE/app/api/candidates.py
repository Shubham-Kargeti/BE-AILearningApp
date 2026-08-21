"""Candidates API endpoints."""
from fastapi import APIRouter, HTTPException, Depends, status, Query, Request
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import func, or_
from sqlalchemy.orm import joinedload
from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, Field, validator
from urllib.parse import quote
import re
import secrets
import string
import asyncio

from config import get_settings
from app.core.dependencies import get_db, get_current_user, admin_required
from app.core.security import get_password_hash
from app.core.email import send_email
from app.db.models import Candidate, User, UploadedDocument, Assessment, TestSession, AssessmentApplication
from app.models.schemas import CandidateCreate, CandidateUpdate, CandidateResponse, PendingOnboardingEmailResponse, OnboardingEmailSentRequest, OnboardingEmailSentResponse, FieldError, ValidationErrorResponse
from app.services.onboarding_module_service import get_onboarding_candidates_with_status

# Response schemas for new endpoints
class EmailValidationResponse(BaseModel):
    email: str
    is_available: bool
    existing_candidate_id: Optional[str] = None
    message: str

class SkillsOverrideRequest(BaseModel):
    submitted_skills: dict  # {skill_name: proficiency_level}

class BulkCandidateCreateRequest(BaseModel):
    """Request body for bulk candidate creation from a list of email addresses."""
    emails: List[str] = Field(..., description="List of email addresses to create candidates for")

class BulkCandidateCreateItem(BaseModel):
    """Result of attempting to create a candidate for a single email."""
    email: str
    created: bool = False
    candidate_id: Optional[str] = None
    password: Optional[str] = None
    message: Optional[str] = None

class BulkCandidateCreateResponse(BaseModel):
    """Aggregated response for a bulk candidate creation request."""
    created: List[BulkCandidateCreateItem]
    skipped: List[str] = []
    errors: List[BulkCandidateCreateItem] = []

class OnboardingCandidateStatusResponse(BaseModel):
    """Onboarding candidate with aggregated module progress status."""
    candidate_id: str
    email: str
    full_name: str
    created_at: datetime
    experience_level: str
    onboarding_email_sent: bool = False
    overall_status: str  # "completed" | "in_progress" | "not_started"

class CandidatePendingAssessmentResponse(BaseModel):
    application_id: str
    assessment_id: str
    title: str
    description: Optional[str] = None
    job_title: str
    duration_minutes: int
    total_questions: int
    required_skills: dict
    question_set_id: Optional[str] = None
    assessment_method: str
    is_questionnaire_enabled: bool
    is_interview_enabled: bool
    expires_at: Optional[datetime] = None
    is_expired: bool
    status: str
    applied_at: datetime
    started_at: Optional[datetime] = None
    session_id: Optional[str] = None
    role_applied_for: Optional[str] = None

router = APIRouter(prefix="/api/v1/candidates", tags=["candidates"])


EMAIL_PATTERN = re.compile(r"^[^\s@]+@[^\s@]+\.[^\s@]+$")


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
        source=candidate.source,
    )


async def get_candidate_for_current_user(
    current_user: User,
    db: AsyncSession,
) -> Candidate:
    """Resolve the authenticated user to an active candidate profile."""
    normalized_email = current_user.email.lower().strip()
    result = await db.execute(
        select(Candidate).where(
            or_(
                Candidate.user_id == current_user.id,
                func.lower(Candidate.email) == normalized_email,
            ),
            Candidate.is_active == True,
        )
    )
    candidate = result.scalars().first()

    if not candidate:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Candidate profile not found",
        )

    return candidate


def is_assessment_available_for_candidate(assessment: Assessment) -> bool:
    """Return whether a candidate should still see this assigned assessment."""
    if not assessment.is_active or not assessment.is_published:
        return False

    return not assessment.is_expired


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


def _generate_random_password(length: int = 16) -> str:
    """Generate a random password for bulk-created candidates."""
    alphabet = string.ascii_letters + string.digits + "!@#$%^&*()-_=+"
    return "".join(secrets.choice(alphabet) for _ in range(length))


def _derive_full_name(email: str) -> str:
    """Derive a display name from an email address' local part."""
    local = email.split("@")[0]
    parts = re.split(r"[._\-+]+", local)
    parts = [p.capitalize() for p in parts if p]
    name = " ".join(parts)
    return name or local.capitalize()


async def _send_candidate_credentials_email(email: str, password: str, full_name: str) -> None:
    """Send login credentials to a newly created candidate."""
    settings = get_settings()
    dashboard_url = f"{settings.FRONTEND_URL.rstrip('/')}/login"
    subject = "BCG onboarding modules"
    onboarding_url = f"{settings.FRONTEND_URL.rstrip('/')}/app/onboarding-candidate"
    text_body = (
        f"Dear User,\n\n"
        f"Your account has been successfully created on the {settings.APP_NAME}.\n\n"
        f"Username: {email}\n"
        f"Password: {password}\n\n"
        f"Login: {dashboard_url}\n\n"
        f"After logging in, you can access the onboarding modules in either of the following ways:\n\n"
        f"1. Open the \"Onboarding\" option from the sidebar menu.\n"
        f"2. Alternatively, directly access the Onboarding page here: {onboarding_url}\n\n"
        f"Please complete all six onboarding modules. For each module, you are required to watch the video and complete the associated quiz.\n\n"
        f"If you have any questions or encounter any issues while accessing the platform, please let us know.\n\n"
        f"Best regards,\n{settings.APP_NAME} Team"
    )
    html_body = f"""<html>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f4f4f4;">
<div style="max-width: 600px; margin: 20px auto; background-color: white; border-radius: 10px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
<div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center;">
<h1 style="color: white; margin: 0; font-size: 28px;">Welcome to {settings.APP_NAME}</h1>
</div>
<div style="padding: 30px;">
<p style="font-size: 16px;">Dear User,</p>
<p>Your account has been successfully created on the <strong>{settings.APP_NAME}</strong>.</p>
<div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
<p style="margin: 10px 0;"><strong>Username:</strong> {email}</p>
<p style="margin: 10px 0;"><strong>Password:</strong> {password}</p>
</div>
<p><strong>Login:</strong> <a href="{dashboard_url}" style="color: #667eea;">{dashboard_url}</a></p>
<p>After logging in, you can access the onboarding modules in either of the following ways:</p>
<ol style="padding-left: 20px; margin: 10px 0;">
<li>Open the <strong>“Onboarding”</strong> option from the <strong>sidebar menu</strong>.</li>
<li>Alternatively, directly access the <strong>Onboarding page</strong> here: <a href="{onboarding_url}" style="color: #667eea;">{onboarding_url}</a></li>
</ol>
<p>Please complete all six onboarding modules. For each module, you are required to watch the video and complete the associated quiz.</p>
<p>If you have any questions or encounter any issues while accessing the platform, please let us know.</p>
<p>Best regards,<br><strong>{settings.APP_NAME} Team</strong></p>
</div>
<div style="background-color: #f8f9fa; padding: 20px; text-align: center; border-top: 1px solid #e0e0e0;">
<p style="color: #999; font-size: 12px; margin: 5px 0;">This is an automated email from {settings.APP_NAME}.</p>
<p style="color: #999; font-size: 12px; margin: 5px 0;">© {datetime.now().year} {settings.APP_NAME}. All rights reserved.</p>
</div>
</div>
</body>
</html>"""
    await send_email(
        to_email=email,
        subject=subject,
        html_body=html_body,
        text_body=text_body,
    )
    return True


@router.post("/bulk", response_model=BulkCandidateCreateResponse, status_code=status.HTTP_201_CREATED)
async def create_candidates_bulk(
    request: BulkCandidateCreateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(admin_required),
) -> BulkCandidateCreateResponse:
    """
    Bulk create candidate profiles from a list of email addresses.

    - Admin-only endpoint
    - Each candidate is created with a randomly generated password and the
      "junior" experience level by default
    - Existing emails are skipped (reported in ``skipped``)
    - Invalid emails are reported in ``errors``
    """
    created: List[BulkCandidateCreateItem] = []
    skipped: List[str] = []
    errors: List[BulkCandidateCreateItem] = []

    for raw_email in request.emails:
        email = (raw_email or "").strip().lower()
        if not email:
            continue

        if not EMAIL_PATTERN.match(email):
            errors.append(BulkCandidateCreateItem(
                email=raw_email, message="Invalid email format"
            ))
            continue

        existing_result = await db.execute(
            select(Candidate).where(func.lower(Candidate.email) == email)
        )
        if existing_result.scalars().first():
            skipped.append(email)
            continue

        password = _generate_random_password()
        candidate = Candidate(
            user_id=None,
            full_name=_derive_full_name(email),
            email=email,
            password=password,
            password_hash=get_password_hash(password),
            experience_level="junior",
            skills={},
            availability_percentage=100,
            source="onboarding",
        )
        db.add(candidate)
        await db.flush()
        created.append(BulkCandidateCreateItem(
            email=email,
            created=True,
            candidate_id=candidate.candidate_id,
            password=password,
        ))

    await db.commit()

    # Disabled bulk onboarding email for now.
    # if created:
    #     email_task_items = []
    #     email_tasks = []
    #     for item in created:
    #         if item.email and item.password:
    #             email_task_items.append(item)
    #             email_tasks.append(
    #                 _send_candidate_credentials_email(
    #                     item.email, item.password, _derive_full_name(item.email)
    #                 )
    #             )
    #
    #     email_results = await asyncio.gather(*email_tasks, return_exceptions=True)
    #
    #     for item, email_result in zip(email_task_items, email_results):
    #         sent = False
    #         if isinstance(email_result, Exception):
    #             print(f"Failed to send credentials email to {item.email}: {email_result}")
    #         else:
    #             sent = bool(email_result)
    #
    #         result = await db.execute(
    #             select(Candidate).where(Candidate.candidate_id == item.candidate_id)
    #         )
    #         candidate = result.scalars().first()
    #         if candidate:
    #             candidate.onboarding_email_sent = sent
    #
    #     await db.flush()

    return BulkCandidateCreateResponse(
        created=created, skipped=skipped, errors=errors
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
    
    return to_candidate_response(result)


@router.get(
    "/my-pending-assessments",
    response_model=List[CandidatePendingAssessmentResponse],
)
async def get_my_pending_assessments(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> List[CandidatePendingAssessmentResponse]:
    """
    Get assessments assigned to the current candidate that are not completed yet.
    """
    candidate = await get_candidate_for_current_user(current_user, db)
    candidate_email = candidate.email.lower().strip()


    applications_result = await db.execute(
        select(AssessmentApplication)
        .options(joinedload(AssessmentApplication.assessment))
        .where(
            AssessmentApplication.candidate_id == candidate.id,
            AssessmentApplication.status.in_(["pending", "in_progress"]),
            AssessmentApplication.completed_at.is_(None),
        )
        .order_by(AssessmentApplication.applied_at.desc())
    )
    applications = applications_result.scalars().all()

    print(f"[Debug] Found {applications} {len(applications)} pending assessments for candidate ({candidate_email})")

    pending_assessments: List[CandidatePendingAssessmentResponse] = []
    for application in applications:
        assessment = application.assessment
        if not assessment or not is_assessment_available_for_candidate(assessment):
            continue

        session = None
        if application.test_session_id:
            session_result = await db.execute(
                select(TestSession).where(
                    TestSession.session_id == application.test_session_id
                )
            )
            session = session_result.scalars().first()
            if session and session.is_completed:
                continue

        if assessment.question_set_id:
            completed_session_result = await db.execute(
                select(TestSession).where(
                    TestSession.question_set_id == assessment.question_set_id,
                    TestSession.is_completed == True,
                    or_(
                        TestSession.user_id == current_user.id,
                        func.lower(TestSession.candidate_email) == candidate_email,
                    ),
                )
            )
            if completed_session_result.scalars().first():
                continue

            if session is None:
                in_progress_session_result = await db.execute(
                    select(TestSession)
                    .where(
                        TestSession.question_set_id == assessment.question_set_id,
                        TestSession.is_completed == False,
                        or_(
                            TestSession.user_id == current_user.id,
                            func.lower(TestSession.candidate_email) == candidate_email,
                        ),
                    )
                    .order_by(TestSession.created_at.desc())
                )
                session = in_progress_session_result.scalars().first()

        pending_assessments.append(
            CandidatePendingAssessmentResponse(
                application_id=application.application_id,
                assessment_id=assessment.assessment_id,
                title=assessment.title,
                description=assessment.description,
                job_title=assessment.job_title,
                duration_minutes=assessment.duration_minutes,
                total_questions=assessment.total_questions,
                required_skills=assessment.required_skills or {},
                question_set_id=assessment.question_set_id,
                assessment_method=assessment.assessment_method,
                is_questionnaire_enabled=assessment.is_questionnaire_enabled,
                is_interview_enabled=assessment.is_interview_enabled,
                expires_at=assessment.expires_at,
                is_expired=assessment.is_expired,
                status=application.status,
                applied_at=application.applied_at,
                started_at=application.started_at,
                session_id=session.session_id if session else application.test_session_id,
                role_applied_for=application.role_applied_for,
            )
        )

    return pending_assessments


@router.get("", response_model=List[CandidateResponse])
async def list_candidates(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    search: Optional[str] = Query(None, description="Search candidates by name or email"),
    source: Optional[str] = Query(None, description="Filter by source (e.g. 'onboarding')"),
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

    if source:
        stmt = stmt.where(Candidate.source == source)

    stmt = stmt.order_by(Candidate.created_at.desc()).offset(skip).limit(limit)
    result = await db.execute(stmt)
    candidates = result.scalars().all()

    return [
        to_candidate_response(candidate, include_password=True)
        for candidate in candidates
    ]


@router.get("/onboarding-status", response_model=List[OnboardingCandidateStatusResponse])
async def get_onboarding_candidates_status(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(admin_required),
) -> List[OnboardingCandidateStatusResponse]:
    """Return all onboarding-sourced candidates with their aggregated module progress status."""
    return await get_onboarding_candidates_with_status(db)


@router.get("/pending-onboarding-emails", response_model=List[PendingOnboardingEmailResponse])
async def get_pending_onboarding_emails(
    api_key: str = Query(..., description="API key for authentication"),
    date: Optional[str] = Query(None, description="Filter candidates created from this date (YYYY-MM-DD). If omitted, returns all pending candidates."),
    db: AsyncSession = Depends(get_db),
) -> List[PendingOnboardingEmailResponse]:
    """Return candidates who have not yet received the onboarding credentials email."""
    settings = get_settings()
    if api_key != settings.API_KEY:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Invalid API key"
        )

    query = select(Candidate).where(Candidate.onboarding_email_sent == False)

    if date:
        try:
            from_date = datetime.strptime(date, "%Y-%m-%d").replace(tzinfo=None)
            query = query.where(Candidate.created_at >= from_date)
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid date format. Use YYYY-MM-DD."
            )

    result = await db.execute(query)
    candidates = result.scalars().all()

    return [
        PendingOnboardingEmailResponse(
            email=candidate.email,
            username=candidate.full_name,
            password=candidate.password,
        )
        for candidate in candidates
    ]


@router.post("/mark-onboarding-email-sent", response_model=OnboardingEmailSentResponse)
async def mark_onboarding_email_sent(
    request: OnboardingEmailSentRequest,
    api_key: str = Query(..., description="API key for authentication"),
    db: AsyncSession = Depends(get_db),
) -> OnboardingEmailSentResponse:
    """Mark onboarding credentials email as sent for a candidate by email."""
    settings = get_settings()
    if api_key != settings.API_KEY:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Invalid API key"
        )

    result = await db.execute(
        select(Candidate).where(func.lower(Candidate.email) == request.email.lower().strip())
    )
    candidate = result.scalar_one_or_none()
    if not candidate:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Candidate not found"
        )

    candidate.onboarding_email_sent = True
    await db.commit()
    await db.refresh(candidate)

    return OnboardingEmailSentResponse(
        email=candidate.email,
        onboarding_email_sent=candidate.onboarding_email_sent,
    )


@router.post("/{candidate_id}/send-credentials-email", response_model=dict)
async def send_candidate_credentials_email(
    candidate_id: str,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(admin_required),
):
    """Return a mailto URL so the admin can send credentials email manually via Outlook."""
    result = await db.execute(
        select(Candidate).where(Candidate.candidate_id == candidate_id)
    )
    candidate = result.scalar_one_or_none()
    if not candidate:
        raise HTTPException(404, "Candidate not found")

    if not candidate.password:
        raise HTTPException(400, "No password available for this candidate")

    settings = get_settings()
    subject = "BCG onboarding modules"

    # Prefer a frontend origin provided by the browser (Origin or Referer)
    # when available — this helps generate correct links in production
    # environments without requiring a separate env var change.
    frontend_base = settings.FRONTEND_URL.rstrip("/")
    try:
        origin_header = None
        # FastAPI injects Request if added to the signature; try to read it
        # from the context locals if present.
        request_obj = locals().get("request")
        if request_obj and hasattr(request_obj, "headers"):
            origin_header = request_obj.headers.get("origin") or request_obj.headers.get("referer")
        if origin_header:
            from urllib.parse import urlparse

            parsed = urlparse(origin_header)
            if parsed.scheme and parsed.netloc:
                frontend_base = f"{parsed.scheme}://{parsed.netloc}"
    except Exception:
        # Fall back to configured FRONTEND_URL
        pass

    dashboard_url = f"{frontend_base}/login"
    onboarding_url = f"{frontend_base}/app/onboarding-candidate"
    text_body = (
        f"Dear User,\n\n"
        f"Your account has been successfully created on the {settings.APP_NAME}.\n\n"
        f"Username: {candidate.email}\n"
        f"Password: {candidate.password}\n\n"
        f"Login: {dashboard_url}\n\n"
        f"After logging in, you can access the onboarding modules in either of the following ways:\n\n"
        f"1. Open the \"Onboarding\" option from the sidebar menu.\n"
        f"2. Alternatively, directly access the Onboarding page here: {onboarding_url}\n\n"
        f"Please complete all six onboarding modules. For each module, you are required to watch the video and complete the associated quiz.\n\n"
        f"If you have any questions or encounter any issues while accessing the platform, please let us know.\n\n"
        f"Best regards,\n{settings.APP_NAME} Team"
    )
    to_email = candidate.email
    mailto_url = f"mailto:{to_email}?subject={quote(subject)}&body={quote(text_body)}"

    return {"mailto_url": mailto_url}


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
    if request.email is not None:
        normalized_email = request.email.lower().strip()
        if not EMAIL_PATTERN.match(normalized_email):
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Enter a valid candidate email"
            )

        existing_result = await db.execute(
            select(Candidate).where(
                func.lower(Candidate.email) == normalized_email,
                Candidate.id != candidate.id,
            )
        )
        if existing_result.scalars().first():
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Candidate with email {normalized_email} already exists"
            )

        candidate.email = normalized_email
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
    if request.created_at is not None:
        candidate.created_at = request.created_at
    
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
