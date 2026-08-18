"""Authentication API endpoints."""
from datetime import datetime, timedelta, timezone
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from fastapi.security import HTTPBearer
from fastapi.responses import RedirectResponse
from pydantic import BaseModel, EmailStr
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from authlib.integrations.starlette_client import OAuth
from authlib.integrations.base_client.errors import OAuthError
import secrets

from app.db.session import get_db
from app.db.models import User, RefreshToken, Candidate
from app.core.security import create_token_pair, decode_token, verify_password, is_admin_user
from app.core.logging import get_logger
# from app.core.redis import RedisService, get_redis  # DISABLED - Redis not in use
from app.core.tasks.email_tasks import send_otp_email, generate_otp
from app.core.dependencies import verify_refresh_token
from app.core.metrics import otp_requests_total, auth_attempts_total
from app.utils.streak_manager import update_login_streak
from config import get_settings

settings = get_settings()
logger = get_logger(__name__)
router = APIRouter()
security = HTTPBearer()

# Initialize OAuth client for Azure AD
oauth = OAuth()
oauth.register(
    name='azure',
    client_id=settings.AZURE_CLIENT_ID,
    client_secret=settings.AZURE_CLIENT_SECRET,
    server_metadata_url=f'https://login.microsoftonline.com/{settings.AZURE_TENANT_ID}/v2.0/.well-known/openid-configuration',
    client_kwargs={
        'scope': 'openid email profile',
    }
)


# Request/Response models
class LoginRequest(BaseModel):
    """Email/password login request."""
    email: EmailStr
    password: str


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
    login_streak: Optional[dict] = None  # Streak information
    role: Optional[str] = None
    candidate_id: Optional[str] = None


class RefreshTokenRequest(BaseModel):
    """Refresh token request."""
    refresh_token: str


async def get_or_create_user(
    db: AsyncSession,
    email: str,
    full_name: Optional[str] = None,
) -> User:
    """Get an active user record for the authenticated principal."""
    result = await db.execute(select(User).where(func.lower(User.email) == email))
    user = result.scalar_one_or_none()

    if user is None:
        user = User(
            email=email,
            full_name=full_name or email.split("@")[0].title(),
            is_active=True,
            is_verified=True,
        )
        db.add(user)
        await db.commit()
        await db.refresh(user)
        return user

    if full_name and user.full_name != full_name:
        user.full_name = full_name
    user.is_verified = True
    await db.commit()
    await db.refresh(user)
    return user


def candidate_password_matches(candidate: Candidate, password: str) -> bool:
    """Validate a candidate password using the stored hash when available."""
    if candidate.password_hash:
        try:
            return verify_password(password, candidate.password_hash)
        except Exception:
            return False

    return candidate.password == password


async def issue_token_response(
    user: User,
    db: AsyncSession,
    role: str,
    candidate_id: Optional[str] = None,
) -> dict:
    """Create tokens, persist refresh token, and return the login payload."""
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User account is inactive"
        )

    streak_info = await update_login_streak(user, db)

    tokens = create_token_pair(
        user_id=user.id,
        email=user.email,
        role=role
    )

    access_token = tokens["access_token"]
    refresh_token = tokens["refresh_token"]

    refresh_token_record = RefreshToken(
        user_id=user.id,
        token=refresh_token,
        expires_at=datetime.utcnow() + timedelta(days=settings.JWT_REFRESH_TOKEN_EXPIRE_DAYS)
    )
    db.add(refresh_token_record)
    await db.commit()

    auth_attempts_total.labels(status="success").inc()

    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "bearer",
        "login_streak": streak_info,
        "role": role,
        "candidate_id": candidate_id,
    }


