"""Redis client initialization and utilities."""
from typing import Optional, Any
import json
from redis.asyncio import Redis, ConnectionPool
from config import get_settings

settings = get_settings()

# Redis connection pool
redis_pool: Optional[ConnectionPool] = None
redis_client: Optional[Redis] = None


async def init_redis() -> Redis:
    """Initialize Redis connection pool."""
    global redis_pool, redis_client
    
    redis_pool = ConnectionPool.from_url(
        settings.REDIS_URL,
        max_connections=settings.REDIS_MAX_CONNECTIONS,
        decode_responses=settings.REDIS_DECODE_RESPONSES,
    )
    
    redis_client = Redis(connection_pool=redis_pool)
    
    # Test connection
    await redis_client.ping()
    
    return redis_client


async def close_redis() -> None:
    """Close Redis connections."""
    global redis_client, redis_pool
    
    if redis_client:
        await redis_client.close()
    
    if redis_pool:
        await redis_pool.disconnect()


def get_redis() -> Redis:
    """Get Redis client instance."""
    if redis_client is None:
        raise RuntimeError("Redis not initialized. Call init_redis() first.")
    return redis_client


class RedisService:
    """Redis service for various operations."""
    
    def __init__(self, redis: Redis):
        self.redis = redis
    
    # OTP Operations
    async def set_otp(self, email: str, otp: str, expiry: int = 300) -> None:
        """Store OTP for email with expiry."""
        key = f"{settings.REDIS_OTP_PREFIX}{email}"
        await self.redis.setex(key, expiry, otp)
    
    async def get_otp(self, email: str) -> Optional[str]:
        """Get OTP for email."""
        key = f"{settings.REDIS_OTP_PREFIX}{email}"
        return await self.redis.get(key)
    
    async def delete_otp(self, email: str) -> None:
        """Delete OTP for email."""
        key = f"{settings.REDIS_OTP_PREFIX}{email}"
        await self.redis.delete(key)
    
    async def increment_otp_attempts(self, email: str) -> int:
        """Increment and get OTP attempt count."""
        key = f"{settings.REDIS_OTP_PREFIX}{email}:attempts"
        count = await self.redis.incr(key)
        if count == 1:
            await self.redis.expire(key, settings.OTP_EXPIRY_SECONDS)
        return count
    
    # Session Operations
    async def set_session(self, session_id: str, data: dict, expiry: int = 3600) -> None:
        """Store session data."""
        key = f"{settings.REDIS_SESSION_PREFIX}{session_id}"
        await self.redis.setex(key, expiry, json.dumps(data))
    
    async def get_session(self, session_id: str) -> Optional[dict]:
        """Get session data."""
        key = f"{settings.REDIS_SESSION_PREFIX}{session_id}"
        data = await self.redis.get(key)
        return json.loads(data) if data else None
    
    async def delete_session(self, session_id: str) -> None:
        """Delete session."""
        key = f"{settings.REDIS_SESSION_PREFIX}{session_id}"
        await self.redis.delete(key)
    
    async def extend_session(self, session_id: str, expiry: int = 3600) -> None:
        """Extend session expiry."""
        key = f"{settings.REDIS_SESSION_PREFIX}{session_id}"
        await self.redis.expire(key, expiry)
    
    # Rate Limiting
    async def check_rate_limit(
        self, key: str, limit: int, window: int
    ) -> tuple[bool, int]:
        """
        Check if rate limit is exceeded.
        
        Returns:
            tuple: (is_allowed, remaining_requests)
        """
        rate_key = f"{settings.REDIS_RATELIMIT_PREFIX}{key}"
        current = await self.redis.get(rate_key)
        
        if current is None:
            await self.redis.setex(rate_key, window, 1)
            return True, limit - 1
        
        current_count = int(current)
        if current_count >= limit:
            return False, 0
        
        await self.redis.incr(rate_key)
        return True, limit - current_count - 1
    
    # Distributed Locks
    async def acquire_lock(
        self, lock_name: str, timeout: int = 10, blocking_timeout: int = 5
    ) -> bool:
        """Acquire distributed lock."""
        key = f"{settings.REDIS_LOCK_PREFIX}{lock_name}"
        return await self.redis.set(key, "1", nx=True, ex=timeout)
    
    async def release_lock(self, lock_name: str) -> None:
        """Release distributed lock."""
        key = f"{settings.REDIS_LOCK_PREFIX}{lock_name}"
        await self.redis.delete(key)
    
    # Cache Operations
    async def cache_set(
        self, key: str, value: Any, expiry: int = 3600
    ) -> None:
        """Cache a value."""
        cache_key = f"{settings.REDIS_CACHE_PREFIX}{key}"
        if isinstance(value, (dict, list)):
            value = json.dumps(value)
        await self.redis.setex(cache_key, expiry, value)
    
    async def cache_get(self, key: str) -> Optional[Any]:
        """Get cached value."""
        cache_key = f"{settings.REDIS_CACHE_PREFIX}{key}"
        value = await self.redis.get(cache_key)
        if value:
            try:
                return json.loads(value)
            except json.JSONDecodeError:
                return value
        return None
    
    async def cache_delete(self, key: str) -> None:
        """Delete cached value."""
        cache_key = f"{settings.REDIS_CACHE_PREFIX}{key}"
        await self.redis.delete(cache_key)
    
    async def cache_exists(self, key: str) -> bool:
        """Check if cache key exists."""
        cache_key = f"{settings.REDIS_CACHE_PREFIX}{key}"
        return await self.redis.exists(cache_key) > 0
    
    # Test Timer
    async def set_test_timer(
        self, session_id: str, duration_seconds: int
    ) -> None:
        """Set timer for test session."""
        key = f"{settings.REDIS_SESSION_PREFIX}{session_id}:timer"
        await self.redis.setex(key, duration_seconds, "active")
    
    async def get_test_remaining_time(self, session_id: str) -> Optional[int]:
        """Get remaining time for test session."""
        key = f"{settings.REDIS_SESSION_PREFIX}{session_id}:timer"
        ttl = await self.redis.ttl(key)
        return ttl if ttl > 0 else None
