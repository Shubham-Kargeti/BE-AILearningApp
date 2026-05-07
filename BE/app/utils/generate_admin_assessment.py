from langchain_openai import ChatOpenAI
import re
from config import settings
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
from app.services.doc_ingest import query_text

# ------------------------------------------------------------
# Difficulty normalization (ADMIN → DB)
# ------------------------------------------------------------
LEVEL_MAP = {
    "easy": "easy",
    "medium": "medium",
    "hard": "hard",
    "basic": "easy",
    "beginner": "easy",
    "intermediate": "medium",
    "advanced": "hard",
    "expert": "hard"
}

VALID_SKILL_LEVELS = {"beginner", "intermediate", "advanced"}


def _normalize_skill_level(level) -> str:
    normalized = str(level or "").strip().lower()
    aliases = {
        "basic": "beginner",
        "easy": "beginner",
        "junior": "beginner",
        "medium": "intermediate",
        "mid": "intermediate",
        "proficient": "intermediate",
        "hard": "advanced",
        "senior": "advanced",
        "lead": "advanced",
        "principal": "advanced",
        "expert": "advanced",
    }
    normalized = aliases.get(normalized, normalized)
    return normalized if normalized in VALID_SKILL_LEVELS else "intermediate"

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

OUTPUT FORMAT (STRICT)
==================================================

Return ONLY a valid JSON array.

CRITICAL JSON RULES (NON-NEGOTIABLE):
- Every object and array MUST be properly closed with }} and ]
- Each option object MUST end with }}
- Use valid JSON syntax only (no trailing commas, no missing braces)
- Ensure commas between all fields and objects
- The response MUST be directly parsable by json.loads without any modification

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
- Every question MUST include a concise suggested answer
- The suggested answer MUST be 250 words or fewer

QUESTION REQUIREMENTS:
Each question MUST include:
1. Clear problem statement
2. Explicit input description
3. Explicit output description
4. Constraints section (time/space or value bounds)
5. Language-agnostic logic (even if language is specified)
6. A clear, step-by-step algorithm in structured pseudocode (suggested_answer)
7. A complete working function implementation in the specified language (reference_solution)

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
  ],
  "suggested_answer": "Structured pseudocode",
  "reference_solution": "Actual working code"
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

reasoning_system_message = SystemMessagePromptTemplate.from_template(
    """
You are generating REASONING QUESTIONS for a non-technical assessment.

STRICT RULES:
- Generate EXACTLY {reasoning_count} questions
- Questions MUST be role-specific and aligned to the job description and listed skills
- Focus on decision-making, prioritization, stakeholder handling, communication, process judgment, and situational reasoning
- Do NOT generate coding challenges
- Do NOT generate system design questions
- Do NOT generate MCQs
- Every question MUST include a suggested answer
- The suggested answer MUST be 250 words or fewer
- The suggested answer should model a strong, practical response with clear reasoning, trade-offs, and next steps

OUTPUT FORMAT (STRICT JSON ONLY):
Return ONLY a valid JSON array of EXACTLY {reasoning_count} items.

Each item MUST follow this format EXACTLY:

{{
  "question_id": 1,
  "title": "Concise reasoning prompt title",
  "description": "Scenario-based question requiring structured reasoning",
  "focus_areas": ["Prioritization", "Stakeholder Communication", "Judgment"],
  "suggested_answer": "Concise ideal response in 250 words or fewer"
}}

No markdown.
No explanations.
No additional fields.
"""
)

reasoning_human_message = HumanMessagePromptTemplate.from_template(
    "Skills and difficulty levels:\n{skills_json}"
)

