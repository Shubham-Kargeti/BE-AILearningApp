from datetime import datetime
from typing import Optional
import asyncio
import json
import random
import re
from urllib.parse import quote

from sqlalchemy import select, func, case
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
    Candidate,
)
# from app.core.email import send_email
from app.core.storage import get_s3_service
from config import get_settings
settings = get_settings()
# from app.utils.generate_questions import _get_llm


# SCENARIO_PASSING_SCORE = 80


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


# def _format_key_concepts_for_prompt(key_concepts: list[OnboardingModuleKeyConcept]) -> str:
#     if not key_concepts:
#         return "No key concepts were provided for this module."
# 
#     return "\n".join(
#         f"- {concept.title}: {concept.description or ''}".strip()
#         for concept in key_concepts
#     )
# 
# 
# async def _evaluate_scenario_answer_with_llm(
#     question_text: str,
#     candidate_answer: str,
#     key_concepts: list[OnboardingModuleKeyConcept],
# ) -> int:
#     prompt = f"""
# You are evaluating a candidate's answer to an onboarding scenario question.
# 
# Grade only against the provided module key concepts and the question. Award a score from 0 to 100.
# 
# Scoring guidance:
# - 90-100: Complete, practical, and aligned with the key concepts.
# - 80-89: Mostly correct with only minor omissions.
# - 60-79: Partially correct but missing important details or judgment.
# - 1-59: Weak, vague, risky, or mostly misaligned.
# - 0: Empty, irrelevant, or unsafe answer.
# 
# Return ONLY valid JSON in this exact shape:
# {{"score": 0}}
# 
# Module key concepts:
# {_format_key_concepts_for_prompt(key_concepts)}
# 
# Question:
# {question_text}
# 
# Candidate answer:
# {candidate_answer}
# """.strip()
# 
#     llm = _get_llm()
#     try:
#         response = await asyncio.to_thread(
#             llm.invoke,
#             [
#                 {"role": "system", "content": "You are a strict, fair onboarding quiz evaluator."},
#                 {"role": "user", "content": prompt},
#             ],
#         )
#     except Exception as exc:
#         print(f"LLM evaluation failed, falling back to score 0: {exc}")
#         return 0
# 
#     content = response.content if hasattr(response, "content") else str(response)
#     parsed = _parse_json_object(content)
#     score = int(round(float(parsed.get("score", 0))))
#     return max(0, min(100, score))
# 
# 
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
    existing_variants = sorted({str(q.variant) for q in all_questions if q.variant is not None})
    if not existing_variants:
        return all_questions

    selected_variant = random.choice(existing_variants)
    filtered_questions = [
        q for q in all_questions
        if q.variant is None or q.variant == selected_variant
    ]

    if not filtered_questions:
        other_variants = [v for v in existing_variants if v != selected_variant]
        if other_variants:
            selected_variant = random.choice(other_variants)
            filtered_questions = [
                q for q in all_questions
                if q.variant is None or q.variant == selected_variant
             ]

    return select_priority_balanced_questions(filtered_questions)


