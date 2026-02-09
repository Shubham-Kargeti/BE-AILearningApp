"""Assessments API endpoints."""
from fastapi import APIRouter, HTTPException, Depends, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import desc
from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel
import json
from config import get_settings
from app.core.redis import get_redis, RedisService
from app.utils.generate_admin_assessment import generate_assessment_question_set
from app.core.dependencies import get_db, get_current_user, optional_auth
from app.core.security import check_admin, is_admin_user
from app.db.models import Assessment, AssessmentApplication, Candidate, User, JobDescription, Question
from app.models.schemas import (
    AssessmentCreate, AssessmentUpdate, AssessmentResponse,
    AssessmentApplicationRequest, AssessmentApplicationResponse
)
from app.models.schemas import ScreeningResponseCreate, ScreeningResponseResponse
from app.db.models import ScreeningResponse

router = APIRouter(prefix="/api/v1/assessments", tags=["assessments"])
settings = get_settings()
CACHE_TTL_SECONDS = 120


async def _get_cache_service() -> Optional[RedisService]:
    try:
        return RedisService(get_redis())
    except Exception:
        return None


def _list_cache_key(is_published: Optional[bool], skip: int, limit: int, show_all: bool) -> str:
    return f"assessments:list:{show_all}:{is_published}:{skip}:{limit}"


def _with_questions_cache_key(show_all: bool) -> str:
    return f"assessments:with_questions:{show_all}"


async def _clear_assessment_cache() -> None:
    try:
        redis = get_redis()
    except Exception:
        return

    pattern = f"{settings.REDIS_CACHE_PREFIX}assessments:*"
    async for key in redis.scan_iter(match=pattern):
        await redis.delete(key)

# ------------------------------------------------------------
# Question Helpers 
# ------------------------------------------------------------

def resolve_question_type(question: Question) -> str:
    """
    Detect question type using options JSON.
    """
    if isinstance(question.options, dict):
        qtype = question.options.get("type")
        if qtype in ("coding", "architecture"):
            return qtype
    return "mcq"


def serialize_question(question: Question) -> dict:
    """
    Convert DB question into FE-safe payload.
    """
    qtype = resolve_question_type(question)

    payload = {
        "id": question.id,
        "question_type": qtype,
        "question_text": question.question_text,
    }

    if qtype == "mcq":
        payload["options"] = question.options
    else:
        payload["meta"] = {
            k: v for k, v in question.options.items()
            if k != "type"
        }

    return payload


def extract_screening_questions(description: Optional[str]) -> list[str]:
    """
    Safely extract screening questions from assessment.description.
    Supports backward compatibility with plain-text descriptions.
    """
    if not description:
        return []

    try:
        data = json.loads(description)
        return data.get("screening_questions", []) or []
    except Exception:
        # Old assessments had plain-text description
        return []
    
    
