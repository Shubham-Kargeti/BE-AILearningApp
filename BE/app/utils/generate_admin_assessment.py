import re
from config import settings
from langchain_core.prompts import (
    ChatPromptTemplate,
    HumanMessagePromptTemplate,
    SystemMessagePromptTemplate
)
from app.db.models import QuestionSet, Question
from app.core.llm import create_chat_llm, get_llm_model_name
from sqlalchemy.ext.asyncio import AsyncSession
from uuid import uuid4
import json
import asyncio
import time
from app.services.doc_ingest import get_document_stats, query_text

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
    if isinstance(level, dict):
        level = level.get("effective_level") or level.get("override_level") or level.get("extracted_level")
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


def _skill_metadata_for(skill_name: str, skill_intelligence: dict) -> dict:
    if not isinstance(skill_intelligence, dict):
        return {}

    direct = skill_intelligence.get(skill_name)
    if isinstance(direct, dict):
        return direct

    lowered = skill_name.lower()
    for key, value in skill_intelligence.items():
        if str(key).lower() == lowered and isinstance(value, dict):
            return value
        if isinstance(value, dict) and str(value.get("skill_name", "")).lower() == lowered:
            return value
    return {}

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
You are an expert technical interviewer and enterprise assessment generator.

Your task is to generate high-quality MCQ interview questions ONLY for TECHNICAL roles.

You will receive:
- A list of technical skills
- Difficulty priorities for each skill
- A fixed total question count

==================================================
STRICT DIFFICULTY ENFORCEMENT
==================================================

The provided difficulty directly maps to expected industry experience.

--------------------------------------------------
EASY
--------------------------------------------------

Represents candidates with:
- Minimum ~5 years industry experience
- Strong fundamentals
- Practical exposure to production systems
- Ability to work independently on common engineering tasks

Questions MUST:
- Focus on practical application
- Include straightforward real-world scenarios
- Test debugging or implementation understanding
- Require reasoning instead of recall

Questions MUST NOT:
- Be fresher-level
- Ask simple definitions
- Ask syntax-only questions
- Ask trivia or memory-based questions

--------------------------------------------------
MEDIUM
--------------------------------------------------

Represents candidates with:
- Approximately 5-10 years experience
- Strong production-level expertise
- Ability to optimize/debug systems
- Comfortable handling trade-offs

Questions MUST:
- Include production scenarios
- Require multi-step reasoning
- Include debugging, optimization, scaling, or design considerations
- Test applied engineering judgment

--------------------------------------------------
HARD
--------------------------------------------------

Represents candidates with:
- 10+ years experience
- Deep system expertise
- Strong architecture and scalability knowledge
- Leadership-level technical decision making

Questions MUST:
- Include architecture-level thinking
- Involve scalability/performance trade-offs
- Include ambiguity and constraints
- Test production failure handling
- Require deep reasoning across multiple concepts

==================================================
GLOBAL QUESTION RULES
==================================================

ALL questions MUST:
- Be scenario-driven whenever possible
- Test practical engineering knowledge
- Be realistic and enterprise-oriented
- Reflect real interview standards
- Match the expected experience level
- Require reasoning instead of direct recall

DO NOT GENERATE:
- Definition-only questions
- "What is X?" questions
- Trivia questions
- Flashcard-style questions
- Questions answerable without reasoning

==================================================
OPTION RULES
==================================================

Options MUST:
- Be realistic and technically plausible
- Avoid obviously incorrect distractors
- Include nuanced trade-offs for medium/hard questions
- Have only ONE clearly correct answer

==================================================
QUESTION DISTRIBUTION RULES
==================================================

- Total questions MUST be exactly {total_questions}
- Higher priority skills should receive more questions
- Higher difficulty skills should receive deeper questions
- Maintain balanced technical coverage and distribution across skill categories
- Do NOT invent skills not present in JD
- Ensure questions strictly align with the determined level
- Ensure role-appropriate question types

==================================================
OUTPUT FORMAT (STRICT)
==================================================

Return ONLY a valid JSON array.

NO markdown.
NO explanations.
NO comments.
NO extra fields.
NO additional metadata.
Do NOT include skill names, difficulty labels, or explanations.

Each question MUST follow EXACTLY this schema:

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

==================================================
CRITICAL JSON VALIDATION RULES
==================================================

- Ensure valid JSON syntax
- No trailing commas
- Every object and array MUST be properly closed with }} and ]
- Each option object MUST end with }}
- Use valid JSON syntax only (no trailing commas, no missing braces)
- Properly close all arrays and objects
- Response MUST be parsable directly using json.loads()
- Return ONLY JSON array
- Ensure commas between all fields and objects
"""
)

mcq_human_message = HumanMessagePromptTemplate.from_template(
"""
Skills and difficulty levels:
{skills_json}
"""
)

mcq_prompt = ChatPromptTemplate.from_messages(
    [mcq_system_message, mcq_human_message]
)

non_tech_mcq_system_message = SystemMessagePromptTemplate.from_template(
"""
You are an expert interviewer and enterprise assessment generator for NON-TECHNICAL roles.

Your task is to generate high-quality, role-specific MCQ interview questions.

You will receive:
- Job description
- Skills with difficulty priorities
- Fixed total question count

Generate EXACTLY {total_questions} questions.

==================================================
SUPPORTED ROLE TYPES
==================================================

FUNCTIONAL ROLES:
Examples:
- Business Analyst
- Functional Consultant
- Product Analyst
- Operations Analyst

Focus areas:
- Requirement gathering
- Documentation
- Requirement clarification
- Stakeholder communication
- Business analysis
- Customer handling
- Gap analysis
- Process improvement
- Prioritization

--------------------------------------------------