def select_priority_balanced_questions(
    questions: list[OnboardingModuleQuiz],
    total_count: int | None = None,
) -> list[OnboardingModuleQuiz]:
    """
    Select questions with balanced priority distribution.

    - Groups questions by priority.
    - Distributes selection equally across distinct priorities.
    - If a priority bucket is exhausted, remaining slots are filled from the
      lowest priority number first.
    - Final list is shuffled so questions are not grouped by priority.
    """
    if not questions:
        return []

    total_available = len(questions)
    if total_count is None:
        total_count = total_available
    total_count = min(total_count, total_available)

    priority_groups: dict[int, list[OnboardingModuleQuiz]] = {}
    for q in questions:
        p = q.priority if q.priority is not None else 0
        priority_groups.setdefault(p, []).append(q)

    if not priority_groups or len(priority_groups) == 1:
        result = questions[:total_count]
        random.shuffle(result)
        return result

    sorted_priorities = sorted(priority_groups.keys())
    num_priorities = len(sorted_priorities)

    base_per_priority = total_count // num_priorities
    remainder = total_count % num_priorities

    selected: list[OnboardingModuleQuiz] = []
    selected_ids: set[int] = set()

    for i, priority in enumerate(sorted_priorities):
        group = priority_groups[priority]
        random.shuffle(group)

        target = base_per_priority + (1 if i < remainder else 0)
        take = min(target, len(group))

        selected.extend(group[:take])
        selected_ids.update(q.id for q in group[:take])

    if len(selected) < total_count and sorted_priorities:
        lowest_priority = sorted_priorities[0]
        lowest_group = priority_groups[lowest_priority]
        for q in lowest_group:
            if q.id not in selected_ids and len(selected) < total_count:
                selected.append(q)
                selected_ids.add(q.id)

    if len(selected) < total_count:
        for q in questions:
            if q.id not in selected_ids and len(selected) < total_count:
                selected.append(q)
                selected_ids.add(q.id)

    random.shuffle(selected)
    return selected[:total_count]


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
    existing_variants = sorted({str(q.variant) for q in all_questions if q.variant is not None})

    # Determine the variant currently shown (from the excluded ids) so we can
    # switch to the other variant for this retry.
    current_variant = None
    if exclude_ids:
        shown = [q for q in all_questions if q.id in set(exclude_ids)]
        variants = {q.variant for q in shown if q.variant is not None}
        if len(variants) == 1:
            current_variant = next(iter(variants))

    if current_variant in existing_variants:
        other_variants = [v for v in existing_variants if v != current_variant]
        selected_variant = random.choice(other_variants) if other_variants else current_variant
    else:
        selected_variant = random.choice(existing_variants) if existing_variants else "1"

    # Single-variant filter (variant None questions are always included),
    # matching the logic used for the initial quiz load.
    questions = [
        q for q in all_questions
        if q.variant is None or q.variant == selected_variant
    ]

    if not questions:
        other_variants = [v for v in existing_variants if v != selected_variant]
        if other_variants:
            selected_variant = random.choice(other_variants)
            questions = [
                q for q in all_questions
                if q.variant is None or q.variant == selected_variant
            ]

    scenario = [q for q in questions if (q.question_type or "").upper() == "SCENARIO"]
    mcq = [q for q in questions if (q.question_type or "").upper() != "SCENARIO"]

    balanced_mcq = select_priority_balanced_questions(mcq)
    random.shuffle(balanced_mcq)

    ordered = balanced_mcq + scenario
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
    module_id: Optional[int] = None,
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
        final_video_url = video_url
        if not final_video_url and module_id:
            module = await db.get(OnboardingModule, module_id)
            if module:
                final_video_url = _get_module_video_url(module.title)
        if not final_video_url:
            final_video_url = ""
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
            OnboardingModuleEmployeeProgress.id.label("employee_progress_id"),
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

    progress_ids = [row.employee_progress_id for row in rows if row.employee_progress_id is not None]

    latest_scores: dict = {}
    if progress_ids:
        max_attempts_subq = (
            select(
                OnboardingModuleQuizAttempt.employee_progress_id,
                func.max(OnboardingModuleQuizAttempt.attempt_number).label("max_attempt"),
            )
            .group_by(OnboardingModuleQuizAttempt.employee_progress_id)
            .subquery()
        )
        score_rows = await db.execute(
            select(
                OnboardingModuleQuizAttempt.employee_progress_id,
                OnboardingModuleQuizAttempt.score,
                OnboardingModuleQuizAttempt.passing_status,
            )
            .join(
                max_attempts_subq,
                (OnboardingModuleQuizAttempt.employee_progress_id == max_attempts_subq.c.employee_progress_id)
                & (OnboardingModuleQuizAttempt.attempt_number == max_attempts_subq.c.max_attempt),
            )
            .where(OnboardingModuleQuizAttempt.employee_progress_id.in_(progress_ids))
        )
        for row in score_rows.all():
            latest_scores[row.employee_progress_id] = {
                "score": float(row.score) if row.score is not None else None,
                "passing_status": row.passing_status,
            }

    modules = []
    completed_modules = 0
    for index, row in enumerate(rows):
        status = row.status or "LOCKED"
        previous_status = rows[index - 1].status if index > 0 else None
        is_unlocked = index == 0 or (previous_status or "LOCKED") == "COMPLETED"

        progress_data = latest_scores.get(row.employee_progress_id, {}) if row.employee_progress_id else {}

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
            "score": progress_data.get("score"),
            "passing_status": progress_data.get("passing_status"),
        })
        if status == "COMPLETED":
            completed_modules += 1

    remaining_modules = total_modules - completed_modules
    overall_progress_percentage = round(
        (completed_modules / total_modules) * 100, 2
    ) if total_modules > 0 else 0.0

    email_sent_result = await db.execute(
        select(OnboardingModuleCandidateChecklist.certificate_email_sent)
        .where(
            OnboardingModuleCandidateChecklist.candidate_id == candidate_id,
            OnboardingModuleCandidateChecklist.certificate_email_sent.is_(True),
        )
    )
    certificate_email_sent = email_sent_result.scalar_one_or_none() is not None

    resources_result = await db.execute(
        select(
            OnboardingModuleKeyConcept.module_id,
            OnboardingModule.title.label("module_title"),
            OnboardingModuleKeyConcept.title,
            OnboardingModuleKeyConcept.link_url,
        )
        .join(
            OnboardingModule,
            OnboardingModuleKeyConcept.module_id == OnboardingModule.id,
        )
        .where(
            OnboardingModuleKeyConcept.link_url.is_not(None),
            OnboardingModuleKeyConcept.link_url.notlike("%url-to-be-added%"),
            OnboardingModule.deleted_date.is_(None),
        )
        .order_by(OnboardingModule.rank, OnboardingModuleKeyConcept.display_order)
    )
    resources = [
        {
            "module_id": row.module_id,
            "module_title": row.module_title,
            "title": row.title,
            "url": row.link_url,
        }
        for row in resources_result.all()
    ]

    return {
        "total_modules": total_modules,
        "completed_modules": completed_modules,
        "remaining_modules": remaining_modules,
        "overall_progress_percentage": overall_progress_percentage,
        "certificate_email_sent": certificate_email_sent,
        "resources": resources,
        "modules": modules,
    }