@router.get("", response_model=List[AssessmentResponse])
async def list_assessments(
    db: AsyncSession = Depends(get_db),
    is_published: Optional[bool] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(10, ge=1, le=100),
    show_all: bool = Query(False, description="Show all assessments including unpublished (admin only)"),
) -> List[AssessmentResponse]:
    """
    List all assessments.
    
    Query Parameters:
    - is_published: Filter by published status
    - skip: Number of records to skip
    - limit: Number of records to return
    - show_all: If true, shows all assessments (for admin dashboard)
    """
    cache_service = await _get_cache_service()
    cache_key = _list_cache_key(is_published, skip, limit, show_all)
    if cache_service:
        cached = await cache_service.cache_get(cache_key)
        if cached:
            return cached

    query = select(Assessment).where(Assessment.is_active == True)
    
    if show_all:
        if is_published is not None:
            query = query.where(Assessment.is_published == is_published)
    elif is_published is not None:
        query = query.where(Assessment.is_published == is_published)
    else:
        query = query.where(Assessment.is_published == True)
    
    query = query.order_by(desc(Assessment.created_at))
    query = query.offset(skip).limit(limit)
    
    result = await db.execute(query)
    assessments = result.scalars().all()
    
    # Fetch session statistics for each assessment
    from app.db.models import TestSession
    assessment_responses = []
    
    for a in assessments:
        # Get session counts if question_set_id exists
        total_sessions = 0
        completed_sessions = 0
        in_progress_sessions = 0
        
        if a.question_set_id:
            session_result = await db.execute(
                select(TestSession).where(TestSession.question_set_id == a.question_set_id)
            )
            sessions = session_result.scalars().all()
            total_sessions = len(sessions)
            completed_sessions = sum(1 for s in sessions if s.is_completed)
            in_progress_sessions = sum(1 for s in sessions if not s.is_completed)
        
        assessment_responses.append(
            AssessmentResponse(
                id=a.id,
                assessment_id=a.assessment_id,
                title=a.title,
                description=a.description,
                job_title=a.job_title,
                jd_id=a.jd_id,
                required_skills=a.required_skills,
                required_roles=a.required_roles,
                question_set_id=a.question_set_id,
                assessment_method=a.assessment_method,
                duration_minutes=a.duration_minutes,
                is_questionnaire_enabled=a.is_questionnaire_enabled,
                is_interview_enabled=a.is_interview_enabled,
                is_active=a.is_active,
                is_published=a.is_published,
                is_expired=a.is_expired,
                expires_at=a.expires_at,
                created_at=a.created_at,
                updated_at=a.updated_at,
                # NEW: Experience-based question configuration fields
                total_questions=a.total_questions,
                question_type_mix=a.question_type_mix,
                passing_score_threshold=a.passing_score_threshold,
                auto_adjust_by_experience=a.auto_adjust_by_experience,
                difficulty_distribution=a.difficulty_distribution,
                generation_policy=a.generation_policy,
                # Session statistics
                total_sessions=total_sessions,
                completed_sessions=completed_sessions,
                in_progress_sessions=in_progress_sessions,
            )
        )
    
    if cache_service:
        cached_payload = [a.model_dump(mode="json") for a in assessment_responses]
        await cache_service.cache_set(cache_key, cached_payload, expiry=CACHE_TTL_SECONDS)

    return assessment_responses


@router.get("/with-questions", response_model=List[dict])
async def list_assessments_with_questions(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    show_all: bool = Query(False, description="Show all assessments including inactive/unpublished (admin only)"),
) -> List[dict]:
    """
    Admin-only: list assessments with their questions.
    Includes screening questions appended at the end.
    """
    await check_admin(current_user)

    cache_service = await _get_cache_service()
    cache_key = _with_questions_cache_key(show_all)
    if cache_service:
        cached = await cache_service.cache_get(cache_key)
        if cached:
            return cached

    query = select(Assessment)

    if not show_all:
        query = query.where(Assessment.is_active == True)

    query = query.order_by(desc(Assessment.created_at))

    result = await db.execute(query)
    assessments = result.scalars().all()

    payload: List[dict] = []

    for assessment in assessments:
        questions_payload: List[dict] = []

        if assessment.question_set_id:
            q_stmt = select(Question).where(
                Question.question_set_id == assessment.question_set_id
            )
            q_result = await db.execute(q_stmt)
            questions = q_result.scalars().all()
            questions_payload = [serialize_question(q) for q in questions]

        screening_questions = extract_screening_questions(assessment.description)
        for idx, sq in enumerate(screening_questions):
            questions_payload.append({
                "id": f"screening_{idx}",
                "question_type": "screening",
                "question_text": sq,
                "required": True,
            })

        payload.append({
            "assessment_id": assessment.assessment_id,
            "title": assessment.title,
            "job_title": assessment.job_title,
            "question_set_id": assessment.question_set_id,
            "is_active": assessment.is_active,
            "is_published": assessment.is_published,
            "total_questions": len(questions_payload),
            "questions": questions_payload,
        })

    if cache_service:
        await cache_service.cache_set(cache_key, payload, expiry=CACHE_TTL_SECONDS)

    return payload