PROCESS / MANAGEMENT ROLES:
Examples:
- Scrum Master
- Project Manager
- Delivery Manager
- Program Manager

Focus areas:
- Agile/Scrum practices
- Sprint planning
- Delivery management
- Risk handling
- Team coordination
- Escalation management
- Dependency management
- Stakeholder alignment
- Process optimization

--------------------------------------------------

LEADERSHIP / BEHAVIORAL:
Applicable to ALL roles.

Focus areas:
- Decision making
- Conflict resolution
- Team collaboration
- Ownership
- Communication
- Stakeholder management
- Negotiation
- Prioritization under pressure
- Handling ambiguity

==================================================
STRICT DIFFICULTY ENFORCEMENT
==================================================

The provided difficulty maps directly to expected industry experience.

--------------------------------------------------
EASY
--------------------------------------------------

Represents candidates with:
- Minimum ~5 years experience
- Strong functional/process fundamentals
- Ability to independently handle common workplace situations

Questions MUST:
- Include practical workplace scenarios
- Require reasoning and judgment
- Test communication and prioritization
- Reflect real business situations

Questions MUST NOT:
- Be fresher-level
- Be definition-only
- Be theory/trivia based
- Be generic aptitude questions

--------------------------------------------------
MEDIUM
--------------------------------------------------

Represents candidates with:
- Approximately 5-10 years experience
- Strong stakeholder and execution capability
- Ability to manage ambiguity and competing priorities

Questions MUST:
- Include cross-functional situations
- Require prioritization and trade-offs
- Test process judgment
- Include delivery or stakeholder challenges
- Require structured decision making

--------------------------------------------------
HARD
--------------------------------------------------

Represents candidates with:
- 10+ years experience
- Leadership or strategic ownership
- Strong organizational influence capability

Questions MUST:
- Include complex organizational scenarios
- Test leadership judgment
- Include conflict resolution under pressure
- Require strategic thinking
- Include ambiguity and competing business goals
- Require high-level decision making

==================================================
GLOBAL QUESTION RULES
==================================================

ALL questions MUST:
- Be scenario-driven whenever possible
- Be role-specific
- Reflect real enterprise/customer situations
- Require applied reasoning
- Test practical judgment
- Evaluate prioritization and communication skills
- Match expected experience level

DO NOT GENERATE:
- Coding questions
- System design questions
- Technical implementation questions
- Definition-only questions
- Generic HR questions
- Generic aptitude questions detached from role context

==================================================
OPTION RULES
==================================================

Options MUST:
- Be realistic and professionally plausible
- Avoid obviously incorrect distractors
- Include nuanced trade-offs for medium/hard questions
- Have only ONE clearly correct answer

==================================================
QUESTION DISTRIBUTION RULES
==================================================

- Generate EXACTLY {total_questions} questions
- Higher priority skills should receive more focus
- Higher difficulty skills should receive deeper scenarios
- Maintain balanced coverage across:
  - Functional reasoning
  - Process management
  - Leadership/behavioral situations

==================================================
OUTPUT FORMAT (STRICT JSON ONLY)
==================================================

Return ONLY a valid JSON array.

NO markdown.
NO explanations.
NO comments.
NO additional fields.

Each question MUST follow EXACTLY this schema:

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

==================================================
CRITICAL JSON VALIDATION RULES
==================================================

- Ensure valid JSON syntax
- No trailing commas
- Properly close all arrays and objects
- Response MUST be parsable directly using json.loads()
- Return ONLY JSON array
"""
)

non_tech_mcq_human_message = HumanMessagePromptTemplate.from_template(
"""Skills and difficulty levels:
{skills_json}
"""
)

non_tech_mcq_prompt = ChatPromptTemplate.from_messages(
    [non_tech_mcq_system_message, non_tech_mcq_human_message]
)

# ------------------------------------------------------------
# CODING QUESTION PROMPT
# ------------------------------------------------------------

coding_system_message = SystemMessagePromptTemplate.from_template(
"""
You are an expert technical interviewer and enterprise coding assessment generator.

Your task is to generate high-quality LEETCODE-STYLE CODING QUESTIONS for experienced software engineers.

You will receive:
- A list of technical skills
- Difficulty priorities for each skill
- Required programming language
- Fixed total coding question count

==================================================
CORE CODING QUESTION RULES
==================================================

A coding question MUST:
- Be solvable by implementing a single function or method
- Have deterministic input/output
- Be automatically testable
- Require algorithmic or logical problem solving
- Be language agnostic in logic
- Support evaluation through hidden test cases

DO NOT GENERATE:
- System design questions
- Architecture discussions
- DevOps/infrastructure tasks
- API development tasks
- Deployment questions
- Theoretical essays
- Explanatory questions
- MCQs
- Non-deterministic/open-ended problems

==================================================
STRICT DIFFICULTY ENFORCEMENT
==================================================

The provided difficulty maps directly to expected industry experience.

--------------------------------------------------
EASY
--------------------------------------------------

Represents candidates with:
- Minimum ~5 years experience
- Strong implementation fundamentals
- Comfortable with common DSA patterns
- Practical debugging capability

Questions MUST:
- Require applied coding logic
- Involve moderate reasoning
- Include practical edge cases
- Use common data structures/algorithms

Questions MUST NOT:
- Be beginner/fresher-level
- Be syntax-only
- Be trivial array/string manipulation
- Be direct textbook recall problems

--------------------------------------------------
MEDIUM
--------------------------------------------------

Represents candidates with:
- Approximately 5-10 years experience
- Strong production engineering capability
- Ability to optimize solutions
- Multi-step reasoning skills

Questions MUST:
- Require optimized solutions
- Include multiple constraints
- Involve deeper algorithmic thinking
- Require trade-offs or pattern recognition
- Test time/space optimization

