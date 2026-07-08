from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.db.models import (
    OnboardingModule,
    OnboardingModuleQuiz,
    OnboardingModuleKeyConcept,
    OnboardingModuleEmployeeProgress,
    OnboardingModuleVideoProgress,
    OnboardingModuleQuizAttempt,
    OnboardingModuleQuizResponseModel,
)


async def get_onboarding_modules(db: AsyncSession):
    result = await db.execute(
        select(OnboardingModule)
        .order_by(OnboardingModule.rank)
    )

    return result.scalars().all()


async def get_onboarding_module_quiz(
    db: AsyncSession,
    module_id: int,
):
    result = await db.execute(
        select(OnboardingModuleQuiz)
        .where(
            OnboardingModuleQuiz.module_id == module_id,
            OnboardingModuleQuiz.deleted_date.is_(None),
        )
        .order_by(OnboardingModuleQuiz.display_order)
    )

    return result.scalars().all()


async def get_onboarding_module_key_concepts(
    db: AsyncSession,
    module_id: int,
):
    result = await db.execute(
        select(OnboardingModuleKeyConcept)
        .where(OnboardingModuleKeyConcept.module_id == module_id)
        .order_by(OnboardingModuleKeyConcept.display_order)
    )

    return result.scalars().all()


async def get_employee_modules(
    db: AsyncSession,
    candidate_id: int,
):
    """Get all onboarding modules for an employee with their progress."""
    
    result = await db.execute(
        select(OnboardingModuleEmployeeProgress)
        .where(OnboardingModuleEmployeeProgress.candidate_id == candidate_id)
        .order_by(OnboardingModuleEmployeeProgress.module_id)
    )
    
    return result.scalars().all()


async def get_employee_module_progress(
    db: AsyncSession,
    candidate_id: int,
    module_id: int,
):
    """Get employee progress for a specific module."""
    
    result = await db.execute(
        select(OnboardingModuleEmployeeProgress)
        .where(
            OnboardingModuleEmployeeProgress.candidate_id == candidate_id,
            OnboardingModuleEmployeeProgress.module_id == module_id,
        )
    )
    
    return result.scalar_one_or_none()


async def get_employee_video_progress(
    db: AsyncSession,
    employee_progress_id: int,
):
    """Get video progress for an employee module."""
    
    result = await db.execute(
        select(OnboardingModuleVideoProgress)
        .where(OnboardingModuleVideoProgress.employee_progress_id == employee_progress_id)
    )
    
    return result.scalar_one_or_none()


async def get_employee_quiz_attempts(
    db: AsyncSession,
    employee_progress_id: int,
):
    """Get all quiz attempts for an employee module."""
    
    result = await db.execute(
        select(OnboardingModuleQuizAttempt)
        .where(OnboardingModuleQuizAttempt.employee_progress_id == employee_progress_id)
        .order_by(OnboardingModuleQuizAttempt.attempted_date.desc())
    )
    
    return result.scalars().all()


async def get_quiz_attempt_responses(
    db: AsyncSession,
    quiz_attempt_id: int,
):
    """Get all question responses for a quiz attempt."""
    
    result = await db.execute(
        select(OnboardingModuleQuizResponseModel)
        .where(OnboardingModuleQuizResponseModel.quiz_attempt_id == quiz_attempt_id)
    )
    
    return result.scalars().all()