@router.post("/auth/login", status_code=status.HTTP_200_OK)
async def simple_login(
    request: LoginRequest,
    db: AsyncSession = Depends(get_db)
):
    """
    Email/password login endpoint.

    This endpoint:
    - Authenticates the default admin credentials
    - Authenticates admin-created candidate credentials

    Args:
        request: Login request with email and password
        db: Database session

    Returns:
        Access and refresh tokens
    """
    email = request.email.lower().strip()
    password = request.password

    logger.info("login_attempt", email=settings.ADMIN_EMAILS, password=settings.ADMIN_EMAILS)
    if email in [e.lower() for e in settings.ADMIN_EMAILS]:
        logger.info("admin_login_attempt", email=email)
        if password != settings.ADMIN_PASSWORD:
            auth_attempts_total.labels(status="failed").inc()
            logger.warning("admin_login_failed", email=email, reason="invalid_password")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid email or password"
            )

        user = await get_or_create_user(db, email, "Admin")
        logger.info("admin_login_success", email=email, user_id=str(user.id))
        return await issue_token_response(user, db, role="admin")

    result = await db.execute(
        select(Candidate).where(
            func.lower(Candidate.email) == email,
            Candidate.is_active == True
        )
    )
    candidate = result.scalar_one_or_none()

    if not candidate or not candidate_password_matches(candidate, password):
        auth_attempts_total.labels(status="failed").inc()
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password"
        )

    user = await get_or_create_user(db, email, candidate.full_name)
    if candidate.user_id != user.id:
        candidate.user_id = user.id
        candidate.updated_at = datetime.utcnow()
        db.add(candidate)
        await db.commit()

    return await issue_token_response(
        user,
        db,
        role="candidate",
        candidate_id=candidate.candidate_id,
    )


@router.get("/auth/sso/azure/login")
async def azure_sso_login(
    redirect_uri: Optional[str] = Query(None, description="Frontend redirect URL after successful auth")
):
    """
    Initiate Azure AD SSO login flow.
    
    This endpoint redirects the user to Microsoft Azure AD login page.
    After successful authentication, Azure will redirect back to the callback endpoint.
    
    Args:
        redirect_uri: Optional frontend URL to redirect to after successful authentication
    """
    state = secrets.token_urlsafe(32)
    
    redirect_url = await oauth.azure.authorize_redirect(
        redirect_uri=settings.AZURE_REDIRECT_URI,
        state=state
    )
    
    return redirect_url


@router.get("/auth/sso/azure/callback")
async def azure_sso_callback(
    code: str = Query(..., description="Authorization code from Azure AD"),
    state: str = Query(..., description="State parameter for CSRF protection"),
    db: AsyncSession = Depends(get_db)
):
    """
    Azure AD SSO callback endpoint.
    
    This endpoint receives the authorization code from Azure AD,
    exchanges it for an access token, retrieves user information,
    and creates/updates the user in our database.
    
    Returns JWT tokens for our application.
    """
    try:
        token = await oauth.azure.authorize_access_token()
        
        user_info = token.get('userinfo')
        if not user_info:
            user_info = await oauth.azure.userinfo(token=token)
        
        email = user_info.get('email') or user_info.get('preferred_username')
        full_name = user_info.get('name', email.split('@')[0].title())
        azure_user_id = user_info.get('sub') or user_info.get('oid')
        
        if not email:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Email not provided by Azure AD"
            )
        
        email_domain = email.split('@')[1].lower()
        allowed_domains = ['nagarro.com']
        
        if email_domain not in allowed_domains:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Only {', '.join(allowed_domains)} email addresses are allowed"
            )
        
        result = await db.execute(
            select(User).where(User.email == email)
        )
        user = result.scalar_one_or_none()
        
        if user is None:
            user = User(
                email=email,
                full_name=full_name,
                is_active=True,
                is_verified=True,
                # Store SSO provider info (you may need to add these fields to User model)
                # sso_provider='azure',
                # sso_user_id=azure_user_id
            )
            db.add(user)
            await db.commit()
            await db.refresh(user)
        else:
            if user.full_name != full_name:
                user.full_name = full_name
            user.is_verified = True  # SSO users are auto-verified
            await db.commit()
        
        if not user.is_active:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="User account is inactive"
            )
        
        streak_info = await update_login_streak(user, db)
        
        role = "admin" if is_admin_user(email) else "candidate"
        tokens = create_token_pair(
            user_id=user.id,
            email=user.email,
            role=role
        )
        
        access_token = tokens["access_token"]
        refresh_token = tokens["refresh_token"]
        
        refresh_token_record = RefreshToken(
            user_id=user.id,
            token=refresh_token,
            expires_at=datetime.now(timezone.utc) + timedelta(days=settings.JWT_REFRESH_TOKEN_EXPIRE_DAYS)
        )
        db.add(refresh_token_record)
        await db.commit()
        
        auth_attempts_total.labels(status="sso_success").inc()
        # For now, return tokens as JSON with streak information
        return {
            "access_token": access_token,
            "refresh_token": refresh_token,
            "token_type": "bearer",
            "login_streak": streak_info
        }
        
    except OAuthError as error:
        auth_attempts_total.labels(status="sso_failed").inc()
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Azure AD authentication failed: {error.error}"
        )
    except Exception as e:
        auth_attempts_total.labels(status="sso_error").inc()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"SSO authentication error: {str(e)}"
        )


