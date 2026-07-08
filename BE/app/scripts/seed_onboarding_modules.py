from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from datetime import datetime, timedelta

from app.db.models import (
    OnboardingModule,
    OnboardingModuleEmployeeProgress,
    OnboardingModuleVideoProgress,
    OnboardingModuleQuizAttempt,
    OnboardingModuleQuizResponseModel,
    OnboardingModuleQuiz,
    OnboardingModuleKeyConcept,
)


ONBOARDING_MODULES = [
    {
        "title": "Welcome & Project Overview",
        "description": "Understanding BCG, the engagement model, dual-laptop policy, and your office setup",
        "rank": 1,
        "passing_criteria": 80,
        "icon": "project_overview",
    },
    {
        "title": "Who's Who & Org Structure",
        "description": "Nagarro & BCG hierarchy, escalation paths, roles and responsibilities",
        "rank": 2,
        "passing_criteria": 80,
        "icon": "org_structure",
    },
    {
        "title": "Ways of Working & Tools",
        "description": "Agile rituals, Slack, Jira, Confluence, timesheet rules, leave culture, and feedback norms",
        "rank": 3,
        "passing_criteria": 80,
        "icon": "working_ways",
    },
    {
        "title": "Compliance, Security & Assets",
        "description": "Data security, NDA obligations, BCG laptop rules, VDI setup, and compliance training deadlines",
        "rank": 4,
        "passing_criteria": 80,
        "icon": "compliance_secure",
    },
    {
        "title": "Leave, Reimbursements & Essentials",
        "description": "Leave approval chain, holiday calendar, SAP Concur, Work Package IDs, and Ginger commands",
        "rank": 5,
        "passing_criteria": 80,
        "icon": "leave_approval",
    },
    {
        "title": "Action Checklist",
        "description": "The final gate. Self-declare each action you've completed. 100% = Engagement Clearance Certificate.",
        "rank": 6,
        "passing_criteria": 80,
        "icon": "action_checklist",
    },
]


async def seed_onboarding_modules(db: AsyncSession) -> None:
    result = await db.execute(
        select(OnboardingModule).limit(1)
    )

    if result.scalar_one_or_none():
        return

    db.add_all(
        [OnboardingModule(**module) for module in ONBOARDING_MODULES]
    )

    await db.commit()


