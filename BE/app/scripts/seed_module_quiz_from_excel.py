import pandas as pd
from sqlalchemy import select, delete
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import OnboardingModule, OnboardingModuleQuiz


EXCEL_PATH = "app/scripts/BCG_Onboarding_Questionnaire_Bank.xlsx"

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
    "Scenario-based MCQ": "MCQ",
    "Subjective": "SCENARIO",
}


async def seed_module_quiz_from_excel(db: AsyncSession) -> None:
    df = pd.read_excel(EXCEL_PATH)

    df = df[df["Active"].astype(str).str.strip().str.lower() == "yes"]

    modules_result = await db.execute(select(OnboardingModule))
    modules = modules_result.scalars().all()
    module_by_rank = {m.rank: m for m in modules}

    for module_no, group in df.groupby("Module No."):
        module = module_by_rank.get(MODULE_NO_TO_RANK.get(int(module_no)))
        if not module:
            continue

        await db.execute(
            delete(OnboardingModuleQuiz).where(
                OnboardingModuleQuiz.module_id == module.id
            )
        )

        quizzes = []
        for display_order, (_, row) in enumerate(group.iterrows(), start=1):
            raw_type = str(row["Question Type"]).strip()
            mapped_type = QUESTION_TYPE_MAP.get(raw_type, "MCQ")

            options = []
            for col in ["Option A", "Option B", "Option C", "Option D"]:
                val = row.get(col)
                if pd.notna(val) and str(val).strip():
                    options.append(str(val).strip())

            correct_answer = ""
            if mapped_type == "MCQ":
                letter = str(row.get("Correct Answer", "")).strip().upper()
                letter_to_index = {"A": 0, "B": 1, "C": 2, "D": 3}
                idx = letter_to_index.get(letter)
                if idx is not None and idx < len(options):
                    correct_answer = options[idx]
                elif options:
                    correct_answer = options[0]
            else:
                correct_answer = str(row.get("Correct Answer", "")).strip()

            variation = str(row.get("Variation", "")).strip().upper()
            variant_map = {"A": "1", "B": "2"}
            variant = variant_map.get(variation)

            quizzes.append(
                OnboardingModuleQuiz(
                    module_id=module.id,
                    question_text=str(row["Question Text"]).strip(),
                    question_type=mapped_type,
                    choices=options if options else [],
                    correct_answer=correct_answer or "",
                    display_order=display_order,
                    points=1,
                    variant=variant,
                )
            )

        db.add_all(quizzes)
        await db.commit()
