from fastapi import APIRouter, Body, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from datetime import datetime
from sqlalchemy import select

from app.db.session import get_db
from app.db.models import (
    OnboardingModule,
    OnboardingModuleCandidateChecklist,
    Candidate,
)
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
    ActionChecklistItemResponse,
    CandidateChecklistResponse,
    CertificateResponse,
    CertificateDataResponse,
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
    get_action_checklist,
    save_candidate_checklist,
    generate_certificate,
    get_certificate_data,
)


router = APIRouter(
    prefix="/onboarding-modules",
    tags=["Onboarding Modules"],
)


async def resolve_candidate_id(db: AsyncSession, candidate_id: str) -> int:
    """Resolve a public candidate_id string (e.g. 'cand_afe15b366e4a') to the integer candidates.id."""
    result = await db.execute(
        select(Candidate.id).where(Candidate.candidate_id == candidate_id)
    )
    internal_id = result.scalar_one_or_none()
    if internal_id is None:
        raise HTTPException(404, "Candidate not found")
    return internal_id


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
    candidate_id: str = Query(..., description="Candidate ID"),
    db: AsyncSession = Depends(get_db),
):
    """Get all onboarding modules and their progress for a candidate."""
    internal_candidate_id = await resolve_candidate_id(db, candidate_id)
    modules = await get_employee_modules(db, internal_candidate_id)
    return modules


@router.get(
    "/employee-progress-summary",
    response_model=EmployeeOnboardingProgressSummaryResponse,
)
async def get_employee_progress_summary(
    candidate_id: str = Query(..., description="Candidate ID"),
    db: AsyncSession = Depends(get_db),
):
    """Get aggregated onboarding stats and module list for the candidate dashboard."""
    internal_candidate_id = await resolve_candidate_id(db, candidate_id)
    return await get_employee_onboarding_progress_summary(db, internal_candidate_id)


@router.get(
    "/employee-modules/{module_id}",
    response_model=EmployeeModuleProgressDetailResponse,
)
async def get_employee_module_detail(
    module_id: int,
    candidate_id: str = Query(..., description="Candidate ID"),
    db: AsyncSession = Depends(get_db),
):
    """Get detailed progress for a specific module including video and quiz data."""
    internal_candidate_id = await resolve_candidate_id(db, candidate_id)
    progress = await get_employee_module_progress(db, internal_candidate_id, module_id)
    
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
    candidate_id: str = Query(..., description="Candidate ID"),
    db: AsyncSession = Depends(get_db),
):
    """Update video progress for an employee module."""
    internal_candidate_id = await resolve_candidate_id(db, candidate_id)
    progress = await get_employee_module_progress(db, internal_candidate_id, module_id)
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
    candidate_id: str = Query(..., description="Candidate ID"),
    db: AsyncSession = Depends(get_db),
):
    """Get full module detail including video, key concepts, and quiz questions."""
    internal_candidate_id = await resolve_candidate_id(db, candidate_id)
    data = await get_module_detail(db, internal_candidate_id, module_id)
    
    if not data:
        raise HTTPException(404, "Module not found")
    
    return data


@router.post(
    "/module-detail/{module_id}/submit-quiz",
    response_model=QuizSubmitResponse,
)
async def submit_module_quiz(
    module_id: int,
    candidate_id: str = Query(..., description="Candidate ID"),
    answers: list[dict] = Body(..., description="List of answers with question_id and answer"),
    db: AsyncSession = Depends(get_db),
):
    """Submit quiz answers, grade against correct answers, and return result."""
    internal_candidate_id = await resolve_candidate_id(db, candidate_id)
    result = await submit_quiz_attempt(db, internal_candidate_id, module_id, answers)
    
    if not result:
        raise HTTPException(404, "Module not found")
    
    return result


@router.get(
    "/module-detail/{module_id}/action-checklist",
    response_model=CandidateChecklistResponse,
)
async def read_action_checklist(
    module_id: int,
    candidate_id: str = Query(..., description="Candidate ID"),
    db: AsyncSession = Depends(get_db),
):
    """Get action checklist for a module."""
    internal_candidate_id = await resolve_candidate_id(db, candidate_id)
    module = await db.get(OnboardingModule, module_id)
    if not module:
        raise HTTPException(404, "Module not found")

    items = await get_action_checklist(db, module_id)

    checklist_result = await db.execute(
        select(OnboardingModuleCandidateChecklist).where(
            OnboardingModuleCandidateChecklist.candidate_id == internal_candidate_id,
            OnboardingModuleCandidateChecklist.module_id == module_id,
        )
    )
    checklist = checklist_result.scalar_one_or_none()

    completed_item_ids = []
    if checklist and checklist.completed_item_ids:
        completed_item_ids = [int(i) for i in checklist.completed_item_ids.split(",") if i.isdigit()]

    return {
        "id": checklist.id if checklist else 0,
        "candidate_id": internal_candidate_id,
        "module_id": module_id,
        "completed_item_ids": checklist.completed_item_ids if checklist else None,
        "all_completed": checklist.all_completed if checklist else False,
        "certificate_generated": checklist.certificate_generated if checklist else False,
        "certificate_generated_date": checklist.certificate_generated_date if checklist else None,
        "completed_date": checklist.completed_date if checklist else None,
        "items": [
            {
                "id": item.id,
                "module_id": item.module_id,
                "item_text": item.item_text,
                "display_order": item.display_order,
                "is_active": item.is_active,
            }
            for item in items
        ],
    }


@router.post(
    "/module-detail/{module_id}/action-checklist",
    response_model=CandidateChecklistResponse,
)
async def save_action_checklist(
    module_id: int,
    candidate_id: str = Query(..., description="Candidate ID"),
    completed_item_ids: list[int] = Body(..., description="List of checked item IDs"),
    db: AsyncSession = Depends(get_db),
):
    """Save candidate checklist progress."""
    internal_candidate_id = await resolve_candidate_id(db, candidate_id)
    result = await save_candidate_checklist(db, internal_candidate_id, module_id, completed_item_ids)
    
    if not result:
        raise HTTPException(404, "Module not found")
    
    return result


@router.post(
    "/module-detail/{module_id}/generate-certificate",
    response_model=CertificateResponse,
)
async def issue_certificate(
    module_id: int,
    candidate_id: str = Query(..., description="Candidate ID"),
    db: AsyncSession = Depends(get_db),
):
    """Generate certificate for candidate."""
    internal_candidate_id = await resolve_candidate_id(db, candidate_id)
    result = await generate_certificate(db, internal_candidate_id, module_id)
    
    if not result:
        raise HTTPException(400, "Checklist not completed or certificate already generated")
    
    return result


@router.get(
    "/certificate/{candidate_id}",
    response_model=CertificateDataResponse,
)
async def get_certificate(
    candidate_id: str,
    module_id: int = Query(..., description="Module ID for certificate context"),
    db: AsyncSession = Depends(get_db),
):
    """Get certificate data including candidate name and all module scores."""
    internal_candidate_id = await resolve_candidate_id(db, candidate_id)
    result = await get_certificate_data(db, internal_candidate_id, module_id)
    
    if not result:
        raise HTTPException(404, "Certificate not found")
    
    return result