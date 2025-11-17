from fastapi import APIRouter, Query, HTTPException, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.utils.generate_questions import generate_mcqs_for_topic
from app.db.session import get_db
from app.db.models import QuestionSet, Question
from app.models.schemas import QuestionSetResponse, MCQOption, MCQQuestion
from datetime import datetime
from typing import List
import uuid

router = APIRouter()

@router.get("/generate-mcqs/", response_model=QuestionSetResponse)
async def generate_mcqs(
    topic: str = Query(
        ...,
        description="The main topic/skill for MCQ generation (e.g., 'Python', 'Machine Learning', 'Agentic AI')",
        example="Agentic AI"
    ),
    subtopics: List[str] = Query(
        [],
        alias="subtopics",
        description="Optional subtopics to focus question generation",
        example=["LLMs", "Tool Use", "Workflows"]
    ),
    level: str = Query(
        ...,
        description="Difficulty level for question generation",
        example="Basic",
        pattern="^(Basic|Intermediate|Advanced)$"
    ),
    db: AsyncSession = Depends(get_db)
):
    """
    🎯 Generate AI-Powered MCQ Questions (GET Endpoint)

    This endpoint generates multiple-choice questions using AI and saves them
    to the database.

    **Process:**
    1. ✨ Generates 10 MCQ questions using LLM (Llama 3.3 70B)
    2. 💾 Creates a new QuestionSet in the database
    3. 📝 Saves all questions with metadata
    4. 📤 Returns the complete question set with unique IDs

    **Query Parameters:**
    - topic: Main topic for the MCQs
    - subtopics: List of subtopics (optional)
    - level: Difficulty level (Basic, Intermediate, Expert)

    **Swagger UI Benefits:**
    ✔ Shows nice input boxes for topic  
    ✔ Shows multiple input fields for subtopics  
    ✔ Shows level field  
    """

    try:
        # Step 1: Generate MCQs using LLM with subtopics
        mcqs = generate_mcqs_for_topic(
            topic=topic,
            subtopics=subtopics,
            level=level
        )

        # Step 2: Create QuestionSet in DB
        question_set = QuestionSet(
            question_set_id=f"qs_{uuid.uuid4().hex[:12]}",
            skill=topic,
            level=level.title(),
            total_questions=len(mcqs),
            generation_model="llama-3.3-70b-versatile",
        )
        db.add(question_set)
        await db.flush()

        # Step 3: Save each generated question
        for mcq in mcqs:
            options_dict = {opt.option_id: opt.text for opt in mcq.options}

            db_question = Question(
                question_set_id=question_set.question_set_id,
                question_text=mcq.question_text,
                options=options_dict,
                correct_answer=mcq.correct_answer,
                difficulty=level.title(),
                topic=topic,
                generation_model="llama-3.3-70b-versatile"
            )
            db.add(db_question)

        await db.commit()
        await db.refresh(question_set)

        # Step 4: Retrieve saved questions
        result = await db.execute(
            select(Question)
            .where(Question.question_set_id == question_set.question_set_id)
            .order_by(Question.id)
        )
        saved_questions = result.scalars().all()

        # Step 5: Prepare response format
        response_questions = []
        for q in saved_questions:
            options = [
                MCQOption(option_id=k, text=v)
                for k, v in sorted(q.options.items())
            ]
            response_questions.append(
                MCQQuestion(
                    question_id=q.id,
                    question_text=q.question_text,
                    options=options,
                    correct_answer=q.correct_answer
                )
            )

        return QuestionSetResponse(
            question_set_id=question_set.question_set_id,
            skill=question_set.skill,
            level=question_set.level,
            total_questions=question_set.total_questions,
            created_at=question_set.created_at,
            message="MCQs generated and saved successfully",
            questions=response_questions
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))