@router.get("/{assessment_id}", response_model=dict)
async def get_assessment(
    assessment_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: Optional[User] = Depends(optional_auth),
) -> dict:
    """
    Get assessment details by ID with enriched data.
    """
    stmt = select(Assessment).where(Assessment.assessment_id == assessment_id)
    result = await db.execute(stmt)
    assessment = result.scalars().first()
    
    if not assessment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Assessment not found"
        )
    
    is_admin = False
    if current_user and hasattr(current_user, "email"):
        is_admin = is_admin_user(current_user.email)
    
    if not is_admin:
        if not assessment.is_published:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="This assessment is not available yet. Please contact the administrator."
            )
        
        if not assessment.is_active:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="This assessment is no longer active."
            )

    response = {
        "id": assessment.id,
        "assessment_id": assessment.assessment_id,
        "title": assessment.title,
        "description": assessment.description,
        "job_title": assessment.job_title,
        "jd_id": assessment.jd_id,
        "required_skills": assessment.required_skills,
        "required_roles": assessment.required_roles,
        "question_set_id": assessment.question_set_id,
        "assessment_method": assessment.assessment_method,
        "duration_minutes": assessment.duration_minutes,
        "is_questionnaire_enabled": assessment.is_questionnaire_enabled,
        "is_interview_enabled": assessment.is_interview_enabled,
        "is_active": assessment.is_active,
        "is_published": assessment.is_published,
        "is_expired": assessment.is_expired,
        "expires_at": assessment.expires_at,
        "created_at": assessment.created_at,
        "updated_at": assessment.updated_at,
        "generation_policy": assessment.generation_policy,
    }
    if assessment.jd_id:
        jd_stmt = select(JobDescription).where(JobDescription.jd_id == assessment.jd_id)
        jd_result = await db.execute(jd_stmt)
        jd = jd_result.scalars().first()
        
        if jd:
            from app.api.skills import extract_skills_from_text, extract_roles_from_text
            
            extracted_text = jd.extracted_text or jd.description or ""
            extracted_skills = extract_skills_from_text(extracted_text)
            extracted_roles = extract_roles_from_text(jd.title or "", extracted_text)
            
            response["extracted_skills"] = extracted_skills
            response["extracted_roles"] = extracted_roles
            response["jd_details"] = {
                "jd_id": jd.jd_id,
                "title": jd.title,
                "description": jd.description,
                "file_name": jd.file_name,
                "file_size": jd.file_size,
                "created_at": jd.created_at,
            }

    # --------------------------------------------------------
    # FETCH QUESTIONS FROM QUESTION SET
    # --------------------------------------------------------
    if assessment.question_set_id:
        q_stmt = select(Question).where(
            Question.question_set_id == assessment.question_set_id
        )
        q_result = await db.execute(q_stmt)
        questions = q_result.scalars().all()

        serialized_questions = [serialize_question(q) for q in questions]

        # --------------------------------------------------
        # Append screening questions LAST (non-scored)
        # --------------------------------------------------
        screening_questions = extract_screening_questions(
            assessment.description
        )

        for idx, sq in enumerate(screening_questions):
            serialized_questions.append({
                "id": f"screening_{idx}",
                "question_type": "screening",
                "question_text": sq,
                "required": True
            })

        response["total_questions"] = len(serialized_questions)
        response["questions"] = serialized_questions

        print("[DEBUG] Assessment Questions Payload")
        print(json.dumps(response["questions"], indent=2))

    # --------------------------------------------------------
    # INCLUDE GENERATED QUESTIONS for admin view
    # Show actual questions from question_set_id (what candidates will see)
    # --------------------------------------------------------
    if is_admin:
        if assessment.question_set_id:
            # Fetch questions from the assessment's question set
            gen_stmt = select(Question).where(Question.question_set_id == assessment.question_set_id)
            gen_result = await db.execute(gen_stmt)
            gen_questions = gen_result.scalars().all()
            
            # Include screening questions from description
            all_admin_questions = [serialize_question(q) for q in gen_questions]
            screening_questions = extract_screening_questions(assessment.description)
            for idx, sq in enumerate(screening_questions):
                all_admin_questions.append({
                    "id": f"screening_{idx}",
                    "question_type": "screening",
                    "question_text": sq,
                    "required": True
                })
            
            response["generated_questions"] = all_admin_questions

    return response