--------------------------------------------------
HARD
--------------------------------------------------

Represents candidates with:
- 10+ years experience
- Deep algorithmic and engineering expertise
- Strong optimization capability
- Ability to solve complex edge cases

Questions MUST:
- Include advanced algorithms or complex logic
- Require strong optimization
- Include hidden edge cases
- Demand efficient scalability
- Require multi-concept reasoning
- Reflect senior/staff-level coding interviews

==================================================
QUESTION STYLE RULES
==================================================

Questions MUST resemble:
- LeetCode
- HackerRank
- CodeSignal
- Enterprise technical interviews

Questions SHOULD involve:
- Arrays
- Strings
- Hashing
- Trees
- Graphs
- Dynamic Programming
- Sliding Window
- Backtracking
- Greedy
- Recursion
- Searching/Sorting
- Heaps
- Queues/Stacks
- Optimization problems

Skill relevance MUST be maintained.

==================================================
QUESTION REQUIREMENTS
==================================================

Each question MUST include:

1. Clear problem statement
2. Explicit input description
3. Explicit output description
4. Constraints section
5. Optimized expected approach
6. Structured pseudocode in suggested_answer
7. Complete working solution in reference_solution

==================================================
SUGGESTED ANSWER RULES
==================================================

The suggested_answer:
- MUST be concise
- MUST contain structured pseudocode
- MUST explain the optimized approach
- MUST be <= 250 words

==================================================
REFERENCE SOLUTION RULES
==================================================

The reference_solution:
- MUST be fully working
- MUST compile logically
- MUST handle edge cases
- MUST follow best practices
- MUST be optimized appropriately for difficulty

==================================================
QUESTION DISTRIBUTION RULES
==================================================

- Generate EXACTLY {coding_count} questions
- Higher priority skills receive more questions
- Higher difficulty skills receive deeper algorithmic complexity
- Maintain balanced technical coverage

==================================================
OUTPUT FORMAT (STRICT JSON ONLY)
==================================================

Return ONLY a valid JSON array.

NO markdown.
NO explanations.
NO comments.
NO examples section.
NO additional fields.

Each item MUST follow EXACTLY this schema:

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

==================================================
CRITICAL JSON VALIDATION RULES
==================================================

- Ensure valid JSON syntax
- No trailing commas
- Properly close all arrays and objects
- Response MUST be parsable directly using json.loads()
- Return ONLY JSON array
"""
)


coding_human_message = HumanMessagePromptTemplate.from_template(
"""
Skills and difficulty levels:
{skills_json}
"""
)

coding_prompt = ChatPromptTemplate.from_messages(
    [coding_system_message, coding_human_message]
)

reasoning_system_message = SystemMessagePromptTemplate.from_template(
"""
You are an expert interviewer and enterprise assessment generator for NON-TECHNICAL roles.

Your task is to generate high-quality reasoning and situational interview questions for:
- Functional roles
- Process/Management roles
- Leadership/Behavioral evaluation

You will receive:
- Job description
- Skills with difficulty priorities
- Fixed reasoning question count

==================================================
SUPPORTED ROLE TYPES
==================================================

FUNCTIONAL ROLES:
Examples:
- Business Analyst
- Functional Consultant
- Product Analyst
- Operations Analyst

Focus areas:
- Requirement gathering
- Requirement clarification
- Documentation
- Stakeholder communication
- Gap analysis
- Process improvement
- Business scenarios
- Customer interactions

--------------------------------------------------

PROCESS / MANAGEMENT ROLES:
Examples:
- Scrum Master
- Project Manager
- Delivery Manager
- Program Manager

Focus areas:
- Agile/Scrum practices
- Sprint planning
- Delivery management
- Team coordination
- Dependency handling
- Escalation management
- Risk mitigation
- Resource conflicts
- Prioritization
- Process optimization

--------------------------------------------------

LEADERSHIP / BEHAVIORAL:
Applicable to ALL roles.

Focus areas:
- Decision making
- Conflict resolution
- Ownership
- Stakeholder management
- Cross-functional collaboration
- Handling ambiguity
- Communication challenges
- Team influence
- Negotiation
- Prioritization under pressure

==================================================
STRICT DIFFICULTY ENFORCEMENT
==================================================

The provided difficulty maps directly to expected industry experience.

--------------------------------------------------
EASY
--------------------------------------------------

Represents candidates with:
- Minimum ~5 years experience
- Strong foundational business/process understanding
- Ability to handle common workplace scenarios independently

Questions MUST:
- Include realistic workplace situations
- Require practical reasoning
- Focus on communication, coordination, and execution
- Test structured thinking

Questions MUST NOT:
- Be definition-only
- Be theoretical or textbook-style
- Be fresher-level questions

--------------------------------------------------
MEDIUM
--------------------------------------------------

Represents candidates with:
- Approximately 5-10 years experience
- Strong stakeholder and execution capability
- Ability to handle ambiguity and prioritization

Questions MUST:
- Include cross-team scenarios
- Require trade-offs and prioritization
- Test process judgment
- Include stakeholder conflicts or delivery challenges
- Require multi-step reasoning

--------------------------------------------------
HARD
--------------------------------------------------

Represents candidates with:
- 10+ years experience
- Leadership or strategic ownership
- Organizational influence capability

Questions MUST:
- Include organizational complexity
- Require leadership judgment
- Include high-impact decision making
- Test conflict management under pressure
- Include ambiguity and competing priorities
- Require strategic reasoning and influence

==================================================
GLOBAL QUESTION RULES
==================================================

ALL questions MUST:
- Be scenario-driven
- Be role-specific
- Require structured reasoning
- Reflect real enterprise/customer situations
- Test practical judgment
- Encourage trade-off analysis
- Require communication and prioritization thinking

