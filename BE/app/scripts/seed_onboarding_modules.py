import io
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from datetime import datetime, timedelta

import pandas as pd

from config import get_settings
settings = get_settings()
from app.db.models import (
    OnboardingModule,
    OnboardingModuleEmployeeProgress,
    OnboardingModuleVideoProgress,
    OnboardingModuleQuizAttempt,
    OnboardingModuleQuizResponseModel,
    OnboardingModuleQuiz,
    OnboardingModuleKeyConcept,
    OnboardingModuleActionItem,
    OnboardingModuleCandidateChecklist,
)


def _canonical_column(columns: list[str], *candidates: str) -> str | None:
    def normalize(value: str) -> str:
        return " ".join(
            str(value)
            .strip()
            .lower()
            .replace("/", " ")
            .replace("-", " ")
            .replace("_", " ")
            .replace("%", " ")
            .replace("(", " ")
            .replace(")", " ")
            .replace(".", " ")
            .replace(",", " ")
            .split()
        )

    normalized = {normalize(col): col for col in columns}
    for candidate in candidates:
        match = normalized.get(normalize(candidate))
        if match is not None:
            return match
    return None


def build_module_replacement_plan(existing_rows: list[dict], incoming_rows: list[dict]) -> tuple[list[int], list[int]]:
    """Return stale and retained module ranks when replacing the saved module set."""
    existing_ranks = {
        int(row["module_no"])
        for row in existing_rows
        if row.get("module_no") is not None
    }
    incoming_ranks = {
        int(row["module_no"])
        for row in incoming_rows
        if row.get("module_no") is not None
    }

    stale_ranks = sorted(existing_ranks - incoming_ranks)
    retained_ranks = sorted(existing_ranks & incoming_ranks)
    return stale_ranks, retained_ranks


def reconcile_preserved_module_updates(existing_rows: list[dict], incoming_rows: list[dict]) -> list[dict]:
    """Keep existing module IDs when a module number is updated in-place.

    Since candidates may already have started a module or quiz, the upload must
    preserve the original row IDs and overwrite the values instead of deleting and
    recreating them.
    """
    existing_by_no = {
        int(row["module_no"]): row
        for row in existing_rows
        if row.get("module_no") is not None
    }

    planned: list[dict] = []
    for row in incoming_rows:
        module_no = row.get("module_no")
        if module_no is None:
            planned.append({**row, "id": None})
            continue

        existing = existing_by_no.get(int(module_no))
        if existing is not None:
            merged = {**existing, **row}
            merged["id"] = existing.get("id")
            planned.append(merged)
        else:
            planned.append({**row, "id": None})

    return planned


def parse_module_rows(excel_df: pd.DataFrame) -> list[dict]:
    """Parse a module-export dataframe into module metadata rows."""
    if excel_df is None or excel_df.empty:
        return []

    df = excel_df.copy()
    columns = list(df.columns)

    module_col = _canonical_column(
        columns,
        "Module No.",
        "Module No",
        "Module Number",
        "module_no",
        "Module No ",
    )
    title_col = _canonical_column(
        columns,
        "Module Name",
        "Title",
        "Module Title",
        "module_name",
        "Module Title ",
    )
    description_col = _canonical_column(columns, "Description", "description")
    passing_col = _canonical_column(
        columns,
        "Passing Criteria",
        "Pass Criteria",
        "passing_criteria",
        "Passing Criteria (%)",
        "Pass Criteria (%)",
    )
    icon_col = _canonical_column(columns, "Icon", "icon", "Icon Name", "icon_name")

    if not module_col or not title_col:
        return []

    df = df.dropna(subset=[module_col])
    rows: list[dict] = []
    for _, row in df.iterrows():
        module_no = row.get(module_col)
        if pd.isna(module_no):
            continue
        try:
            module_no = int(float(str(module_no).strip() or 0))
        except Exception:
            continue

        title = str(row.get(title_col, "") or "").strip()
        if not title:
            continue

        description = str(row.get(description_col, "") or "").strip()
        passing_criteria_raw = row.get(passing_col)
        passing_criteria = 80.0
        if not pd.isna(passing_criteria_raw):
            try:
                passing_criteria = float(str(passing_criteria_raw).replace("%", "").strip())
            except Exception:
                passing_criteria = 80.0

        icon = str(row.get(icon_col, "") or "").strip() or None

        rows.append({
            "module_no": module_no,
            "title": title,
            "description": description,
            "passing_criteria": passing_criteria,
            "icon": icon,
        })

    rows.sort(key=lambda row: row["module_no"])
    return rows