async def get_onboarding_candidates_with_status(db: AsyncSession):
    """Return all onboarding-sourced candidates with their aggregated module status.

    Status values:
    - "completed": every assigned module is COMPLETED
    - "in_progress": at least one module is actively being worked on
    - "not_started": no modules started yet
    """
    stmt = (
        select(
            Candidate.candidate_id,
            Candidate.email,
            Candidate.full_name,
            Candidate.created_at,
            Candidate.experience_level,
            Candidate.onboarding_email_sent,
            func.coalesce(
                case(
                    (func.count(OnboardingModuleEmployeeProgress.id) == 0, "not_started"),
                    (
                        func.sum(
                            case(
                                (OnboardingModuleEmployeeProgress.status == "COMPLETED", 1),
                                else_=0,
                            )
                        )
                        == func.count(OnboardingModuleEmployeeProgress.id),
                        "completed",
                    ),
                    (
                        func.sum(
                            case(
                                (
                                    OnboardingModuleEmployeeProgress.status.in_(
                                        [
                                            "VIDEO_IN_PROGRESS",
                                            "VIDEO_COMPLETED",
                                            "QUIZ_IN_PROGRESS",
                                        ]
                                    ),
                                    1,
                                ),
                                else_=0,
                            )
                        )
                        > 0,
                        "in_progress",
                    ),
                    else_="not_started",
                ),
                "not_started",
            ).label("overall_status"),
        )
        .select_from(Candidate)
        .outerjoin(
            OnboardingModuleEmployeeProgress,
            (Candidate.id == OnboardingModuleEmployeeProgress.candidate_id),
        )
        .where(Candidate.source == "onboarding")
        .group_by(
            Candidate.candidate_id,
            Candidate.email,
            Candidate.full_name,
            Candidate.created_at,
            Candidate.experience_level,
            Candidate.onboarding_email_sent,
        )
        .order_by(Candidate.created_at.desc())
    )
    result = await db.execute(stmt)
    return [
        {
            "candidate_id": row.candidate_id,
            "email": row.email,
            "full_name": row.full_name,
            "created_at": row.created_at,
            "experience_level": row.experience_level,
            "onboarding_email_sent": row.onboarding_email_sent,
            "overall_status": row.overall_status,
        }
        for row in result.all()
    ]


