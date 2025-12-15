from langchain_groq import ChatGroq
from config import GROQ_API_KEY
from langchain_core.prompts import (
    ChatPromptTemplate,
    HumanMessagePromptTemplate,
    SystemMessagePromptTemplate
)
from app.db.models import QuestionSet, Question
from sqlalchemy.ext.asyncio import AsyncSession
from uuid import uuid4
import json
import asyncio
import time

# ------------------------------------------------------------
# Difficulty normalization (ADMIN → DB)
# ------------------------------------------------------------
LEVEL_MAP = {
    "basic": "easy",
    "beginner": "easy",
    "intermediate": "medium",
    "advanced": "hard",
    "expert": "hard"
}

# ------------------------------------------------------------
# DOWNWARD-ONLY Validators (SAFE & ASYMMETRIC)
# ------------------------------------------------------------
def is_clearly_beginner_question(question_text: str) -> bool:
    """
    Detect ONLY obvious beginner / recall questions.
    Conservative by design.
    """
    recall_patterns = [
        "what is",
        "which of the following",
        "define",
        "identify",
        "purpose of",
        "used for"
    ]

    text = question_text.lower().strip()
    return any(text.startswith(p) for p in recall_patterns)


# ------------------------------------------------------------
# LLM PROMPT (UNCHANGED)
# ------------------------------------------------------------
system_message = SystemMessagePromptTemplate.from_template(
    """
You are an expert assessment generator for technical and non-technical skills.

You will receive:
- A list of skills with required difficulty levels
- A fixed total question count (MAX 10)

You MUST strictly follow the difficulty rubric below.
Do NOT invent your own interpretation of difficulty.

==================================================
STRICT DIFFICULTY ENFORCEMENT (NON-NEGOTIABLE)
==================================================

❌ FOR INTERMEDIATE OR ADVANCED QUESTIONS, YOU MUST NOT:
- Ask definition-based questions
- Ask "What is...", "What is the purpose of...", "How do you..." questions
- Ask recall-only or fact-based questions
- Ask questions answerable without reasoning or context

✅ INTERMEDIATE QUESTIONS MUST:
- Contain a scenario, condition, example, or situation
- Require applying knowledge (not recall)
- Ask about outcomes, behavior, or decisions

✅ ADVANCED QUESTIONS MUST:
- Involve constraints, trade-offs, or edge cases
- Require multi-step reasoning
- Include architecture, performance, scalability, or failure considerations

==================================================
DIFFICULTY RUBRIC (MANDATORY)
==================================================

EASY (Beginner-level):
- Tests recall or recognition only
- No real-world scenarios
- No system design
- No multi-step reasoning
- Single concept per question
- Examples: definitions, purpose, basic syntax, simple facts

INTERMEDIATE:
- Includes a short scenario, example, or code snippet
- Requires applying knowledge, not just recall
- May involve comparison of approaches
- No deep architecture or optimization decisions

ADVANCED:
- Involves real-world constraints or edge cases
- Requires reasoning across multiple concepts
- May include architecture, performance, scalability, or trade-offs
- No obvious or direct answer

==================================================
QUESTION DISTRIBUTION RULES
==================================================

- Total questions MUST be exactly {total_questions}
- Skills marked as higher difficulty must receive more emphasis
- Advanced skills should receive deeper, more complex questions
- Beginner skills should receive simpler questions
- You MUST internally validate that each question follows its difficulty rubric

==================================================
OUTPUT FORMAT (STRICT)
==================================================

Return ONLY a valid JSON array.
Do NOT include skill names, difficulty labels, or explanations.

Each question must follow this exact format:

{{
  "question_id": 1,
  "question_text": "Question text",
  "options": [
    {{"option_id": "A", "text": "Option A"}},
    {{"option_id": "B", "text": "Option B"}},
    {{"option_id": "C", "text": "Option C"}},
    {{"option_id": "D", "text": "Option D"}}
  ],
  "correct_answer": "A"
}}

No markdown.
No extra fields.
No comments.
"""
)

human_message = HumanMessagePromptTemplate.from_template(
    "Skills and difficulty levels:\n{skills_json}"
)

chat_prompt = ChatPromptTemplate.from_messages([system_message, human_message])

llm = ChatGroq(
    model="llama-3.3-70b-versatile",
    temperature=0,
    api_key=GROQ_API_KEY
)

# ------------------------------------------------------------
# MAIN FUNCTION
# ------------------------------------------------------------
async def generate_assessment_question_set(
    required_skills: dict,
    db: AsyncSession
):
    start_time = time.time()

    # Normalize skills
    skills_with_levels = [
        {
            "skill": skill,
            "level": level,
            "difficulty": LEVEL_MAP.get(level.lower(), "medium")
        }
        for skill, level in required_skills.items()
    ]

    formatted = json.dumps(skills_with_levels, indent=2)
    messages = chat_prompt.format_messages(
        skills_json=formatted,
        total_questions=10
    )

    # Single LLM call
    response = await asyncio.to_thread(llm.invoke, messages)

    print("\n[Admin Assessment LLM Output]\n", response.content)

    try:
        data = json.loads(response.content)
        if not isinstance(data, list) or len(data) != 10:
            raise ValueError("Expected exactly 10 questions")
    except Exception as e:
        raise ValueError(f"Invalid LLM output: {e}")

    # --------------------------------------------------------
    # Create QuestionSet
    # --------------------------------------------------------
    question_set_id = f"qs_{uuid4().hex}"

    qs = QuestionSet(
        question_set_id=question_set_id,
        skill="multiple-skills",
        level="mixed",
        total_questions=10,
        generation_model="llama-3.3-70b-versatile"
    )

    db.add(qs)
    await db.flush()

    # --------------------------------------------------------
    # Save Questions (ASYMMETRIC VALIDATION)
    # --------------------------------------------------------
    for idx, q in enumerate(data):
        options_dict = {
            opt["option_id"]: opt["text"]
            for opt in q["options"]
        }

        skill_meta = skills_with_levels[idx % len(skills_with_levels)]
        intended_difficulty = skill_meta["difficulty"]
        qt = q["question_text"]

        # 🔒 ONLY detect DOWNWARD violations
        if intended_difficulty in ("medium", "hard") and is_clearly_beginner_question(qt):
            print(
                f"[WARN] Downward difficulty violation "
                f"(expected {intended_difficulty}): {qt}"
            )

        db_question = Question(
            question_set_id=question_set_id,
            question_text=qt,
            options=options_dict,
            correct_answer=q["correct_answer"],
            difficulty=intended_difficulty,
            generation_model="llama-3.3-70b-versatile",
            generation_time=time.time() - start_time
        )

        db.add(db_question)

    await db.commit()
    return question_set_id