def parse_module_file(file_bytes: bytes) -> list[dict]:
    """Read the uploaded module workbook and support both real project templates.

    The authored onboarding module Excel includes a short banner above the data table,
    so the real header row is offset by 3 rows. Older or simpler exports may start
    at row 0, so we try both layouts.
    """
    for header_row in (3, 0):
        try:
            df = pd.read_excel(io.BytesIO(file_bytes), header=header_row)
        except Exception:
            continue

        columns = list(df.columns)
        if _canonical_column(
            columns,
            "Module No.",
            "Module No",
            "Module Number",
            "module_no",
            "Module No ",
        ):
            return parse_module_rows(df)

    return parse_module_rows(pd.read_excel(io.BytesIO(file_bytes)))


ONBOARDING_MODULES = [
    {
        "title": "Engagement Context & Structure",
        "description": "BCG engagement overview, team structure, and key support contacts",
        "rank": 1,
        "passing_criteria": 80,
        "icon": "project_overview",
    },
    {
        "title": "Legal, Compliance & Data Security",
        "description": "Compliance requirements, access setup, data security, and approved AI usage",
        "rank": 2,
        "passing_criteria": 80,
        "icon": "org_structure",
    },
    {
        "title": "Ways of Working & Tools",
        "description": "Timesheets, leave planning, communication norms, and daily collaboration tools",
        "rank": 3,
        "passing_criteria": 80,
        "icon": "working_ways",
    },
    {
        "title": "Engagement & Delivery Excellence",
        "description": "Scope clarity, stakeholder visibility, meeting conduct, GenAI usage, and quality standards",
        "rank": 4,
        "passing_criteria": 80,
        "icon": "compliance_secure",
    },
    {
        "title": "Admin Essentials: Reimbursements",
        "description": "SAP Concur process, required approvals, documentation, and claim submission rules",
        "rank": 5,
        "passing_criteria": 80,
        "icon": "leave_approval",
    },
    {
        "title": "Onboarding Completion & Next Steps",
        "description": "Peer connects, ramp-up planning, squad alignment, and final readiness actions",
        "rank": 6,
        "passing_criteria": 80,
        "icon": "action_checklist",
    },
]


async def seed_onboarding_modules(db: AsyncSession) -> None:
    modules_result = await db.execute(select(OnboardingModule))
    existing_by_rank = {m.rank: m for m in modules_result.scalars().all()}

    for module_data in ONBOARDING_MODULES:
        existing = existing_by_rank.get(module_data["rank"])
        if existing:
            existing.title = module_data["title"]
            existing.description = module_data["description"]
            existing.passing_criteria = module_data["passing_criteria"]
            existing.icon = module_data["icon"]
        else:
            db.add(OnboardingModule(**module_data))

    await db.commit()


