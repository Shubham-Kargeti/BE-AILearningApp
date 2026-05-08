"""Learning Path API - Generate personalized learning paths from test results."""
from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, func, desc
from typing import Any, Iterable, Optional
import logging
from pydantic import BaseModel
from app.core.dependencies import get_current_user, admin_required
from datetime import datetime

from app.db.session import get_db
from app.db.models import TestSession, Answer, Question, QuestionSet, User, Assessment, LearningPath


from app.models.schemas import RecommendedCoursesResponse

class PushLearningPathRequest(BaseModel):
    session_id: str
    topic: str
    recommended_courses: list


class SelfLearningPathRequest(BaseModel):
    session_id: str


def serialize_learning_path(path: LearningPath) -> dict:
    return {
        "id": path.id,
        "learning_path_id": path.learning_path_id,
        "session_id": path.session_id,
        "assessment_id": path.assessment_public_id,
        "assessment_title": path.assessment_title,
        "employee_email": path.employee_email,
        "employee_name": path.employee_name,
        "topic": path.topic,
        "recommended_courses": path.recommended_courses or [],
        "course_count": len(path.recommended_courses or []),
        "created_at": path.created_at,
        "updated_at": path.updated_at,
    }


async def get_assessment_for_session(db: AsyncSession, session: TestSession) -> Optional[Assessment]:
    if not session.question_set_id:
        return None

    result = await db.execute(
        select(Assessment)
        .where(Assessment.question_set_id == session.question_set_id)
        .order_by(desc(Assessment.created_at))
        .limit(1)
    )
    return result.scalar_one_or_none()


def build_self_assessed_title(topic: str) -> str:
    date_label = datetime.now().strftime("%b %d, %Y")
    skill_label = (topic or "General").strip()
    return f"Self assessed learning path - {date_label} - {skill_label}"


GENERIC_TOPIC_LABELS = {
    "",
    "general",
    "mixed",
    "multiple-skills",
    "multiple skills",
    "unknown",
}


def _clean_topic(value: Any) -> str:
    return " ".join(str(value or "").replace("_", " ").split()).strip()


def _is_specific_topic(value: Any) -> bool:
    topic = _clean_topic(value)
    return bool(topic) and topic.casefold() not in GENERIC_TOPIC_LABELS


def _append_topic(topics: list[str], seen: set[str], value: Any) -> None:
    if isinstance(value, dict):
        for nested in value.values():
            _append_topic(topics, seen, nested)
        return

    if isinstance(value, (list, tuple, set)):
        for nested in value:
            _append_topic(topics, seen, nested)
        return

    topic = _clean_topic(value)
    key = topic.casefold()
    if _is_specific_topic(topic) and key not in seen:
        seen.add(key)
        topics.append(topic)


def _topics_from_mapping(mapping: dict) -> list[str]:
    topics: list[str] = []
    seen: set[str] = set()
    for key in (
        "topic",
        "topics",
        "skill",
        "skills",
        "focus_area",
        "focus_areas",
        "competency",
        "competencies",
        "category",
        "tags",
        "language",
    ):
        if key in mapping:
            _append_topic(topics, seen, mapping.get(key))
    return topics


def _assessment_skill_topics(assessment: Optional[Assessment]) -> list[str]:
    topics: list[str] = []
    seen: set[str] = set()

    if not assessment:
        return topics

    required_skills = assessment.required_skills or {}
    if isinstance(required_skills, dict):
        for skill in required_skills.keys():
            _append_topic(topics, seen, skill)
    elif isinstance(required_skills, list):
        _append_topic(topics, seen, required_skills)

    skill_configuration = getattr(assessment, "skill_configuration", None) or {}
    if isinstance(skill_configuration, dict):
        for skill in skill_configuration.keys():
            _append_topic(topics, seen, skill)

    return topics


def _assessment_topics(assessment: Optional[Assessment]) -> list[str]:
    topics = _assessment_skill_topics(assessment)
    seen = {topic.casefold() for topic in topics}

    if not assessment:
        return topics

    _append_topic(topics, seen, getattr(assessment, "required_roles", None) or [])
    _append_topic(topics, seen, getattr(assessment, "job_title", None))
    return topics