@router.post("/auth/request-otp", status_code=status.HTTP_200_OK)
async def request_otp(
    request: OTPRequest,
    db: AsyncSession = Depends(get_db)
) -> dict:
    """
    Request OTP for email login.
    
    Sends OTP to email if valid.
    """
    # DISABLED - Redis not in use, skipping rate limit and OTP storage
    # redis_service = RedisService(get_redis())
    # 
    # # Check rate limit
    # is_allowed, _ = await redis_service.check_rate_limit(
    #     f"otp_request:{request.email}",
    #     limit=3,
    #     window=60  # 3 requests per minute
    # )
    # 
    # if not is_allowed:
    #     otp_requests_total.labels(status="rate_limited").inc()
    #     raise HTTPException(
    #         status_code=status.HTTP_429_TOO_MANY_REQUESTS,
    #         detail="Too many OTP requests. Please try again later."
    #     )
    
    # Generate OTP
    otp = generate_otp(settings.OTP_LENGTH)
    
    # Store OTP in Redis - DISABLED, storing in session/memory temporarily
    # await redis_service.set_otp(
    #     request.email,
    #     otp,
    #     settings.OTP_EXPIRY_SECONDS
    # )
    # WARNING: Without Redis, OTP verification won't work properly
    
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
    # DISABLED - Redis not in use, OTP verification disabled
    # WARNING: This endpoint won't work without Redis
    raise HTTPException(
        status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
        detail="OTP verification temporarily disabled (Redis not available)"
    )
    
    # redis_service = RedisService(get_redis())
    # 
    # # Get OTP from Redis
    # stored_otp = await redis_service.get_otp(request.email)
    # 
    # if not stored_otp:
    #     auth_attempts_total.labels(status="otp_expired").inc()
    #     raise HTTPException(
    #         status_code=status.HTTP_400_BAD_REQUEST,
    #         detail="OTP expired or not found"
    #     )
    # 
    # # Verify OTP
    # if stored_otp != request.otp:
    #     # Increment attempt count
    #     attempts = await redis_service.increment_otp_attempts(request.email)
    #     
    #     if attempts >= settings.OTP_MAX_ATTEMPTS:
    #         await redis_service.delete_otp(request.email)
    #         auth_attempts_total.labels(status="max_attempts").inc()
    #         raise HTTPException(
    #             status_code=status.HTTP_400_BAD_REQUEST,
    #             detail="Maximum OTP attempts exceeded"
    #         )
    #     
    #     auth_attempts_total.labels(status="invalid_otp").inc()
    #     raise HTTPException(
    #         status_code=status.HTTP_400_BAD_REQUEST,
    #         detail=f"Invalid OTP. {settings.OTP_MAX_ATTEMPTS - attempts} attempts remaining."
    #     )
    # 
    # # OTP verified - delete from Redis
    # await redis_service.delete_otp(request.email)
    
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
        user.last_login = datetime.utcnow()
        user.is_verified = True
    
    await db.commit()
    await db.refresh(user)
    
    tokens = create_token_pair(user.id, user.email, role="candidate")
    
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
    user = await verify_refresh_token(request.refresh_token, db)
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired refresh token"
        )
    
    result = await db.execute(
        select(RefreshToken).where(RefreshToken.token == request.refresh_token)
    )
    old_token = result.scalar_one_or_none()
    
    if old_token:
        old_token.is_revoked = True
    
    payload = decode_token(request.refresh_token)
    role = payload.get("role", "candidate") if payload else "candidate"
    tokens = create_token_pair(user.id, user.email, role=role)
    
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
    result = await db.execute(
        select(RefreshToken).where(RefreshToken.token == request.refresh_token)
    )
    token = result.scalar_one_or_none()
    
    if token:
        token.is_revoked = True
        await db.commit()
    
    return {"message": "Logged out successfully"}