async def seed_employee_onboarding_progress(db: AsyncSession, candidate_id: int = 1) -> None:
    """
    Seed employee onboarding progress with dummy data for testing.
    Shows candidate_id passing "Welcome & Project Overview" module with completed video and quiz attempts.
    
    Can be toggled on/off as needed by including/excluding this function call.
    """
    # Find the "Welcome & Project Overview" module
    module_result = await db.execute(
        select(OnboardingModule).where(
            OnboardingModule.title == "Welcome & Project Overview"
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
        video_url="https://example.com/videos/module-1-intro.mp4",
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


async def seed_module_quiz(db: AsyncSession) -> None:
    """
    Seed quiz questions for "Welcome & Project Overview" module.
    Can be toggled on/off as needed.
    """
    # Find the "Welcome & Project Overview" module
    module_result = await db.execute(
        select(OnboardingModule).where(
            OnboardingModule.title == "Welcome & Project Overview"
        )
    )
    module = module_result.scalar_one_or_none()
    
    if not module:
        return
    
    # Check if quiz already exists for this module
    existing_quiz = await db.execute(
        select(OnboardingModuleQuiz).where(
            OnboardingModuleQuiz.module_id == module.id
        ).limit(1)
    )
    
    if existing_quiz.scalar_one_or_none():
        return
    
    # Create quiz questions
    quiz_data = [
        {
            "module_id": module.id,
            "question_text": "What is the dual-laptop policy at BCG Nagarro?",
            "question_type": "MCQ",
            "choices": [
                "One personal laptop for personal work and one company laptop for project work",
                "Only company-provided laptop is required",
                "Personal choice of laptop",
                "No specific policy",
            ],
            "correct_answer": "One personal laptop for personal work and one company laptop for project work",
            "display_order": 1,
            "points": 1,
        },
        {
            "module_id": module.id,
            "question_text": "Who is the primary escalation point for project issues?",
            "question_type": "MCQ",
            "choices": [
                "Project Manager or Team Lead",
                "HR Department",
                "Finance Team",
                "Senior Management",
            ],
            "correct_answer": "Project Manager or Team Lead",
            "display_order": 2,
            "points": 1,
        },
        {
            "module_id": module.id,
            "question_text": "Which tools are used for daily standups at BCG Nagarro?",
            "question_type": "MCQ",
            "choices": [
                "Slack and Jira",
                "Email and Excel",
                "Teams and Asana",
                "WhatsApp and Spreadsheets",
            ],
            "correct_answer": "Slack and Jira",
            "display_order": 3,
            "points": 1,
        },
        {
            "module_id": module.id,
            "question_text": "What is the minimum leave notice period for planned leaves?",
            "question_type": "MCQ",
            "choices": [
                "2 weeks for planned leave",
                "1 week",
                "1 month",
                "Immediate leave is allowed",
            ],
            "correct_answer": "2 weeks for planned leave",
            "display_order": 4,
            "points": 1,
        },
    ]
    
    db.add_all([OnboardingModuleQuiz(**q) for q in quiz_data])
    await db.commit()


async def seed_module_key_concepts(db: AsyncSession) -> None:
    """
    Seed key concepts for "Welcome & Project Overview" module.
    Can be toggled on/off as needed.
    """
    # Find the "Welcome & Project Overview" module
    module_result = await db.execute(
        select(OnboardingModule).where(
            OnboardingModule.title == "Welcome & Project Overview"
        )
    )
    module = module_result.scalar_one_or_none()
    
    if not module:
        return
    
    # Check if key concepts already exist for this module
    existing_concepts = await db.execute(
        select(OnboardingModuleKeyConcept).where(
            OnboardingModuleKeyConcept.module_id == module.id
        ).limit(1)
    )
    
    if existing_concepts.scalar_one_or_none():
        return
    
    # Create key concepts
    concepts_data = [
        {
            "module_id": module.id,
            "title": "Dual-Laptop Policy",
            "description": "Understanding the dual-laptop setup: one personal laptop for personal use and one company-provided laptop for BCG project work to ensure data security and compliance.",
            "display_order": 1,
        },
        {
            "module_id": module.id,
            "title": "Engagement Model",
            "description": "BCG's engagement model focuses on client success, collaborative teamwork, and continuous learning. Every consultant is empowered to contribute ideas and drive impact.",
            "display_order": 2,
        },
        {
            "module_id": module.id,
            "title": "Office Setup & Resources",
            "description": "Your office workspace includes access to meeting rooms, collaboration zones, wellness facilities, and IT support. Familiarize yourself with the office layout and available resources.",
            "display_order": 3,
        },
        {
            "module_id": module.id,
            "title": "Project Overview Documents",
            "description": "Review the project charter, stakeholder list, and key deliverables. Understand the project timeline, milestones, and success metrics before your first day.",
            "display_order": 4,
        },
        {
            "module_id": module.id,
            "title": "Communication Channels",
            "description": "Primary communication happens via Slack for instant messaging, email for formal communications, and Jira for project tracking. Ensure your profiles are set up correctly.",
            "display_order": 5,
        },
        {
            "module_id": module.id,
            "title": "Getting Started Checklist",
            "description": "Complete all prerequisite tasks including account setup, security training, software installations, and team introductions before your first project assignment.",
            "display_order": 6,
        },
    ]
    
    db.add_all([OnboardingModuleKeyConcept(**c) for c in concepts_data])
    await db.commit()


async def seed_candidate_journey(db: AsyncSession, candidate_id: int = 1) -> None:
    """
    Seed a complete, meaningful onboarding journey for a candidate (default candidate_id=1).

    Mirrors the UI gating flow:
      - Module 1 "Welcome & Project Overview": COMPLETED
            video watched to 100%, quiz attempted (failed once, then passed) -> unlocks Module 2.
      - Module 2 "Who's Who & Org Structure": VIDEO_COMPLETED
            video watched to 100%, quiz not yet attempted (quiz shown but pending) -> unlocks Module 3.
      - Module 3 "Ways of Working & Tools": VIDEO_IN_PROGRESS
            video partially watched (~45%), quiz still LOCKED until video finishes.
      - Module 4 "Compliance, Security & Assets": NOT_STARTED
            module unlocked, available to start, nothing done yet.
      - Module 5 "Leave, Reimbursements & Essentials": LOCKED (no progress row).
      - Module 6 "Action Checklist": LOCKED (no progress row).

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
            # Static fallback sample (used if seed_module_quiz was not run)
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

    VIDEO_URLS = {
        "Welcome & Project Overview": "https://puneetbanga15.github.io/bcg-onboarding/videos/step1.mp4",
        "Who's Who & Org Structure": "https://example.com/videos/module-2-org-structure.mp4",
        "Ways of Working & Tools": "https://example.com/videos/module-3-ways-of-working.mp4",
        "Compliance, Security & Assets": "https://example.com/videos/module-4-compliance.mp4",
        "Leave, Reimbursements & Essentials": "https://example.com/videos/module-5-leave.mp4",
        "Action Checklist": "https://example.com/videos/module-6-checklist.mp4",
    }

    # Per-module journey definition
    journey = {
        "Welcome & Project Overview": {
            "status": "COMPLETED",
            "started_date": now - timedelta(days=5),
            "video_completed_date": now - timedelta(days=4),
            "completed_date": now - timedelta(days=3),
            "video": {"current": 1425, "total": 1425, "pct": 100.0, "completed": True,
                      "completed_date": now - timedelta(days=4)},
            "quiz": {
                "attempts": [
                    {
                        "score": 50.0, "passing_status": "FAIL", "attempt_number": 1,
                        "time_spent_seconds": 600, "attempted_date": now - timedelta(days=3, hours=2),
                        "passed": False,
                    },
                    {
                        "score": 90.0, "passing_status": "PASS", "attempt_number": 2,
                        "time_spent_seconds": 700, "attempted_date": now - timedelta(days=3),
                        "passed": True,
                    },
                ]
            },
        },
        "Who's Who & Org Structure": {
            "status": "VIDEO_COMPLETED",
            "started_date": now - timedelta(days=2),
            "video_completed_date": now - timedelta(days=1),
            "completed_date": None,
            "video": {"current": 980, "total": 980, "pct": 100.0, "completed": True,
                      "completed_date": now - timedelta(days=1)},
            "quiz": {"attempts": []},
        },
        "Ways of Working & Tools": {
            "status": "VIDEO_IN_PROGRESS",
            "started_date": now - timedelta(days=1),
            "video_completed_date": None,
            "completed_date": None,
            "video": {"current": 320, "total": 711, "pct": 45.0, "completed": False,
                      "completed_date": None},
            "quiz": {"attempts": []},
        },
        "Compliance, Security & Assets": {
            "status": "NOT_STARTED",
            "started_date": None,
            "video_completed_date": None,
            "completed_date": None,
            "video": None,
            "quiz": {"attempts": []},
        },
        "Leave, Reimbursements & Essentials": {
            "status": "LOCKED",
            "started_date": None,
            "video_completed_date": None,
            "completed_date": None,
            "video": None,
            "quiz": {"attempts": []},
        },
        "Action Checklist": {
            "status": "LOCKED",
            "started_date": None,
            "video_completed_date": None,
            "completed_date": None,
            "video": None,
            "quiz": {"attempts": []},
        },
    }

    for title, state in journey.items():
        module = module_by_title.get(title)
        if not module:
            continue

        # Idempotency: skip a module already seeded for this candidate
        existing = await db.execute(
            select(OnboardingModuleEmployeeProgress).where(
                OnboardingModuleEmployeeProgress.candidate_id == candidate_id,
                OnboardingModuleEmployeeProgress.module_id == module.id,
            )
        )
        if existing.scalar_one_or_none():
            continue

        # LOCKED modules have no progress row yet (they are locked in the UI)
        if state["status"] == "LOCKED":
            continue

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

        # Video progress
        if state["video"]:
            v = state["video"]
            video_progress = OnboardingModuleVideoProgress(
                employee_progress_id=progress.id,
                video_url=VIDEO_URLS.get(title, "https://example.com/videos/unknown.mp4"),
                current_duration_seconds=v["current"],
                total_duration_seconds=v["total"],
                completion_percentage=v["pct"],
                is_completed=v["completed"],
                completed_date=v["completed_date"],
            )
            db.add(video_progress)
            await db.flush()

        # Quiz attempts + responses
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