def _topic_terms(topic: str) -> set[str]:
    return {
        term
        for term in _clean_topic(topic).casefold().replace("/", " ").replace("-", " ").split()
        if len(term) > 3
    }


def _matching_assessment_topics(question_text: str, topics: Iterable[str]) -> list[str]:
    normalized_text = _clean_topic(question_text).casefold()
    matches = []
    for topic in topics:
        normalized_topic = _clean_topic(topic).casefold()
        if normalized_topic and normalized_topic in normalized_text:
            matches.append(topic)
            continue
        if any(term in normalized_text for term in _topic_terms(topic)):
            matches.append(topic)
    return matches

router = APIRouter()
logger = logging.getLogger(__name__)

# Import course recommendation logic from recommended_courses
from app.api.recommended_courses import recommend_courses_for_topic, sanitize_for_json

@router.get("/learning-path/employee")
async def get_employee_learning_path(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    📥 Get pushed learning path for logged-in employee
    """

    result = await db.execute(
        select(LearningPath)
        .where(
            and_(
                LearningPath.employee_email == current_user.email,
                LearningPath.is_active == True
            )
        )
        .order_by(desc(LearningPath.created_at))
    )
    paths = result.scalars().all()

    return {"learning_paths": [serialize_learning_path(path) for path in paths]}


@router.get("/learning-path/employee/{learning_path_id}")
async def get_employee_learning_path_detail(
    learning_path_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(LearningPath).where(
            and_(
                LearningPath.learning_path_id == learning_path_id,
                LearningPath.employee_email == current_user.email,
                LearningPath.is_active == True
            )
        )
    )
    path = result.scalar_one_or_none()

    if not path:
        raise HTTPException(status_code=404, detail="Learning path not found")

    return serialize_learning_path(path)



@router.get("/learning-path/{session_id}", response_model=RecommendedCoursesResponse)
async def generate_learning_path(
    session_id: str,
    db: AsyncSession = Depends(get_db)
):
    """
    🎓 Generate Personalized Learning Path from Test Results

    Analyzes test session performance and generates personalized course recommendations
    based on:
    - Topics/skills from incorrect answers
    - Overall performance level (Beginner/Intermediate/Advanced)
    - Question difficulty and topic coverage

    Returns:
    - Topic-based course recommendations
    - Difficulty-appropriate learning materials
    - Prioritized weak areas for improvement
    """
    
    # Fetch test session
    result = await db.execute(
        select(TestSession).where(TestSession.session_id == session_id)
    )
    session = result.scalar_one_or_none()
    
    if not session:
        raise HTTPException(status_code=404, detail="Test session not found")
    
    if not session.is_completed:
        raise HTTPException(status_code=400, detail="Test session not yet completed")
    
    # Get question set to determine topic
    topic = "General"

    if session.question_set_id:
        qs_result = await db.execute(
            select(QuestionSet).where(QuestionSet.question_set_id == session.question_set_id)
        )
        question_set = qs_result.scalar_one_or_none()
        if question_set:
            topic = question_set.skill or "General"
    
    # Calculate performance level
    score_percentage = session.score_percentage or 0
    
    # Determine learning level based on performance
    if score_percentage >= 80:
        learning_level = "Advanced"  # Good score → advance to harder topics
    elif score_percentage >= 60:
        learning_level = "Intermediate"  # Moderate score → intermediate level
    else:
        learning_level = "Beginner"  # Low score → start with basics
    
    assessment = await get_assessment_for_session(db, session)
    assessment_skill_topics = _assessment_skill_topics(assessment)
    assessment_topic_list = _assessment_topics(assessment)

    question_topic_by_id: dict[int, str] = {}
    if assessment_skill_topics and session.question_set_id:
        questions_result = await db.execute(
            select(Question)
            .where(Question.question_set_id == session.question_set_id)
            .order_by(Question.id)
        )
        ordered_questions = questions_result.scalars().all()
        for index, question in enumerate(ordered_questions):
            question_topic_by_id[question.id] = assessment_skill_topics[index % len(assessment_skill_topics)]

    # Get incorrect answers to identify weak areas
    answers_result = await db.execute(
        select(Answer, Question)
        .join(Question, Answer.question_id == Question.id)
        .where(
            and_(
                Answer.session_id == session.session_id,
                Answer.is_correct == False
            )
        )
    )
    weak_questions = answers_result.all()

    weak_topics: list[str] = []
    seen_topics: set[str] = set()

    for _, question in weak_questions:
        if _is_specific_topic(getattr(question, "topic", None)):
            _append_topic(weak_topics, seen_topics, question.topic)

        if isinstance(question.options, dict):
            _append_topic(weak_topics, seen_topics, _topics_from_mapping(question.options))

        if isinstance(question.source_meta, dict):
            _append_topic(weak_topics, seen_topics, _topics_from_mapping(question.source_meta))

        _append_topic(
            weak_topics,
            seen_topics,
            _matching_assessment_topics(question.question_text or "", assessment_topic_list),
        )

        _append_topic(weak_topics, seen_topics, question_topic_by_id.get(question.id))

    if not weak_topics:
        _append_topic(weak_topics, seen_topics, assessment_topic_list)

    if not weak_topics:
        _append_topic(weak_topics, seen_topics, topic)

    search_topic = " ".join(weak_topics) if weak_topics else "General"
    logger.debug(
        "Learning path topic extraction session=%s weak_topics=%s learning_level=%s",
        session_id,
        weak_topics,
        learning_level,
    )

    recommended = await recommend_courses_for_topic(
        search_topic,
        learning_level,
        max_results=10,
    )
    logger.debug(
        "Learning path recommendations session=%s count=%s",
        session_id,
        len(recommended),
    )
    
    safe_response = sanitize_for_json({
        "topic": search_topic,
        "recommended_courses": recommended
    })
    
    return safe_response



@router.post("/learning-path/self")
async def save_self_assessed_learning_path(
    payload: SelfLearningPathRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Save a learning path generated from the logged-in employee's self assessment.
    """

    result = await db.execute(
        select(TestSession).where(TestSession.session_id == payload.session_id)
    )
    session = result.scalar_one_or_none()

    if not session:
        raise HTTPException(status_code=404, detail="Test session not found")

    if session.user_id and session.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="You cannot save a learning path for this session")

    if not session.user_id and session.candidate_email != current_user.email:
        raise HTTPException(status_code=403, detail="You cannot save a learning path for this session")

    if not session.is_completed:
        raise HTTPException(status_code=400, detail="Test session not yet completed")

    learning_path_data = await generate_learning_path(payload.session_id, db)
    topic = learning_path_data.get("topic") or "General"
    recommended_courses = learning_path_data.get("recommended_courses") or []

    title_topic = topic
    if session.question_set_id:
        question_set_result = await db.execute(
            select(QuestionSet).where(QuestionSet.question_set_id == session.question_set_id)
        )
        question_set = question_set_result.scalar_one_or_none()
        if question_set and question_set.skill:
            title_topic = question_set.skill

    existing_result = await db.execute(
        select(LearningPath).where(
            and_(
                LearningPath.employee_email == current_user.email,
                LearningPath.session_id == payload.session_id
            )
        )
    )
    learning_path = existing_result.scalar_one_or_none()

    self_title = build_self_assessed_title(title_topic)

    if learning_path:
        learning_path.user_id = current_user.id
        learning_path.employee_name = current_user.full_name
        learning_path.assessment_id = None
        learning_path.assessment_public_id = None
        learning_path.assessment_title = self_title
        learning_path.topic = topic
        learning_path.recommended_courses = recommended_courses
        learning_path.pushed_by = None
        learning_path.is_active = True
    else:
        learning_path = LearningPath(
            user_id=current_user.id,
            employee_email=current_user.email,
            employee_name=current_user.full_name,
            session_id=payload.session_id,
            assessment_id=None,
            assessment_public_id=None,
            assessment_title=self_title,
            topic=topic,
            recommended_courses=recommended_courses,
            pushed_by=None,
            is_active=True,
        )
        db.add(learning_path)

    await db.commit()
    await db.refresh(learning_path)

    return {
        "message": "Self assessed learning path saved successfully",
        "learning_path": serialize_learning_path(learning_path),
    }