VIDEO_URL_MAP = {
    "Engagement Context & Structure": "onboarding-module/module-1.mp4",
    "Legal, Compliance & Data Security": "onboarding-module/module-2.mp4",
    "Ways of Working & Tools": "onboarding-module/module-3.mp4",
    "Engagement & Delivery Excellence": "onboarding-module/module-4.mp4",
    "Admin Essentials: Reimbursements": "onboarding-module/module-5.mp4",
    "Onboarding Completion & Next Steps": "onboarding-module/module-6.mp4",
}

STATIC_VIDEO_URL_MAP = {
    "Engagement Context & Structure": "https://harshit-nagarro-git.github.io/onboarding-module-videos/module-videos/module-1.mp4",
    "Legal, Compliance & Data Security": "https://harshit-nagarro-git.github.io/onboarding-module-videos/module-videos/module-2.mp4",
    "Ways of Working & Tools": "https://harshit-nagarro-git.github.io/onboarding-module-videos/module-videos/module-3.mp4",
    "Engagement & Delivery Excellence": "https://harshit-nagarro-git.github.io/onboarding-module-videos/module-videos/module-4.mp4",
    "Admin Essentials: Reimbursements": "https://harshit-nagarro-git.github.io/onboarding-module-videos/module-videos/module-5.mp4",
    "Onboarding Completion & Next Steps": "https://harshit-nagarro-git.github.io/onboarding-module-videos/module-videos/module-6.mp4",
}


def _normalize_module_title_for_video_lookup(module_title: str) -> str:
    """Normalize titles that get a trailing numeric suffix during Excel imports.

    Excel import paths sometimes produce titles like "Engagement Context & Structure1"
    while the canonical module titles in the app are exact strings without the stray
    numeric suffix. Trim the trailing numeric suffix before lookup so the default
    module videos remain stable.
    """
    if not module_title:
        return ""

    normalized = str(module_title).strip()
    if normalized.endswith("1") and normalized[:-1].rstrip().endswith("Structure"):
        normalized = normalized[:-1].rstrip()
    elif normalized and normalized[-1].isdigit():
        normalized = re.sub(r"\s*\d+$", "", normalized)

    return normalized


def _get_module_video_url(module_title: str) -> str:
    """Resolve the onboarding video URL for a module.

    When FETCH_VIDEOS_FROM_S3 is True, returns the S3 object key (which is
    later turned into a presigned URL). When False, returns the static
    GitHub-hosted URL directly.
    """
    lookup_title = _normalize_module_title_for_video_lookup(module_title)
    if settings.FETCH_VIDEOS_FROM_S3:
        return VIDEO_URL_MAP.get(lookup_title, VIDEO_URL_MAP.get(module_title, ""))
    return STATIC_VIDEO_URL_MAP.get(lookup_title, STATIC_VIDEO_URL_MAP.get(module_title, ""))


def _get_video_presigned_url(s3_key: str, expiration: int = 3600) -> str:
    """Generate a presigned URL for an onboarding video S3 key."""
    try:
        s3_service = get_s3_service()
        return s3_service.generate_presigned_url(s3_key, expiration=expiration, http_method="GET")
    except Exception as exc:
        print(f"Failed to generate presigned URL for {s3_key}: {exc}")
        return s3_key


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
        new_url = _get_module_video_url(module.title)
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
        video_url = _get_module_video_url(module.title)
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

    if video_url and not video_url.startswith("http"):
        # Run the blocking boto3 call in a worker thread so it never
        # freezes the asyncio event loop (e.g. when S3 is slow/unreachable).
        video_url = await asyncio.to_thread(_get_video_presigned_url, video_url)

    key_concepts = await get_onboarding_module_key_concepts(db, module.id)
    quiz_questions = await get_onboarding_module_quiz(db, module.id)

    quiz_attempts = []
    attempts = await get_employee_quiz_attempts(db, progress.id)
    for attempt in attempts:
        responses = await get_quiz_attempt_responses(db, attempt.id)
        quiz_attempts.append({
            "id": attempt.id,
            "employee_progress_id": attempt.employee_progress_id,
            "quiz_id": attempt.quiz_id,
            "score": attempt.score,
            "passing_status": attempt.passing_status,
            "attempt_number": attempt.attempt_number,
            "time_spent_seconds": attempt.time_spent_seconds,
            "attempted_date": attempt.attempted_date.isoformat() if attempt.attempted_date else None,
            "responses": [
                {
                    "id": r.id,
                    "quiz_attempt_id": r.quiz_attempt_id,
                    "question_id": r.question_id,
                    "question_text": r.question_text,
                    "employee_answer": r.employee_answer,
                    "correct_answer": r.correct_answer,
                    "is_correct": r.is_correct,
                }
                for r in responses
            ],
        })

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
        if question and question.question_type == "SCENARIO":
            is_correct = False
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

    if passing_status == "PASS":
        # await _check_and_send_onboarding_completion_email(db, candidate_id)
        pass

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


