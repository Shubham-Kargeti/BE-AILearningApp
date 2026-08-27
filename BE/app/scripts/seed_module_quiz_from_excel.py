import io
from typing import Any

import pandas as pd
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import OnboardingModule, OnboardingModuleQuiz


MODULE_NO_TO_RANK = {
    1: 1,
    2: 2,
    3: 3,
    4: 4,
    5: 5,
    6: 6,
}

QUESTION_TYPE_MAP = {
    "MCQ": "MCQ",
    "Scenario-based MCQ": "SCENARIO-MCQ",
    "Subjective": "SCENARIO",
}


def _canonical_column(columns: list[str], *candidates: str) -> str | None:
    def normalize(value: str) -> str:
        return " ".join(
            str(value)
            .strip()
            .lower()
            .replace("/", " ")
            .replace("-", " ")
            .replace("_", " ")
            .replace("%", " ")
            .replace("(", " ")
            .replace(")", " ")
            .replace(".", " ")
            .replace(",", " ")
            .split()
        )

    normalized = {normalize(col): col for col in columns}
    for candidate in candidates:
        match = normalized.get(normalize(candidate))
        if match is not None:
            return match
    return None


def _as_bool(value: Any) -> bool:
    if value is None:
        return False
    return str(value).strip().lower() in {"yes", "y", "true", "1"}


def parse_excel_rows(excel_df: pd.DataFrame) -> list[dict[str, Any]]:
    if excel_df is None or excel_df.empty:
        return []

    df = excel_df.copy()
    columns = list(df.columns)

    module_col = _canonical_column(columns, "Module No.", "Module No", "Module Number", "module_no")
    active_col = _canonical_column(columns, "Active", "active")
    question_text_col = _canonical_column(columns, "Question Text", "Question", "question_text")
    question_type_col = _canonical_column(columns, "Question Type", "question_type")
    variation_col = _canonical_column(columns, "Variation", "variation")
    correct_answer_col = _canonical_column(columns, "Correct Answer", "correct_answer")
    category_col = _canonical_column(columns, "Category", "category")

    if not module_col or not question_text_col:
        return []

    df = df[[col for col in df.columns if str(col).strip() in {module_col, active_col or "", question_text_col, question_type_col or "", variation_col or "", correct_answer_col or "", category_col or "", *[f"Option {letter}" for letter in ["A", "B", "C", "D"]]}]]
    df = df[df[active_col].astype(str).str.strip().str.lower().isin({"yes", "y", "true", "1"})] if active_col else df

    rows: list[dict[str, Any]] = []
    for _, row in df.iterrows():
        question_text = str(row.get(question_text_col, "") or "").strip()
        if not question_text:
            continue

        try:
            module_no = int(float(str(row.get(module_col, "")).strip()))
        except (TypeError, ValueError):
            continue

        raw_type = str(row.get(question_type_col, "") or "").strip()
        mapped_type = QUESTION_TYPE_MAP.get(raw_type, "MCQ")

        options = []
        for col in ["Option A", "Option B", "Option C", "Option D"]:
            if col in df.columns:
                val = row.get(col)
                if pd.notna(val) and str(val).strip():
                    options.append(str(val).strip())

        correct_answer_value = row.get(correct_answer_col) if correct_answer_col else ""
        correct_answer = ""
        if mapped_type == "MCQ":
            letter = str(correct_answer_value).strip().upper()
            if not letter:
                letter = str(row.get("Correct Answer", "")).strip().upper()
            letter_to_index = {"A": 0, "B": 1, "C": 2, "D": 3}
            idx = letter_to_index.get(letter)
            if idx is not None and idx < len(options):
                correct_answer = options[idx]
            elif options:
                correct_answer = options[0]
        else:
            correct_answer = str(correct_answer_value or "").strip()

        variation = str(row.get(variation_col, "") or "").strip().upper()
        variant = {"A": "1", "B": "2"}.get(variation)

        rows.append(
            {
                "module_no": module_no,
                "question_text": question_text,
                "question_type": mapped_type,
                "choices": options,
                "correct_answer": correct_answer,
                "variant": variant,
                "display_order": len(rows) + 1,
                "category": str(row.get(category_col) or "").strip() or None,
            }
        )

    return rows


def parse_excel_file(file_bytes: bytes) -> list[dict[str, Any]]:
    return parse_excel_rows(pd.read_excel(io.BytesIO(file_bytes)))


async def seed_module_quiz_from_excel(db: AsyncSession) -> None:
    df = pd.read_excel(EXCEL_PATH)
    records = parse_excel_rows(df)

    modules_result = await db.execute(select(OnboardingModule))
    modules = modules_result.scalars().all()
    module_by_rank = {m.rank: m for m in modules}

    for module_no in sorted({row["module_no"] for row in records}):
        module = module_by_rank.get(MODULE_NO_TO_RANK.get(int(module_no)))
        if not module:
            continue

        group = [row for row in records if row["module_no"] == module_no]
        await db.execute(
            delete(OnboardingModuleQuiz).where(
                OnboardingModuleQuiz.module_id == module.id
            )
        )

        quizzes = []
        for display_order, row in enumerate(group, start=1):
            quizzes.append(
                OnboardingModuleQuiz(
                    module_id=module.id,
                    question_text=row["question_text"],
                    question_type=row["question_type"],
                    choices=row["choices"],
                    correct_answer=row["correct_answer"],
                    display_order=display_order,
                    points=1,
                    variant=row["variant"],
                    category=row.get("category"),
                )
            )

        db.add_all(quizzes)
        await db.commit()