DO NOT GENERATE:
- Coding challenges
- System design questions
- MCQs
- Pure theory questions
- Definition-only questions
- Generic HR questions without context

==================================================
SUGGESTED ANSWER RULES
==================================================

The suggested_answer:
- MUST be <= 250 words
- MUST model a strong professional response
- MUST explain reasoning clearly
- MUST include prioritization/trade-offs when applicable
- MUST include communication or next-step considerations where relevant

==================================================
QUESTION DISTRIBUTION RULES
==================================================

- Generate EXACTLY {reasoning_count} questions
- Higher priority skills receive more focus
- Higher difficulty skills require deeper business/process complexity
- Maintain balanced coverage across:
  - Functional reasoning
  - Process management
  - Leadership/behavioral scenarios

==================================================
OUTPUT FORMAT (STRICT JSON ONLY)
==================================================

Return ONLY a valid JSON array.

NO markdown.
NO explanations.
NO comments.
NO additional fields.

Each item MUST follow EXACTLY this schema:

{{
  "question_id": 1,
  "title": "Concise reasoning prompt title",
  "description": "Scenario-based question requiring structured reasoning",
  "focus_areas": [
    "Prioritization",
    "Stakeholder Communication",
    "Judgment"
  ],
  "suggested_answer": "Concise ideal response in 250 words or fewer"
}}

==================================================
CRITICAL JSON VALIDATION RULES
==================================================

- Ensure valid JSON syntax
- No trailing commas
- Properly close all arrays and objects
- Response MUST be parsable directly using json.loads()
- Return ONLY JSON array
"""
)

reasoning_human_message = HumanMessagePromptTemplate.from_template(
"""
Skills and difficulty levels:
{skills_json}
"""
)

reasoning_prompt = ChatPromptTemplate.from_messages(
    [reasoning_system_message, reasoning_human_message]
)

# ------------------------------------------------------------
# ARCHITECTURE QUESTION PROMPT 
# ------------------------------------------------------------
architecture_system_message = SystemMessagePromptTemplate.from_template(
"""
You are an expert system design interviewer and enterprise architecture assessment generator.

Your task is to generate high-quality ARCHITECTURE / SYSTEM DESIGN interview questions for experienced software engineers and technical leaders.

You will receive:
- A list of technical skills
- Difficulty priorities for each skill
- Fixed architecture question count

==================================================
CORE SYSTEM DESIGN RULES
==================================================

System design questions MUST:
- Be real-world and production-oriented
- Focus on scalable distributed systems
- Require architectural reasoning
- Include trade-offs and constraints
- Test engineering decision making
- Reflect enterprise-level design interviews

DO NOT GENERATE:
- MCQs
- Coding-only problems
- Theory-only questions
- Definition-based questions
- Generic cloud trivia
- DevOps-only operational tasks
- Open-ended vague prompts without constraints

==================================================
STRICT DIFFICULTY ENFORCEMENT
==================================================

The provided difficulty maps directly to expected industry experience.

--------------------------------------------------
EASY
--------------------------------------------------

Represents candidates with:
- Minimum ~5 years experience
- Strong understanding of production systems
- Familiarity with common backend architecture patterns

Questions MUST:
- Focus on designing moderately scalable systems
- Include APIs, databases, caching, queues, or storage decisions
- Test understanding of reliability basics
- Require practical trade-off reasoning

Questions MUST NOT:
- Be beginner-level
- Ask only conceptual definitions
- Be purely theoretical

--------------------------------------------------
MEDIUM
--------------------------------------------------

Represents candidates with:
- Approximately 5-10 years experience
- Strong backend/system ownership experience
- Ability to optimize and scale systems

Questions MUST:
- Include scalability bottlenecks
- Require distributed systems reasoning
- Include performance/reliability trade-offs
- Test database partitioning/caching/messaging decisions
- Include fault tolerance considerations

--------------------------------------------------
HARD
--------------------------------------------------

Represents candidates with:
- 10+ years experience
- Senior/Staff/Architect-level expertise
- Large-scale distributed systems ownership

Questions MUST:
- Involve complex distributed architectures
- Include ambiguous real-world constraints
- Require scalability under massive traffic
- Test consistency/availability trade-offs
- Include disaster recovery/failure handling
- Include multi-region or high-availability considerations
- Require deep architectural reasoning

==================================================
QUESTION STYLE RULES
==================================================

Questions SHOULD involve:
- High-scale backend systems
- Distributed systems
- Event-driven architecture
- Caching strategies
- Database scaling
- Messaging systems
- Rate limiting
- Search systems
- Realtime systems
- Monitoring/reliability
- Microservices
- API gateways
- Storage optimization
- Fault tolerance

Questions MUST:
- Be role-relevant
- Be realistic
- Reflect actual enterprise interviews

==================================================
SUGGESTED ANSWER RULES
==================================================

The suggested_answer:
- MUST be <= 250 words
- MUST explain:
  - High-level architecture
  - Core components
  - Data flow
  - Scalability approach
  - Reliability considerations
  - Trade-offs
- MUST remain concise but technically strong

==================================================
QUESTION DISTRIBUTION RULES
==================================================

- Generate EXACTLY {architecture_count} questions
- Higher priority skills receive more focus
- Higher difficulty skills require deeper system complexity
- Maintain balanced architectural coverage

==================================================
OUTPUT FORMAT (STRICT JSON ONLY)
==================================================

Return ONLY a valid JSON array.

NO markdown.
NO explanations.
NO comments.
NO additional fields.

Each item MUST follow EXACTLY this schema:

{{
  "question_id": 1,
  "title": "System design problem title",
  "description": "Design problem statement",
  "focus_areas": [
    "Scalability",
    "Reliability",
    "Trade-offs"
  ],
  "suggested_answer": "Concise ideal design response in 250 words or fewer"
}}

