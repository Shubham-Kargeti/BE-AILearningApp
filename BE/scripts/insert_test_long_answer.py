"""Insert a test answer with a very long selected_answer to verify DB column type supports it."""
import asyncio
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.db.session import async_session_maker
from app.db.models import Answer

async def main():
    long_text = "A" * 20000  # 20k chars
    async with async_session_maker() as session:
        # Use an existing session_id and question_id from your DB; adjust if needed
        session_id = 'session_55b8d315570840e7a01972bcc3818122'
        question_id = 2346
        ans = Answer(session_id=session_id, question_id=question_id, selected_answer=long_text, is_correct=False)
        session.add(ans)
        try:
            await session.commit()
            print("Inserted test answer successfully.")
        except Exception as e:
            print("Error inserting:", e)
            await session.rollback()

if __name__ == '__main__':
    asyncio.run(main())