@router.post("/learning-path/push-to-employee")
async def push_learning_path(
    payload: PushLearningPathRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(admin_required)
):
    """
    📤 Push finalized learning path to employee
    """

    # 1. Fetch session
    result = await db.execute(
        select(TestSession).where(TestSession.session_id == payload.session_id)
    )
    session = result.scalar_one_or_none()

    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    user = None
    if session.user_id:
        result = await db.execute(select(User).where(User.id == session.user_id))
        user = result.scalar_one_or_none()

    employee_email = user.email if user else session.candidate_email
    if not employee_email:
        raise HTTPException(status_code=404, detail="Employee email not found for this session")

    employee_name = user.full_name if user and user.full_name else session.candidate_name
    assessment = await get_assessment_for_session(db, session)

    existing_result = await db.execute(
        select(LearningPath).where(
            and_(
                LearningPath.employee_email == employee_email,
                LearningPath.session_id == payload.session_id
            )
        )
    )
    learning_path = existing_result.scalar_one_or_none()

    if learning_path:
        learning_path.user_id = user.id if user else session.user_id
        learning_path.employee_name = employee_name
        learning_path.assessment_id = assessment.id if assessment else None
        learning_path.assessment_public_id = assessment.assessment_id if assessment else None
        learning_path.assessment_title = assessment.title if assessment else session.question_set_id
        learning_path.topic = payload.topic
        learning_path.recommended_courses = payload.recommended_courses
        learning_path.pushed_by = current_user.id
        learning_path.is_active = True
    else:
        learning_path = LearningPath(
            user_id=user.id if user else session.user_id,
            employee_email=employee_email,
            employee_name=employee_name,
            session_id=payload.session_id,
            assessment_id=assessment.id if assessment else None,
            assessment_public_id=assessment.assessment_id if assessment else None,
            assessment_title=assessment.title if assessment else session.question_set_id,
            topic=payload.topic,
            recommended_courses=payload.recommended_courses,
            pushed_by=current_user.id,
            is_active=True,
        )
        db.add(learning_path)

    await db.commit()
    await db.refresh(learning_path)

    count_result = await db.execute(
        select(func.count(LearningPath.id)).where(
            and_(
                LearningPath.employee_email == employee_email,
                LearningPath.is_active == True
            )
        )
    )
    assigned_count = count_result.scalar_one()

    return {
        "message": "Learning path pushed successfully",
        "email": employee_email,
        "learning_path": serialize_learning_path(learning_path),
        "assigned_count": assigned_count,
    }


@router.get("/learning-path/admin/employees")
async def list_learning_path_employees(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(admin_required)
):
    result = await db.execute(
        select(
            LearningPath.employee_email,
            func.max(LearningPath.employee_name),
            func.count(LearningPath.id),
            func.max(LearningPath.updated_at),
        )
        .where(LearningPath.is_active == True)
        .group_by(LearningPath.employee_email)
        .order_by(func.max(LearningPath.updated_at).desc())
    )

    employees = [
        {
            "employee_email": email,
            "employee_name": name,
            "learning_path_count": count,
            "last_assigned_at": last_assigned_at,
        }
        for email, name, count, last_assigned_at in result.all()
    ]

    return {"employees": employees}


@router.get("/learning-path/admin/employee/{employee_email}")
async def list_employee_learning_paths_for_admin(
    employee_email: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(admin_required)
):
    result = await db.execute(
        select(LearningPath)
        .where(
            and_(
                LearningPath.employee_email == employee_email,
                LearningPath.is_active == True
            )
        )
        .order_by(desc(LearningPath.created_at))
    )
    paths = result.scalars().all()

    return {
        "employee_email": employee_email,
        "learning_path_count": len(paths),
        "learning_paths": [serialize_learning_path(path) for path in paths],
    }


