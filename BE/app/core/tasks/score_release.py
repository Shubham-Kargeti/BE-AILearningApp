"""Celery tasks for delayed score release."""
import asyncio
from datetime import datetime, timedelta
from typing import Dict
from celery import Task
from app.core.celery_app import celery_app
from config import get_settings

settings = get_settings()


@celery_app.task(
    name='app.core.tasks.score_release.schedule_score_release',
    max_retries=3
)
def schedule_score_release(session_id: str, delay_hours: int = 24) -> Dict:
    """
    Schedule score release after delay.
    
    Args:
        session_id: Test session ID
        delay_hours: Hours to delay before releasing score
    
    Returns:
        Task result dict
    """
    # Schedule the actual release task
    release_time = datetime.utcnow() + timedelta(hours=delay_hours)
    
    release_score_task.apply_async(
        args=[session_id],
        eta=release_time
    )
    
    return {
        'session_id': session_id,
        'release_scheduled_at': release_time.isoformat(),
        'delay_hours': delay_hours,
        'status': 'scheduled'
    }


@celery_app.task(
    name='app.core.tasks.score_release.release_score_task',
    max_retries=3,
    default_retry_delay=300
)
def release_score_task(session_id: str) -> Dict:
    """
    Release score for completed test session.
    
    Args:
        session_id: Test session ID
    
    Returns:
        Task result dict
    """
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    
    try:
        result = loop.run_until_complete(_release_score(session_id))
        return result
    finally:
        loop.close()


async def _release_score(session_id: str) -> Dict:
    """Release score and notify user."""
    from app.db.session import async_session_maker
    from app.db.models import TestSession
    from sqlalchemy import select
    from app.core.tasks.email_tasks import send_score_notification
    
    async with async_session_maker() as session:
        result = await session.execute(
            select(TestSession).where(TestSession.session_id == session_id)
        )
        test_session = result.scalar_one_or_none()
        
        if not test_session:
            raise ValueError(f"Test session {session_id} not found")
        
        if not test_session.is_completed:
            raise ValueError(f"Test session {session_id} is not completed")
        
        if test_session.is_scored:
            return {
                'session_id': session_id,
                'status': 'already_released',
                'message': 'Score already released'
            }
        
        # Mark as scored
        test_session.is_scored = True
        test_session.score_released_at = datetime.utcnow()
        
        await session.commit()
        
        # Send email notification if user has email
        if test_session.candidate_email:
            send_score_notification.delay(
                email=test_session.candidate_email,
                session_id=session_id,
                score_percentage=test_session.score_percentage
            )
        
        return {
            'session_id': session_id,
            'score_percentage': test_session.score_percentage,
            'released_at': test_session.score_released_at.isoformat(),
            'status': 'released'
        }


@celery_app.task(name='app.core.tasks.score_release.batch_release_scores')
def batch_release_scores(hours_threshold: int = 24) -> Dict:
    """
    Batch release scores for sessions older than threshold.
    
    Args:
        hours_threshold: Hours threshold for auto-release
    
    Returns:
        Task result dict
    """
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    
    try:
        from app.db.session import async_session_maker
        from app.db.models import TestSession
        from sqlalchemy import select, and_
        
        async def _batch_release():
            threshold_time = datetime.utcnow() - timedelta(hours=hours_threshold)
            
            async with async_session_maker() as session:
                result = await session.execute(
                    select(TestSession).where(
                        and_(
                            TestSession.is_completed == True,
                            TestSession.is_scored == False,
                            TestSession.completed_at < threshold_time
                        )
                    )
                )
                
                sessions_to_release = result.scalars().all()
                released_count = 0
                
                for test_session in sessions_to_release:
                    try:
                        await _release_score(test_session.session_id)
                        released_count += 1
                    except Exception as e:
                        print(f"Error releasing score for {test_session.session_id}: {e}")
                
                return {
                    'total_sessions': len(sessions_to_release),
                    'released_count': released_count,
                    'status': 'completed'
                }
        
        return loop.run_until_complete(_batch_release())
    finally:
        loop.close()
