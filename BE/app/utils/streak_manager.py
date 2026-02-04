"""Streak management utilities for tracking user engagement."""
from datetime import datetime, timezone, timedelta
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.models import User


def is_consecutive_day(last_date: datetime | None, current_date: datetime | None = None) -> bool:
    """
    Check if current date is consecutive to last date (yesterday or today).
    
    Args:
        last_date: Last streak date
        current_date: Current date (defaults to now)
    
    Returns:
        True if consecutive (yesterday or today), False otherwise
    """
    if last_date is None:
        return False
    
    if current_date is None:
        current_date = datetime.now(timezone.utc)
    
    # Normalize to date only (ignore time)
    last_date_only = last_date.date()
    current_date_only = current_date.date()
    
    # Check if same day (already logged in today)
    if last_date_only == current_date_only:
        return True
    
    # Check if yesterday
    yesterday = current_date_only - timedelta(days=1)
    return last_date_only == yesterday


def should_increment_streak(last_date: datetime | None, current_date: datetime | None = None) -> bool:
    """
    Check if streak should be incremented (not same day, but consecutive).
    
    Args:
        last_date: Last streak date
        current_date: Current date (defaults to now)
    
    Returns:
        True if should increment, False otherwise
    """
    if last_date is None:
        return True  # First time
    
    if current_date is None:
        current_date = datetime.now(timezone.utc)
    
    # Normalize to date only
    last_date_only = last_date.date()
    current_date_only = current_date.date()
    
    # Don't increment if same day
    if last_date_only == current_date_only:
        return False
    
    # Increment if yesterday
    yesterday = current_date_only - timedelta(days=1)
    return last_date_only == yesterday


async def update_login_streak(user: User, db: AsyncSession) -> dict:
    """
    Update user's login streak.
    
    Args:
        user: User object
        db: Database session
    
    Returns:
        Dict with streak information
    """
    current_time = datetime.now(timezone.utc)
    
    # Check if streak should continue
    if is_consecutive_day(user.login_streak_last_date, current_time):
        # Consecutive day - check if we should increment
        if should_increment_streak(user.login_streak_last_date, current_time):
            user.login_streak += 1
            user.login_streak_last_date = current_time
            
            # Update max streak if current is higher
            if user.login_streak > user.login_streak_max:
                user.login_streak_max = user.login_streak
        # else: same day, don't increment
    else:
        # Streak broken - reset to 1
        user.login_streak = 1
        user.login_streak_last_date = current_time
        
        # Set max if this is the first login
        if user.login_streak_max == 0:
            user.login_streak_max = 1
    
    # Update last login time
    user.last_login = current_time
    
    await db.commit()
    await db.refresh(user)
    
    return {
        "current_streak": user.login_streak,
        "max_streak": user.login_streak_max,
        "last_login": user.last_login,
        "streak_type": "login"
    }


async def update_quiz_streak(user: User, db: AsyncSession) -> dict:
    """
    Update user's quiz completion streak.
    
    Args:
        user: User object
        db: Database session
    
    Returns:
        Dict with streak information
    """
    current_time = datetime.now(timezone.utc)
    
    # Check if streak should continue
    if is_consecutive_day(user.quiz_streak_last_date, current_time):
        # Consecutive day - check if we should increment
        if should_increment_streak(user.quiz_streak_last_date, current_time):
            user.quiz_streak += 1
            user.quiz_streak_last_date = current_time
            
            # Update max streak if current is higher
            if user.quiz_streak > user.quiz_streak_max:
                user.quiz_streak_max = user.quiz_streak
        # else: same day, already completed quiz today
    else:
        # Streak broken - reset to 1
        user.quiz_streak = 1
        user.quiz_streak_last_date = current_time
        
        # Set max if this is the first quiz
        if user.quiz_streak_max == 0:
            user.quiz_streak_max = 1
    
    await db.commit()
    await db.refresh(user)
    
    return {
        "current_streak": user.quiz_streak,
        "max_streak": user.quiz_streak_max,
        "last_quiz_date": user.quiz_streak_last_date,
        "streak_type": "quiz"
    }


def get_streak_status(user: User) -> dict:
    """
    Get current streak status for a user.
    
    Args:
        user: User object
    
    Returns:
        Dict with all streak information
    """
    current_time = datetime.now(timezone.utc)
    
    # Check if login streak is still active
    login_streak_active = is_consecutive_day(user.login_streak_last_date, current_time)
    
    # Check if quiz streak is still active
    quiz_streak_active = is_consecutive_day(user.quiz_streak_last_date, current_time)
    
    # Calculate days until streak breaks
    def days_until_break(last_date: datetime | None) -> int:
        """Calculate days until streak breaks (0 = today, 1 = tomorrow)."""
        if last_date is None:
            return 0
        
        last_date_only = last_date.date()
        current_date_only = current_time.date()
        
        # If same day, user has until tomorrow
        if last_date_only == current_date_only:
            return 1
        
        # If yesterday, user needs to login/quiz today
        yesterday = current_date_only - timedelta(days=1)
        if last_date_only == yesterday:
            return 0
        
        # Streak already broken
        return -1
    
    return {
        "login_streak": {
            "current": user.login_streak if login_streak_active else 0,
            "max": user.login_streak_max,
            "last_date": user.login_streak_last_date,
            "is_active": login_streak_active,
            "days_until_break": days_until_break(user.login_streak_last_date)
        },
        "quiz_streak": {
            "current": user.quiz_streak if quiz_streak_active else 0,
            "max": user.quiz_streak_max,
            "last_date": user.quiz_streak_last_date,
            "is_active": quiz_streak_active,
            "days_until_break": days_until_break(user.quiz_streak_last_date)
        },
        "total_engagement": {
            "login_count": user.login_streak_max,  # Approximate
            "quiz_count": user.quiz_streak_max,    # Approximate
        }
    }


async def check_and_update_quiz_completion(
    user: User,
    db: AsyncSession,
    test_completed: bool = True
) -> dict | None:
    """
    Check if quiz was completed and update streak accordingly.
    
    This should be called when a test session is completed.
    Only updates streak once per day.
    
    Args:
        user: User object
        db: Database session
        test_completed: Whether test was actually completed
    
    Returns:
        Streak info dict if updated, None if not (already completed today)
    """
    if not test_completed:
        return None
    
    current_time = datetime.now(timezone.utc)
    
    # Check if user already completed a quiz today
    if user.quiz_streak_last_date:
        last_date_only = user.quiz_streak_last_date.date()
        current_date_only = current_time.date()
        
        if last_date_only == current_date_only:
            # Already completed quiz today, don't update
            return None
    
    # Update quiz streak
    return await update_quiz_streak(user, db)
