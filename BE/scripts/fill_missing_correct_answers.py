"""Fill missing correct_answer values in the questions table.

This script sets `correct_answer` to an explicit empty string where it is NULL.

Usage:
    python scripts/fill_missing_correct_answers.py
"""
import asyncio
import sys
from pathlib import Path

# Ensure project root is on sys.path when running as a script
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from sqlalchemy import update, select, func
from app.db.session import async_session_maker
from app.db.models import Question


async def main():
    async with async_session_maker() as session:
        # Find questions where correct_answer is NULL or blank (whitespace)
        missing_stmt = select(Question).where(
            (Question.correct_answer.is_(None)) | (func.trim(Question.correct_answer) == "")
        )
        res = await session.execute(missing_stmt)
        missing_questions = res.scalars().all()
        print(f"Found {len(missing_questions)} questions with missing/blank correct_answer.")

        if not missing_questions:
            print("No changes required.")
            return

        # Log sample question ids for manual verification
        sample_ids = [q.id for q in missing_questions[:10]]
        print(f"Sample question IDs to be updated: {sample_ids}")

        # Perform update: set correct_answer to empty string where it is NULL or blank
        upd = update(Question).where(
            (Question.correct_answer.is_(None)) | (func.trim(Question.correct_answer) == "")
        ).values(correct_answer="")
        upd_res = await session.execute(upd)
        print(f"Matched rows: {upd_res.rowcount}")
        await session.commit()
        print("✅ Ensured missing/blank correct_answer values are stored as empty string.")


if __name__ == "__main__":
    asyncio.run(main())
