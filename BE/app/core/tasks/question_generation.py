"""Celery tasks for question generation."""
from __future__ import annotations

from celery.utils.log import get_task_logger
from typing import Optional
from app.core.celery_app import celery_app
# unified generator is imported dynamically inside the task to avoid import cycles
from app.db.session import get_db_sync_engine
from app.db.models import CeleryTask
from sqlalchemy.orm import sessionmaker
import traceback
import asyncio

logger = get_task_logger(__name__)


@celery_app.task(bind=True)
def run_question_generation(self, topic: Optional[str], count: int = 5, min_retrieval: float = 0.0, assessment_id: Optional[str] = None, mode: str = "rag", rag_pct: int = 100):
    """Run generation job and record status in CeleryTask model."""
    engine = get_db_sync_engine()
    Session = sessionmaker(bind=engine)

    task_id = self.request.id
    # Create CeleryTask record
    with Session() as session:
        ct = CeleryTask(task_id=task_id, task_name="run_question_generation", status="STARTED", related_type="question_generation")
        session.add(ct)
        session.commit()

    try:
        # Use the new generator which supports assessment_id, mode and mix
        from app.services.question_generator import generate_questions

        created_ids = generate_questions(topic=topic, assessment_id=assessment_id, count=count, mode=mode, rag_pct=rag_pct, min_retrieval=min_retrieval)
        with Session() as session:
            ct = session.query(CeleryTask).filter(CeleryTask.task_id == task_id).one()
            ct.status = "SUCCESS"
            ct.result = {"created": created_ids}
            session.commit()

        return {"created": created_ids}
    except Exception as e:
        logger.exception("generation_failed")
        with Session() as session:
            try:
                ct = session.query(CeleryTask).filter(CeleryTask.task_id == task_id).one()
                ct.status = "FAILURE"
                ct.error = str(e)
                session.commit()
            except Exception:
                logger.exception("failed_to_update_celerytask")
        raise
from typing import List, Dict
from celery import Task
from app.core.celery_app import celery_app
from app.utils.generate_questions import generate_mcqs_from_text
from config import get_settings

settings = get_settings()


class DatabaseTask(Task):
    """Base task with database session support."""
    
    _db = None
    
    @property
    def db(self):
        """Get database session."""
        if self._db is None:
            from app.db.session import async_session_maker
            self._db = async_session_maker
        return self._db


@celery_app.task(
    bind=True,
    base=DatabaseTask,
    name='app.core.tasks.question_generation.generate_questions_task',
    max_retries=3,
    default_retry_delay=60
)
def generate_questions_task(
    self,
    jd_id: str,
    extracted_text: str,
    num_questions: int = 20
) -> Dict:
    """
    Generate MCQ questions from job description text.
    
    Args:
        jd_id: Job description ID
        extracted_text: Text extracted from document
        num_questions: Number of questions to generate
    
    Returns:
        Dict with task result
    """
    try:
        # Run async function in sync context
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        
        try:
            result = loop.run_until_complete(
                _generate_and_save_questions(jd_id, extracted_text, num_questions)
            )
            return result
        finally:
            loop.close()
    
    except Exception as exc:
        # Retry on failure
        raise self.retry(exc=exc)


async def _generate_and_save_questions(
    jd_id: str,
    extracted_text: str,
    num_questions: int
) -> Dict:
    """Generate questions and save to database."""
    from app.db.session import async_session_maker
    from app.db.models import Question
    from sqlalchemy import select
    import time
    
    start_time = time.time()
    
    # Generate questions using AI
    questions_data = await generate_mcqs_from_text(
        extracted_text,
        num_questions=num_questions
    )
    
    generation_time = time.time() - start_time
    
    # Save to database
    async with async_session_maker() as session:
        # Delete old questions for this JD
        await session.execute(
            select(Question).where(Question.jd_id == jd_id)
        )
        
        # Create new questions
        questions = []
        for idx, q_data in enumerate(questions_data, 1):
            question = Question(
                jd_id=jd_id,
                question_text=q_data['question_text'],
                options=q_data['options'],
                correct_answer=q_data['correct_answer'],
                difficulty=q_data.get('difficulty'),
                topic=q_data.get('topic'),
                generation_model=settings.GROQ_API_KEY[:10] + "...",
                generation_time=generation_time / num_questions
            )
            questions.append(question)
        
        session.add_all(questions)
        await session.commit()
    
    return {
        'jd_id': jd_id,
        'questions_generated': len(questions),
        'generation_time': generation_time,
        'status': 'success'
    }


@celery_app.task(bind=True)
def index_question_document_task(self, doc_id: str, text: str, metadata: dict = None):
    """Background task to index a question document into FAISS and record CeleryTask status."""
    task_id = self.request.id

    # update/create CeleryTask STARTED status in sync DB
    try:
        from app.db.session import get_db_sync_engine
        from sqlalchemy.orm import sessionmaker
        from app.db.models import CeleryTask

        engine = get_db_sync_engine()
        Session = sessionmaker(bind=engine)
        with Session() as session:
            ct = session.query(CeleryTask).filter(CeleryTask.task_id == task_id).one_or_none()
            if ct:
                ct.status = "STARTED"
                session.commit()
    except Exception:
        # non-fatal: proceed with indexing even if DB update fails
        pass

    try:
        from app.services.doc_ingest import index_document
        index_document(doc_id, text, metadata or {})

        # mark SUCCESS
        try:
            from app.db.session import get_db_sync_engine
            from sqlalchemy.orm import sessionmaker
            from app.db.models import CeleryTask

            engine = get_db_sync_engine()
            Session = sessionmaker(bind=engine)
            with Session() as session:
                ct = session.query(CeleryTask).filter(CeleryTask.task_id == task_id).one_or_none()
                if ct:
                    ct.status = "SUCCESS"
                    ct.result = {"doc_id": doc_id, "status": "indexed"}
                    session.commit()
        except Exception:
            pass

        return {"doc_id": doc_id, "status": "indexed"}
    except Exception as e:
        # mark FAILURE
        try:
            from app.db.session import get_db_sync_engine
            from sqlalchemy.orm import sessionmaker
            from app.db.models import CeleryTask

            engine = get_db_sync_engine()
            Session = sessionmaker(bind=engine)
            with Session() as session:
                ct = session.query(CeleryTask).filter(CeleryTask.task_id == task_id).one_or_none()
                if ct:
                    ct.status = "FAILURE"
                    ct.error = str(e)
                    session.commit()
        except Exception:
            pass
        raise


@celery_app.task(
    name='app.core.tasks.question_generation.regenerate_questions_task',
    max_retries=2
)
def regenerate_questions_task(jd_id: str, num_questions: int = 20) -> Dict:
    """Regenerate questions for existing JD."""
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    
    try:
        from app.db.session import async_session_maker
        from app.db.models import JobDescription
        from sqlalchemy import select
        
        async def _regenerate():
            async with async_session_maker() as session:
                result = await session.execute(
                    select(JobDescription).where(JobDescription.jd_id == jd_id)
                )
                jd = result.scalar_one_or_none()
                
                if not jd:
                    raise ValueError(f"Job description {jd_id} not found")
                
                return await _generate_and_save_questions(
                    jd_id,
                    jd.extracted_text,
                    num_questions
                )
        
        return loop.run_until_complete(_regenerate())
    finally:
        loop.close()