@router.post("", response_model=AssessmentResponse, status_code=status.HTTP_201_CREATED)
async def create_assessment(
    request: AssessmentCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> AssessmentResponse:
    """
    Create a new assessment (Admin only).
    """
    await check_admin(current_user)
    
    if request.jd_id:
        jd_stmt = select(JobDescription).where(JobDescription.jd_id == request.jd_id)
        jd_result = await db.execute(jd_stmt)
        if not jd_result.scalars().first():
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Job description {request.jd_id} not found"
            )
    
    candidate_db = None
    if request.candidate_info and request.candidate_info.email:
        cand_stmt = select(Candidate).where(Candidate.email == request.candidate_info.email)
        cand_result = await db.execute(cand_stmt)
        candidate_db = cand_result.scalars().first()
        
        experience_level = "mid"
        if request.candidate_info.experience:
            try:
                years = int(''.join(filter(str.isdigit, request.candidate_info.experience)) or 0)
                if years < 2:
                    experience_level = "junior"
                elif years < 5:
                    experience_level = "mid"
                elif years < 8:
                    experience_level = "senior"
                else:
                    experience_level = "lead"
            except:
                pass

        if candidate_db:
            if request.candidate_info.name:
                candidate_db.full_name = request.candidate_info.name
            if request.candidate_info.phone:
                candidate_db.phone = request.candidate_info.phone
            if request.candidate_info.current_role:
                candidate_db.current_role = request.candidate_info.current_role
            if request.candidate_info.location:
                candidate_db.location = request.candidate_info.location
            if request.candidate_info.education:
                candidate_db.education = request.candidate_info.education
            if request.candidate_info.linkedin:
                candidate_db.linkedin_url = request.candidate_info.linkedin
            if request.candidate_info.github:
                candidate_db.github_url = request.candidate_info.github
            if request.candidate_info.portfolio:
                candidate_db.portfolio_url = request.candidate_info.portfolio
            if request.candidate_info.experience:
                candidate_db.experience_years = request.candidate_info.experience
                candidate_db.experience_level = experience_level
        else:
            candidate_db = Candidate(
                full_name=request.candidate_info.name or "Unknown",
                email=request.candidate_info.email,
                phone=request.candidate_info.phone,
                current_role=request.candidate_info.current_role,
                location=request.candidate_info.location,
                education=request.candidate_info.education,
                linkedin_url=request.candidate_info.linkedin,
                github_url=request.candidate_info.github,
                portfolio_url=request.candidate_info.portfolio,
                experience_years=request.candidate_info.experience,
                experience_level=experience_level,
                skills=request.required_skills or {},
            )
            db.add(candidate_db)
            await db.flush()

    # ------------------------------------------------------
    # SAFETY CHECK: required_skills must not be empty
    # ------------------------------------------------------
    if not request.required_skills or len(request.required_skills) == 0:
        raise HTTPException(
            status_code=400,
            detail="Cannot generate assessment — no skills were extracted. Please extract skills first."
        )

    # ------------------------------------------------------
    # GENERATE QUESTION SET
    # ------------------------------------------------------
    question_set_id = await generate_assessment_question_set(
        request.required_skills,
        db,
        questionnaire_config=request.questionnaire_config
    )

    # ------------------------------------------------------
    # ✅ NEW: Add manual questions to the question set
    # ------------------------------------------------------
    if request.manual_questions and len(request.manual_questions) > 0:
        from app.db.models import Question
        
        for manual_q in request.manual_questions:
            # Skip empty questions
            if not manual_q.get('question_text', '').strip():
                continue
                
            new_question = Question(
                question_set_id=question_set_id,
                question_text=manual_q['question_text'],
                question_type=manual_q.get('type', 'mcq'),
                difficulty=manual_q.get('difficulty', 'medium'),
                topic=manual_q.get('skill', ''),
                options=manual_q.get('options', {}),
                correct_answer=manual_q.get('correct_answer', ''),
                code_template=manual_q.get('code_template'),
                constraints=manual_q.get('constraints'),
                test_cases=manual_q.get('test_cases'),
                time_limit_minutes=manual_q.get('time_limit', 30),
                source_type='manual',  # Mark as manually added
                quality_score=100,  # Manual questions are pre-approved
            )
            db.add(new_question)
        
        await db.flush()  # Save manual questions to database

    # --------------------------------------------
    # Store screening questions inside description
    # --------------------------------------------
    description_payload = {
        "text": request.description,
        "screening_questions": getattr(request, "screening_questions", []) or []
    }

    assessment = Assessment(
        title=request.title,
        description=json.dumps(description_payload),
        job_title=request.job_title,
        jd_id=request.jd_id,
        required_skills=request.required_skills or {},
        required_roles=request.required_roles or [],
        question_set_id=question_set_id,
        assessment_method="questionnaire" if request.is_questionnaire_enabled else "interview",
        duration_minutes=request.duration_minutes,
        is_questionnaire_enabled=request.is_questionnaire_enabled,
        is_interview_enabled=request.is_interview_enabled,
        is_published=True,
        expires_at=request.expires_at,
        created_by=current_user.id,
        generation_policy=request.generation_policy or {"mode": "rag", "rag_pct": 100, "llm_pct": 0},
    )
    
    db.add(assessment)
    await db.commit()
    await db.refresh(assessment)

    await _clear_assessment_cache()

    return AssessmentResponse(
    id=assessment.id,
    assessment_id=assessment.assessment_id,
    title=assessment.title,
    description=assessment.description,
    job_title=assessment.job_title,
    jd_id=assessment.jd_id,
    required_skills=assessment.required_skills,
    required_roles=assessment.required_roles,
    question_set_id=assessment.question_set_id,
    assessment_method=assessment.assessment_method,
    duration_minutes=assessment.duration_minutes,
    is_questionnaire_enabled=assessment.is_questionnaire_enabled,
    is_interview_enabled=assessment.is_interview_enabled,
    is_active=assessment.is_active,
    is_published=assessment.is_published,
    is_expired=assessment.is_expired,
    expires_at=assessment.expires_at,
    created_at=assessment.created_at,
    updated_at=assessment.updated_at,
    total_questions=assessment.total_questions,
    question_type_mix=assessment.question_type_mix,
    passing_score_threshold=assessment.passing_score_threshold,
    auto_adjust_by_experience=assessment.auto_adjust_by_experience,
    difficulty_distribution=assessment.difficulty_distribution,
    generation_policy=assessment.generation_policy,
)


