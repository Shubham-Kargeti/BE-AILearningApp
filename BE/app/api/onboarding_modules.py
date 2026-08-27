import io
from typing import Any

import pandas as pd
from fastapi import APIRouter, Body, Depends, File, HTTPException, Query, UploadFile
from sqlalchemy.ext.asyncio import AsyncSession
from datetime import datetime
from sqlalchemy import delete, select

from app.core.dependencies import admin_required
from app.db.session import get_db
from app.db.models import (
    OnboardingModule,
    OnboardingModuleCandidateChecklist,
    OnboardingModuleEmployeeProgress,
    OnboardingModuleKeyConcept,
    Candidate,
    OnboardingModuleQuiz,
)
from app.scripts.seed_module_quiz_from_excel import parse_excel_file
from app.scripts.seed_module_key_concepts_from_excel import parse_key_concepts_file
from app.scripts.seed_onboarding_modules import (
    build_module_replacement_plan,
    parse_module_file,
    reconcile_preserved_module_updates,
)
from app.scripts.parse_bcg_quiz_excel import parse_bcg_quiz_excel
from app.models.schemas import (
    OnboardingModuleDetailResponse,
    OnboardingModuleResponse,
    OnboardingModuleQuizResponse,
    OnboardingModuleKeyConceptResponse,
    EmployeeModuleProgressResponse,
    EmployeeModuleProgressDetailResponse,
    EmployeeModuleVideoProgressResponse,
    EmployeeQuizAttemptResponse,
    EmployeeQuizResponseItemResponse,
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
    share_certificate_email,
    # send_certificate_email_auto,
    update_certificate_email_status,
    get_retry_quiz,
    delete_admin_quiz_question,
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


async def _module_has_employee_progress(db: AsyncSession, module_id: int) -> bool:
    """Return True when a module is still linked to employee onboarding progress.

    Keeping these modules avoids cascading away candidate video progress when new
    modules are added via the Excel upload flow.
    """
    result = await db.execute(
        select(OnboardingModuleEmployeeProgress.id)
        .where(OnboardingModuleEmployeeProgress.module_id == module_id)
        .limit(1)
    )
    return result.scalar_one_or_none() is not None


@router.get(
    "/onboarding-modules",
    response_model=list[OnboardingModuleResponse],
)
async def list_modules(
    db: AsyncSession = Depends(get_db),
):
    return await get_onboarding_modules(db)


@router.post("/admin/onboarding-module-preview")
async def preview_admin_onboarding_module(
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    current_user=Depends(admin_required),
):
    """Parse an uploaded onboarding module Excel and return a module-wise preview."""
    contents = await file.read()
    try:
        rows = parse_module_file(contents)
    except Exception as exc:  # pragma: no cover - defensive validation path
        raise HTTPException(status_code=400, detail=f"Failed to read Excel file: {exc}") from exc

    if not rows:
        raise HTTPException(status_code=400, detail="No module rows were found in the Excel file")

    modules_result = await db.execute(select(OnboardingModule).order_by(OnboardingModule.rank))
    modules = modules_result.scalars().all()
    module_by_rank = {module.rank: module for module in modules}

    grouped: dict[int, dict[str, Any]] = {}
    for row in rows:
        module_no = int(row["module_no"])
        module = module_by_rank.get(module_no)
        if not module:
            continue

        grouped[module_no] = {
            "module_no": module_no,
            "module_id": module.id,
            "title": str(row.get("title") or module.title).strip(),
            "description": str(row.get("description") or module.description or "").strip(),
            "passing_criteria": float(row.get("passing_criteria") or module.passing_criteria or 0),
            "icon": str(row.get("icon") or module.icon or "").strip() or None,
        }

    if not grouped:
        raise HTTPException(status_code=400, detail="No onboarding modules in the uploaded file match the configured modules")

    response = [grouped[module_no] for module_no in sorted(grouped)]
    return {"modules": response}


@router.get("/admin/onboarding-modules-current")
async def get_current_admin_onboarding_modules(
    db: AsyncSession = Depends(get_db),
    current_user=Depends(admin_required),
):
    """Return the currently saved onboarding modules in the preview structure used by the upload page."""
    modules_result = await db.execute(select(OnboardingModule).order_by(OnboardingModule.rank))
    modules = modules_result.scalars().all()

    response = [
        {
            "module_no": module.rank,
            "module_id": module.id,
            "title": module.title,
            "description": module.description or "",
            "passing_criteria": float(module.passing_criteria),
            "icon": module.icon,
        }
        for module in modules
    ]
    return {"modules": response}


@router.post("/admin/onboarding-module-save")
async def save_admin_onboarding_module(
    payload: dict[str, Any] = Body(...),
    db: AsyncSession = Depends(get_db),
    current_user=Depends(admin_required),
):
    """Persist confirmed onboarding module metadata for one or more modules."""
    records = payload.get("modules") or []
    if not records:
        raise HTTPException(status_code=400, detail="No modules were selected for save")

    existing_result = await db.execute(select(OnboardingModule).order_by(OnboardingModule.rank))
    existing_modules = existing_result.scalars().all()
    incoming_rows = [
        {"module_no": int(row.get("module_no")), "module_id": row.get("module_id")}
        for row in records
        if row.get("module_no") is not None
    ]
    existing_rows = [{"module_no": module.rank, "id": module.id} for module in existing_modules]
    preserve_plan = reconcile_preserved_module_updates(existing_rows, incoming_rows)

    saved = 0
    for row in records:
        module_id = row.get("module_id")
        module_no = row.get("module_no")

        module = None
        if module_id is not None:
            module = await db.get(OnboardingModule, int(module_id))
        if module is None and module_no is not None:
            result = await db.execute(select(OnboardingModule).where(OnboardingModule.rank == int(module_no)))
            module = result.scalar_one_or_none()
        if module is None:
            module = OnboardingModule(rank=int(module_no) if module_no is not None else 0)
            db.add(module)
            await db.flush()

        planned_match = next(
            (item for item in preserve_plan if int(item.get("module_no")) == int(module_no) and item.get("id") == module.id),
            None,
        )
        if planned_match is not None and planned_match.get("id") is not None:
            row_for_update = planned_match
        else:
            row_for_update = row

        module.title = str(row_for_update.get("title") or row.get("title") or module.title or "").strip()
        module.description = str(row_for_update.get("description") or row.get("description") or "").strip() or None
        passing_criteria = row_for_update.get("passing_criteria", row.get("passing_criteria"))
        try:
            module.passing_criteria = float(str(passing_criteria).replace("%", "").strip())
        except Exception:
            module.passing_criteria = module.passing_criteria or 80
        icon_value = str(row_for_update.get("icon") or row.get("icon") or "").strip()
        module.icon = icon_value or module.icon
        if module_no is not None:
            module.rank = int(module_no)
        saved += 1

    await db.commit()
    return {"saved": saved, "modules": [record.get("module_no") for record in records if record.get("module_no") is not None]}


@router.post("/admin/onboarding-module-quiz-preview")
async def preview_admin_onboarding_module_quiz(
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    current_user=Depends(admin_required),
):
    """Parse an uploaded onboarding quiz Excel and return a module-wise preview."""
    contents = await file.read()
    try:
        rows = parse_excel_file(contents)
    except Exception as exc:  # pragma: no cover - defensive validation path
        raise HTTPException(status_code=400, detail=f"Failed to read Excel file: {exc}") from exc

    if not rows:
        raise HTTPException(status_code=400, detail="No active quiz rows were found in the Excel file")

    modules_result = await db.execute(select(OnboardingModule).order_by(OnboardingModule.rank))
    modules = modules_result.scalars().all()
    module_by_rank = {module.rank: module for module in modules}

    grouped: dict[int, dict[str, Any]] = {}
    for row in rows:
        module_no = int(row["module_no"])
        module = module_by_rank.get(module_no)
        if not module:
            continue

        variant = row.get("variant") or "1"
        grouped.setdefault(module_no, {"module_id": module.id, "title": module.title, "variants": {}})
        grouped[module_no]["variants"].setdefault(variant, []).append({
            "module_no": module_no,
            "module_id": module.id,
            "question_text": row["question_text"],
            "question_type": row["question_type"],
            "choices": row["choices"],
            "correct_answer": row["correct_answer"],
            "variant": variant,
        })

    if not grouped:
        raise HTTPException(status_code=400, detail="No onboarding modules in the uploaded file match the configured modules")

    response = []
    for module_no in sorted(grouped):
        payload = grouped[module_no]
        variants = []
        for variant in sorted(payload["variants"].keys(), key=lambda value: int(value) if value.isdigit() else 999):
            variants.append({
                "variant": variant,
                "questions": payload["variants"][variant],
            })
        response.append({
            "module_no": module_no,
            "module_id": payload["module_id"],
            "title": payload["title"],
            "variants": variants,
        })

    return {"modules": response}


@router.post("/admin/onboarding-module-quiz-bcg-preview")
async def preview_bcg_quiz_excel(
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    current_user=Depends(admin_required),
):
    """Parse an uploaded BCG questionnaire Excel and return a module-wise preview."""
    contents = await file.read()
    try:
        modules_result = await db.execute(
            select(OnboardingModule).where(OnboardingModule.deleted_date.is_(None))
        )
        modules = modules_result.scalars().all()
        module_by_name = {m.title.strip().lower(): m for m in modules}

        result = parse_bcg_quiz_excel(contents, module_by_name)
    except Exception as exc:  # pragma: no cover - defensive validation path
        raise HTTPException(status_code=400, detail=f"Failed to read Excel file: {exc}") from exc

    if not result["modules"]:
        raise HTTPException(status_code=400, detail="No valid quiz rows were found in the uploaded file")

    return result


@router.post("/admin/onboarding-module-keyconcepts-preview")
async def preview_admin_onboarding_module_keyconcepts(
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    current_user=Depends(admin_required),
):
    """Parse an uploaded onboarding key-concepts Excel and return a module-wise preview."""
    contents = await file.read()
    try:
        rows = parse_key_concepts_file(contents)
    except Exception as exc:  # pragma: no cover - defensive validation path
        raise HTTPException(status_code=400, detail=f"Failed to read Excel file: {exc}") from exc

    if not rows:
        raise HTTPException(status_code=400, detail="No key concept rows were found in the Excel file")

    modules_result = await db.execute(select(OnboardingModule).order_by(OnboardingModule.rank))
    modules = modules_result.scalars().all()
    module_by_rank = {module.rank: module for module in modules}

    grouped: dict[int, dict[str, Any]] = {}
    for row in rows:
        module_no = int(row["module_no"])
        module = module_by_rank.get(module_no)
        if not module:
            continue

        grouped.setdefault(module_no, {"module_id": module.id, "title": module.title, "key_concepts": []})
        grouped[module_no]["key_concepts"].append({
            "module_no": module_no,
            "module_id": module.id,
            "title": row["title"],
            "description": row.get("description") or "",
            "link_url": row.get("link_url"),
            "display_order": row.get("display_order") or 0,
        })

    if not grouped:
        raise HTTPException(status_code=400, detail="No onboarding modules in the uploaded file match the configured modules")

    response = []
    for module_no in sorted(grouped):
        payload = grouped[module_no]
        # Ensure concepts are ordered
        concepts = sorted(payload["key_concepts"], key=lambda c: int(c.get("display_order") or 0))
        response.append({
            "module_no": module_no,
            "module_id": payload["module_id"],
            "title": payload["title"],
            "key_concepts": concepts,
        })

    return {"modules": response}


@router.get("/admin/onboarding-module-keyconcepts-current")
async def get_current_admin_onboarding_module_keyconcepts(
    db: AsyncSession = Depends(get_db),
    current_user=Depends(admin_required),
):
    """Return the currently saved onboarding key concepts in a preview structure used by the upload page."""
    modules_result = await db.execute(select(OnboardingModule).order_by(OnboardingModule.rank))
    modules = modules_result.scalars().all()

    response = []
    for module in modules:
        concept_result = await db.execute(
            select(OnboardingModuleKeyConcept)
            .where(
                OnboardingModuleKeyConcept.module_id == module.id,
            )
            .order_by(OnboardingModuleKeyConcept.display_order)
        )
        concepts = concept_result.scalars().all()
        if not concepts:
            continue

        response.append({
            "module_no": module.rank,
            "module_id": module.id,
            "title": module.title,
            "key_concepts": [
                {
                    "module_no": module.rank,
                    "module_id": module.id,
                    "title": c.title,
                    "description": c.description,
                    "link_url": c.link_url,
                    "display_order": c.display_order,
                }
                for c in concepts
            ],
        })

    return {"modules": response}


@router.post("/admin/onboarding-module-keyconcepts-save")
async def save_admin_onboarding_module_keyconcepts(
    payload: dict[str, Any] = Body(...),
    db: AsyncSession = Depends(get_db),
    current_user=Depends(admin_required),
):
    """Persist confirmed onboarding key concepts for one or more modules."""
    records = payload.get("key_concepts") or []
    if not records:
        raise HTTPException(status_code=400, detail="No key concepts were selected for save")

    grouped: dict[int, list[dict[str, Any]]] = {}
    for row in records:
        module_id = row.get("module_id")
        module_no = row.get("module_no")
        if module_id is None and module_no is None:
            continue
        local_key = int(module_id) if module_id is not None else int(module_no)
        grouped.setdefault(local_key, []).append(row)

    saved = 0
    for module_key, rows in grouped.items():
        module = await db.get(OnboardingModule, module_key) if isinstance(module_key, int) and module_key > 0 else None
        if module is None:
            module_result = await db.execute(select(OnboardingModule).where(OnboardingModule.rank == module_key))
            module = module_result.scalar_one_or_none()
        if module is None:
            # Create the module if it does not exist yet (use module_key as the rank)
            module = OnboardingModule(rank=int(module_key) if isinstance(module_key, int) else 0)
            db.add(module)
            await db.flush()

        existing_concepts_result = await db.execute(
            select(OnboardingModuleKeyConcept)
            .where(OnboardingModuleKeyConcept.module_id == module.id)
            .order_by(OnboardingModuleKeyConcept.display_order)
        )
        existing_concepts = existing_concepts_result.scalars().all()
        existing_by_order = {concept.display_order: concept for concept in existing_concepts}

        for index, row in enumerate(rows, start=1):
            display_order = int(row.get("display_order") or index)
            concept = existing_by_order.get(display_order)
            if concept is None:
                concept = OnboardingModuleKeyConcept(module_id=module.id, display_order=display_order)
                db.add(concept)
            concept.title = str(row.get("title") or concept.title or "").strip()
            concept.description = str(row.get("description") or concept.description or "").strip() or None
            concept.link_url = row.get("link_url") or concept.link_url
            concept.display_order = display_order
            saved += 1

    await db.commit()
    return {"saved": saved, "modules": list(grouped.keys())}


@router.get("/admin/onboarding-module-quiz-current")
async def get_current_admin_onboarding_module_quiz(
    db: AsyncSession = Depends(get_db),
    current_user=Depends(admin_required),
):
    """Return the currently saved onboarding quiz data in the same preview structure used by the upload page."""
    modules_result = await db.execute(select(OnboardingModule).order_by(OnboardingModule.rank))
    modules = modules_result.scalars().all()

    response = []
    for module in modules:
        quiz_result = await db.execute(
            select(OnboardingModuleQuiz)
            .where(
                OnboardingModuleQuiz.module_id == module.id,
                OnboardingModuleQuiz.deleted_date.is_(None),
            )
            .order_by(OnboardingModuleQuiz.display_order)
        )
        questions = quiz_result.scalars().all()
        if not questions:
            continue

        grouped_variants: dict[str, list[dict[str, Any]]] = {}
        for question in questions:
            variant = str(question.variant or "1").strip() or "1"
            grouped_variants.setdefault(variant, []).append({
                "id": question.id,
                "module_no": module.rank,
                "module_id": module.id,
                "question_text": question.question_text,
                "question_type": question.question_type.value if hasattr(question.question_type, "value") else str(question.question_type),
                "choices": question.choices or [],
                "correct_answer": question.correct_answer,
                "variant": variant,
                "priority": question.priority or 0,
                "category": question.category,
            })

        variants = []
        for variant in sorted(grouped_variants.keys(), key=lambda value: int(value) if value.isdigit() else 999):
            variants.append({
                "variant": variant,
                "questions": grouped_variants[variant],
            })

        response.append({
            "module_no": module.rank,
            "module_id": module.id,
            "title": module.title,
            "variants": variants,
        })

    return {"modules": response}


@router.post("/admin/onboarding-module-quiz-save")
async def save_admin_onboarding_module_quiz(
    payload: dict[str, Any] = Body(...),
    db: AsyncSession = Depends(get_db),
    current_user=Depends(admin_required),
):
    """Persist confirmed onboarding quiz questions for one or more modules."""
    records = payload.get("questions") or []
    delete_missing = payload.get("delete_missing", True)
    module_ids = payload.get("module_ids") or []
    if not records and not delete_missing and not module_ids:
        raise HTTPException(status_code=400, detail="No questions were selected for save")

    grouped: dict[int, list[dict[str, Any]]] = {}
    for row in records:
        module_id = row.get("module_id")
        module_no = row.get("module_no")
        if module_id is None and module_no is None:
            continue
        local_key = int(module_id) if module_id is not None else int(module_no)
        grouped.setdefault(local_key, []).append(row)

    touched_module_keys = set(grouped.keys())
    for raw_module_id in module_ids:
        try:
            touched_module_keys.add(int(raw_module_id))
        except (TypeError, ValueError):
            continue

    saved = 0
    for module_key in touched_module_keys:
        rows = grouped.get(module_key, [])
        module = await db.get(OnboardingModule, module_key) if isinstance(module_key, int) and module_key > 0 else None
        if module is None:
            module_result = await db.execute(select(OnboardingModule).where(OnboardingModule.rank == module_key))
            module = module_result.scalar_one_or_none()
        if module is None:
            continue

        existing_questions_result = await db.execute(
            select(OnboardingModuleQuiz)
            .where(OnboardingModuleQuiz.module_id == module.id)
            .order_by(OnboardingModuleQuiz.display_order, OnboardingModuleQuiz.id)
        )
        existing_questions = existing_questions_result.scalars().all()
        existing_by_index: dict[tuple[str, int], OnboardingModuleQuiz] = {}
        for question in existing_questions:
            existing_by_index[(str(question.variant or "1"), int(question.display_order))] = question

        submitted_keys: set[tuple[str, int]] = set()
        for index, row in enumerate(rows, start=1):
            question_type = str(row.get("question_type") or "MCQ").strip().upper()
            mapped_type = "SCENARIO-MCQ" if question_type == "SCENARIO-MCQ" else ("MCQ" if question_type == "MCQ" else "SCENARIO")
            variant = str(row.get("variant") or "").strip() or "1"
            submitted_keys.add((variant, index))
            question = existing_by_index.get((variant, index))
            if question is None:
                question = OnboardingModuleQuiz(
                    module_id=module.id,
                    variant=variant,
                    display_order=index,
                    points=1,
                )
                db.add(question)

            question.question_text = str(row.get("question_text") or question.question_text or "").strip()
            question.question_type = mapped_type
            question.choices = row.get("choices") or question.choices or []
            question.correct_answer = str(row.get("correct_answer") or question.correct_answer or "").strip()
            question.display_order = index
            question.variant = variant
            question.points = 1
            question.priority = int(row.get("priority") or 0)
            question.category = row.get("category") or question.category or None
            saved += 1

        if delete_missing:
            for key, question in existing_by_index.items():
                if key not in submitted_keys:
                    await db.delete(question)

    await db.commit()
    return {"saved": saved, "modules": list(touched_module_keys)}


@router.delete("/admin/onboarding-module-quiz/{question_id}")
async def delete_admin_onboarding_module_quiz(
    question_id: int,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(admin_required),
):
    """Delete a single onboarding quiz question."""
    deleted = await delete_admin_quiz_question(db, question_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Question not found")
    return {"deleted": True}


@router.patch("/admin/onboarding-module-quiz/{question_id}", response_model=OnboardingModuleQuizResponse)
async def update_admin_onboarding_module_quiz(
    question_id: int,
    payload: dict[str, Any] = Body(...),
    db: AsyncSession = Depends(get_db),
    current_user=Depends(admin_required),
):
    """Update a single onboarding quiz question."""
    result = await db.execute(select(OnboardingModuleQuiz).where(OnboardingModuleQuiz.id == question_id))
    question = result.scalar_one_or_none()
    if not question:
        raise HTTPException(status_code=404, detail="Question not found")

    if "question_text" in payload:
        question.question_text = str(payload["question_text"]).strip()
    if "question_type" in payload:
        question_type = str(payload["question_type"] or "MCQ").strip().upper()
        question.question_type = "SCENARIO-MCQ" if question_type == "SCENARIO-MCQ" else ("MCQ" if question_type == "MCQ" else "SCENARIO")
    if "choices" in payload:
        question.choices = payload["choices"] or []
    if "correct_answer" in payload:
        question.correct_answer = str(payload["correct_answer"] or "").strip()
    if "variant" in payload:
        question.variant = str(payload["variant"] or "1").strip() or "1"
    if "priority" in payload:
        question.priority = int(payload["priority"] or 0)
    if "category" in payload:
        question.category = str(payload["category"] or "").strip() or None

    await db.flush()
    await db.refresh(question)
    return question


@router.post("/admin/onboarding-module-quiz", response_model=OnboardingModuleQuizResponse)
async def create_admin_onboarding_module_quiz(
    payload: dict[str, Any] = Body(...),
    db: AsyncSession = Depends(get_db),
    current_user=Depends(admin_required),
):
    """Create a new onboarding quiz question."""
    module_id = payload.get("module_id")
    if not module_id:
        raise HTTPException(status_code=400, detail="module_id is required")

    module = await db.get(OnboardingModule, module_id)
    if not module:
        raise HTTPException(status_code=404, detail="Module not found")

    question_type = str(payload.get("question_type") or "MCQ").strip().upper()
    mapped_type = "SCENARIO-MCQ" if question_type == "SCENARIO-MCQ" else ("MCQ" if question_type == "MCQ" else "SCENARIO")

    question = OnboardingModuleQuiz(
        module_id=module.id,
        question_text=str(payload.get("question_text") or "").strip(),
        question_type=mapped_type,
        choices=payload.get("choices") or [],
        correct_answer=str(payload.get("correct_answer") or "").strip(),
        variant=str(payload.get("variant") or "1").strip() or "1",
        display_order=1,
        points=1,
        priority=int(payload.get("priority") or 0),
        category=str(payload.get("category") or "").strip() or None,
    )
    db.add(question)
    await db.flush()
    await db.refresh(question)
    return question


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

    module = await db.get(OnboardingModule, module_id)

    video_progress = await get_employee_video_progress(db, progress.id)

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
            "attempted_date": attempt.attempted_date,
            "responses": [
                {
                    "id": r.id,
                    "quiz_attempt_id": r.quiz_attempt_id,
                    "question_id": r.question_id,
                    "question_text": r.question_text,
                    "employee_answer": r.employee_answer,
                    "correct_answer": r.correct_answer,
                    "is_correct": r.is_correct,
                    "time_spent_seconds": r.time_spent_seconds,
                }
                for r in responses
            ],
        })

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
    attempts = await get_employee_quiz_attempts(db, employee_progress_id)

    result = []
    for attempt in attempts:
        responses = await get_quiz_attempt_responses(db, attempt.id)
        result.append({
            "id": attempt.id,
            "employee_progress_id": attempt.employee_progress_id,
            "quiz_id": attempt.quiz_id,
            "score": attempt.score,
            "passing_status": attempt.passing_status,
            "attempt_number": attempt.attempt_number,
            "time_spent_seconds": attempt.time_spent_seconds,
            "attempted_date": attempt.attempted_date,
            "responses": [
                {
                    "id": r.id,
                    "quiz_attempt_id": r.quiz_attempt_id,
                    "question_id": r.question_id,
                    "question_text": r.question_text,
                    "employee_answer": r.employee_answer,
                    "correct_answer": r.correct_answer,
                    "is_correct": r.is_correct,
                    "time_spent_seconds": r.time_spent_seconds,
                }
                for r in responses
            ],
        })

    return result


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
        module_id=module_id,
    )

    if payload.is_completed:
        # A completed video must never downgrade a module that is already
        # COMPLETED (quiz passed). Only advance the status to VIDEO_COMPLETED
        # when the module has not yet been completed; otherwise keep COMPLETED
        # and just stamp the video completion date if it is missing.
        if progress.status == "COMPLETED":
            if not progress.video_completed_date:
                await update_employee_module_progress_status(
                    db,
                    progress.id,
                    "COMPLETED",
                    video_completed_date=datetime.utcnow(),
                )
        else:
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

    quiz_attempts = []
    for attempt in data.get("quiz_attempts", []):
        attempted_date = attempt.get("attempted_date")
        if isinstance(attempted_date, str):
            attempted_date = datetime.fromisoformat(attempted_date)

        quiz_attempts.append(EmployeeQuizAttemptResponse(
            id=attempt["id"],
            employee_progress_id=attempt["employee_progress_id"],
            quiz_id=attempt.get("quiz_id"),
            score=attempt.get("score"),
            passing_status=attempt.get("passing_status"),
            attempt_number=attempt["attempt_number"],
            time_spent_seconds=attempt.get("time_spent_seconds"),
            attempted_date=attempted_date,
            responses=[
                EmployeeQuizResponseItemResponse(**r)
                for r in attempt.get("responses", [])
            ],
        ))

    return ModuleDetailResponse(
        module=data["module"],
        video_url=data.get("video_url"),
        video_completed=data.get("video_completed", False),
        key_concepts=data.get("key_concepts", []),
        quiz_questions=data.get("quiz_questions", []),
        quiz_attempts=quiz_attempts,
    )