# async def _check_and_send_onboarding_completion_email(db: AsyncSession, candidate_id: int) -> None:
#     """Check if all onboarding modules are completed and send auto-email if so."""
#     total_result = await db.execute(
#         select(func.count(OnboardingModule.id))
#         .where(OnboardingModule.deleted_date.is_(None))
#     )
#     total_modules = total_result.scalar_one() or 0
#
#     if total_modules == 0:
#         return
#
#     completed_result = await db.execute(
#         select(func.count(OnboardingModuleEmployeeProgress.id))
#         .join(OnboardingModule, OnboardingModuleEmployeeProgress.module_id == OnboardingModule.id)
#         .where(
#             OnboardingModuleEmployeeProgress.candidate_id == candidate_id,
#             OnboardingModuleEmployeeProgress.status == "COMPLETED",
#             OnboardingModule.deleted_date.is_(None),
#         )
#     )
#     completed_modules = completed_result.scalar_one() or 0
#
#     if completed_modules != total_modules:
#         return
#
#     all_modules = await db.execute(
#         select(OnboardingModule)
#         .where(OnboardingModule.deleted_date.is_(None))
#         .order_by(OnboardingModule.rank)
#     )
#     last_module = all_modules.scalars().all()[-1]
#
#     checklist_result = await db.execute(
#         select(OnboardingModuleCandidateChecklist).where(
#             OnboardingModuleCandidateChecklist.candidate_id == candidate_id,
#             OnboardingModuleCandidateChecklist.module_id == last_module.id,
#         )
#     )
#     checklist = checklist_result.scalar_one_or_none()
#
#     if checklist and checklist.certificate_email_sent:
#         return
#
#     email_result = await send_certificate_email_auto(db, candidate_id, last_module.id)
#     if email_result is None:
#         return
#
#     email_sent = email_result.get("sent", False)
#
#     if checklist:
#         checklist.certificate_email_sent = email_sent
#     else:
#         checklist = OnboardingModuleCandidateChecklist(
#             candidate_id=candidate_id,
#             module_id=last_module.id,
#             completed_item_ids=None,
#             all_completed=True,
#             certificate_generated=True,
#             certificate_generated_date=func.now(),
#             certificate_email_sent=email_sent,
#             completed_date=func.now(),
#         )
#         db.add(checklist)
#
#     await db.flush()


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
        "certificate_email_sent": checklist.certificate_email_sent,
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
    """Prepare certificate email and return a mailto URL for the candidate to send manually."""
    certificate_data = await get_certificate_data(db, candidate_id, module_id)
    if not certificate_data:
        return None

    candidate = await db.get(Candidate, candidate_id)
    if not candidate:
        return None

    completion_date = certificate_data["completed_date"]
    if completion_date:
        completion_date_str = datetime.fromisoformat(str(completion_date).replace("Z", "+00:00")).strftime("%B %d, %Y")
    else:
        completion_date_str = datetime.now().strftime("%B %d, %Y")

    subject = "Onboarding Completion Confirmation"
    text_body = f"""Hello Everyone,

I am pleased to inform you that I have successfully completed all required onboarding modules and passed the associated assessments.

Candidate Details

* Name: {certificate_data["candidate_name"] or "N/A"}
* Email: {candidate.email}
* Completion Date: {completion_date_str}

Please find this email as confirmation of my onboarding completion. I look forward to the next steps in the onboarding process.""".strip()

    to_emails = ",".join(settings.ONBOARDING_EMAILS)
    mailto_url = f"mailto:{to_emails}?subject={quote(subject)}&body={quote(text_body)}"

    return {"mailto_url": mailto_url}