@router.delete("/{assessment_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_assessment(
    assessment_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Delete assessment (Admin only). Soft delete by setting is_active to False."""
    await check_admin(current_user)
    
    stmt = select(Assessment).where(Assessment.assessment_id == assessment_id)
    result = await db.execute(stmt)
    assessment = result.scalars().first()
    
    if not assessment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Assessment not found"
        )
    
    assessment.is_active = False
    assessment.updated_at = datetime.utcnow()
    await db.commit()

    await _clear_assessment_cache()
    
    return None


@router.post("/{assessment_id}/publish", response_model=AssessmentResponse)
async def publish_assessment(
    assessment_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Publish or unpublish an assessment (Admin only). Toggles is_published status."""
    await check_admin(current_user)
    
    stmt = select(Assessment).where(Assessment.assessment_id == assessment_id)
    result = await db.execute(stmt)
    assessment = result.scalars().first()
    
    if not assessment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Assessment not found"
        )
    
    assessment.is_published = not assessment.is_published
    assessment.updated_at = datetime.utcnow()
    await db.commit()
    await db.refresh(assessment)

    await _clear_assessment_cache()
    
    return AssessmentResponse(
        id=assessment.id,
        assessment_id=assessment.assessment_id,
        title=assessment.title,
        description=assessment.description,
        job_title=assessment.job_title,
        jd_id=assessment.jd_id,
        required_skills=assessment.required_skills,
        required_roles=assessment.required_roles,
        question_set_id=assessment.question_set_id,
        assessment_method=assessment.assessment_method,
        duration_minutes=assessment.duration_minutes,
        is_questionnaire_enabled=assessment.is_questionnaire_enabled,
        is_interview_enabled=assessment.is_interview_enabled,
        is_active=assessment.is_active,
        is_published=assessment.is_published,
        is_expired=assessment.is_expired,
        expires_at=assessment.expires_at,
        created_at=assessment.created_at,
        updated_at=assessment.updated_at,
        total_questions=assessment.total_questions,
        question_type_mix=assessment.question_type_mix,
        passing_score_threshold=assessment.passing_score_threshold,
        auto_adjust_by_experience=assessment.auto_adjust_by_experience,
        difficulty_distribution=assessment.difficulty_distribution,
        generation_policy=assessment.generation_policy,
    )


