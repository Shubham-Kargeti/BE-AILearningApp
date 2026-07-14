from datetime import datetime
from typing import Optional
import asyncio
import json
import random
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
    Candidate,
)
from app.core.email import send_email
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

    all_questions = result.scalars().all()
    selected_variant = random.choice(["1", "2"])
    filtered_questions = [
        q for q in all_questions
        if q.variant is None or q.variant == selected_variant
    ]

    return filtered_questions


async def get_all_onboarding_module_quiz(
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


async def get_retry_quiz(
    db: AsyncSession,
    module_id: int,
    exclude_ids: list[int] | None = None,
):
    """
    Build a fresh quiz set for a retry attempt:
    - use a single variant only (never mix variants across questions),
    - prefer the variant different from the one currently shown,
    - shuffle the MCQ questions while keeping the scenario (text-area)
      question fixed at the end, then reassign display_order (rank).
    """
    all_questions = await get_all_onboarding_module_quiz(db, module_id)

    # Determine the variant currently shown (from the excluded ids) so we can
    # switch to the other variant for this retry.
    current_variant = None
    if exclude_ids:
        shown = [q for q in all_questions if q.id in set(exclude_ids)]
        variants = {q.variant for q in shown if q.variant is not None}
        if len(variants) == 1:
            current_variant = next(iter(variants))

    if current_variant in ("1", "2"):
        selected_variant = "2" if current_variant == "1" else "1"
    else:
        selected_variant = random.choice(["1", "2"])

    # Single-variant filter (variant None questions are always included),
    # matching the logic used for the initial quiz load.
    questions = [
        q for q in all_questions
        if q.variant is None or q.variant == selected_variant
    ]

    scenario = [q for q in questions if (q.question_type or "").upper() == "SCENARIO"]
    mcq = [q for q in questions if (q.question_type or "").upper() != "SCENARIO"]

    random.shuffle(mcq)

    ordered = mcq + scenario
    for index, q in enumerate(ordered, start=1):
        q.display_order = index

    return ordered


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
        final_video_url = video_url or "/videos/unknown.mp4"
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
    "Engagement Context & Structure": "/videos/module-1.mp4",
    "Legal, Compliance & Data Security": "/videos/module-2.mp4",
    "Ways of Working & Tools": "/videos/module-3.mp4",
    "Engagement & Delivery Excellence": "/videos/module-4.mp4",
    "Admin Essentials: Reimbursements": "/videos/module-5.mp4",
    "Onboarding Completion & Next Steps": "/videos/module-6.mp4",
}