# async def send_certificate_email_auto(db: AsyncSession, candidate_id: int, module_id: int):
#     """Automatically send onboarding completion email to project coordinators."""
#     certificate_data = await get_certificate_data(db, candidate_id, module_id)
#     if not certificate_data:
#         return None
#
#     candidate = await db.get(Candidate, candidate_id)
#     if not candidate:
#         return None
#
#     completion_date = certificate_data["completed_date"]
#     if completion_date:
#         completion_date_str = datetime.fromisoformat(str(completion_date).replace("Z", "+00:00")).strftime("%B %d, %Y")
#     else:
#         completion_date_str = datetime.now().strftime("%B %d, %Y")
#
#     subject = "Onboarding Completion Confirmation"
#     text_body = f"""Hello Everyone,
#
# I am pleased to inform you that I have successfully completed all required onboarding modules and passed the associated assessments.
#
# Candidate Details
#
# * Name: {certificate_data["candidate_name"] or "N/A"}
# * Email: {candidate.email}
# * Completion Date: {completion_date_str}
#
# Please find this email as confirmation of my onboarding completion. I look forward to the next steps in the onboarding process.""".strip()
#
#     html_body = f"""<html>
# <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f4f4f4;">
# <div style="max-width: 600px; margin: 20px auto; background-color: white; border-radius: 10px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
# <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center;">
# <h1 style="color: white; margin: 0; font-size: 28px;">Onboarding Completion</h1>
# </div>
# <div style="padding: 30px;">
# <p style="font-size: 16px;">A candidate has successfully completed all onboarding modules.</p>
# <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
# <h2 style="margin-top: 0; color: #667eea;">Candidate Details</h2>
# <p style="margin: 10px 0;"><strong>Name:</strong> {certificate_data["candidate_name"] or "N/A"}</p>
# <p style="margin: 10px 0;"><strong>Email:</strong> {candidate.email}</p>
# <p style="margin: 10px 0;"><strong>Completion Date:</strong> {completion_date_str}</p>
# <p style="margin: 10px 0;"><strong>Certificate Status:</strong> Issued</p>
# </div>
# <p style="margin-top: 30px;">Best regards,<br><strong>AI Learning App Team</strong></p>
# </div>
# <div style="background-color: #f8f9fa; padding: 20px; text-align: center; border-top: 1px solid #e0e0e0;">
# <p style="color: #999; font-size: 12px; margin: 5px 0;">This is an automated email from AI Learning App.</p>
# <p style="color: #999; font-size: 12px; margin: 5px 0;">© {datetime.now().year} AI Learning App. All rights reserved.</p>
# </div>
# </div>
# </body>
# </html>"""
#
#     to_emails = settings.ONBOARDING_EMAILS
#     try:
#         await send_email(
#             to_email=to_emails,
#             subject=subject,
#             html_body=html_body,
#             text_body=text_body,
#         )
#     except Exception as exc:
#         print(f"Failed to send certificate email: {exc}")
#         return {"sent": False, "message": "Failed to send onboarding completion email"}
#
#     return {"sent": True, "message": "Onboarding completion email sent successfully"}


async def update_certificate_email_status(
    db: AsyncSession,
    candidate_id: int,
    module_id: int,
    email_sent: bool,
) -> None:
    """Update the certificate email sent flag on the candidate checklist.

    Records whether an automatic email send succeeded or failed so the
    dashboard can offer a manual resend when delivery fails (flag stays False).
    """
    result = await db.execute(
        select(OnboardingModuleCandidateChecklist).where(
            OnboardingModuleCandidateChecklist.candidate_id == candidate_id,
            OnboardingModuleCandidateChecklist.module_id == module_id,
        )
    )
    checklist = result.scalar_one_or_none()
    if checklist:
        checklist.certificate_email_sent = email_sent
        await db.flush()


async def delete_admin_quiz_question(
    db: AsyncSession,
    question_id: int,
) -> bool:
    """Delete a single onboarding quiz question by ID."""
    result = await db.execute(
        select(OnboardingModuleQuiz).where(OnboardingModuleQuiz.id == question_id)
    )
    question = result.scalar_one_or_none()
    if not question:
        return False

    await db.delete(question)
    await db.flush()
    return True
