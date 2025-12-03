"""User management API endpoints."""
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, EmailStr
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.db.session import get_db
from app.db.models import User
from app.core.dependencies import get_current_user, get_current_verified_user
from app.utils.streak_manager import get_streak_status

router = APIRouter()


# Response models
class UserResponse(BaseModel):
    """User response model."""
    id: int
    email: str
    full_name: str | None
    is_active: bool
    is_verified: bool
    
    class Config:
        from_attributes = True


class UserUpdate(BaseModel):
    """User update model."""
    full_name: str | None = None


@router.get("/users/me", response_model=UserResponse)
async def get_current_user_info(
    current_user: User = Depends(get_current_user)
) -> UserResponse:
    """Get current user information."""
    return UserResponse.from_orm(current_user)


@router.put("/users/me", response_model=UserResponse)
async def update_current_user(
    user_update: UserUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
) -> UserResponse:
    """Update current user information."""
    if user_update.full_name is not None:
        current_user.full_name = user_update.full_name
    
    await db.commit()
    await db.refresh(current_user)
    
    return UserResponse.from_orm(current_user)


@router.get("/users/me/streaks")
async def get_user_streaks(
    current_user: User = Depends(get_current_user)
):
    """
    Get current user's streak information.
    
    Returns login and quiz completion streaks including:
    - Current streak count
    - Maximum streak achieved
    - Last activity date
    - Active status
    - Days until streak breaks
    """
    return get_streak_status(current_user)