@router.get(
    "/module-detail/{module_id}/retry-quiz",
    response_model=list[OnboardingModuleQuizResponse],
)
async def retry_module_quiz(
    module_id: int,
    candidate_id: str = Query(..., description="Candidate ID"),
    exclude_ids: str = Query(default="", description="Comma-separated IDs of currently shown questions to avoid on retry"),
    db: AsyncSession = Depends(get_db),
):
    """Return a reshuffled quiz set with new question variants for a retry attempt."""
    internal_candidate_id = await resolve_candidate_id(db, candidate_id)
    parsed_ids = [int(x) for x in exclude_ids.split(",") if x.strip()]
    questions = await get_retry_quiz(db, module_id, parsed_ids)
    return questions


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
        raise HTTPException(400, "Module progress not found")
    
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


@router.post(
    "/certificate/{candidate_id}/share",
    response_model=dict,
)
async def share_certificate(
    candidate_id: str,
    module_id: int = Query(..., description="Module ID for certificate context"),
    db: AsyncSession = Depends(get_db),
):
    """Return a mailto URL for the candidate to send the onboarding completion email manually."""
    internal_candidate_id = await resolve_candidate_id(db, candidate_id)
    result = await share_certificate_email(db, internal_candidate_id, module_id)

    if not result:
        raise HTTPException(404, "Certificate not found or candidate email missing")

    return result


