from datetime import datetime
from typing import Optional
import asyncio
import json
import re

from sqlalchemy import select, func
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
    OnboardingModuleActionItem,
    OnboardingModuleCandidateChecklist,
    QuestionType,
)
from app.utils.generate_questions import _get_llm


SCENARIO_PASSING_SCORE = 80


def _parse_json_object(content: str) -> dict:
    cleaned = str(content or "").strip()
    cleaned = re.sub(r"^```(?:json)?\s*|\s*```$", "", cleaned, flags=re.IGNORECASE | re.DOTALL).strip()

    try:
        parsed = json.loads(cleaned)
    except Exception:
        start = cleaned.find("{")
        end = cleaned.rfind("}")
        if start == -1 or end == -1 or end < start:
            raise
        parsed = json.loads(cleaned[start:end + 1])

    if not isinstance(parsed, dict):
        raise ValueError("LLM output must be a JSON object")
    return parsed


def _format_key_concepts_for_prompt(key_concepts: list[OnboardingModuleKeyConcept]) -> str:
    if not key_concepts:
        return "No key concepts were provided for this module."

    return "\n".join(
        f"- {concept.title}: {concept.description or ''}".strip()
        for concept in key_concepts
    )


async def _evaluate_scenario_answer_with_llm(
    question_text: str,
    candidate_answer: str,
    key_concepts: list[OnboardingModuleKeyConcept],
) -> int:
    prompt = f"""
You are evaluating a candidate's answer to an onboarding scenario question.

Grade only against the provided module key concepts and the question. Award a score from 0 to 100.

Scoring guidance:
- 90-100: Complete, practical, and aligned with the key concepts.
- 80-89: Mostly correct with only minor omissions.
- 60-79: Partially correct but missing important details or judgment.
- 1-59: Weak, vague, risky, or mostly misaligned.
- 0: Empty, irrelevant, or unsafe answer.

Return ONLY valid JSON in this exact shape:
{{"score": 0}}

Module key concepts:
{_format_key_concepts_for_prompt(key_concepts)}

Question:
{question_text}

Candidate answer:
{candidate_answer}
""".strip()

    llm = _get_llm()
    response = await asyncio.to_thread(
        llm.invoke,
        [
            {"role": "system", "content": "You are a strict, fair onboarding quiz evaluator."},
            {"role": "user", "content": prompt},
        ],
    )
    content = response.content if hasattr(response, "content") else str(response)
    parsed = _parse_json_object(content)
    score = int(round(float(parsed.get("score", 0))))
    return max(0, min(100, score))


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


async def update_employee_video_progress(
    db: AsyncSession,
    employee_progress_id: int,
    video_url: str,
    current_duration_seconds: int,
    total_duration_seconds: int,
    completion_percentage: float,
    is_completed: bool,
):
    """Create or update video progress for an employee module."""

    result = await db.execute(
        select(OnboardingModuleVideoProgress).where(
            OnboardingModuleVideoProgress.employee_progress_id == employee_progress_id
        )
    )
    video_progress = result.scalar_one_or_none()

    if video_progress:
        if video_url:
            video_progress.video_url = video_url
        video_progress.current_duration_seconds = current_duration_seconds
        video_progress.total_duration_seconds = total_duration_seconds
        video_progress.completion_percentage = completion_percentage
        video_progress.is_completed = is_completed
        if is_completed and not video_progress.completed_date:
            video_progress.completed_date = func.now()
    else:
        final_video_url = video_url or "https://puneetbanga15.github.io/bcg-onboarding/videos/unknown.mp4"
        video_progress = OnboardingModuleVideoProgress(
            employee_progress_id=employee_progress_id,
            video_url=final_video_url,
            current_duration_seconds=current_duration_seconds,
            total_duration_seconds=total_duration_seconds,
            completion_percentage=completion_percentage,
            is_completed=is_completed,
            completed_date=func.now() if is_completed else None,
        )
        db.add(video_progress)

    await db.flush()
    await db.refresh(video_progress)
    return {
        "id": video_progress.id,
        "employee_progress_id": video_progress.employee_progress_id,
        "video_url": video_progress.video_url,
        "current_duration_seconds": video_progress.current_duration_seconds,
        "total_duration_seconds": video_progress.total_duration_seconds,
        "completion_percentage": float(video_progress.completion_percentage),
        "is_completed": video_progress.is_completed,
        "completed_date": video_progress.completed_date,
        "created_date": video_progress.created_date,
        "modified_date": video_progress.modified_date,
    }


