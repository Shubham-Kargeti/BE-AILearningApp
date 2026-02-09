"""Authentication dependencies for FastAPI."""
from typing import Optional
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.db.session import get_db
from app.db.models import User, RefreshToken
from app.core.security import decode_token, is_admin_user
from datetime import datetime

security = HTTPBearer()


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: AsyncSession = Depends(get_db)
) -> User:
    """
    Get current authenticated user from JWT token.
    
    Raises:
        HTTPException: If token is invalid or user not found
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    
    token = credentials.credentials
    payload = decode_token(token)
    
    if payload is None:
        raise credentials_exception
    
    user_id: str = payload.get("sub")
    token_type: str = payload.get("type")
    
    if user_id is None or token_type != "access":
        raise credentials_exception
    
    result = await db.execute(
        select(User).where(User.id == int(user_id))
    )
    user = result.scalar_one_or_none()
    
    if user is None:
        raise credentials_exception
    
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Inactive user"
        )
    
    return user


async def get_current_active_user(
    current_user: User = Depends(get_current_user)
) -> User:
    """Get current active user."""
    if not current_user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Inactive user"
        )
    return current_user


async def get_current_verified_user(
    current_user: User = Depends(get_current_user)
) -> User:
    """Get current verified user."""
    if not current_user.is_verified:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Email not verified"
        )
    return current_user


async def verify_refresh_token(
    token: str,
    db: AsyncSession
) -> Optional[User]:
    """
    Verify refresh token and return associated user.
    
    Args:
        token: Refresh token
        db: Database session
    
    Returns:
        User if token is valid, None otherwise
    """
    payload = decode_token(token)
    
    if payload is None or payload.get("type") != "refresh":
        return None
    
    result = await db.execute(
        select(RefreshToken).where(
            RefreshToken.token == token,
            RefreshToken.is_revoked == False,
            RefreshToken.expires_at > datetime.utcnow()
        )
    )
    
    refresh_token_record = result.scalar_one_or_none()
    
    if refresh_token_record is None:
        return None
    
    result = await db.execute(
        select(User).where(User.id == refresh_token_record.user_id)
    )
    
    return result.scalar_one_or_none()


optional_security = HTTPBearer(auto_error=False)


class OptionalAuth:
    """Optional authentication dependency."""
    
    async def __call__(
        self,
        credentials: Optional[HTTPAuthorizationCredentials] = Depends(optional_security),
        db: AsyncSession = Depends(get_db)
    ) -> Optional[User]:
        """Get current user if authenticated, None otherwise."""
        import logging
        logger = logging.getLogger(__name__)
        
        if credentials is None:
            logger.info("OptionalAuth: No credentials provided")
            return None
        
        try:
            token = credentials.credentials
            logger.info(f"OptionalAuth: Token received (first 20 chars): {token[:20] if token else 'None'}...")
            payload = decode_token(token)
            
            if payload is None:
                logger.info("OptionalAuth: Token decode returned None")
                return None
            
            user_id = payload.get("sub")
            logger.info(f"OptionalAuth: user_id from token: {user_id}")
            if user_id is None:
                return None
            
            result = await db.execute(
                select(User).where(User.id == int(user_id))
            )
            user = result.scalar_one_or_none()
            
            if user and user.is_active:
                logger.info(f"OptionalAuth: Found active user: {user.email}")
                return user
            else:
                logger.info(f"OptionalAuth: User not found or inactive")
            
        except Exception as e:
            logger.error(f"OptionalAuth: Exception: {e}")
            pass
        
        return None


optional_auth = OptionalAuth()


async def optional_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(HTTPBearer(auto_error=False)),
    db: AsyncSession = Depends(get_db)
) -> Optional[User]:
    """
    Get current user if authenticated, None otherwise.
    
    This is useful for endpoints that work both with and without authentication.
    """
    if credentials is None:
        return None
    
    try:
        token = credentials.credentials
        payload = decode_token(token)
        
        if payload is None:
            return None
        
        user_id = payload.get("sub")
        if user_id is None:
            return None
        
        result = await db.execute(
            select(User).where(User.id == int(user_id))
        )
        user = result.scalar_one_or_none()
        
        if user and user.is_active:
            return user
        
    except Exception:
        pass
    
    return None


async def admin_required(
    current_user: User = Depends(get_current_user)
) -> User:
    """
    Require admin privileges for endpoint access.
    
    Args:
        current_user: Current authenticated user
    
    Returns:
        User: Admin user
    
    Raises:
        HTTPException: If user is not an admin
    """
    if not is_admin_user(current_user.email):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin privileges required"
        )
    return current_user