async def sync_video_urls(db: AsyncSession) -> None:
    """Sync video URLs for all existing video progress records with the current VIDEO_URL_MAP."""
    result = await db.execute(
        select(OnboardingModuleVideoProgress, OnboardingModuleEmployeeProgress, OnboardingModule)
        .join(
            OnboardingModuleEmployeeProgress,
            OnboardingModuleVideoProgress.employee_progress_id == OnboardingModuleEmployeeProgress.id,
        )
        .join(
            OnboardingModule,
            OnboardingModuleEmployeeProgress.module_id == OnboardingModule.id,
        )
    )
    rows = result.all()

    updated = False
    for vp, _emp, module in rows:
        new_url = VIDEO_URL_MAP.get(module.title)
        if new_url and vp.video_url != new_url:
            vp.video_url = new_url
            updated = True

    if updated:
        await db.commit()


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

    quiz_questions = await get_all_onboarding_module_quiz(db, module_id)
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

    total_questions = len(answers)
    score = round((correct_count / total_questions) * 100, 2) if total_questions > 0 else 0.0
    passing_status = "PASS" if score >= float(module.passing_criteria) else "FAIL"

    quiz_attempt.score = score
    quiz_attempt.passing_status = passing_status
    await db.flush()

    if passing_status == "PASS":
        progress.status = "COMPLETED"
        progress.completed_date = func.now()
    else:
        progress.status = "QUIZ_IN_PROGRESS"
        progress.completed_date = None
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
    """Generate certificate for candidate after passing last module quiz."""
    from app.db.models import Candidate

    progress = await get_employee_module_progress(db, candidate_id, module_id)
    if not progress:
        return None

    candidate = await db.get(Candidate, candidate_id)
    candidate_name = candidate.full_name if candidate else None

    if progress.status != "COMPLETED":
        progress.status = "COMPLETED"
        progress.completed_date = func.now()
        await db.flush()
        await db.refresh(progress)

    now = datetime.utcnow()

    return {
        "certificate_id": progress.id,
        "candidate_id": candidate_id,
        "module_id": module_id,
        "generated_at": now,
        "completion_date": progress.completed_date,
        "candidate_name": candidate_name,
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

    last_progress = await get_employee_module_progress(db, candidate_id, module_id)

    return {
        "candidate_name": candidate.full_name,
        "completed_date": last_progress.completed_date if last_progress else None,
        "generated_at": last_progress.completed_date if last_progress else None,
        "modules": modules,
    }


async def share_certificate_email(db: AsyncSession, candidate_id: int, module_id: int):
    """Send certificate data to candidate's email."""
    certificate_data = await get_certificate_data(db, candidate_id, module_id)
    if not certificate_data:
        return None

    candidate = await db.get(Candidate, candidate_id)
    if not candidate:
        return None

    modules_html = ""
    for module in certificate_data["modules"]:
        score_text = f"{round(module['score'])}%" if module["score"] is not None else "N/A"
        status_text = module["passing_status"] or module["status"]
        modules_html += f"""
        <tr>
          <td style="padding: 8px; border: 1px solid #ddd;">{module["rank"]}. {module["title"]}</td>
          <td style="padding: 8px; border: 1px solid #ddd; text-align: center;">{score_text}</td>
          <td style="padding: 8px; border: 1px solid #ddd; text-align: center;">{status_text}</td>
        </tr>
        """

    html_body = f"""
    <html>
      <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #1976d2;">Congratulations, {certificate_data["candidate_name"]}!</h2>
        <p>You have successfully completed all onboarding modules. Your Engagement Clearance Certificate is ready.</p>
        
        <h3>Module Scores</h3>
        <table style="width: 100%; border-collapse: collapse;">
          <thead>
            <tr style="background-color: #f5f5f5;">
              <th style="padding: 8px; border: 1px solid #ddd; text-align: left;">Module</th>
              <th style="padding: 8px; border: 1px solid #ddd; text-align: center;">Score</th>
              <th style="padding: 8px; border: 1px solid #ddd; text-align: center;">Status</th>
            </tr>
          </thead>
          <tbody>
            {modules_html}
          </tbody>
        </table>
        
        <p style="margin-top: 20px;">
          <strong>Certificate ID:</strong> CERT-{certificate_data["candidate_name"][:3].upper() if certificate_data["candidate_name"] else "XXX"}-{candidate_id}
        </p>
        <p>
          <strong>Completed Date:</strong> {certificate_data["completed_date"] and datetime.fromisoformat(str(certificate_data["completed_date"]).replace("Z", "+00:00")).strftime("%B %d, %Y") or datetime.now().strftime("%B %d, %Y")}
        </p>
        
        <p>Please find your certificate attached or download it from the onboarding portal.</p>
      </body>
    </html>
    """

    text_body = f"""
    Congratulations, {certificate_data["candidate_name"]}!
    
    You have successfully completed all onboarding modules. Your Engagement Clearance Certificate is ready.
    
    Module Scores:
    """

    for module in certificate_data["modules"]:
        score_text = f"{round(module['score'])}%" if module["score"] is not None else "N/A"
        status_text = module["passing_status"] or module["status"]
        text_body += f"\n{module['rank']}. {module['title']} - {score_text} ({status_text})"

    text_body += f"\n\nCertificate ID: CERT-{certificate_data['candidate_name'][:3].upper() if certificate_data['candidate_name'] else 'XXX'}-{candidate_id}"

    await send_email(
        to_email=candidate.email,
        subject="Your Engagement Clearance Certificate",
        html_body=html_body,
        text_body=text_body,
    )

    return {"sent": True, "email": candidate.email}