async def seed_employee_onboarding_progress(db: AsyncSession, candidate_id: int = 1) -> None:
    """
    Seed employee onboarding progress with dummy data for testing.
    Shows candidate_id passing "Engagement Context & Structure" module with completed video and quiz attempts.
    
    Can be toggled on/off as needed by including/excluding this function call.
    """
    # Find the "Engagement Context & Structure" module
    module_result = await db.execute(
        select(OnboardingModule).where(
            OnboardingModule.title == "Engagement Context & Structure"
        )
    )
    module = module_result.scalar_one_or_none()
    
    if not module:
        return  # Module doesn't exist, skip seeding
    
    module_id = module.id
    
    # Check if data already exists
    result = await db.execute(
        select(OnboardingModuleEmployeeProgress).where(
            OnboardingModuleEmployeeProgress.candidate_id == candidate_id,
            OnboardingModuleEmployeeProgress.module_id == module_id,
        )
    )
    
    if result.scalar_one_or_none():
        return
    
    # Create employee progress record
    now = datetime.utcnow()
    progress = OnboardingModuleEmployeeProgress(
        candidate_id=candidate_id,
        module_id=module_id,
        status="COMPLETED",
        started_date=now - timedelta(days=2),
        video_completed_date=now - timedelta(days=1, hours=1),
        completed_date=now,
    )
    db.add(progress)
    await db.flush()
    
    # Create video progress record
    video_progress = OnboardingModuleVideoProgress(
        employee_progress_id=progress.id,
        video_url="onboarding-module/module-1.mp4",
        current_duration_seconds=1425,
        total_duration_seconds=1425,
        completion_percentage=100.0,
        is_completed=True,
        completed_date=now - timedelta(days=1, hours=1),
    )
    db.add(video_progress)
    await db.flush()
    
    # Create quiz attempt record
    quiz_attempt = OnboardingModuleQuizAttempt(
        employee_progress_id=progress.id,
        quiz_id=None,  # Keep optional in case quiz doesn't exist
        score=85.0,
        passing_status="PASS",
        attempt_number=1,
        time_spent_seconds=840,  # 14 minutes
        attempted_date=now - timedelta(hours=2),
    )
    db.add(quiz_attempt)
    await db.flush()
    
    # Create quiz response records (4 sample Q&A responses)
    responses = [
        {
            "question_id": 1,
            "question_text": "What is the dual-laptop policy at BCG Nagarro?",
            "employee_answer": "One personal laptop for personal work and one company laptop for project work",
            "correct_answer": "One personal laptop for personal work and one company laptop for project work",
            "is_correct": True,
            "time_spent_seconds": 30,
        },
        {
            "question_id": 2,
            "question_text": "Who is the primary escalation point for project issues?",
            "employee_answer": "Project Manager or Team Lead",
            "correct_answer": "Project Manager or Team Lead",
            "is_correct": True,
            "time_spent_seconds": 25,
        },
        {
            "question_id": 3,
            "question_text": "What tools are used for daily standups?",
            "employee_answer": "Slack and Jira",
            "correct_answer": "Slack and Jira",
            "is_correct": True,
            "time_spent_seconds": 20,
        },
        {
            "question_id": 4,
            "question_text": "What is the minimum leave notice period?",
            "employee_answer": "2 weeks for planned leave",
            "correct_answer": "2 weeks for planned leave",
            "is_correct": True,
            "time_spent_seconds": 35,
        },
    ]
    
    for resp in responses:
        response_record = OnboardingModuleQuizResponseModel(
            quiz_attempt_id=quiz_attempt.id,
            **resp,
        )
        db.add(response_record)
    
    await db.commit()


async def seed_module_action_items(db: AsyncSession) -> None:
    """Seed action checklist items for module 6."""
    modules_to_seed = [
        {
            "title": "Onboarding Completion & Next Steps",
            "action_items": [
                {"item_text": "I have completed all mandatory onboarding training modules.", "display_order": 1},
                {"item_text": "I have set up my dual-laptop configuration as per policy.", "display_order": 2},
                {"item_text": "I have reviewed the org structure and know my escalation paths.", "display_order": 3},
                {"item_text": "I have installed all required tools and approved software.", "display_order": 4},
                {"item_text": "I have read and acknowledged the compliance and security policies.", "display_order": 5},
                {"item_text": "I have submitted my first timesheet and expense claim (if applicable).", "display_order": 6},
                {"item_text": "I have introduced myself to the team and scheduled 1:1s with leads.", "display_order": 7},
            ],
        },
    ]

    for item in modules_to_seed:
        module_result = await db.execute(
            select(OnboardingModule).where(OnboardingModule.title == item["title"])
        )
        module = module_result.scalar_one_or_none()
        if not module:
            continue

        existing_items = await db.execute(
            select(OnboardingModuleActionItem).where(
                OnboardingModuleActionItem.module_id == module.id
            ).limit(1)
        )
        if existing_items.scalar_one_or_none():
            continue

        db.add_all([
            OnboardingModuleActionItem(module_id=module.id, **a)
            for a in item["action_items"]
        ])
        await db.commit()


