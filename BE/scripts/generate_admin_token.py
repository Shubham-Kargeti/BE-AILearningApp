"""Generate an access token for a given email and print it to stdout.

Usage:
    python scripts/generate_admin_token.py admin@nagarro.com
"""
import sys
import asyncio
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.db.session import async_session_maker
from app.db.models import User
from app.core.security import create_token_pair

async def main(email: str):
    async with async_session_maker() as session:
        from sqlalchemy import select
        res = await session.execute(
            select(User).where(User.email == email)
        )
        user = res.scalar_one_or_none()
        if not user:
            print(f"User {email} not found")
            return
        user_id = user.id
        user_email = user.email
        tokens = create_token_pair(user_id, user_email)
        print(tokens["access_token"])

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python scripts/generate_admin_token.py <email>")
        sys.exit(1)
    asyncio.run(main(sys.argv[1]))