reasoning_prompt = ChatPromptTemplate.from_messages(
    [reasoning_system_message, reasoning_human_message]
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
- Every question MUST include a suggested answer
- The suggested answer MUST be 250 words or fewer
- The suggested answer should explain a strong design direction, core components, trade-offs, and reliability/scalability considerations

OUTPUT FORMAT (STRICT):
Return ONLY a valid JSON array of EXACTLY {architecture_count} items.

Each item must follow this format:

{{
  "question_id": 1,
  "title": "System design problem title",
  "description": "Design problem statement",
  "focus_areas": ["Scalability", "Reliability", "Trade-offs"],
  "suggested_answer": "Concise ideal design response in 250 words or fewer"
}}

No markdown.
No explanations.
"""
)

# ------------------------------------------------------------
# LLM INITIALIZATION (lazy)
# ------------------------------------------------------------

class _StubLLM:
    def invoke(self, *args, **kwargs):
        raise RuntimeError(
            "OPENAI API key is not configured. Set OPENAI_API_KEY to enable LLM features."
        )


def _get_llm():
    if not settings.OPENAI_API_KEY:
        raise RuntimeError("OPENAI_API_KEY is not configured")

    return ChatOpenAI(
        model="gpt-4o",
        temperature=0,
        api_key=settings.OPENAI_API_KEY
    )


def _parse_json_array_response(raw_content, label: str) -> list:
    content = str(raw_content or "").strip()
    if not content:
        raise ValueError(f"{label} output was empty")

    cleaned = re.sub(r"^```(?:json)?\s*|\s*```$", "", content, flags=re.IGNORECASE | re.DOTALL).strip()

    try:
        parsed = json.loads(cleaned)
    except Exception:
        start = cleaned.find("[")
        end = cleaned.rfind("]")
        if start == -1 or end == -1 or end < start:
            snippet = cleaned[:300].replace("\n", " ")
            raise ValueError(f"{label} output was not valid JSON. Raw snippet: {snippet}")
        parsed = json.loads(cleaned[start:end + 1])

    if not isinstance(parsed, list):
        raise ValueError(f"{label} output was not a JSON array")

    return parsed


def _limit_words(text: str, max_words: int = 250) -> str:
    normalized = re.sub(r"\s+", " ", str(text or "")).strip()
    if not normalized:
        return ""

    words = normalized.split()
    if len(words) <= max_words:
        return normalized

    return " ".join(words[:max_words]).rstrip(" ,;:.") + "..."


def _extract_suggested_answer(item: dict, label: str) -> str:
    for key in ("suggested_answer", "ideal_answer", "sample_answer", "answer"):
        value = item.get(key)
        if isinstance(value, str) and value.strip():
            return _limit_words(value, 250)

    question_id = item.get("question_id", "?")
    raise ValueError(f"{label} item {question_id} is missing a suggested_answer")

# ------------------------------------------------------------
# MAIN FUNCTION 
# ------------------------------------------------------------
async def generate_assessment_question_set(
    required_skills: dict,
    db: AsyncSession,
    questionnaire_config: dict | None = None,
    existing_questions: list[str] | None = None
    
):
    start_time = time.time()
    rag_context = ""
    questionnaire_config = questionnaire_config or {}
    job_description = questionnaire_config.get("job_description")
    role_type = str(questionnaire_config.get("role_type", "tech")).strip().lower()
    is_non_technical = role_type in {"non-tech", "nontechnical", "non-technical", "non tech"}
    # mode = questionnaire_config.get("mode")

   

    doc_id = questionnaire_config.get("doc_id")  # use doc_id
    use_rag = bool(doc_id)

    print(f"[DEBUG] use_rag={use_rag}, doc_id={doc_id}")

    if use_rag:
        max_retries = 3
        retry_delay = 2

        for attempt in range(max_retries):
            try:
                await asyncio.sleep(2)
                
                rag_chunks = query_text(
                    f"questions about {', '.join(required_skills.keys())}",
                    top_k=10,
                    doc_id=doc_id if doc_id else None   # FIX
                )

                if rag_chunks:
                    def extract_text(chunk):
                        if isinstance(chunk, tuple):
                            chunk = chunk[0]

                        if isinstance(chunk, dict):
                            return chunk.get("text") or str(chunk)
                        return str(chunk)

                    rag_context = "\n\n".join(
                        [extract_text(chunk) for chunk in rag_chunks]
                    )

                    print(f"[RAG] ✅ Found {len(rag_chunks)} chunks")
                    print(f"[RAG] Context: {rag_context}")
                    break
                else:
                    print(f"[RAG] ⏳ No chunks (attempt {attempt + 1})")

            except Exception as e:
                print("[RAG ERROR]:", e)

            await asyncio.sleep(retry_delay)

    else:
        print("[RAG] ❌ No doc uploaded → skipping RAG")

    # ------------------------------------------------------------
    # Questionnaire configuration (FE-driven, backward-safe)
    # ------------------------------------------------------------

    mcq_count = int(questionnaire_config.get("mcq", 6))
    coding_count = int(questionnaire_config.get("coding", 2))
    architecture_count = int(questionnaire_config.get("architecture", 2))
    reasoning_count = int(
        questionnaire_config.get(
            "reasoning",
            questionnaire_config.get("scenario", questionnaire_config.get("ba", 0))
        )
    )
    total_questions = (
        mcq_count + reasoning_count
        if is_non_technical
        else mcq_count + coding_count + architecture_count
    )


    # Normalize skills
    skills_with_levels = [
        {
            "skill": skill,
            "level": _normalize_skill_level(level),
            "difficulty": LEVEL_MAP.get(_normalize_skill_level(level), "medium")
        }
        for skill, level in required_skills.items()
    ]
    print("[DEBUG] Skill-level-driven assessment plan:", skills_with_levels)

    formatted = json.dumps(skills_with_levels, indent=2)

    selected_mcq_prompt = mcq_prompt
    if is_non_technical:
        selected_mcq_prompt = ChatPromptTemplate.from_messages(
            [
                SystemMessagePromptTemplate.from_template(
                    """
You are an expert assessment generator for NON-TECHNICAL roles.

Generate EXACTLY {total_questions} role-specific MCQs aligned to the provided skills and job description.

STRICT RULES:
- Questions must reflect real workplace situations for non-technical roles
- Focus on applied judgment, communication, prioritization, process handling, stakeholder coordination, and role-specific domain knowledge
- No coding prompts
- No generic aptitude questions detached from the role

OUTPUT FORMAT:
Return ONLY a valid JSON array using this exact schema:
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
"""
                ),
                mcq_human_message,
            ]
        )

    messages = selected_mcq_prompt.format_messages(
        skills_json=formatted,
        total_questions=mcq_count
    )
    

    #############NEW CODE##################
    if job_description:
        messages[-1].content += f"""

    

    JOB DESCRIPTION:
    {job_description}

    INSTRUCTION:
    - Use this job description to tailor questions
    - Focus on real-world responsibilities, tools, and scenarios
    - Avoid generic questions
    """
    
    
    

    # ------------------------------------------------------------
    # 🚨 ANTI-DUPLICATION INSTRUCTION (CRITICAL FIX)
    # ------------------------------------------------------------
    if existing_questions:
            messages[-1].content += f"""

        AVOID DUPLICATION:
        Do NOT repeat or rephrase any of the following questions:
        {existing_questions}

        STRICT RULES:
        - Questions must be completely different in scenario, context, and intent
        - Do not reuse similar themes like "budget trade-off", "stakeholder conflict", etc.
        - Ensure high diversity in topics and decision-making situations
        """
        ##############NEW CODE END################

    # Inject RAG context if available
    if rag_context:
        messages[-1].content += f"\n\nContext:\n{rag_context}"
    
    

    # LLM call (MCQs only)
    llm = _get_llm()
    response = await asyncio.to_thread(llm.invoke, messages)

    print("\n[Admin MCQ LLM Output]\n", response.content)

    try:
        data = _parse_json_array_response(response.content, "MCQ LLM")
        if len(data) != mcq_count:
            raise ValueError(
                f"Expected exactly {mcq_count} MCQ questions, got {len(data)}"
            )

    except Exception as e:
        raise ValueError(f"Invalid MCQ LLM output: {e}")
    
    coding_data = []
    architecture_data = []
    reasoning_data = []

    if is_non_technical:
        if reasoning_count > 0:
            reasoning_messages = reasoning_prompt.format_messages(
                skills_json=formatted,
                reasoning_count=reasoning_count
            )
            if job_description:
                # print(f"[DEBUG] Adding job description to REASONING prompt", job_description)
                reasoning_messages[-1].content += f"""

    JOB DESCRIPTION:
    {job_description}
    

    INSTRUCTION:
    - Use this context to create realistic reasoning scenarios for the target role
    - Focus on role-specific judgment, communication, and trade-offs
    """
        # ✅ Add anti-duplication context (CRITICAL FIX)
                if existing_questions:
                    print(f"[DEBUG] Adding anti-duplication context")

                    # Ensure it's clean text (important)
                    if isinstance(existing_questions, list):
                        existing_questions_text = "\n".join(existing_questions)
                    else:
                        existing_questions_text = str(existing_questions)

                    reasoning_messages[-1].content += f"""

        AVOID DUPLICATION:
        Do NOT repeat, rephrase, or create similar variants of the following questions:
        {existing_questions_text}

        IMPORTANT:
        - Generate completely new and distinct scenarios
        - Avoid same context, same structure, or same intent
        """
            if rag_context:
                reasoning_messages[-1].content += f"\n\nContext:\n{rag_context}"

            reasoning_response = await asyncio.to_thread(llm.invoke, reasoning_messages)
            print("\n[Admin REASONING LLM Output]\n", reasoning_response.content)

            try:
                reasoning_data = _parse_json_array_response(reasoning_response.content, "REASONING LLM")
                if len(reasoning_data) != reasoning_count:
                    raise ValueError(
                        f"Expected exactly {reasoning_count} reasoning questions, got {len(reasoning_data)}"
                    )
            except Exception as e:
                raise ValueError(f"Invalid REASONING LLM output: {e}")
    else:
        coding_messages = coding_prompt.format_messages(
            skills_json=formatted,
            coding_count=coding_count
        )
        if job_description:
            coding_messages[-1].content += f"""

    JOB DESCRIPTION:
    {job_description}

    INSTRUCTION:
    - Use the job context to design realistic coding problems
    """


# ✅ Add anti-duplication (CRITICAL)
        if existing_questions:
            print(f"[DEBUG] Adding anti-duplication context for coding")

            if isinstance(existing_questions, list):
                existing_questions_text = "\n".join(existing_questions)
            else:
                existing_questions_text = str(existing_questions)

            coding_messages[-1].content += f"""

    AVOID DUPLICATION:
    Do NOT repeat, rephrase, or generate similar coding problems to the following:
    {existing_questions_text}

    IMPORTANT:
    - Create completely new problem statements
    - Avoid same logic, same pattern, or same constraints
    - Ensure variation in difficulty, context, and approach
    """
        

        if rag_context:
            coding_messages[-1].content += f"\n\nContext:\n{rag_context}"

        coding_llm = _get_llm()
        coding_response = await asyncio.to_thread(coding_llm.invoke, coding_messages)

        print("\n[Admin CODING LLM Output]\n", coding_response.content)

        try:
            coding_data = _parse_json_array_response(coding_response.content, "CODING LLM")
            if len(coding_data) != coding_count:
                raise ValueError(
                    f"Expected exactly {coding_count} coding questions, got {len(coding_data)}"
                )
        except Exception as e:
            raise ValueError(f"Invalid CODING LLM output: {e}")

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
        if job_description:
            architecture_messages[-1].content += f"""

    JOB DESCRIPTION:
    {job_description}

    INSTRUCTION:
    - Use this context for system design questions
    - Focus on real-world architecture decisions
    """

# ✅ Add anti-duplication (same pattern)
        if existing_questions:
            print(f"[DEBUG] Adding anti-duplication context for architecture")

            if isinstance(existing_questions, list):
                existing_questions_text = "\n".join(existing_questions)
            else:
                existing_questions_text = str(existing_questions)

            architecture_messages[-1].content += f"""

        AVOID DUPLICATION:
        Do NOT repeat, rephrase, or generate similar system design questions to the following:
        {existing_questions_text}

        IMPORTANT:
        - Create completely new system design scenarios
        - Avoid same use-case (e.g., URL shortener, chat app, etc.)
        - Ensure variation in scale, constraints, and architecture choices
        """
    
        if rag_context:
            architecture_messages[-1].content += f"\n\nContext:\n{rag_context}"

        architecture_response = await asyncio.to_thread(llm.invoke, architecture_messages)

        print("\n[Admin ARCHITECTURE LLM Output]\n", architecture_response.content)

        try:
            architecture_data = _parse_json_array_response(architecture_response.content, "ARCHITECTURE LLM")
            if len(architecture_data) != architecture_count:
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
        generation_model="gpt-4o"
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
            generation_model="gpt-4o",
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
            correct_answer=_extract_suggested_answer(cq, "CODING LLM"),
            difficulty="coding",
            generation_model="gpt-4o",
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
            correct_answer=_extract_suggested_answer(aq, "ARCHITECTURE LLM"),
            difficulty="architecture",
            generation_model="gpt-4o",
            generation_time=time.time() - start_time
        )
        db.add(db_question)

    # --------------------------------------------------------
    # Save REASONING Questions
    # --------------------------------------------------------
    for rq in reasoning_data:
        db_question = Question(
            question_set_id=question_set_id,
            question_text=f"{rq['title']}\n\n{rq['description']}",
            options={
                "type": "scenario",
                "focus_areas": rq.get("focus_areas", [])
            },
            correct_answer=_extract_suggested_answer(rq, "REASONING LLM"),
            difficulty="scenario",
            generation_model="gpt-4o",
            generation_time=time.time() - start_time
        )
        db.add(db_question)
    print(
    "[DEBUG] Total questions to be saved:",
    mcq_count + len(coding_data) + len(architecture_data) + len(reasoning_data)
)



    await db.commit()
    return question_set_id
