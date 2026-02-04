"""Learning Path API - Generate personalized learning paths from test results."""
from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_
from typing import List, Optional
import logging

from app.db.session import get_db
from app.db.models import TestSession, Answer, Question, QuestionSet
from app.models.schemas import CourseRecommendation, RecommendedCoursesResponse
from config import get_settings

router = APIRouter()
logger = logging.getLogger(__name__)
settings = get_settings()

# Import course recommendation logic from recommended_courses
from app.api.recommended_courses import vectorstore, get_allowed_levels, fallback_search, sanitize_for_json
import math


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
    level = "Intermediate"
    
    if session.question_set_id:
        qs_result = await db.execute(
            select(QuestionSet).where(QuestionSet.question_set_id == session.question_set_id)
        )
        question_set = qs_result.scalar_one_or_none()
        if question_set:
            topic = question_set.skill or "General"
            level = question_set.level or "Intermediate"
    
    # Calculate performance level
    score_percentage = session.score_percentage or 0
    
    # Determine learning level based on performance
    if score_percentage >= 80:
        learning_level = "Advanced"  # Good score → advance to harder topics
    elif score_percentage >= 60:
        learning_level = "Intermediate"  # Moderate score → intermediate level
    else:
        learning_level = "Beginner"  # Low score → start with basics
    
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
    
    # Extract topics from weak areas (can be enhanced with more sophisticated topic extraction)
    weak_topics = set()
    for answer, question in weak_questions:
        # Use question tags or skill if available
        if hasattr(question, 'skill') and question.skill:
            weak_topics.add(question.skill)
        elif hasattr(question, 'topic') and question.topic:
            weak_topics.add(question.topic)
    
    # If no specific weak topics, use the main topic
    if not weak_topics:
        weak_topics.add(topic)
    
    # Combine weak topics for search query
    search_topic = " ".join(weak_topics) if weak_topics else topic
    
    # Use vector search if available
    recommended = []
    allowed_levels = get_allowed_levels(learning_level)
    
    if vectorstore is not None:
        try:
            results = vectorstore.similarity_search_with_score(
                search_topic, k=10, filter={"type": "resource"}
            )
            
            for doc, score in results:
                try:
                    score_value = float(score)
                except Exception:
                    score_value = None

                if score_value is not None and not math.isfinite(score_value):
                    score_value = None

                course_level = doc.metadata.get("course_level", "").strip()
                if not course_level:
                    continue
                if course_level not in allowed_levels:
                    continue

                recommended.append({
                    "name": doc.metadata.get("name", "") or "",
                    "topic": doc.metadata.get("topic", "") or "",
                    "collection": doc.metadata.get("collection", "") or "",
                    "category": doc.metadata.get("category", "") or "",
                    "description": doc.metadata.get("description", "") or "",
                    "url": doc.metadata.get("url", "") or "",
                    "score": score_value,
                    "course_level": course_level
                })
        except Exception as e:
            logger.exception("Vector search failed for learning path: %s", e)
    
    # Fallback to Excel-based search if needed
    if len(recommended) < 3:
        fallback_results = await fallback_search(search_topic, learning_level)
        existing_names = {r["name"] for r in recommended}
        for fr in fallback_results:
            if fr["name"] not in existing_names:
                recommended.append(fr)
    
    # Limit to top 10 recommendations
    recommended = recommended[:10]
    
    safe_response = sanitize_for_json({
        "topic": search_topic,
        "recommended_courses": recommended
    })
    
    return safe_response