@router.post(
    "/certificate/{candidate_id}/send-email",
    response_model=dict,
)
async def send_certificate_email(
    candidate_id: str,
    module_id: int = Query(..., description="Module ID for certificate context"),
    db: AsyncSession = Depends(get_db),
):
    """Automatically send the onboarding completion email to project coordinators.

    Records the outcome (sent/failed) on the candidate checklist so the
    dashboard can offer a manual resend when delivery fails.
    """
    # Email sending is currently disabled.
    return {"sent": False, "message": "Email notifications are currently disabled"}


@router.patch("/admin/onboarding-modules/{module_id}", response_model=OnboardingModuleResponse)
async def update_admin_onboarding_module(
    module_id: int,
    payload: dict[str, Any] = Body(...),
    db: AsyncSession = Depends(get_db),
    current_user=Depends(admin_required),
):
    module = await db.get(OnboardingModule, module_id)
    if not module:
        raise HTTPException(status_code=404, detail="Module not found")

    if "title" in payload:
        module.title = str(payload["title"] or "").strip()
    if "description" in payload:
        module.description = str(payload["description"] or "").strip() or None
    if "passing_criteria" in payload:
        try:
            module.passing_criteria = float(str(payload["passing_criteria"]).replace("%", "").strip())
        except Exception:
            module.passing_criteria = module.passing_criteria or 80
    if "icon" in payload:
        module.icon = str(payload["icon"] or "").strip() or module.icon
    if "rank" in payload:
        try:
            module.rank = int(payload["rank"])
        except Exception:
            raise HTTPException(status_code=400, detail="Invalid rank")

    await db.commit()
    await db.refresh(module)
    return module