@router.put("/{assessment_id}", response_model=AssessmentResponse)
async def update_assessment(
    assessment_id: str,
    request: AssessmentUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> AssessmentResponse:
    """Update assessment (Admin only)."""
    await check_admin(current_user)
    
    stmt = select(Assessment).where(Assessment.assessment_id == assessment_id)
    result = await db.execute(stmt)
    assessment = result.scalars().first()
    
    if not assessment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Assessment not found"
        )
    
    if request.title is not None:
        assessment.title = request.title
    if request.description is not None:
        assessment.description = request.description
    if request.job_title is not None:
        assessment.job_title = request.job_title
    if request.required_skills is not None:
        assessment.required_skills = request.required_skills
    if request.required_roles is not None:
        assessment.required_roles = request.required_roles
    if request.duration_minutes is not None:
        assessment.duration_minutes = request.duration_minutes
    if request.is_questionnaire_enabled is not None:
        assessment.is_questionnaire_enabled = request.is_questionnaire_enabled
    if request.is_interview_enabled is not None:
        assessment.is_interview_enabled = request.is_interview_enabled
    if request.is_active is not None:
        assessment.is_active = request.is_active
    if request.is_published is not None:
        assessment.is_published = request.is_published
    if request.expires_at is not None:
        assessment.expires_at = request.expires_at
    if request.total_questions is not None:
        assessment.total_questions = request.total_questions
    if request.question_type_mix is not None:
        assessment.question_type_mix = request.question_type_mix
    if request.passing_score_threshold is not None:
        assessment.passing_score_threshold = request.passing_score_threshold
    if request.auto_adjust_by_experience is not None:
        assessment.auto_adjust_by_experience = request.auto_adjust_by_experience
    if request.difficulty_distribution is not None:
        assessment.difficulty_distribution = request.difficulty_distribution
    if request.generation_policy is not None:
        assessment.generation_policy = request.generation_policy
    
    assessment.updated_at = datetime.utcnow()
    await db.commit()
    await db.refresh(assessment)

    await _clear_assessment_cache()
    
    return AssessmentResponse(
        id=assessment.id,
        assessment_id=assessment.assessment_id,
        title=assessment.title,
        description=assessment.description,
        job_title=assessment.job_title,
        jd_id=assessment.jd_id,
        required_skills=assessment.required_skills,
        required_roles=assessment.required_roles,
        question_set_id=assessment.question_set_id,
        assessment_method=assessment.assessment_method,
        duration_minutes=assessment.duration_minutes,
        is_questionnaire_enabled=assessment.is_questionnaire_enabled,
        is_interview_enabled=assessment.is_interview_enabled,
        is_active=assessment.is_active,
        is_published=assessment.is_published,
        is_expired=assessment.is_expired,
        expires_at=assessment.expires_at,
        created_at=assessment.created_at,
        updated_at=assessment.updated_at,
        total_questions=assessment.total_questions,
        question_type_mix=assessment.question_type_mix,
        passing_score_threshold=assessment.passing_score_threshold,
        auto_adjust_by_experience=assessment.auto_adjust_by_experience,
        difficulty_distribution=assessment.difficulty_distribution,
        generation_policy=assessment.generation_policy,
    )