async def update_employee_module_progress_status(
    db: AsyncSession,
    employee_progress_id: int,
    status: str,
    video_completed_date: Optional[datetime] = None,
    completed_date: Optional[datetime] = None,
):
    """Update employee module progress status."""

    result = await db.execute(
        select(OnboardingModuleEmployeeProgress).where(
            OnboardingModuleEmployeeProgress.id == employee_progress_id
        )
    )
    progress = result.scalar_one_or_none()
    if not progress:
        return None

    progress.status = status
    if video_completed_date:
        progress.video_completed_date = video_completed_date
    if completed_date:
        progress.completed_date = completed_date

    await db.flush()
    await db.refresh(progress)
    return {
        "id": progress.id,
        "candidate_id": progress.candidate_id,
        "module_id": progress.module_id,
        "status": progress.status,
        "started_date": progress.started_date,
        "video_completed_date": progress.video_completed_date,
        "completed_date": progress.completed_date,
    }


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


async def get_employee_onboarding_progress_summary(db: AsyncSession, candidate_id: int):
    """Get aggregated onboarding progress stats and module list for a candidate."""
    
    total_modules_result = await db.execute(
        select(func.count(OnboardingModule.id))
        .where(OnboardingModule.deleted_date.is_(None))
    )
    total_modules = total_modules_result.scalar_one() or 0

    stmt = (
        select(
            OnboardingModule.id,
            OnboardingModule.title,
            OnboardingModule.description,
            OnboardingModule.rank,
            OnboardingModule.passing_criteria,
            OnboardingModuleEmployeeProgress.status,
            OnboardingModuleEmployeeProgress.started_date,
            OnboardingModuleEmployeeProgress.video_completed_date,
            OnboardingModuleEmployeeProgress.completed_date,
        )
        .join(
            OnboardingModuleEmployeeProgress,
            (OnboardingModule.id == OnboardingModuleEmployeeProgress.module_id)
            & (OnboardingModuleEmployeeProgress.candidate_id == candidate_id),
            isouter=True,
        )
        .where(OnboardingModule.deleted_date.is_(None))
        .order_by(OnboardingModule.rank)
    )

    result = await db.execute(stmt)
    rows = result.all()

    modules = []
    completed_modules = 0
    for index, row in enumerate(rows):
        status = row.status or "LOCKED"
        previous_status = rows[index - 1].status if index > 0 else None
        is_unlocked = index == 0 or (previous_status or "LOCKED") == "COMPLETED"
        modules.append({
            "module_id": row.id,
            "title": row.title,
            "description": row.description,
            "rank": row.rank,
            "passing_criteria": float(row.passing_criteria),
            "status": status,
            "is_unlocked": is_unlocked,
            "started_date": row.started_date,
            "video_completed_date": row.video_completed_date,
            "completed_date": row.completed_date,
        })
        if status == "COMPLETED":
            completed_modules += 1

    remaining_modules = total_modules - completed_modules
    overall_progress_percentage = round(
        (completed_modules / total_modules) * 100, 2
    ) if total_modules > 0 else 0.0

    return {
        "total_modules": total_modules,
        "completed_modules": completed_modules,
        "remaining_modules": remaining_modules,
        "overall_progress_percentage": overall_progress_percentage,
        "modules": modules,
    }


VIDEO_URL_MAP = {
    "Welcome & Project Overview": "https://puneetbanga15.github.io/bcg-onboarding/videos/step1.mp4",
    "Who's Who & Org Structure": "https://puneetbanga15.github.io/bcg-onboarding/videos/step2.mp4",
    "Ways of Working & Tools": "https://puneetbanga15.github.io/bcg-onboarding/videos/step3.mp4",
    "Compliance, Security & Assets": "https://puneetbanga15.github.io/bcg-onboarding/videos/step4.mp4",
    "Leave, Reimbursements & Essentials": "https://puneetbanga15.github.io/bcg-onboarding/videos/step5.mp4",
    "Action Checklist": "https://puneetbanga15.github.io/bcg-onboarding/videos/step6.mp4",
}


