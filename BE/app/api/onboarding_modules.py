from fastapi import APIRouter, Body, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from datetime import datetime

from app.db.session import get_db
from app.db.models import OnboardingModule
from app.models.schemas import (
    OnboardingModuleDetailResponse,
    OnboardingModuleResponse,
    OnboardingModuleQuizResponse,
    OnboardingModuleKeyConceptResponse,
    EmployeeModuleProgressResponse,
    EmployeeModuleProgressDetailResponse,
    EmployeeModuleVideoProgressResponse,
    EmployeeQuizAttemptResponse,
    EmployeeOnboardingProgressSummaryResponse,
    ModuleDetailResponse,
    QuizSubmitResponse,
    VideoProgressUpdateRequest,
    VideoProgressResponse,
)
from app.services.onboarding_module_service import (
    get_onboarding_modules,
    get_onboarding_module_quiz,
    get_onboarding_module_key_concepts,
    get_employee_modules,
    get_employee_module_progress,
    get_employee_video_progress,
    get_employee_quiz_attempts,
    get_quiz_attempt_responses,
    get_employee_onboarding_progress_summary,
    get_module_detail,
    submit_quiz_attempt,
    update_employee_video_progress,
    update_employee_module_progress_status,
)


router = APIRouter(
    prefix="/onboarding-modules",
    tags=["Onboarding Modules"],
)


@router.get(
    "/onboarding-modules",
    response_model=list[OnboardingModuleResponse],
)
async def list_modules(
    db: AsyncSession = Depends(get_db),
):
    return await get_onboarding_modules(db)


@router.get(
    "/onboarding-module-quiz/{module_id}",
    response_model=list[OnboardingModuleQuizResponse],
)
async def onboarding_module_quiz(
    module_id: int,
    db: AsyncSession = Depends(get_db),
):
    module = await get_onboarding_module_quiz(db, module_id)

    if not module:
        raise HTTPException(404, "Module quiz not found")

    return module


@router.get(
    "/onboarding-module-keyconcepts/{module_id}",
    response_model=list[OnboardingModuleKeyConceptResponse],
)
async def onboarding_module_key_concepts(
    module_id: int,
    db: AsyncSession = Depends(get_db),
):
    module = await get_onboarding_module_key_concepts(db, module_id)

    if not module:
        raise HTTPException(404, "Module quiz not found")

    return module


# Employee Onboarding Module Tracking Endpoints

@router.get(
    "/employee-modules",
    response_model=list[EmployeeModuleProgressResponse],
)
async def list_employee_modules(
    candidate_id: int = Query(..., description="Candidate ID"),
    db: AsyncSession = Depends(get_db),
):
    """Get all onboarding modules and their progress for a candidate."""
    modules = await get_employee_modules(db, candidate_id)
    return modules


@router.get(
    "/employee-progress-summary",
    response_model=EmployeeOnboardingProgressSummaryResponse,
)
async def get_employee_progress_summary(
    candidate_id: int = Query(..., description="Candidate ID"),
    db: AsyncSession = Depends(get_db),
):
    """Get aggregated onboarding stats and module list for the candidate dashboard."""
    return await get_employee_onboarding_progress_summary(db, candidate_id)


@router.get(
    "/employee-modules/{module_id}",
    response_model=EmployeeModuleProgressDetailResponse,
)
async def get_employee_module_detail(
    module_id: int,
    candidate_id: int = Query(..., description="Candidate ID"),
    db: AsyncSession = Depends(get_db),
):
    """Get detailed progress for a specific module including video and quiz data."""
    progress = await get_employee_module_progress(db, candidate_id, module_id)
    
    if not progress:
        raise HTTPException(404, "Module progress not found")
    
    # Get module info
    module = await db.get(OnboardingModule, module_id)
    
    # Get video progress
    video_progress = await get_employee_video_progress(db, progress.id)
    
    # Get quiz attempts
    quiz_attempts = await get_employee_quiz_attempts(db, progress.id)
    
    # Enrich quiz attempts with responses
    for attempt in quiz_attempts:
        responses = await get_quiz_attempt_responses(db, attempt.id)
        attempt.responses = responses
    
    return {
        "id": progress.id,
        "candidate_id": progress.candidate_id,
        "module_id": progress.module_id,
        "status": progress.status,
        "started_date": progress.started_date,
        "video_completed_date": progress.video_completed_date,
        "completed_date": progress.completed_date,
        "module": module,
        "video_progress": video_progress,
        "quiz_attempts": quiz_attempts,
    }


@router.get(
    "/employee-module-video-progress/{employee_progress_id}",
    response_model=EmployeeModuleVideoProgressResponse,
)
async def get_module_video_progress(
    employee_progress_id: int,
    db: AsyncSession = Depends(get_db),
):
    """Get video progress for an employee module."""
    video_progress = await get_employee_video_progress(db, employee_progress_id)
    
    if not video_progress:
        raise HTTPException(404, "Video progress not found")
    
    return video_progress


@router.get(
    "/employee-module-quiz-attempts/{employee_progress_id}",
    response_model=list[EmployeeQuizAttemptResponse],
)
async def get_module_quiz_attempts(
    employee_progress_id: int,
    db: AsyncSession = Depends(get_db),
):
    """Get all quiz attempts for an employee module."""
    quiz_attempts = await get_employee_quiz_attempts(db, employee_progress_id)
    
    # Enrich quiz attempts with responses
    for attempt in quiz_attempts:
        responses = await get_quiz_attempt_responses(db, attempt.id)
        attempt.responses = responses
    
    return quiz_attempts


@router.patch(
    "/module-detail/{module_id}/video-progress",
    response_model=VideoProgressResponse,
)
async def update_module_video_progress(
    module_id: int,
    payload: VideoProgressUpdateRequest,
    candidate_id: int = Query(..., description="Candidate ID"),
    db: AsyncSession = Depends(get_db),
):
    """Update video progress for an employee module."""
    progress = await get_employee_module_progress(db, candidate_id, module_id)
    if not progress:
        raise HTTPException(404, "Employee progress not found")

    video_progress = await update_employee_video_progress(
        db,
        progress.id,
        "",
        payload.current_duration_seconds,
        payload.total_duration_seconds,
        payload.completion_percentage,
        payload.is_completed,
    )

    if payload.is_completed:
        await update_employee_module_progress_status(
            db,
            progress.id,
            "VIDEO_COMPLETED",
            video_completed_date=datetime.utcnow(),
        )

    return video_progress


@router.get(
    "/module-detail/{module_id}",
    response_model=ModuleDetailResponse,
)
async def read_module_detail(
    module_id: int,
    candidate_id: int = Query(..., description="Candidate ID"),
    db: AsyncSession = Depends(get_db),
):
    """Get full module detail including video, key concepts, and quiz questions."""
    data = await get_module_detail(db, candidate_id, module_id)
    
    if not data:
        raise HTTPException(404, "Module not found")
    
    return data


@router.post(
    "/module-detail/{module_id}/submit-quiz",
    response_model=QuizSubmitResponse,
)
async def submit_module_quiz(
    module_id: int,
    candidate_id: int = Query(..., description="Candidate ID"),
    answers: list[dict] = Body(..., description="List of answers with question_id and answer"),
    db: AsyncSession = Depends(get_db),
):
    """Submit quiz answers, grade against correct answers, and return result."""
    result = await submit_quiz_attempt(db, candidate_id, module_id, answers)
    
    if not result:
        raise HTTPException(404, "Module not found")
    
    return result