@router.post("/admin/onboarding-modules", response_model=OnboardingModuleResponse)
async def create_admin_onboarding_module(
    payload: dict[str, Any] = Body(...),
    db: AsyncSession = Depends(get_db),
    current_user=Depends(admin_required),
):
    rank = payload.get("rank")
    try:
        rank_int = int(rank) if rank is not None else 0
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid rank")

    module = OnboardingModule(
        title=str(payload.get("title") or "").strip(),
        description=str(payload.get("description") or "").strip() or None,
        passing_criteria=float(str(payload.get("passing_criteria", 80)).replace("%", "").strip()),
        icon=str(payload.get("icon") or "").strip() or None,
        rank=rank_int,
    )
    db.add(module)
    await db.commit()
    await db.refresh(module)
    return module


@router.get("/admin/onboarding-modules/{module_id}/can-delete")
async def can_delete_admin_onboarding_module(
    module_id: int,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(admin_required),
):
    """Check if a module can be deleted (no candidate progress)."""
    has_progress = await _module_has_employee_progress(db, module_id)
    return {"can_delete": not has_progress}


@router.delete("/admin/onboarding-modules/{module_id}")
async def delete_admin_onboarding_module(
    module_id: int,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(admin_required),
):
    module = await db.get(OnboardingModule, module_id)
    if not module:
        raise HTTPException(status_code=404, detail="Module not found")
    has_progress = await _module_has_employee_progress(db, module_id)
    if has_progress:
        raise HTTPException(status_code=400, detail="Cannot delete module with existing candidate progress")
    await db.delete(module)
    await db.commit()
    return {"deleted": True}