@router.post("/{assessment_id}/apply", response_model=AssessmentApplicationResponse, status_code=status.HTTP_201_CREATED)
async def apply_for_assessment(
    assessment_id: str,
    candidate_id: str,
    request: AssessmentApplicationRequest,
    db: AsyncSession = Depends(get_db),
) -> AssessmentApplicationResponse:
    """
    Candidate applies for an assessment.
    """
    assess_stmt = select(Assessment).where(Assessment.assessment_id == assessment_id)
    assess_result = await db.execute(assess_stmt)
    assessment = assess_result.scalars().first()
    
    if not assessment or not assessment.is_published:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Assessment not found or not published"
        )
    
    cand_stmt = select(Candidate).where(Candidate.candidate_id == candidate_id)
    cand_result = await db.execute(cand_stmt)
    candidate = cand_result.scalars().first()
    
    if not candidate:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Candidate not found"
        )
    
    exist_stmt = select(AssessmentApplication).where(
        (AssessmentApplication.candidate_id == candidate.id) &
        (AssessmentApplication.assessment_id == assessment.id)
    )
    exist_result = await db.execute(exist_stmt)
    if exist_result.scalars().first():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Candidate has already applied for this assessment"
        )
    
    application = AssessmentApplication(
        candidate_id=candidate.id,
        assessment_id=assessment.id,
        status="pending",
        applied_at=datetime.utcnow(),
        candidate_availability=min(100, max(0, request.candidate_availability)),
        submitted_skills=request.submitted_skills,
        role_applied_for=request.role_applied_for,
    )
    
    db.add(application)
    await db.commit()
    await db.refresh(application)
    
    return AssessmentApplicationResponse(
        id=application.id,
        application_id=application.application_id,
        candidate_id=application.candidate_id,
        assessment_id=application.assessment_id,
        status=application.status,
        candidate_availability=application.candidate_availability,
        submitted_skills=application.submitted_skills,
        role_applied_for=request.role_applied_for,
        applied_at=application.applied_at,
        started_at=application.started_at,
        completed_at=application.completed_at,
        created_at=application.created_at,
        updated_at=application.updated_at,
    )


@router.get("/{assessment_id}/applications", response_model=List[AssessmentApplicationResponse])
async def list_assessment_applications(
    assessment_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    status: Optional[str] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(10, ge=1, le=100),
) -> List[AssessmentApplicationResponse]:
    """
    List all applications for an assessment (Admin only).
    """
    await check_admin(current_user)
    
    query = select(AssessmentApplication).where(
        AssessmentApplication.assessment_id == assessment_id
    )
    
    if status:
        query = query.where(AssessmentApplication.status == status)
    
    query = query.order_by(desc(AssessmentApplication.applied_at))
    query = query.offset(skip).limit(limit)
    
    result = await db.execute(query)
    applications = result.scalars().all()
    
    return [
        AssessmentApplicationResponse(
            id=app.id,
            application_id=app.application_id,
            candidate_id=app.candidate_id,
            assessment_id=app.assessment_id,
            status=app.status,
            candidate_availability=app.candidate_availability,
            submitted_skills=app.submitted_skills,
            role_applied_for=app.role_applied_for,
            applied_at=app.applied_at,
            started_at=app.started_at,
            completed_at=app.completed_at,
            created_at=app.created_at,
            updated_at=app.updated_at,
        )
        for app in applications
    ]


@router.post("/{assessment_id}/screening-responses", response_model=ScreeningResponseResponse, status_code=status.HTTP_201_CREATED)
async def submit_screening_responses(
    assessment_id: str,
    request: ScreeningResponseCreate,
    db: AsyncSession = Depends(get_db),
    current_user: Optional[User] = Depends(optional_auth),
) -> ScreeningResponseResponse:
    """Submit mandatory screening answers for an assessment (candidate or anonymous)."""
    stmt = select(Assessment).where(Assessment.assessment_id == assessment_id)
    result = await db.execute(stmt)
    assessment = result.scalars().first()

    if not assessment:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Assessment not found")

    # Do not allow submissions for unpublished/inactive assessments for non-admins
    is_admin = False
    if current_user and hasattr(current_user, "email"):
        from app.core.security import is_admin_user
        is_admin = is_admin_user(current_user.email)

    if not is_admin:
        if not assessment.is_published:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="This assessment is not available yet. Please contact the administrator.")
        if not assessment.is_active:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="This assessment is no longer active.")

    screening = ScreeningResponse(
        assessment_id=assessment.id,
        candidate_session_id=request.candidate_session_id,
        candidate_id=None,
        answers={"answers": request.answers},
    )

    db.add(screening)
    await db.commit()
    await db.refresh(screening)

    return ScreeningResponseResponse(
        id=screening.id,
        screening_id=screening.screening_id,
        assessment_id=screening.assessment_id,
        candidate_session_id=screening.candidate_session_id,
        candidate_id=screening.candidate_id,
        answers=screening.answers,
        created_at=screening.created_at,
        updated_at=screening.updated_at,
    )
