import io
from typing import Any

import pandas as pd


QUESTION_TYPE_MAP = {
    "MCQ": "MCQ",
    "Scenario-based MCQ": "SCENARIO-MCQ",
    "SCENARIO-MCQ": "SCENARIO-MCQ",
    "Subjective": "SCENARIO",
    "Scenario": "SCENARIO",
}

VARIANT_MAP = {
    "A": "1",
    "B": "2",
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


def parse_bcg_quiz_excel(file_bytes: bytes, module_by_name: dict[str, Any]) -> dict[str, Any]:
    df = pd.read_excel(io.BytesIO(file_bytes))
    columns = list(df.columns)

    module_no_col = _canonical_column(columns, "Module No.", "Module No", "Module Number", "module_no")
    module_name_col = _canonical_column(columns, "Module Name", "module_name")
    question_group_col = _canonical_column(columns, "Question Group", "question_group")
    category_col = _canonical_column(columns, "Category", "category")
    variation_col = _canonical_column(columns, "Variation", "variation")
    question_id_col = _canonical_column(columns, "Question ID", "question_id")
    priority_col = _canonical_column(columns, "Priority", "priority")
    question_type_col = _canonical_column(columns, "Question Type", "question_type")
    question_text_col = _canonical_column(columns, "Question Text", "Question", "question_text")

    option_cols = []
    for letter in ["A", "B", "C", "D"]:
        col = _canonical_column(columns, f"Option {letter}", f"option_{letter.lower()}")
        if col:
            option_cols.append((letter, col))

    correct_answer_col = _canonical_column(columns, "Correct Answer", "correct_answer")

    if not module_name_col or not question_text_col:
        raise ValueError("Missing required columns: Module Name and Question Text")

    grouped: dict[str, dict[str, Any]] = {}
    skipped = 0

    for _, row in df.iterrows():
        module_name = str(row.get(module_name_col, "") or "").strip()
        if not module_name:
            skipped += 1
            continue

        module = module_by_name.get(module_name.lower())
        if not module:
            skipped += 1
            continue

        question_text = str(row.get(question_text_col, "") or "").strip()
        if not question_text:
            skipped += 1
            continue

        choices = []
        for _, col in option_cols:
            val = row.get(col)
            if pd.notna(val) and str(val).strip():
                choices.append(str(val).strip())

        correct_answer = ""
        correct_letter = str(row.get(correct_answer_col, "") or "").strip().upper() if correct_answer_col else ""
        letter_to_index = {"A": 0, "B": 1, "C": 2, "D": 3}
        idx = letter_to_index.get(correct_letter)
        if idx is not None and idx < len(choices):
            correct_answer = choices[idx]
        elif choices:
            correct_answer = choices[0]

        variation = str(row.get(variation_col, "") or "").strip().upper()
        variant = VARIANT_MAP.get(variation, "1")

        raw_type = str(row.get(question_type_col, "") or "").strip()
        mapped_type = QUESTION_TYPE_MAP.get(raw_type, "MCQ")

        try:
            priority = int(float(str(row.get(priority_col, 0) or 0)))
        except (TypeError, ValueError):
            priority = 0

        category = str(row.get(category_col, "") or "").strip() or None

        grouped.setdefault(module.title, {
            "module_no": module.rank,
            "module_id": module.id,
            "title": module.title,
            "variants": {},
        })

        grouped[module.title]["variants"].setdefault(variant, []).append({
            "module_no": module.rank,
            "module_id": module.id,
            "question_text": question_text,
            "question_type": mapped_type,
            "choices": choices,
            "correct_answer": correct_answer,
            "variant": variant,
            "priority": priority,
            "category": category,
        })

    response = []
    for module_title in sorted(grouped.keys(), key=lambda t: grouped[t]["module_no"]):
        payload = grouped[module_title]
        variants = []
        for variant in sorted(payload["variants"].keys(), key=lambda v: int(v) if v.isdigit() else 999):
            variants.append({
                "variant": variant,
                "questions": payload["variants"][variant],
            })
        response.append({
            "module_no": payload["module_no"],
            "module_id": payload["module_id"],
            "title": payload["title"],
            "variants": variants,
        })

    return {"modules": response, "skipped": skipped}