@router.patch("/admin/onboarding-module-keyconcepts/{concept_id}", response_model=OnboardingModuleKeyConceptResponse)
async def update_admin_onboarding_keyconcept(
    concept_id: int,
    payload: dict[str, Any] = Body(...),
    db: AsyncSession = Depends(get_db),
    current_user=Depends(admin_required),
):
    concept = await db.get(OnboardingModuleKeyConcept, concept_id)
    if not concept:
        raise HTTPException(status_code=404, detail="Key concept not found")

    if "title" in payload:
        concept.title = str(payload["title"] or "").strip()
    if "description" in payload:
        concept.description = str(payload["description"] or "").strip() or None
    if "link_url" in payload:
        concept.link_url = payload["link_url"] or concept.link_url
    if "display_order" in payload:
        try:
            concept.display_order = int(payload["display_order"])
        except Exception:
            raise HTTPException(status_code=400, detail="Invalid display_order")

    await db.commit()
    await db.refresh(concept)
    return concept


@router.post("/admin/onboarding-module-keyconcepts", response_model=OnboardingModuleKeyConceptResponse)
async def create_admin_onboarding_keyconcept(
    payload: dict[str, Any] = Body(...),
    db: AsyncSession = Depends(get_db),
    current_user=Depends(admin_required),
):
    module_id = payload.get("module_id")
    if not module_id:
        raise HTTPException(status_code=400, detail="module_id is required")

    module = await db.get(OnboardingModule, int(module_id))
    if not module:
        raise HTTPException(status_code=404, detail="Module not found")

    concept = OnboardingModuleKeyConcept(
        module_id=int(module_id),
        title=str(payload.get("title") or "").strip(),
        description=str(payload.get("description") or "").strip() or None,
        link_url=payload.get("link_url") or None,
        display_order=int(payload.get("display_order") or 0),
    )
    db.add(concept)
    await db.commit()
    await db.refresh(concept)
    return concept


@router.delete("/admin/onboarding-module-keyconcepts/{concept_id}")
async def delete_admin_onboarding_keyconcept(
    concept_id: int,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(admin_required),
):
    concept = await db.get(OnboardingModuleKeyConcept, concept_id)
    if not concept:
        raise HTTPException(status_code=404, detail="Key concept not found")
    await db.delete(concept)
    await db.commit()
    return {"deleted": True}