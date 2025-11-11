"""Authentication API endpoints."""
from datetime import datetime, timedelta
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPBearer
from pydantic import BaseModel, EmailStr
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.db.session import get_db
from app.db.models import User, RefreshToken
from app.core.security import create_token_pair, decode_token
from app.core.redis import RedisService, get_redis
from app.core.tasks.email_tasks import send_otp_email, generate_otp
from app.core.dependencies import verify_refresh_token
from app.core.metrics import otp_requests_total, auth_attempts_total
from config import get_settings

settings = get_settings()
router = APIRouter()
security = HTTPBearer()


# Request/Response models
class OTPRequest(BaseModel):
    """Request OTP for email."""
    email: EmailStr


class OTPVerify(BaseModel):
    """Verify OTP and login."""
    email: EmailStr
    otp: str


class TokenResponse(BaseModel):
    """JWT token response."""
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class RefreshTokenRequest(BaseModel):
    """Refresh token request."""
    refresh_token: str


@router.post("/auth/request-otp", status_code=status.HTTP_200_OK)
async def request_otp(
    request: OTPRequest,
    db: AsyncSession = Depends(get_db)
) -> dict:
    """
    Request OTP for email login.
    
    Sends OTP to email if valid.
    """
    redis_service = RedisService(get_redis())
    
    # Check rate limit
    is_allowed, _ = await redis_service.check_rate_limit(
        f"otp_request:{request.email}",
        limit=3,
        window=60  # 3 requests per minute
    )
    
    if not is_allowed:
        otp_requests_total.labels(status="rate_limited").inc()
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many OTP requests. Please try again later."
        )
    
    # Generate OTP
    otp = generate_otp(settings.OTP_LENGTH)
    
    # Store OTP in Redis
    await redis_service.set_otp(
        request.email,
        otp,
        settings.OTP_EXPIRY_SECONDS
    )
    
    # Send OTP email (async via Celery)
    send_otp_email.delay(request.email, otp)
    
    otp_requests_total.labels(status="success").inc()
    
    return {
        "message": "OTP sent to email",
        "email": request.email,
        "expires_in": settings.OTP_EXPIRY_SECONDS
    }


@router.post("/auth/verify-otp", response_model=TokenResponse)
async def verify_otp(
    request: OTPVerify,
    db: AsyncSession = Depends(get_db)
) -> TokenResponse:
    """
    Verify OTP and login/register user.
    
    Returns JWT access and refresh tokens.
    """
    redis_service = RedisService(get_redis())
    
    # Get OTP from Redis
    stored_otp = await redis_service.get_otp(request.email)
    
    if not stored_otp:
        auth_attempts_total.labels(status="otp_expired").inc()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="OTP expired or not found"
        )
    
    # Verify OTP
    if stored_otp != request.otp:
        # Increment attempt count
        attempts = await redis_service.increment_otp_attempts(request.email)
        
        if attempts >= settings.OTP_MAX_ATTEMPTS:
            await redis_service.delete_otp(request.email)
            auth_attempts_total.labels(status="max_attempts").inc()
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Maximum OTP attempts exceeded"
            )
        
        auth_attempts_total.labels(status="invalid_otp").inc()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid OTP. {settings.OTP_MAX_ATTEMPTS - attempts} attempts remaining."
        )
    
    # OTP verified - delete from Redis
    await redis_service.delete_otp(request.email)
    
    # Get or create user
    result = await db.execute(
        select(User).where(User.email == request.email)
    )
    user = result.scalar_one_or_none()
    
    if not user:
        # Create new user
        user = User(
            email=request.email,
            is_active=True,
            is_verified=True,
            last_login=datetime.utcnow()
        )
        db.add(user)
        await db.flush()
    else:
        # Update last login
        user.last_login = datetime.utcnow()
        user.is_verified = True
    
    await db.commit()
    await db.refresh(user)
    
    # Create JWT tokens
    tokens = create_token_pair(user.id, user.email)
    
    # Store refresh token in database
    refresh_token_record = RefreshToken(
        token=tokens["refresh_token"],
        user_id=user.id,
        expires_at=datetime.utcnow() + timedelta(days=settings.JWT_REFRESH_TOKEN_EXPIRE_DAYS)
    )
    db.add(refresh_token_record)
    await db.commit()
    
    auth_attempts_total.labels(status="success").inc()
    
    return TokenResponse(**tokens)


@router.post("/auth/refresh", response_model=TokenResponse)
async def refresh_access_token(
    request: RefreshTokenRequest,
    db: AsyncSession = Depends(get_db)
) -> TokenResponse:
    """
    Refresh access token using refresh token.
    
    Returns new access and refresh tokens.
    """
    # Verify refresh token
    user = await verify_refresh_token(request.refresh_token, db)
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired refresh token"
        )
    
    # Revoke old refresh token
    result = await db.execute(
        select(RefreshToken).where(RefreshToken.token == request.refresh_token)
    )
    old_token = result.scalar_one_or_none()
    
    if old_token:
        old_token.is_revoked = True
    
    # Create new tokens
    tokens = create_token_pair(user.id, user.email)
    
    # Store new refresh token
    new_refresh_token = RefreshToken(
        token=tokens["refresh_token"],
        user_id=user.id,
        expires_at=datetime.utcnow() + timedelta(days=settings.JWT_REFRESH_TOKEN_EXPIRE_DAYS)
    )
    db.add(new_refresh_token)
    
    await db.commit()
    
    return TokenResponse(**tokens)


@router.post("/auth/logout")
async def logout(
    request: RefreshTokenRequest,
    db: AsyncSession = Depends(get_db)
) -> dict:
    """
    Logout user by revoking refresh token.
    """
    # Revoke refresh token
    result = await db.execute(
        select(RefreshToken).where(RefreshToken.token == request.refresh_token)
    )
    token = result.scalar_one_or_none()
    
    if token:
        token.is_revoked = True
        await db.commit()
    
    return {"message": "Logged out successfully"}
