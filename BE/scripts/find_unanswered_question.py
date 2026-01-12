"""Find a question id in the same question_set that doesn't have an answer for the given session."""
import asyncio
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from sqlalchemy import select
from app.db.session import async_session_maker
from app.db.models import TestSession, Question, Answer

async def main(session_id):
    async with async_session_maker() as session:
        res = await session.execute(select(TestSession).where(TestSession.session_id == session_id))
        ts = res.scalar_one_or_none()
        if not ts:
            print("Session not found")
            return
        qsid = ts.question_set_id
        if not qsid:
            print("Session has no question_set_id")
            return
        res = await session.execute(select(Question).where(Question.question_set_id == qsid))
        qs = res.scalars().all()
        answered_res = await session.execute(select(Answer.question_id).where(Answer.session_id == session_id))
        answered = {r[0] for r in answered_res.all()}
        for q in qs:
            if q.id not in answered:
                print("Found unanswered question id:", q.id)
                return
        print("All questions have answers for this session")

if __name__ == '__main__':
    if len(sys.argv) < 2:
        print("Usage: python scripts/find_unanswered_question.py <session_id>")
        sys.exit(1)
    asyncio.run(main(sys.argv[1]))
