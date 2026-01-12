"""Migration script to ALTER TABLE answers.selected_answer to TEXT.

Usage:
    python scripts/migrate_selected_answer_to_text.py
"""
import asyncio
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from sqlalchemy import text
from app.db.session import engine

async def main():
    async with engine.begin() as conn:
        print("Altering answers.selected_answer column to TEXT...")
        await conn.execute(text('ALTER TABLE answers ALTER COLUMN selected_answer TYPE TEXT'))
        print("Done.")

if __name__ == '__main__':
    asyncio.run(main())