async def get_module_detail(db: AsyncSession, candidate_id: int, module_id: int):
    """Get full detail for a module including video, key concepts, and quiz."""

    module = await db.get(OnboardingModule, module_id)
    if not module:
        return None

    progress = await get_employee_module_progress(db, candidate_id, module.id)
    if not progress:
        progress = OnboardingModuleEmployeeProgress(
            candidate_id=candidate_id,
            module_id=module.id,
            status="NOT_STARTED",
        )
        db.add(progress)
        await db.flush()

    video_progress = await get_employee_video_progress(db, progress.id)
    video_url = video_progress.video_url if video_progress else None

    if not video_progress:
        video_url = VIDEO_URL_MAP.get(module.title)
        if video_url:
            video_progress = OnboardingModuleVideoProgress(
                employee_progress_id=progress.id,
                video_url=video_url,
                current_duration_seconds=0,
                total_duration_seconds=0,
                completion_percentage=0.0,
                is_completed=False,
                completed_date=None,
            )
            db.add(video_progress)
            await db.flush()

    key_concepts = await get_onboarding_module_key_concepts(db, module.id)
    quiz_questions = await get_onboarding_module_quiz(db, module.id)

    quiz_attempts = []
    attempts = await get_employee_quiz_attempts(db, progress.id)
    for attempt in attempts:
        responses = await get_quiz_attempt_responses(db, attempt.id)
        attempt.responses = responses
        quiz_attempts.append(attempt)

    return {
        "module": module,
        "video_url": video_url,
        "video_completed": progress.video_completed_date is not None,
        "key_concepts": key_concepts,
        "quiz_questions": quiz_questions,
        "quiz_attempts": quiz_attempts,
    }


async def submit_quiz_attempt(db: AsyncSession, candidate_id: int, module_id: int, answers: list[dict]):
    """Grade a submitted quiz and save attempt + responses."""

    module = await db.get(OnboardingModule, module_id)
    if not module:
        return None

    progress = await get_employee_module_progress(db, candidate_id, module_id)
    if not progress:
        progress = OnboardingModuleEmployeeProgress(
            candidate_id=candidate_id,
            module_id=module_id,
            status="QUIZ_IN_PROGRESS",
        )
        db.add(progress)
        await db.flush()

    quiz_questions = await get_onboarding_module_quiz(db, module_id)
    questions_by_id = {q.id: q for q in quiz_questions}
    key_concepts = await get_onboarding_module_key_concepts(db, module_id)

    last_attempt = await get_employee_quiz_attempts(db, progress.id)
    attempt_number = (last_attempt[0].attempt_number + 1) if last_attempt else 1

    quiz_attempt = OnboardingModuleQuizAttempt(
        employee_progress_id=progress.id,
        quiz_id=None,
        attempt_number=attempt_number,
        time_spent_seconds=None,
    )
    db.add(quiz_attempt)
    await db.flush()

    response_models = []
    response_results = []
    correct_count = 0
    for answer in answers:
        question = questions_by_id.get(answer["question_id"])
        correct_answer = question.correct_answer if question else None
        candidate_answer = answer.get("answer")
        llm_score = None
        is_correct = False
        if question and question.question_type == QuestionType.SCENARIO:
            if candidate_answer:
                llm_score = await _evaluate_scenario_answer_with_llm(
                    question_text=question.question_text,
                    candidate_answer=str(candidate_answer),
                    key_concepts=key_concepts,
                )
                is_correct = llm_score >= SCENARIO_PASSING_SCORE
        elif correct_answer is not None and candidate_answer is not None:
            is_correct = str(candidate_answer).strip().lower() == str(correct_answer).strip().lower()

        if is_correct:
            correct_count += 1

        response_model = OnboardingModuleQuizResponseModel(
            quiz_attempt_id=quiz_attempt.id,
            question_id=answer["question_id"],
            question_text=question.question_text if question else None,
            employee_answer=candidate_answer,
            correct_answer=correct_answer,
            is_correct=is_correct,
        )
        response_models.append(response_model)
        response_results.append({
            "model": response_model,
            "llm_score": llm_score,
        })

    db.add_all(response_models)
    await db.flush()

    total_questions = len(quiz_questions) or len(answers)
    score = round((correct_count / total_questions) * 100, 2) if total_questions > 0 else 0.0
    passing_status = "PASS" if score >= float(module.passing_criteria) else "FAIL"

    quiz_attempt.score = score
    quiz_attempt.passing_status = passing_status
    await db.flush()

    if passing_status == "PASS":
        progress.status = "COMPLETED"
        progress.completed_date = func.now()
        await db.flush()

    return {
        "attempt_id": quiz_attempt.id,
        "module_id": module.id,
        "attempt_number": attempt_number,
        "total_questions": total_questions,
        "correct_answers": correct_count,
        "score": score,
        "passing_status": passing_status,
        "passing_criteria": float(module.passing_criteria),
        "responses": [
            {
                "question_id": item["model"].question_id,
                "question_text": item["model"].question_text,
                "employee_answer": item["model"].employee_answer,
                "correct_answer": item["model"].correct_answer,
                "is_correct": item["model"].is_correct,
                "llm_score": item["llm_score"],
            }
            for item in response_results
        ],
    }