==================================================
CRITICAL JSON VALIDATION RULES
==================================================

- Ensure valid JSON syntax
- No trailing commas
- Properly close all arrays and objects
- Response MUST be parsable directly using json.loads()
- Return ONLY JSON array
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

    return create_chat_llm()


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


def _clamp_pct(value) -> int:
    try:
        pct = int(round(float(value)))
    except (TypeError, ValueError):
        pct = 0
    return max(0, min(100, pct))


def _normalize_generation_policy(policy: dict | None, doc_id: str | None) -> dict:
    policy = policy or {}
    rag_pct = _clamp_pct(policy.get("rag_pct", 0 if not doc_id else 100))
    if not doc_id:
        rag_pct = 0
    llm_pct = 100 - rag_pct
    mode = "llm" if rag_pct == 0 else "rag" if rag_pct == 100 else "mix"
    return {"mode": mode, "rag_pct": rag_pct, "llm_pct": llm_pct}


def _allocate_rag_counts(type_counts: dict[str, int], rag_pct: int) -> dict[str, int]:
    total = sum(max(0, int(count or 0)) for count in type_counts.values())
    target = round(total * (_clamp_pct(rag_pct) / 100))
    target = max(0, min(total, target))

    allocations = {key: 0 for key in type_counts}
    if target == 0 or total == 0:
        return allocations

    raw = []
    for order, (key, count) in enumerate(type_counts.items()):
        safe_count = max(0, int(count or 0))
        exact = safe_count * target / total
        floor_value = min(safe_count, int(exact))
        allocations[key] = floor_value
        raw.append((exact - floor_value, order, key, safe_count))

    remaining = target - sum(allocations.values())
    for _, _, key, safe_count in sorted(raw, key=lambda item: (-item[0], item[1])):
        if remaining <= 0:
            break
        if allocations[key] < safe_count:
            allocations[key] += 1
            remaining -= 1

    return allocations


def _existing_questions_text(existing_questions: list[str] | None) -> str:
    if not existing_questions:
        return ""
    if isinstance(existing_questions, list):
        return "\n".join(str(item) for item in existing_questions if item)
    return str(existing_questions)


def _question_text_for_dedup(item: dict) -> str:
    parts = [
        item.get("question_text"),
        item.get("title"),
        item.get("description"),
    ]
    return " ".join(str(part).strip() for part in parts if part).strip()


def _mark_source(items: list[dict], source_type: str, source_meta: dict | None = None) -> list[dict]:
    for item in items:
        if isinstance(item, dict):
            item["_source_type"] = source_type
            item["_source_meta"] = source_meta or {}
    return items


def _normalize_mcq_options(raw_options) -> dict:
    if isinstance(raw_options, dict):
        return {str(key): str(value) for key, value in raw_options.items()}

    if isinstance(raw_options, list):
        options = {}
        for idx, opt in enumerate(raw_options):
            if isinstance(opt, dict):
                option_id = opt.get("option_id") or opt.get("id") or chr(65 + idx)
                option_text = opt.get("text") or opt.get("label") or opt.get("value") or ""
            else:
                option_id = chr(65 + idx)
                option_text = str(opt)
            options[str(option_id)] = str(option_text)
        return options

    return {}


