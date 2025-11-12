from fastapi import APIRouter, Query, HTTPException, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.utils.generate_questions import generate_mcqs_for_topic
from app.db.session import get_db
from app.db.models import QuestionSet, Question
from app.models.schemas import QuestionSetResponse, MCQOption, MCQQuestion
from datetime import datetime
import uuid

router = APIRouter()

@router.get("/generate-mcqs/", response_model=QuestionSetResponse)
async def generate_mcqs(
    topic: str = Query(
        ..., 
        description="The topic/skill for question generation (e.g., 'Python Programming', 'Machine Learning', 'Agentic AI')",
        example="Agentic AI"
    ),
    level: str = Query(
        ..., 
        description="Difficulty level for questions",
        example="Basic",
        pattern="^(Basic|Intermediate|Expert)$"
    ),
    db: AsyncSession = Depends(get_db)
):
    """
    🎯 Generate AI-Powered MCQ Questions
    
    This endpoint generates multiple-choice questions using AI and saves them to the database.
    
    **Process:**
    1. ✨ Generates 10 MCQ questions using LLM (Llama 3.3 70B)
    2. 💾 Creates a new QuestionSet in the database
    3. 📝 Saves all questions with metadata
    4. 📤 Returns the complete question set with unique IDs
    
    **Features:**
    - Each question has 4 options (A, B, C, D)
    - Questions are automatically tagged with topic and difficulty
    - Unique question_set_id generated for tracking
    - Timestamps recorded for audit trail
    
    **Usage:**
    - Use this to create new question sets for testing
    - Questions can be used immediately for testing via `/questionset-tests/start`
    - All data is persisted in the database
    
    **Example Response:**
    ```json
    {
      "question_set_id": "qs_abc123def456",
      "skill": "Agentic AI",
      "level": "Basic",
      "total_questions": 10,
      "created_at": "2025-11-12T10:30:00",
      "questions": [
        {
          "question_id": 1,
          "question_text": "What is Agentic AI?",
          "options": [
            {"option_id": "A", "text": "A type of AI..."},
            {"option_id": "B", "text": "Another option..."}
          ],
          "correct_answer": "A"
        }
      ]
    }
    ```
    
    **Valid Levels:**
    - `Basic`: For beginners, foundational concepts
    - `Intermediate`: For those with some experience
    - `Expert`: Advanced topics and complex scenarios
    """
    try:
        # Step 1: Generate MCQs using LLM
        mcqs = generate_mcqs_for_topic(topic, level)
        
        # Step 2: Create QuestionSet in database
        question_set = QuestionSet(
            question_set_id=f"qs_{uuid.uuid4().hex[:12]}",
            skill=topic,
            level=level.lower(),
            total_questions=len(mcqs),
            generation_model="llama-3.3-70b-versatile"
        )
        db.add(question_set)
        await db.flush()  # Get the question_set_id
        
        # Step 3: Save each question to database
        db_questions = []
        for mcq in mcqs:
            # Convert options from list of MCQOption to dict format for DB
            options_dict = {opt.option_id: opt.text for opt in mcq.options}
            
            db_question = Question(
                question_set_id=question_set.question_set_id,
                question_text=mcq.question_text,
                options=options_dict,
                correct_answer=mcq.correct_answer,
                difficulty=level.lower(),
                topic=topic,
                generation_model="llama-3.3-70b-versatile"
            )
            db.add(db_question)
            db_questions.append(db_question)
        
        await db.commit()
        
        # Step 4: Refresh to get IDs and retrieve from DB
        await db.refresh(question_set)
        
        # Step 5: Query questions from DB to send to frontend
        result = await db.execute(
            select(Question)
            .where(Question.question_set_id == question_set.question_set_id)
            .order_by(Question.id)
        )
        saved_questions = result.scalars().all()
        
        # Step 6: Convert DB questions to response format
        response_questions = []
        for db_q in saved_questions:
            options = [
                MCQOption(option_id=opt_id, text=opt_text)
                for opt_id, opt_text in sorted(db_q.options.items())
            ]
            response_questions.append(
                MCQQuestion(
                    question_id=db_q.id,
                    question_text=db_q.question_text,
                    options=options,
                    correct_answer=db_q.correct_answer
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
        await db.rollback()
        raise HTTPException(status_code=500, detail=f"Error generating MCQs: {str(e)}")