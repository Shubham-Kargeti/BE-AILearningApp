"""JWT authentication utilities."""
from datetime import datetime, timedelta
from typing import Optional, Dict
import hashlib
import bcrypt
from jose import JWTError, jwt
from fastapi import HTTPException, status
from config import get_settings

settings = get_settings()

# Password hashing
PASSWORD_HASH_PREFIX = "bcrypt_sha256_v1$"


def _bcrypt_secret(password: str) -> bytes:
    """Return a fixed-size bcrypt input so long passwords do not hit 72 bytes."""
    return hashlib.sha256(password.encode("utf-8")).hexdigest().encode("ascii")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a password against its hash."""
    if hashed_password.startswith(PASSWORD_HASH_PREFIX):
        bcrypt_hash = hashed_password[len(PASSWORD_HASH_PREFIX):].encode("utf-8")
        try:
            return bcrypt.checkpw(_bcrypt_secret(plain_password), bcrypt_hash)
        except ValueError:
            return False

    # Legacy hashes were raw bcrypt. Keep them verifiable for existing candidates.
    raw_password = plain_password.encode("utf-8")
    bcrypt_hash = hashed_password.encode("utf-8")
    try:
        return bcrypt.checkpw(raw_password, bcrypt_hash)
    except ValueError:
        try:
            return bcrypt.checkpw(raw_password[:72], bcrypt_hash)
        except ValueError:
            return False


def get_password_hash(password: str) -> str:
    """Hash a password."""
    bcrypt_hash = bcrypt.hashpw(_bcrypt_secret(password), bcrypt.gensalt())
    return f"{PASSWORD_HASH_PREFIX}{bcrypt_hash.decode('utf-8')}"


def create_access_token(
    data: Dict,
    expires_delta: Optional[timedelta] = None
) -> str:
    """
    Create JWT access token.
    
    Args:
        data: Data to encode in token
        expires_delta: Token expiration time
    
    Returns:
        Encoded JWT token
    """
    to_encode = data.copy()
    
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(
            minutes=settings.JWT_ACCESS_TOKEN_EXPIRE_MINUTES
        )
    
    to_encode.update({"exp": expire, "type": "access"})
    
    encoded_jwt = jwt.encode(
        to_encode,
        settings.JWT_SECRET_KEY,
        algorithm=settings.JWT_ALGORITHM
    )
    
    return encoded_jwt


def create_refresh_token(data: Dict) -> str:
    """
    Create JWT refresh token.
    
    Args:
        data: Data to encode in token
    
    Returns:
        Encoded JWT refresh token
    """
    to_encode = data.copy()
    
    expire = datetime.utcnow() + timedelta(
        days=settings.JWT_REFRESH_TOKEN_EXPIRE_DAYS
    )
    
    to_encode.update({"exp": expire, "type": "refresh"})
    
    encoded_jwt = jwt.encode(
        to_encode,
        settings.JWT_SECRET_KEY,
        algorithm=settings.JWT_ALGORITHM
    )
    
    return encoded_jwt


def decode_token(token: str) -> Optional[Dict]:
    """
    Decode and verify JWT token.
    
    Args:
        token: JWT token to decode
    
    Returns:
        Decoded token payload or None if invalid
    """
    try:
        payload = jwt.decode(
            token,
            settings.JWT_SECRET_KEY,
            algorithms=[settings.JWT_ALGORITHM]
        )
        return payload
    except JWTError:
        return None


def create_token_pair(user_id: int, email: str, role: str = "candidate", source: Optional[str] = None) -> Dict[str, str]:
    """
    Create access and refresh token pair.
    
    Args:
        user_id: User ID
        email: User email
        role: User role (admin or candidate)
        source: Candidate source ("manual" or "onboarding")
    
    Returns:
        Dict with access_token and refresh_token
    """
    token_data = {
        "sub": str(user_id),
        "email": email,
        "role": role,
    }
    
    if source:
        token_data["source"] = source
    
    access_token = create_access_token(token_data)
    refresh_token = create_refresh_token(token_data)
    
    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "bearer"
    }


def is_admin_user(email: str) -> bool:
    """
    Check if an email belongs to an admin user.
    
    Args:
        email: User email to check
    
    Returns:
        bool: True if user is admin
    """
    from config import get_settings
    settings = get_settings()
    return email.lower() in [e.lower() for e in settings.ADMIN_EMAILS]


async def check_admin(user):
    """
    Check if user has admin role.
    
    Args:
        user: User object to check
    
    Raises:
        HTTPException: If user is not admin
    """
    # Check admin status by email
    if not hasattr(user, 'email') or not is_admin_user(user.email):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin privileges required"
        )
