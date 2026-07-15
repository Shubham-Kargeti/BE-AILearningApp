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
    OnboardingModuleActionItem,
    OnboardingModuleCandidateChecklist,
)


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


async def seed_module_quiz(db: AsyncSession) -> None:
    """
    Seed quiz questions for onboarding modules.
    Can be toggled on/off as needed.
    """
    modules_to_seed = [
        {
            "title": "Engagement Context & Structure",
            "quiz_data": [
                {
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
            ],
        },
        {
            "title": "Legal, Compliance & Data Security",
            "quiz_data": [
                {
                    "question_text": "What best describes BCG Nagarro's leadership structure?",
                    "question_type": "MCQ",
                    "choices": [
                        "Flat hierarchy with direct access to leadership",
                        "BCG leads client strategy and Nagarro leads engineering delivery",
                        "Nagarro manages all client relationships",
                        "No formal structure",
                    ],
                    "correct_answer": "BCG leads client strategy and Nagarro leads engineering delivery",
                    "display_order": 1,
                    "points": 1,
                },
                {
                    "question_text": "Who defines project KPIs for delivery teams?",
                    "question_type": "MCQ",
                    "choices": [
                        "Engagement Manager / Delivery Lead",
                        "HR",
                        "Finance",
                        "Individual contributors",
                    ],
                    "correct_answer": "Engagement Manager / Delivery Lead",
                    "display_order": 2,
                    "points": 1,
                },
                {
                    "question_text": "How should a blocking delivery risk be escalated?",
                    "question_type": "SCENARIO",
                    "choices": [],
                    "correct_answer": "",
                    "display_order": 3,
                    "points": 1,
                },
                {
                    "question_text": "Which profile should you update for project role clarity and visibility?",
                    "question_type": "MCQ",
                    "choices": [
                        "Internal HRMS and project tool profiles",
                        "Only LinkedIn",
                        "Only timesheet tool",
                        "Only email signature",
                    ],
                    "correct_answer": "Internal HRMS and project tool profiles",
                    "display_order": 4,
                    "points": 1,
                },
            ],
        },
        {
            "title": "Ways of Working & Tools",
            "quiz_data": [
                {
                    "question_text": "Which tool is primarily used for project task tracking?",
                    "question_type": "MCQ",
                    "choices": [
                        "Jira",
                        "PowerPoint",
                        "Outlook calendar only",
                        "Files shared on chat",
                    ],
                    "correct_answer": "Jira",
                    "display_order": 1,
                    "points": 1,
                },
                {
                    "question_text": "A daily 15-minute check-in with your team is most likely referring to which ritual?",
                    "question_type": "SCENARIO",
                    "choices": [],
                    "correct_answer": "",
                    "display_order": 2,
                    "points": 1,
                },
                {
                    "question_text": "Where should work-related project updates normally be recorded instead of personal chat threads?",
                    "question_type": "MCQ",
                    "choices": [
                        "Confluence and Jira",
                        "Personal notes only",
                        "WhatsApp group",
                        "Email drafts",
                    ],
                    "correct_answer": "Confluence and Jira",
                    "display_order": 3,
                    "points": 1,
                },
                {
                    "question_text": "What is the best practice when a feedback item is assigned to you after a review session?",
                    "question_type": "MCQ",
                    "choices": [
                        "Acknowledge it and create a follow-up action",
                        "Ignore it until reminded again",
                        "Forward it to another teammate",
                        "Delete the feedback note",
                    ],
                    "correct_answer": "Acknowledge it and create a follow-up action",
                    "display_order": 4,
                    "points": 1,
                },
            ],
        },
        {
            "title": "Engagement & Delivery Excellence",
            "quiz_data": [
                {
                    "question_text": "Which action is safest when you receive an external email with an unexpected attachment?",
                    "question_type": "MCQ",
                    "choices": [
                        "Do not open it and report it to IT security",
                        "Open it immediately to check what it contains",
                        "Forward it to friends in the team",
                        "Upload it to a shared drive first",
                    ],
                    "correct_answer": "Do not open it and report it to IT security",
                    "display_order": 1,
                    "points": 1,
                },
                {
                    "question_text": "Who must approve access to sensitive project data before you share it outside the workspace?",
                    "question_type": "SCENARIO",
                    "choices": [
                        "Your Delivery Lead and Information Security",
                        "Any peer in the same project",
                        "The office admin team only",
                        "No approval is needed for internal data",
                    ],
                    "correct_answer": "Your Delivery Lead and Information Security",
                    "display_order": 2,
                    "points": 1,
                },
                {
                    "question_text": "What is the main purpose of an NDA in client engagements?",
                    "question_type": "MCQ",
                    "choices": [
                        "Protect confidential client and company information",
                        "Speed up laptop setup",
                        "Record daily attendance",
                        "Assign parking slots",
                    ],
                    "correct_answer": "Protect confidential client and company information",
                    "display_order": 3,
                    "points": 1,
                },
                {
                    "question_text": "If you lose your company laptop or mobile device, what should you do first?",
                    "question_type": "MCQ",
                    "choices": [
                        "Report it to IT security immediately",
                        "Wait to see if someone returns it",
                        "Buy a replacement yourself",
                        "Use personal email to recover accounts only",
                    ],
                    "correct_answer": "Report it to IT security immediately",
                    "display_order": 4,
                    "points": 1,
                },
            ],
        },
        {
            "title": "Admin Essentials: Reimbursements",
            "quiz_data": [
                {
                    "question_text": "Which platform is typically used for travel and expense reimbursements?",
                    "question_type": "MCQ",
                    "choices": [
                        "SAP Concur",
                        "Jira",
                        "Slack expense bot",
                        "Personal spreadsheet",
                    ],
                    "correct_answer": "SAP Concur",
                    "display_order": 1,
                    "points": 1,
                },
                {
                    "question_text": "Before taking planned leave, what is the minimum expected action?",
                    "question_type": "SCENARIO",
                    "choices": [
                        "Apply in the leave system and inform your lead",
                        "Message your team only on chat",
                        "Wait until returning from leave",
                        "Send a personal email to HR only",
                    ],
                    "correct_answer": "Apply in the leave system and inform your lead",
                    "display_order": 2,
                    "points": 1,
                },
                {
                    "question_text": "What is the best source for upcoming public holidays and blackout dates?",
                    "question_type": "MCQ",
                    "choices": [
                        "Official company holiday calendar",
                        "Teammate memory",
                        "Random website",
                        "Previous year's calendar by guess",
                    ],
                    "correct_answer": "Official company holiday calendar",
                    "display_order": 3,
                    "points": 1,
                },
                {
                    "question_text": "Which detail is most important while submitting an expense claim?",
                    "question_type": "MCQ",
                    "choices": [
                        "Valid receipt, correct amount, and relevant project/cost center",
                        "Screenshot of payment app only",
                        "Colleague approval text message",
                        "Only the total amount",
                    ],
                    "correct_answer": "Valid receipt, correct amount, and relevant project/cost center",
                    "display_order": 4,
                    "points": 1,
                },
            ],
        },
        {
            "title": "Onboarding Completion & Next Steps",
            "quiz_data": [],
            "action_items": [
                {
                    "item_text": "I have completed all mandatory onboarding training modules.",
                    "display_order": 1,
                },
                {
                    "item_text": "I have set up my dual-laptop configuration as per policy.",
                    "display_order": 2,
                },
                {
                    "item_text": "I have reviewed the org structure and know my escalation paths.",
                    "display_order": 3,
                },
                {
                    "item_text": "I have installed all required tools and approved software.",
                    "display_order": 4,
                },
                {
                    "item_text": "I have read and acknowledged the compliance and security policies.",
                    "display_order": 5,
                },
                {
                    "item_text": "I have submitted my first timesheet and expense claim (if applicable).",
                    "display_order": 6,
                },
                {
                    "item_text": "I have introduced myself to the team and scheduled 1:1s with leads.",
                    "display_order": 7,
                },
            ],
        },
    ]

    for item in modules_to_seed:
        module_result = await db.execute(
            select(OnboardingModule).where(
                OnboardingModule.title == item["title"]
            )
        )
        module = module_result.scalar_one_or_none()
        if not module:
            continue

        existing_quiz = await db.execute(
            select(OnboardingModuleQuiz).where(
                OnboardingModuleQuiz.module_id == module.id
            ).limit(1)
        )
        if existing_quiz.scalar_one_or_none():
            continue

        db.add_all([
            OnboardingModuleQuiz(module_id=module.id, **q)
            for q in item["quiz_data"]
        ])
        await db.commit()


async def seed_module_key_concepts(db: AsyncSession) -> None:
    """
    Seed key concepts for onboarding modules.
    Can be toggled on/off as needed.
    """
    modules_to_seed = [
        {
            "title": "Engagement Context & Structure",
            "concepts": [
                {
                    "title": "Dual-Laptop Policy",
                    "description": "Understanding the dual-laptop setup: one personal laptop for personal use and one company-provided laptop for BCG project work to ensure data security and compliance.",
                    "display_order": 1,
                },
                {
                    "title": "Engagement Model",
                    "description": "BCG's engagement model focuses on client success, collaborative teamwork, and continuous learning. Every consultant is empowered to contribute ideas and drive impact.",
                    "display_order": 2,
                },
                {
                    "title": "Office Setup & Resources",
                    "description": "Your office workspace includes access to meeting rooms, collaboration zones, wellness facilities, and IT support. Familiarize yourself with the office layout and available resources.",
                    "display_order": 3,
                },
                {
                    "title": "Project Overview Documents",
                    "description": "Review the project charter, stakeholder list, and key deliverables. Understand the project timeline, milestones, and success metrics before your first day.",
                    "display_order": 4,
                },
                {
                    "title": "Communication Channels",
                    "description": "Primary communication happens via Slack for instant messaging, email for formal communications, and Jira for project tracking. Ensure your profiles are set up correctly.",
                    "display_order": 5,
                },
                {
                    "title": "Getting Started Checklist",
                    "description": "Complete all prerequisite tasks including account setup, security training, software installations, and team introductions before your first project assignment.",
                    "display_order": 6,
                },
            ],
        },
        {
            "title": "Legal, Compliance & Data Security",
            "concepts": [
                {
                    "title": "BCG-Nagarro Operating Model",
                    "description": "BCG defines client strategy and Nagarro owns engineering delivery. Clear accountability exists across consulting, delivery, and support teams.",
                    "display_order": 1,
                },
                {
                    "title": "Org Hierarchy",
                    "description": "Typical flow: Delivery Lead / Engagement Manager -> Module Lead -> Senior Consultant -> Consultant -> Associate.",
                    "display_order": 2,
                },
                {
                    "title": "Escalation Paths",
                    "description": "Delivery issues escalate to the Delivery Lead, then to the Engagement Manager. People or HR concerns go to HRBP.",
                    "display_order": 3,
                },
                {
                    "title": "RACI Awareness",
                    "description": "Know who is Responsible, Accountable, Consulted, and Informed for each workstream before starting assignments.",
                    "display_order": 4,
                },
                {
                    "title": "Tools for Visibility",
                    "description": "Use the org chart tool, HRMS, and project roster to understand team structures, reporting lines, and contact information.",
                    "display_order": 5,
                },
            ],
        },
        {
            "title": "Ways of Working & Tools",
            "concepts": [
                {
                    "title": "Agile Delivery Rhythms",
                    "description": "Daily standups, sprint planning, review, and retrospective ceremonies keep delivery predictable and aligned.",
                    "display_order": 1,
                },
                {
                    "title": "Task Tracking",
                    "description": "Jira tickets should be kept current with status, assignee, blockers, and acceptance criteria.",
                    "display_order": 2,
                },
                {
                    "title": "Documentation Standards",
                    "description": "Confluence pages should be updated after major decisions, incidents, and handovers.",
                    "display_order": 3,
                },
                {
                    "title": "Communication Etiquette",
                    "description": "Use Slack for instant messaging, email for formal comms, calendar invites for meetings, and project tools for work artifacts.",
                    "display_order": 4,
                },
                {
                    "title": "Feedback Norms",
                    "description": "Give timely, specific, behavior-focused feedback; receive it without defensiveness and convert it into actions.",
                    "display_order": 5,
                },
            ],
        },
        {
            "title": "Engagement & Delivery Excellence",
            "concepts": [
                {
                    "title": "Data Classification",
                    "description": "Understand public, internal, confidential, and restricted data labels, and handle information accordingly.",
                    "display_order": 1,
                },
                {
                    "title": "Secure Laptop Setup",
                    "description": "Enable encryption, VPN, antivirus, auto-lock, and approved browser extensions before accessing systems.",
                    "display_order": 2,
                },
                {
                    "title": "Phishing Awareness",
                    "description": "Look for suspicious sender addresses, unexpected attachments, urgency tricks, and mismatched URLs.",
                    "display_order": 3,
                },
                {
                    "title": "Incident Reporting",
                    "description": "Report suspected breaches, lost devices, and policy violations immediately to the security team.",
                    "display_order": 4,
                },
                {
                    "title": "Audit Readiness",
                    "description": "Keep approvals, training records, and access logs current for internal and client audits.",
                    "display_order": 5,
                },
            ],
        },
        {
            "title": "Admin Essentials: Reimbursements",
            "concepts": [
                {
                    "title": "Leave Workflow",
                    "description": "Apply in the leave system, notify your lead, and ensure handover notes exist before long absences.",
                    "display_order": 1,
                },
                {
                    "title": "Expense Submission",
                    "description": "Submit within policy timelines with valid receipts and correct cost center/code mapping.",
                    "display_order": 2,
                },
                {
                    "title": "Holiday Calendar",
                    "description": "Use the official holiday calendar to plan delivery milestones, client coverage, and release schedules.",
                    "display_order": 3,
                },
                {
                    "title": "Work Package IDs",
                    "description": "Always tag time and expenses to the correct work package or project code for accurate billing.",
                    "display_order": 4,
                },
                {
                    "title": "Support Contacts",
                    "description": "Know the right contacts for HR, IT, facilities, finance, and compliance questions.",
                    "display_order": 5,
                },
            ],
        },
        {
            "title": "Onboarding Completion & Next Steps",
            "concepts": [
                {
                    "title": "Completion Criteria",
                    "description": "All mandatory setup, training, approvals, and acknowledgement steps must be marked complete before clearance.",
                    "display_order": 1,
                },
                {
                    "title": "Escalation Path",
                    "description": "If a checklist item is blocked, escalate to your lead or HR contact with clear blockers and timelines.",
                    "display_order": 2,
                },
                {
                    "title": "Documentation Handoff",
                    "description": "Ensure account setups, access lists, onboarding notes, and asset handovers are documented.",
                    "display_order": 3,
                },
                {
                    "title": "Final Confirmation",
                    "description": "Confirm completion formally, get acknowledgment, and retain onboarding closure evidence.",
                    "display_order": 4,
                },
            ],
        },
    ]

    for item in modules_to_seed:
        module_result = await db.execute(
            select(OnboardingModule).where(
                OnboardingModule.title == item["title"]
            )
        )
        module = module_result.scalar_one_or_none()
        if not module:
            continue

        existing_concepts = await db.execute(
            select(OnboardingModuleKeyConcept).where(
                OnboardingModuleKeyConcept.module_id == module.id
            ).limit(1)
        )
        if existing_concepts.scalar_one_or_none():
            continue

        db.add_all([
            OnboardingModuleKeyConcept(module_id=module.id, **c)
            for c in item["concepts"]
        ])
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
        "Engagement Context & Structure": "onboarding-module/module-1.mp4",
        "Legal, Compliance & Data Security": "onboarding-module/module-2.mp4",
        "Ways of Working & Tools": "onboarding-module/module-3.mp4",
        "Engagement & Delivery Excellence": "onboarding-module/module-4.mp4",
        "Admin Essentials: Reimbursements": "onboarding-module/module-5.mp4",
        "Onboarding Completion & Next Steps": "onboarding-module/module-6.mp4",
    }

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