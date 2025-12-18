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
# MCQ LLM PROMPT 
# ------------------------------------------------------------
mcq_system_message = SystemMessagePromptTemplate.from_template(
    """
You are an expert assessment generator for technical and non-technical skills.

You will receive:
- A list of skills with required difficulty levels
- A fixed total question count (Exactly {total_questions})

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

mcq_human_message = HumanMessagePromptTemplate.from_template(
    "Skills and difficulty levels:\n{skills_json}"
)

mcq_prompt = ChatPromptTemplate.from_messages(
    [mcq_system_message, mcq_human_message]
)

# ------------------------------------------------------------
# CODING QUESTION PROMPT
# ------------------------------------------------------------

coding_system_message = SystemMessagePromptTemplate.from_template(
    """
You are generating LEETCODE-STYLE CODING QUESTIONS for a technical assessment.

CRITICAL DEFINITIONS (NON-NEGOTIABLE):
- A coding question MUST be solvable by writing a single function or method
- The problem MUST have deterministic inputs and outputs
- The solution MUST be testable using automated test cases
- DO NOT ask for system design, deployment, architecture, APIs, or DevOps
- DO NOT ask for explanations, essays, or real-world write-ups

STRICT RULES:
- Generate EXACTLY {coding_count} questions
- Difficulty must align with provided skill difficulty:
  - Easy → Basic algorithms / data structures
  - Medium → Multi-step logic, optimized solutions
  - Hard → Advanced algorithms, edge cases, performance constraints
- Questions MUST resemble LeetCode / HackerRank style problems
- NO scenario storytelling
- NO Docker, Kubernetes, cloud, monitoring, or architecture topics
- NO MCQs
- NO solutions

QUESTION REQUIREMENTS:
Each question MUST include:
1. Clear problem statement
2. Explicit input description
3. Explicit output description
4. Constraints section (time/space or value bounds)
5. Language-agnostic logic (even if language is specified)

OUTPUT FORMAT (STRICT JSON ONLY):
Return ONLY a valid JSON array of EXACTLY {coding_count} items.

Each item MUST follow this format EXACTLY:

{{
  "question_id": 1,
  "title": "Concise algorithmic problem title",
  "description": "Problem statement including input and output description",
  "language": "python",
  "constraints": [
    "Example: 1 <= n <= 10^5",
    "Example: O(n log n) or better solution required"
  ]
}}

ABSOLUTE PROHIBITIONS:
- No markdown
- No explanations
- No examples section
- No test cases
- No additional fields
"""
)


coding_human_message = HumanMessagePromptTemplate.from_template(
    "Skills and difficulty levels:\n{skills_json}"
)

coding_prompt = ChatPromptTemplate.from_messages(
    [coding_system_message, coding_human_message]
)

# ------------------------------------------------------------
# ARCHITECTURE QUESTION PROMPT 
# ------------------------------------------------------------
architecture_system_message = SystemMessagePromptTemplate.from_template(
    """
You are generating ARCHITECTURE / SYSTEM DESIGN QUESTIONS.

STRICT RULES:
- Generate EXACTLY {architecture_count} questions
- Each question MUST include a unique question_id (1–2)
- Questions must be real-world and design-focused
- No MCQ options
- No answers or solutions

OUTPUT FORMAT (STRICT):
Return ONLY a valid JSON array of EXACTLY {architecture_count} items.

Each item must follow this format:

{{
  "question_id": 1,
  "title": "System design problem title",
  "description": "Design problem statement",
  "focus_areas": ["Scalability", "Reliability", "Trade-offs"]
}}

No markdown.
No explanations.
"""
)

# ------------------------------------------------------------
# LLM INITIALIZATION
# ------------------------------------------------------------
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
    db: AsyncSession,
    questionnaire_config: dict | None = None
):
    start_time = time.time()

    # ------------------------------------------------------------
    # Questionnaire configuration (FE-driven, backward-safe)
    # ------------------------------------------------------------
    questionnaire_config = questionnaire_config or {}

    mcq_count = int(questionnaire_config.get("mcq", 6))
    coding_count = int(questionnaire_config.get("coding", 2))
    architecture_count = int(questionnaire_config.get("architecture", 2))
    total_questions = mcq_count + coding_count + architecture_count


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

    messages = mcq_prompt.format_messages(
        skills_json=formatted,
        #total_questions=6
        total_questions=mcq_count
    )

    # LLM call (MCQs only)
    response = await asyncio.to_thread(llm.invoke, messages)

    print("\n[Admin MCQ LLM Output]\n", response.content)

    try:
        data = json.loads(response.content)
        # if not isinstance(data, list) or len(data) != 6:
        #     raise ValueError("Expected exactly 6 MCQ questions")
        if not isinstance(data, list) or len(data) != mcq_count:
            raise ValueError(
                f"Expected exactly {mcq_count} MCQ questions, got {len(data)}"
            )

    except Exception as e:
        raise ValueError(f"Invalid MCQ LLM output: {e}")
    
    # --------------------------------------------------------
    # CODING QUESTIONS 
    # --------------------------------------------------------
    coding_messages = coding_prompt.format_messages(
        skills_json=formatted,
        coding_count=coding_count
    )

    coding_response = await asyncio.to_thread(llm.invoke, coding_messages)

    print("\n[Admin CODING LLM Output]\n", coding_response.content)

    try:
        coding_data = json.loads(coding_response.content)
        # if not isinstance(coding_data, list) or len(coding_data) != 2:
        #     raise ValueError("Expected exactly 2 coding questions")
        if not isinstance(coding_data, list) or len(coding_data) != coding_count:
            raise ValueError(
            f"Expected exactly {coding_count} coding questions, got {len(coding_data)}"
    )

    except Exception as e:
        raise ValueError(f"Invalid CODING LLM output: {e}")
    
    # --------------------------------------------------------
    # ARCHITECTURE QUESTIONS 
    # --------------------------------------------------------
    architecture_messages = ChatPromptTemplate.from_messages(
        [
            architecture_system_message,
            HumanMessagePromptTemplate.from_template(
                "Skills and difficulty levels:\n{skills_json}"
            ),
        ]
    ).format_messages(
        skills_json=formatted,
        architecture_count=architecture_count
    )

    architecture_response = await asyncio.to_thread(llm.invoke, architecture_messages)

    print("\n[Admin ARCHITECTURE LLM Output]\n", architecture_response.content)

    try:
        architecture_data = json.loads(architecture_response.content)
        # if not isinstance(architecture_data, list) or len(architecture_data) != 2:
        #     raise ValueError("Expected exactly 2 architecture questions")
        if not isinstance(architecture_data, list) or len(architecture_data) != architecture_count:
            raise ValueError(
        f"Expected exactly {architecture_count} architecture questions, got {len(architecture_data)}"
    )

    except Exception as e:
        raise ValueError(f"Invalid ARCHITECTURE LLM output: {e}")



    # --------------------------------------------------------
    # Create QuestionSet
    # --------------------------------------------------------
    question_set_id = f"qs_{uuid4().hex}"

    qs = QuestionSet(
        question_set_id=question_set_id,
        skill="multiple-skills",
        level="mixed",
        total_questions=total_questions,
        generation_model="llama-3.3-70b-versatile"
    )

    db.add(qs)
    await db.flush()

    # --------------------------------------------------------
    # Save MCQ Questions
    # --------------------------------------------------------
    for idx, q in enumerate(data):
        options_dict = {
            opt["option_id"]: opt["text"]
            for opt in q["options"]
        }

        skill_meta = skills_with_levels[idx % len(skills_with_levels)]
        intended_difficulty = skill_meta["difficulty"]
        qt = q["question_text"]

        # 🔒 Downward-only difficulty check
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
    
    # --------------------------------------------------------
    # Save CODING Questions 
    # --------------------------------------------------------
    for cq in coding_data:
        db_question = Question(
            question_set_id=question_set_id,
            question_text=f"{cq['title']}\n\n{cq['description']}",
            options={
                "type": "coding",
                "language": cq.get("language"),
                "constraints": cq.get("constraints", [])
            },
            correct_answer="N/A",
            difficulty="coding",
            generation_model="llama-3.3-70b-versatile",
            generation_time=time.time() - start_time
        )
        db.add(db_question)

    # --------------------------------------------------------
    # Save ARCHITECTURE Questions 
    # --------------------------------------------------------
    for aq in architecture_data:
        db_question = Question(
            question_set_id=question_set_id,
            question_text=f"{aq['title']}\n\n{aq['description']}",
            options={
                "type": "architecture",
                "focus_areas": aq.get("focus_areas", [])
            },
            correct_answer="N/A",
            difficulty="architecture",
            generation_model="llama-3.3-70b-versatile",
            generation_time=time.time() - start_time
        )
        db.add(db_question)
    print(
    "[DEBUG] Total questions to be saved:",
    mcq_count + len(coding_data) + len(architecture_data)
)



    await db.commit()
    return question_set_id
