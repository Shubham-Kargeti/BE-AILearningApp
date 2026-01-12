"""Migration helper: alter answers.selected_answer column to TEXT.

Run locally in dev to change the column type safely:
    python scripts/alter_selected_answer_to_text.py
"""
import asyncio
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.db.session import engine

async def main():
    from sqlalchemy import text
    async with engine.begin() as conn:
        print("Altering column 'answers.selected_answer' to type TEXT...")
        # Postgres syntax: ALTER TABLE answers ALTER COLUMN selected_answer TYPE TEXT;
        await conn.execute(text('ALTER TABLE answers ALTER COLUMN selected_answer TYPE TEXT;'))
        print("Done.")

if __name__ == '__main__':
    asyncio.run(main())