async def get_action_checklist(db: AsyncSession, module_id: int):
    """Get action checklist items for a module."""
    result = await db.execute(
        select(OnboardingModuleActionItem)
        .where(
            OnboardingModuleActionItem.module_id == module_id,
            OnboardingModuleActionItem.is_active == True,
        )
        .order_by(OnboardingModuleActionItem.display_order)
    )
    return result.scalars().all()


async def save_candidate_checklist(db: AsyncSession, candidate_id: int, module_id: int, completed_item_ids: list[int]):
    """Save candidate checklist progress."""
    result = await db.execute(
        select(OnboardingModuleCandidateChecklist).where(
            OnboardingModuleCandidateChecklist.candidate_id == candidate_id,
            OnboardingModuleCandidateChecklist.module_id == module_id,
        )
    )
    checklist = result.scalar_one_or_none()

    module = await db.get(OnboardingModule, module_id)
    if not module:
        return None

    total_items_result = await db.execute(
        select(func.count(OnboardingModuleActionItem.id)).where(
            OnboardingModuleActionItem.module_id == module_id,
            OnboardingModuleActionItem.is_active == True,
        )
    )
    total_items = total_items_result.scalar_one() or 0
    all_completed = len(completed_item_ids) == total_items and total_items > 0

    if not checklist:
        checklist = OnboardingModuleCandidateChecklist(
            candidate_id=candidate_id,
            module_id=module_id,
            completed_item_ids=",".join(str(i) for i in completed_item_ids) if completed_item_ids else None,
            all_completed=all_completed,
        )
        db.add(checklist)
    else:
        checklist.completed_item_ids = ",".join(str(i) for i in completed_item_ids) if completed_item_ids else None
        checklist.all_completed = all_completed

    await db.flush()
    await db.refresh(checklist)

    return {
        "id": checklist.id,
        "candidate_id": checklist.candidate_id,
        "module_id": checklist.module_id,
        "completed_item_ids": checklist.completed_item_ids,
        "all_completed": checklist.all_completed,
        "certificate_generated": checklist.certificate_generated,
        "certificate_generated_date": checklist.certificate_generated_date,
        "completed_date": checklist.completed_date,
    }


async def generate_certificate(db: AsyncSession, candidate_id: int, module_id: int):
    """Generate certificate for candidate after checklist completion."""
    result = await db.execute(
        select(OnboardingModuleCandidateChecklist).where(
            OnboardingModuleCandidateChecklist.candidate_id == candidate_id,
            OnboardingModuleCandidateChecklist.module_id == module_id,
        )
    )
    checklist = result.scalar_one_or_none()

    if not checklist:
        return None

    checklist.certificate_generated = True
    checklist.certificate_generated_date = func.now()
    checklist.completed_date = func.now()
    await db.flush()
    await db.refresh(checklist)

    progress = await get_employee_module_progress(db, candidate_id, module_id)
    if progress and progress.status != "COMPLETED":
        progress.status = "COMPLETED"
        progress.completed_date = func.now()
        await db.flush()
        await db.refresh(progress)

    return {
        "certificate_id": checklist.id,
        "candidate_id": checklist.candidate_id,
        "module_id": checklist.module_id,
        "generated_at": checklist.certificate_generated_date,
        "completion_date": checklist.completed_date,
        "candidate_name": None,
    }


async def get_certificate_data(db: AsyncSession, candidate_id: int, module_id: int):
    """Get certificate data including candidate name and all module scores."""
    from app.db.models import Candidate

    candidate = await db.get(Candidate, candidate_id)
    if not candidate:
        return None

    progress_records = await get_employee_modules(db, candidate_id)

    modules = []
    for progress in progress_records:
        module = await db.get(OnboardingModule, progress.module_id)
        if not module:
            continue

        score = None
        passing_status = None
        attempts = await get_employee_quiz_attempts(db, progress.id)
        if attempts:
            latest = attempts[0]
            score = latest.score
            passing_status = latest.passing_status

        modules.append({
            "module_id": module.id,
            "title": module.title,
            "rank": module.rank,
            "score": float(score) if score is not None else None,
            "passing_status": passing_status,
            "status": progress.status,
        })

    modules.sort(key=lambda item: item["rank"])

    checklist_result = await db.execute(
        select(OnboardingModuleCandidateChecklist).where(
            OnboardingModuleCandidateChecklist.candidate_id == candidate_id,
            OnboardingModuleCandidateChecklist.module_id == module_id,
        )
    )
    checklist = checklist_result.scalar_one_or_none()

    return {
        "candidate_name": candidate.full_name,
        "completed_date": checklist.completed_date if checklist else None,
        "generated_at": checklist.certificate_generated_date if checklist else None,
        "modules": modules,
    }