async def seed_candidate_journey(db: AsyncSession, candidate_id: int = 1) -> None:
    """
    Seed a complete, meaningful onboarding journey for a candidate (default candidate_id=1).

    Mirrors the UI gating flow:
      - Module 1 "Engagement Context & Structure": COMPLETED
            video watched to 100%, quiz attempted (failed once, then passed) -> unlocks Module 2.
      - Module 2 "Legal, Compliance & Data Security": VIDEO_COMPLETED
            video watched to 100%, quiz not yet attempted (quiz shown but pending) -> unlocks Module 3.
      - Module 3 "Ways of Working & Tools": VIDEO_IN_PROGRESS
            video partially watched (~45%), quiz still LOCKED until video finishes.
      - Module 4 "Engagement & Delivery Excellence": NOT_STARTED
            module unlocked, available to start, nothing done yet.
      - Module 5 "Admin Essentials: Reimbursements": LOCKED (no progress row).
      - Module 6 "Onboarding Completion & Next Steps": LOCKED (no progress row).

    Can be toggled on/off by including/excluding this function call.
    """
    modules_result = await db.execute(
        select(OnboardingModule).order_by(OnboardingModule.rank)
    )
    modules = modules_result.scalars().all()

    if not modules:
        return  # No modules available to build a journey

    module_by_title = {m.title: m for m in modules}
    now = datetime.utcnow()

    # Helper: fetch quiz questions for a module (if seeded)
    async def get_quiz_questions(module_id: int):
        res = await db.execute(
            select(OnboardingModuleQuiz)
            .where(OnboardingModuleQuiz.module_id == module_id)
            .order_by(OnboardingModuleQuiz.display_order)
        )
        return res.scalars().all()

    # Build quiz responses from quiz questions (or a static fallback sample)
    def build_quiz_responses(quiz_questions, passed: bool):
        if quiz_questions:
            questions = quiz_questions
        else:
            # Static fallback sample used only when no quiz data exists yet.
            questions = [
                type("Q", (), {
                    "id": i + 1,
                    "question_text": txt,
                    "correct_answer": ans,
                    "choices": [ans, "Wrong option A", "Wrong option B", "Wrong option C"],
                })()
                for i, (txt, ans) in enumerate([
                    ("What is the dual-laptop policy at BCG Nagarro?",
                     "One personal laptop for personal work and one company laptop for project work"),
                    ("Who is the primary escalation point for project issues?",
                     "Project Manager or Team Lead"),
                    ("Which tools are used for daily standups at BCG Nagarro?",
                     "Slack and Jira"),
                    ("What is the minimum leave notice period for planned leaves?",
                     "2 weeks for planned leave"),
                ])
            ]

        responses = []
        for q in questions:
            correct_answer = q.correct_answer
            if passed:
                employee_answer = correct_answer
                is_correct = True
            else:
                choices = q.choices or []
                wrong = [c for c in choices if c != correct_answer]
                employee_answer = wrong[0] if wrong else "incorrect"
                is_correct = False
            responses.append({
                "question_id": q.id,
                "question_text": q.question_text,
                "employee_answer": employee_answer,
                "correct_answer": correct_answer,
                "is_correct": is_correct,
                "time_spent_seconds": 30,
            })
        return responses

    VIDEO_S3_URLS = {
        "Engagement Context & Structure": "onboarding-module/module-1.mp4",
        "Legal, Compliance & Data Security": "onboarding-module/module-2.mp4",
        "Ways of Working & Tools": "onboarding-module/module-3.mp4",
        "Engagement & Delivery Excellence": "onboarding-module/module-4.mp4",
        "Admin Essentials: Reimbursements": "onboarding-module/module-5.mp4",
        "Onboarding Completion & Next Steps": "onboarding-module/module-6.mp4",
    }

    VIDEO_STATIC_URLS = {
        "Engagement Context & Structure": "https://harshit-nagarro-git.github.io/onboarding-module-videos/module-videos/module-1.mp4",
        "Legal, Compliance & Data Security": "https://harshit-nagarro-git.github.io/onboarding-module-videos/module-videos/module-2.mp4",
        "Ways of Working & Tools": "https://harshit-nagarro-git.github.io/onboarding-module-videos/module-videos/module-3.mp4",
        "Engagement & Delivery Excellence": "https://harshit-nagarro-git.github.io/onboarding-module-videos/module-videos/module-4.mp4",
        "Admin Essentials: Reimbursements": "https://harshit-nagarro-git.github.io/onboarding-module-videos/module-videos/module-5.mp4",
        "Onboarding Completion & Next Steps": "https://harshit-nagarro-git.github.io/onboarding-module-videos/module-videos/module-6.mp4",
    }

    VIDEO_URLS = VIDEO_S3_URLS if settings.FETCH_VIDEOS_FROM_S3 else VIDEO_STATIC_URLS

    # Per-module journey definition
    journey = {
        "Engagement Context & Structure": {
            "status": "NOT_STARTED",
            "started_date": now - timedelta(days=1),
            "video_completed_date": None,
            "completed_date": None,
            "video": {"current": 0, "total": 1425, "pct": 0.0, "completed": False,
                      "completed_date": None},
            "quiz": {"attempts": []},
        },
        "Legal, Compliance & Data Security": {
            "status": "LOCKED",
            "started_date": None,
            "video_completed_date": None,
            "completed_date": None,
            "video": None,
            "quiz": {"attempts": []},
        },
        "Ways of Working & Tools": {
            "status": "LOCKED",
            "started_date": None,
            "video_completed_date": None,
            "completed_date": None,
            "video": None,
            "quiz": {"attempts": []},
        },
        "Engagement & Delivery Excellence": {
            "status": "LOCKED",
            "started_date": None,
            "video_completed_date": None,
            "completed_date": None,
            "video": None,
            "quiz": {"attempts": []},
        },
        "Admin Essentials: Reimbursements": {
            "status": "LOCKED",
            "started_date": None,
            "video_completed_date": None,
            "completed_date": None,
            "video": None,
            "quiz": {"attempts": []},
        },
        "Onboarding Completion & Next Steps": {
            "status": "LOCKED",
            "started_date": None,
            "video_completed_date": None,
            "completed_date": None,
            "video": None,
            "quiz": {"attempts": []},
        },
    }

    # Reset any persisted Onboarding Completion & Next Steps for the candidate so the action list
    # starts unchecked on reseed (otherwise a previously saved/completed checklist
    # would make every item appear checked).
    action_module = module_by_title.get("Onboarding Completion & Next Steps")
    if action_module:
        existing_checklists = await db.execute(
            select(OnboardingModuleCandidateChecklist).where(
                OnboardingModuleCandidateChecklist.candidate_id == candidate_id,
                OnboardingModuleCandidateChecklist.module_id == action_module.id,
            )
        )
        for checklist in existing_checklists.scalars().all():
            await db.delete(checklist)

    for title, state in journey.items():
        module = module_by_title.get(title)
        if not module:
            continue

        existing_progress = await db.execute(
            select(OnboardingModuleEmployeeProgress).where(
                OnboardingModuleEmployeeProgress.candidate_id == candidate_id,
                OnboardingModuleEmployeeProgress.module_id == module.id,
            )
        )
        progress = existing_progress.scalar_one_or_none()

        if state["status"] == "LOCKED":
            if progress:
                await db.delete(progress)
            continue

        if not progress:
            progress = OnboardingModuleEmployeeProgress(
                candidate_id=candidate_id,
                module_id=module.id,
                status=state["status"],
                started_date=state["started_date"],
                video_completed_date=state["video_completed_date"],
                completed_date=state["completed_date"],
            )
            db.add(progress)
            await db.flush()
        else:
            progress.status = state["status"]
            progress.started_date = state["started_date"]
            progress.video_completed_date = state["video_completed_date"]
            progress.completed_date = state["completed_date"]

        existing_video = await db.execute(
            select(OnboardingModuleVideoProgress).where(
                OnboardingModuleVideoProgress.employee_progress_id == progress.id
            )
        )
        video_record = existing_video.scalar_one_or_none()

        video_url = VIDEO_URLS.get(title)
        if video_url:
            if state["video"]:
                v = state["video"]
                if video_record:
                    video_record.video_url = video_url
                    video_record.current_duration_seconds = v["current"]
                    video_record.total_duration_seconds = v["total"]
                    video_record.completion_percentage = v["pct"]
                    video_record.is_completed = v["completed"]
                    video_record.completed_date = v["completed_date"]
                else:
                    video_progress = OnboardingModuleVideoProgress(
                        employee_progress_id=progress.id,
                        video_url=video_url,
                        current_duration_seconds=v["current"],
                        total_duration_seconds=v["total"],
                        completion_percentage=v["pct"],
                        is_completed=v["completed"],
                        completed_date=v["completed_date"],
                    )
                    db.add(video_progress)
            else:
                if video_record:
                    video_record.video_url = video_url
                    video_record.current_duration_seconds = 0
                    video_record.total_duration_seconds = 0
                    video_record.completion_percentage = 0.0
                    video_record.is_completed = False
                    video_record.completed_date = None
                else:
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
        elif video_record:
            await db.delete(video_record)

        existing_attempts = await db.execute(
            select(OnboardingModuleQuizAttempt).where(
                OnboardingModuleQuizAttempt.employee_progress_id == progress.id
            )
        )
        for old_attempt in existing_attempts.scalars().all():
            await db.delete(old_attempt)

        quiz_questions = await get_quiz_questions(module.id)
        for attempt in state["quiz"]["attempts"]:
            quiz_attempt = OnboardingModuleQuizAttempt(
                employee_progress_id=progress.id,
                quiz_id=None,
                score=attempt["score"],
                passing_status=attempt["passing_status"],
                attempt_number=attempt["attempt_number"],
                time_spent_seconds=attempt["time_spent_seconds"],
                attempted_date=attempt["attempted_date"],
            )
            db.add(quiz_attempt)
            await db.flush()

            for resp in build_quiz_responses(quiz_questions, attempt["passed"]):
                db.add(OnboardingModuleQuizResponseModel(
                    quiz_attempt_id=quiz_attempt.id,
                    **resp,
                ))

    await db.commit()