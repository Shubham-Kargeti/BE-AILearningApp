"""Dashboard and topic selection API endpoints."""
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.db.models import User
from app.core.dependencies import get_current_user, optional_auth
from config import get_settings

settings = get_settings()
router = APIRouter()


# Request/Response models
class Topic(BaseModel):
    """Topic model."""
    id: str
    name: str
    description: str
    is_available: bool = True


class TopicSelectionRequest(BaseModel):
    """Topic selection request."""
    topic: str


class TopicSelectionResponse(BaseModel):
    """Topic selection response."""
    topic: str
    topic_name: str
    next_step: str = "rate_yourself"
    message: str


class DifficultyLevel(BaseModel):
    """Difficulty level model."""
    level: str
    name: str
    description: str


# Available topics (MVP-1: Only Agentic AI)
AVAILABLE_TOPICS = [
    {
        "id": "agentic_ai",
        "name": "Agentic AI",
        "description": "Learn about autonomous AI agents, their architecture, and applications",
        "is_available": True
    },
    {
        "id": "machine_learning",
        "name": "Machine Learning",
        "description": "Coming soon",
        "is_available": False
    },
    {
        "id": "deep_learning",
        "name": "Deep Learning",
        "description": "Coming soon",
        "is_available": False
    }
]

# Difficulty levels
DIFFICULTY_LEVELS = [
    {
        "level": "basic",
        "name": "Basic",
        "description": "Foundational concepts and introductory material"
    },
    {
        "level": "intermediate",
        "name": "Intermediate",
        "description": "Applied knowledge and practical scenarios"
    },
    {
        "level": "expert",
        "name": "Expert",
        "description": "Advanced concepts and complex problem-solving"
    }
]


@router.get("/topics", response_model=List[Topic])
async def get_available_topics(
    current_user: User = Depends(optional_auth)
) -> List[Topic]:
    """
    Get list of available topics.
    
    MVP-1: Only Agentic AI is available.
    """
    return [Topic(**topic) for topic in AVAILABLE_TOPICS]


@router.post("/dashboard/select-topic", response_model=TopicSelectionResponse)
async def select_topic(
    request: TopicSelectionRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
) -> TopicSelectionResponse:
    """
    Select a topic for the test.
    
    MVP-1: Only 'agentic_ai' is available.
    """
    # Validate topic
    valid_topics = [t["id"] for t in AVAILABLE_TOPICS if t["is_available"]]
    
    if request.topic not in valid_topics:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Topic '{request.topic}' is not available. Available topics: {', '.join(valid_topics)}"
        )
    
    # Get topic details
    topic_details = next(
        (t for t in AVAILABLE_TOPICS if t["id"] == request.topic),
        None
    )
    
    if not topic_details:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Topic not found"
        )
    
    # Store selection in session/cache if needed
    # For now, just return the response
    
    return TopicSelectionResponse(
        topic=request.topic,
        topic_name=topic_details["name"],
        next_step="rate_yourself",
        message=f"Topic '{topic_details['name']}' selected. Please rate your expertise level."
    )


@router.get("/difficulty-levels", response_model=List[DifficultyLevel])
async def get_difficulty_levels() -> List[DifficultyLevel]:
    """Get available difficulty levels."""
    return [DifficultyLevel(**level) for level in DIFFICULTY_LEVELS]


@router.get("/dashboard")
async def get_dashboard_data(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
) -> dict:
    """
    Get dashboard data for logged-in user.
    
    Returns user info, available topics, and test history.
    """
    from sqlalchemy import select, func, desc
    from app.db.models import TestSession
    
    # Get user's test history
    result = await db.execute(
        select(TestSession)
        .where(TestSession.user_id == current_user.id)
        .order_by(desc(TestSession.created_at))
        .limit(5)
    )
    recent_tests = result.scalars().all()
    
    # Get test statistics
    total_tests = await db.execute(
        select(func.count(TestSession.id))
        .where(TestSession.user_id == current_user.id)
    )
    total_count = total_tests.scalar() or 0
    
    completed_tests = await db.execute(
        select(func.count(TestSession.id))
        .where(
            TestSession.user_id == current_user.id,
            TestSession.is_completed == True
        )
    )
    completed_count = completed_tests.scalar() or 0
    
    avg_score = await db.execute(
        select(func.avg(TestSession.score_percentage))
        .where(
            TestSession.user_id == current_user.id,
            TestSession.is_completed == True,
            TestSession.score_percentage.isnot(None)
        )
    )
    average_score = avg_score.scalar() or 0.0
    
    return {
        "user": {
            "id": current_user.id,
            "email": current_user.email,
            "full_name": current_user.full_name,
            "is_verified": current_user.is_verified
        },
        "topics": AVAILABLE_TOPICS,
        "statistics": {
            "total_tests": total_count,
            "completed_tests": completed_count,
            "average_score": float(average_score) if average_score else 0.0
        },
        "recent_tests": [
            {
                "session_id": test.session_id,
                "topic": "agentic_ai",  # Add topic field to model later
                "started_at": test.started_at.isoformat(),
                "is_completed": test.is_completed,
                "score_percentage": test.score_percentage
            }
            for test in recent_tests
        ]
    }