def _collect_rag_context(
    required_skills: dict,
    questionnaire_config: dict,
    doc_id: str | None,
    rag_question_count: int,
) -> dict:
    if not doc_id or rag_question_count <= 0:
        return {"available": False, "context": "", "hits": [], "stats": get_document_stats(doc_id)}

    stats = get_document_stats(doc_id)
    total_chunks = int(stats.get("chunks") or 0)
    if total_chunks <= 0:
        return {"available": False, "context": "", "hits": [], "stats": stats}

    skills = list((required_skills or {}).keys())
    role = str(questionnaire_config.get("role_type") or questionnaire_config.get("job_title") or "").strip()
    query_base = ", ".join(skills[:12]) or role or "assessment"
    dynamic_top_k = min(
        total_chunks,
        max(8, rag_question_count * 3, len(skills) * 2),
    )
    per_query_k = max(3, min(dynamic_top_k, dynamic_top_k // 2 or dynamic_top_k))

    queries = [
        f"assessment questions for {query_base}",
        f"role responsibilities scenarios tools concepts for {query_base}",
    ]
    queries.extend(f"interview questions about {skill}" for skill in skills[:6])

    hits_by_id: dict[str, tuple[dict, float | None]] = {}
    for query in queries:
        try:
            for hit, score in query_text(query, top_k=per_query_k, doc_id=doc_id):
                hit_id = hit.get("id")
                if not hit_id:
                    continue
                existing = hits_by_id.get(hit_id)
                existing_score = existing[1] if existing else None
                if existing is None or (score is not None and (existing_score is None or score > existing_score)):
                    hits_by_id[hit_id] = (hit, score)
        except Exception as exc:
            print(f"[RAG] Retrieval query failed: {exc}")

    if len(hits_by_id) < min(dynamic_top_k, 4):
        try:
            for hit, score in query_text(f"questions about {query_base}", top_k=dynamic_top_k, doc_id=doc_id):
                hit_id = hit.get("id")
                if hit_id and hit_id not in hits_by_id:
                    hits_by_id[hit_id] = (hit, score)
        except Exception as exc:
            print(f"[RAG] Fallback retrieval failed: {exc}")

    ranked_hits = sorted(
        hits_by_id.values(),
        key=lambda item: (
            -1 if item[1] is None else -float(item[1]),
            int((item[0].get("meta") or {}).get("chunk_index") or 0),
        ),
    )[:dynamic_top_k]

    if not ranked_hits:
        return {"available": False, "context": "", "hits": [], "stats": stats}

    context_parts = []
    max_context_chars = 22000
    used_chars = 0
    for index, (hit, _score) in enumerate(ranked_hits, 1):
        text = re.sub(r"\s+", " ", str(hit.get("text") or "")).strip()
        if not text:
            continue
        meta = hit.get("meta") or {}
        label = f"[Source {index}: chunk {meta.get('chunk_index')}]"
        addition = f"{label}\n{text}"
        if used_chars + len(addition) > max_context_chars and context_parts:
            break
        context_parts.append(addition)
        used_chars += len(addition)

    return {
        "available": bool(context_parts),
        "context": "\n\n".join(context_parts),
        "hits": [hit for hit, _score in ranked_hits],
        "stats": stats,
    }

# ------------------------------------------------------------
# MAIN FUNCTION 
# ------------------------------------------------------------
async def _generate_assessment_question_set_legacy(
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
    skill_intelligence = questionnaire_config.get("skill_intelligence") or {}
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
    skills_with_levels = []
    for skill, level in required_skills.items():
        metadata = _skill_metadata_for(skill, skill_intelligence)
        effective_level = _normalize_skill_level(metadata.get("effective_level") or level)
        skills_with_levels.append(
            {
                "skill": skill,
                "level": effective_level,
                "difficulty": LEVEL_MAP.get(effective_level, "medium"),
                "level_source": metadata.get("level_source", "llm"),
                "extracted_level": _normalize_skill_level(metadata.get("extracted_level") or level),
                "override_experience_years": metadata.get("override_experience_years"),
                "override_level": metadata.get("override_level"),
                "priority": metadata.get("priority"),
                "category": metadata.get("category"),
                "matched_with_jd": metadata.get("matched_with_jd"),
                "confidence": metadata.get("confidence"),
                "source": metadata.get("source"),
                "inferred": metadata.get("inferred"),
            }
        )
    print("[DEBUG] Skill-level-driven assessment plan:", skills_with_levels)

    formatted = json.dumps(skills_with_levels, indent=2)

    selected_mcq_prompt = mcq_prompt
    if is_non_technical:
        selected_mcq_prompt = non_tech_mcq_prompt
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
                    """
                    Skills and difficulty levels:
                    {skills_json}
                    """
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
        generation_model=get_llm_model_name()
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
            generation_model=get_llm_model_name(),
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
            generation_model=get_llm_model_name(),
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
            generation_model=get_llm_model_name(),
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
            generation_model=get_llm_model_name(),
            generation_time=time.time() - start_time
        )
        db.add(db_question)
    print(
    "[DEBUG] Total questions to be saved:",
    mcq_count + len(coding_data) + len(architecture_data) + len(reasoning_data)
)



    await db.commit()
    return question_set_id


async def generate_assessment_question_set(
    required_skills: dict,
    db: AsyncSession,
    questionnaire_config: dict | None = None,
    existing_questions: list[str] | None = None,
):
    """Generate and persist an assessment question set.

    RAG is request-scoped: only the supplied doc_id is queried, the selected RAG
    percentage is allocated deterministically across question types, and any RAG
    failure falls back to regular LLM generation for the affected batch.
    """
    start_time = time.time()
    questionnaire_config = questionnaire_config or {}
    existing_questions = existing_questions or []

    job_description = questionnaire_config.get("job_description")
    role_type = str(questionnaire_config.get("role_type", "tech")).strip().lower()
    skill_intelligence = questionnaire_config.get("skill_intelligence") or {}
    is_non_technical = role_type in {"non-tech", "nontechnical", "non-technical", "non tech"}
    doc_id = questionnaire_config.get("doc_id")
    generation_policy = _normalize_generation_policy(
        questionnaire_config.get("generation_policy"),
        doc_id,
    )

    mcq_count = int(questionnaire_config.get("mcq", 6))
    coding_count = int(questionnaire_config.get("coding", 2))
    architecture_count = int(questionnaire_config.get("architecture", 2))
    reasoning_count = int(
        questionnaire_config.get(
            "reasoning",
            questionnaire_config.get("scenario", questionnaire_config.get("ba", 0)),
        )
    )
    type_counts = (
        {"mcq": mcq_count, "reasoning": reasoning_count}
        if is_non_technical
        else {"mcq": mcq_count, "coding": coding_count, "architecture": architecture_count}
    )
    total_questions = sum(type_counts.values())

    requested_rag_counts = _allocate_rag_counts(type_counts, generation_policy["rag_pct"])
    rag_info = await asyncio.to_thread(
        _collect_rag_context,
        required_skills,
        questionnaire_config,
        doc_id,
        sum(requested_rag_counts.values()),
    )
    rag_context = rag_info.get("context") if rag_info.get("available") else ""
    rag_counts = requested_rag_counts if rag_context else {key: 0 for key in type_counts}
    llm_counts = {
        key: max(0, int(type_counts.get(key, 0)) - int(rag_counts.get(key, 0)))
        for key in type_counts
    }

    print(
        "[RAG] policy=",
        generation_policy,
        "doc_id=",
        doc_id,
        "stats=",
        rag_info.get("stats"),
        "distribution=",
        {"rag": rag_counts, "llm": llm_counts},
    )

    skills_with_levels = []
    for skill, level in required_skills.items():
        metadata = _skill_metadata_for(skill, skill_intelligence)
        effective_level = _normalize_skill_level(metadata.get("effective_level") or level)
        skills_with_levels.append(
            {
                "skill": skill,
                "level": effective_level,
                "difficulty": LEVEL_MAP.get(effective_level, "medium"),
                "level_source": metadata.get("level_source", "llm"),
                "extracted_level": _normalize_skill_level(metadata.get("extracted_level") or level),
                "override_experience_years": metadata.get("override_experience_years"),
                "override_level": metadata.get("override_level"),
                "priority": metadata.get("priority"),
                "category": metadata.get("category"),
                "matched_with_jd": metadata.get("matched_with_jd"),
                "confidence": metadata.get("confidence"),
                "source": metadata.get("source"),
                "inferred": metadata.get("inferred"),
            }
        )
    print("[DEBUG] Skill-level-driven assessment plan:", skills_with_levels)

    formatted = json.dumps(skills_with_levels, indent=2)
    selected_mcq_prompt = non_tech_mcq_prompt if is_non_technical else mcq_prompt
    llm = _get_llm()

    rag_source_meta = {
        "doc_id": doc_id,
        "requested_rag_pct": generation_policy["rag_pct"],
        "chunks_used": [hit.get("id") for hit in rag_info.get("hits", [])],
        "chunk_count": len(rag_info.get("hits", [])),
        "retrieval": "isolated_document",
    }

    def append_common_context(messages, count: int, source_type: str, context: str, avoid_questions: list[str] | None) -> None:
        if job_description:
            messages[-1].content += f"""

JOB DESCRIPTION:
{job_description}

INSTRUCTION:
- Use this job description to tailor questions.
- Focus on real-world responsibilities, tools, and scenarios.
- Avoid generic questions.
"""

        avoid_text = _existing_questions_text(avoid_questions)
        if avoid_text:
            messages[-1].content += f"""

AVOID DUPLICATION:
Do NOT repeat, rephrase, or create similar variants of the following questions:
{avoid_text}

STRICT RULES:
- Questions must be different in scenario, context, and intent.
- Avoid reusing the same problem shape or business situation.
- Keep the generated batch diverse.
"""

        if source_type == "rag" and context:
            messages[-1].content += f"""

DOCUMENT CONTEXT FOR THIS BATCH:
{context}

STRICT DOCUMENT-GROUNDED RULES:
- Generate exactly {count} questions in this batch from the uploaded document context.
- Anchor each question to facts, tools, responsibilities, scenarios, or concepts present in the document.
- Do not mention "the document", "the context", "source", or chunk numbers in the question text.
- If the document context is narrow, create practical scenario questions that test applying the document's content.
"""
        else:
            messages[-1].content += """

SOURCE FOR THIS BATCH:
- Generate these questions from the job description, role, skills, and general expert knowledge.
- Do not use the uploaded RAG document for this batch.
"""

    async def invoke_json(messages, label: str, expected_count: int) -> list[dict]:
        response = await asyncio.to_thread(llm.invoke, messages)
        print(f"\n[Admin {label} LLM Output]\n", response.content)
        data = _parse_json_array_response(response.content, label)
        if len(data) > expected_count:
            data = data[:expected_count]
        if len(data) != expected_count:
            raise ValueError(f"Expected exactly {expected_count} questions, got {len(data)}")
        return data

    def build_mcq_messages(count: int, source_type: str, context: str, avoid_questions: list[str] | None):
        messages = selected_mcq_prompt.format_messages(
            skills_json=formatted,
            total_questions=count,
        )
        append_common_context(messages, count, source_type, context, avoid_questions)
        return messages

    def build_reasoning_messages(count: int, source_type: str, context: str, avoid_questions: list[str] | None):
        messages = reasoning_prompt.format_messages(
            skills_json=formatted,
            reasoning_count=count,
        )
        append_common_context(messages, count, source_type, context, avoid_questions)
        if source_type == "rag" and context:
            messages[-1].content += "\nFocus on role-specific judgment, communication, and trade-offs grounded in the document."
        return messages

    def build_coding_messages(count: int, source_type: str, context: str, avoid_questions: list[str] | None):
        messages = coding_prompt.format_messages(
            skills_json=formatted,
            coding_count=count,
        )
        append_common_context(messages, count, source_type, context, avoid_questions)
        if source_type == "rag" and context:
            messages[-1].content += "\nUse the document's technologies, constraints, data shapes, or workflows to frame coding problems when possible."
        return messages

    def build_architecture_messages(count: int, source_type: str, context: str, avoid_questions: list[str] | None):
        messages = ChatPromptTemplate.from_messages(
            [
                architecture_system_message,
                HumanMessagePromptTemplate.from_template(
                    """
                    Skills and difficulty levels:
                    {skills_json}
                    """
                ),
            ]
        ).format_messages(
            skills_json=formatted,
            architecture_count=count,
        )
        append_common_context(messages, count, source_type, context, avoid_questions)
        if source_type == "rag" and context:
            messages[-1].content += "\nUse the document's systems, responsibilities, integrations, or constraints as the design scenario basis."
        return messages

    async def generate_batch(
        label: str,
        count: int,
        source_type: str,
        message_builder,
        avoid_questions: list[str] | None,
    ) -> list[dict]:
        if count <= 0:
            return []

        try:
            messages = message_builder(
                count,
                source_type,
                rag_context if source_type == "rag" else "",
                avoid_questions,
            )
            data = await invoke_json(messages, label, count)
            source_meta = rag_source_meta if source_type == "rag" else {}
            return _mark_source(data, source_type, source_meta)
        except Exception as exc:
            if source_type != "rag":
                raise ValueError(f"Invalid {label} LLM output: {exc}")

            print(f"[RAG] Falling back to LLM-only for {label} batch: {exc}")
            fallback_messages = message_builder(count, "llm", "", avoid_questions)
            data = await invoke_json(fallback_messages, f"{label} FALLBACK", count)
            return _mark_source(
                data,
                "llm",
                {"fallback_from": "rag", "reason": str(exc), "doc_id": doc_id},
            )

    generated_texts = list(existing_questions)

    mcq_data = []
    mcq_rag = await generate_batch("MCQ RAG", rag_counts.get("mcq", 0), "rag", build_mcq_messages, generated_texts)
    mcq_data.extend(mcq_rag)
    generated_texts.extend(_question_text_for_dedup(item) for item in mcq_rag)

    mcq_llm = await generate_batch("MCQ", llm_counts.get("mcq", 0), "llm", build_mcq_messages, generated_texts)
    mcq_data.extend(mcq_llm)
    generated_texts.extend(_question_text_for_dedup(item) for item in mcq_llm)

    coding_data = []
    architecture_data = []
    reasoning_data = []

    if is_non_technical:
        reasoning_rag = await generate_batch(
            "REASONING RAG",
            rag_counts.get("reasoning", 0),
            "rag",
            build_reasoning_messages,
            generated_texts,
        )
        reasoning_data.extend(reasoning_rag)
        generated_texts.extend(_question_text_for_dedup(item) for item in reasoning_rag)

        reasoning_llm = await generate_batch(
            "REASONING",
            llm_counts.get("reasoning", 0),
            "llm",
            build_reasoning_messages,
            generated_texts,
        )
        reasoning_data.extend(reasoning_llm)
        generated_texts.extend(_question_text_for_dedup(item) for item in reasoning_llm)
    else:
        coding_rag = await generate_batch(
            "CODING RAG",
            rag_counts.get("coding", 0),
            "rag",
            build_coding_messages,
            generated_texts,
        )
        coding_data.extend(coding_rag)
        generated_texts.extend(_question_text_for_dedup(item) for item in coding_rag)

        coding_llm = await generate_batch(
            "CODING",
            llm_counts.get("coding", 0),
            "llm",
            build_coding_messages,
            generated_texts,
        )
        coding_data.extend(coding_llm)
        generated_texts.extend(_question_text_for_dedup(item) for item in coding_llm)

        architecture_rag = await generate_batch(
            "ARCHITECTURE RAG",
            rag_counts.get("architecture", 0),
            "rag",
            build_architecture_messages,
            generated_texts,
        )
        architecture_data.extend(architecture_rag)
        generated_texts.extend(_question_text_for_dedup(item) for item in architecture_rag)

        architecture_llm = await generate_batch(
            "ARCHITECTURE",
            llm_counts.get("architecture", 0),
            "llm",
            build_architecture_messages,
            generated_texts,
        )
        architecture_data.extend(architecture_llm)
        generated_texts.extend(_question_text_for_dedup(item) for item in architecture_llm)

    question_set_id = f"qs_{uuid4().hex}"
    qs = QuestionSet(
        question_set_id=question_set_id,
        skill="multiple-skills",
        level="mixed",
        total_questions=total_questions,
        generation_model=get_llm_model_name(),
    )

    db.add(qs)
    await db.flush()

    for idx, q in enumerate(mcq_data):
        options_dict = _normalize_mcq_options(q.get("options"))
        skill_meta = skills_with_levels[idx % len(skills_with_levels)]
        intended_difficulty = skill_meta["difficulty"]
        question_text = q["question_text"]

        if intended_difficulty in ("medium", "hard") and is_clearly_beginner_question(question_text):
            print(
                f"[WARN] Downward difficulty violation "
                f"(expected {intended_difficulty}): {question_text}"
            )

        db.add(
            Question(
                question_set_id=question_set_id,
                question_text=question_text,
                options=options_dict,
                correct_answer=q.get("correct_answer") or "",
                difficulty=intended_difficulty,
                generation_model=get_llm_model_name(),
                generation_time=time.time() - start_time,
                source_type=q.get("_source_type", "llm"),
                source_meta=q.get("_source_meta") or {},
            )
        )

    for cq in coding_data:
        db.add(
            Question(
                question_set_id=question_set_id,
                question_text=f"{cq['title']}\n\n{cq['description']}",
                options={
                    "type": "coding",
                    "language": cq.get("language"),
                    "constraints": cq.get("constraints", []),
                },
                correct_answer=_extract_suggested_answer(cq, "CODING LLM"),
                difficulty="coding",
                generation_model=get_llm_model_name(),
                generation_time=time.time() - start_time,
                source_type=cq.get("_source_type", "llm"),
                source_meta=cq.get("_source_meta") or {},
            )
        )

    for aq in architecture_data:
        db.add(
            Question(
                question_set_id=question_set_id,
                question_text=f"{aq['title']}\n\n{aq['description']}",
                options={
                    "type": "architecture",
                    "focus_areas": aq.get("focus_areas", []),
                },
                correct_answer=_extract_suggested_answer(aq, "ARCHITECTURE LLM"),
                difficulty="architecture",
                generation_model=get_llm_model_name(),
                generation_time=time.time() - start_time,
                source_type=aq.get("_source_type", "llm"),
                source_meta=aq.get("_source_meta") or {},
            )
        )

    for rq in reasoning_data:
        db.add(
            Question(
                question_set_id=question_set_id,
                question_text=f"{rq['title']}\n\n{rq['description']}",
                options={
                    "type": "scenario",
                    "focus_areas": rq.get("focus_areas", []),
                },
                correct_answer=_extract_suggested_answer(rq, "REASONING LLM"),
                difficulty="scenario",
                generation_model=get_llm_model_name(),
                generation_time=time.time() - start_time,
                source_type=rq.get("_source_type", "llm"),
                source_meta=rq.get("_source_meta") or {},
            )
        )

    print(
        "[DEBUG] Total questions to be saved:",
        len(mcq_data) + len(coding_data) + len(architecture_data) + len(reasoning_data),
    )

    await db.commit()
    return question_set_id
