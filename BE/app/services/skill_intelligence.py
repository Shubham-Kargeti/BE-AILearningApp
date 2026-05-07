"""LLM-first semantic skill and proficiency extraction service.

The old regex/dictionary extraction remains useful as a safety net, but this
module is the primary extraction pipeline for role and candidate assessment
flows.
"""
from __future__ import annotations

import asyncio
import json
import re
from typing import Callable, Optional

from pydantic import BaseModel, Field, field_validator, model_validator

from app.utils.generate_questions import _get_llm


FallbackExtractor = Callable[[str, str], dict[str, tuple[str, str, float]]]

VALID_LEVELS = {"beginner", "intermediate", "advanced"}
VALID_PRIORITIES = {"critical", "high", "medium", "low"}
SOFT_CATEGORIES = {"soft", "communication", "leadership", "behavioral", "interpersonal"}


class SkillExtractionFallbackNeeded(Exception):
    """Raised when LLM extraction should yield to the legacy fallback."""


class SemanticSkill(BaseModel):
    skill_name: str
    canonical_name: str = ""
    category: str = "technical"
    proficiency_level: str = "intermediate"
    confidence: float = Field(default=0.75, ge=0.0, le=1.0)
    inferred: bool = False
    source: str = "unknown"
    evidence: str = ""
    priority: str = "medium"
    matched_with_jd: bool = False

    @field_validator("skill_name", "canonical_name", "category", "proficiency_level", "source", "priority", mode="before")
    @classmethod
    def _clean_string(cls, value):
        if value is None:
            return ""
        return re.sub(r"\s+", " ", str(value)).strip()

    @model_validator(mode="after")
    def _normalize(self):
        self.skill_name = _display_name(self.skill_name or self.canonical_name)
        self.canonical_name = _canonicalize_skill_name(self.canonical_name or self.skill_name)
        self.category = _normalize_category(self.category)
        self.proficiency_level = _normalize_level(self.proficiency_level)
        self.source = _normalize_source(self.source, self.matched_with_jd)
        self.priority = _normalize_priority(self.priority)
        self.evidence = _limit_text(self.evidence, 280)
        return self


class SkillIntelligenceResult(BaseModel):
    role: str = ""
    role_type: str = "unknown"
    role_seniority: str = ""
    role_expectations: list[str] = Field(default_factory=list)
    inferred_competencies: list[str] = Field(default_factory=list)
    skills: list[SemanticSkill] = Field(default_factory=list)
    extraction_confidence: float = Field(default=0.0, ge=0.0, le=1.0)
    extraction_strategy: str = "llm"
    fallback_reason: Optional[str] = None

    @model_validator(mode="after")
    def _finalize(self):
        self.role = _limit_text(self.role, 80)
        self.role_type = _normalize_role_type(self.role_type)
        self.role_seniority = _limit_text(self.role_seniority, 60)
        self.role_expectations = [_limit_text(item, 160) for item in self.role_expectations if str(item).strip()]
        self.inferred_competencies = [
            _canonicalize_skill_name(item) for item in self.inferred_competencies if str(item).strip()
        ]
        self.skills = _dedupe_and_enforce(self.skills)
        if self.skills and not self.extraction_confidence:
            self.extraction_confidence = round(sum(skill.confidence for skill in self.skills) / len(self.skills), 3)
        return self


def _display_name(value: str) -> str:
    canonical = _canonicalize_skill_name(value)
    special = {
        "aws": "AWS",
        "gcp": "GCP",
        "azure": "Azure",
        "sql": "SQL",
        "cicd": "CI/CD",
        "hris": "HRIS",
        "crm": "CRM",
        "erp": "ERP",
        "kpi management": "KPI Management",
        "fp&a": "FP&A",
        ".net": ".NET",
    }
    if canonical in special:
        return special[canonical]
    return " ".join(part.upper() if part in {"hr", "ai", "ml", "qa", "ui", "ux"} else part.capitalize() for part in canonical.split())


def _canonicalize_skill_name(value: str) -> str:
    text = re.sub(r"\s+", " ", str(value or "").strip().lower())
    text = text.strip(" .,:;|/\\")
    replacements = {
        "ci/cd": "cicd",
        "ci cd": "cicd",
        "k8s": "kubernetes",
        "ml": "machine learning",
        "ai": "artificial intelligence",
        "nlp": "natural language processing",
        "oop": "object oriented programming",
        "nodejs": "node.js",
        "react.js": "react",
        "reactjs": "react",
        "postgres": "postgresql",
        "postgres sql": "postgresql",
        "golang": "go",
        "ms excel": "excel",
        "advanced excel": "excel",
        "microsoft excel": "excel",
        "ms office": "microsoft office",
        "g suite": "productivity tools",
        "google workspace": "productivity tools",
        "hris": "hr information systems",
        "ats": "applicant tracking system",
        "talent acquisition": "recruitment",
        "labour laws": "labor laws",
        "p&l": "profit and loss",
        "fpa": "financial planning and analysis",
        "fp&a": "financial planning and analysis",
    }
    return replacements.get(text, text)


def _normalize_category(value: str) -> str:
    normalized = str(value or "").strip().lower().replace("_", "-")
    if normalized in {"technical", "framework", "tool", "platform", "cloud", "database", "language"}:
        return "technical"
    if normalized in {"soft", "communication", "leadership", "behavioral", "interpersonal"}:
        return "soft"
    if normalized in {"business", "functional", "finance", "hr", "sales", "marketing", "operations", "domain"}:
        return "business"
    if normalized in {"certification", "certifications"}:
        return "certification"
    if normalized in {"methodology", "process"}:
        return "methodology"
    return normalized or "technical"


def _normalize_level(value: str) -> str:
    normalized = str(value or "").strip().lower()
    aliases = {
        "basic": "beginner",
        "novice": "beginner",
        "mid": "intermediate",
        "medium": "intermediate",
        "proficient": "advanced",
        "senior": "advanced",
        "high": "advanced",
        "master": "advanced",
        "expert": "advanced",
    }
    normalized = aliases.get(normalized, normalized)
    return normalized if normalized in VALID_LEVELS else "intermediate"


def _normalize_priority(value: str) -> str:
    normalized = str(value or "").strip().lower()
    aliases = {"must-have": "critical", "must have": "critical", "required": "high", "nice-to-have": "medium"}
    normalized = aliases.get(normalized, normalized)
    return normalized if normalized in VALID_PRIORITIES else "medium"


def _normalize_source(value: str, matched_with_jd: bool = False) -> str:
    normalized = str(value or "").strip().lower().replace("_", "-")
    if matched_with_jd or normalized in {"both", "jd+resume", "resume+jd", "jd/resume"}:
        return "both"
    if normalized in {"jd", "job-description", "job description", "requirements"}:
        return "jd"
    if normalized in {"resume", "cv", "candidate", "candidate-resume"}:
        return "resume"
    return "unknown"


def _normalize_role_type(value: str) -> str:
    normalized = str(value or "").strip().lower()
    if any(token in normalized for token in ("non-tech", "non tech", "nontechnical", "business", "functional")):
        return "non-tech"
    if any(token in normalized for token in ("tech", "technical", "engineering", "software", "data")):
        return "tech"
    return normalized or "unknown"


def _limit_text(value: str, max_chars: int) -> str:
    text = re.sub(r"\s+", " ", str(value or "")).strip()
    if len(text) <= max_chars:
        return text
    return text[:max_chars].rstrip(" ,.;:") + "..."


def _has_strong_resume_evidence(skill: SemanticSkill) -> bool:
    evidence = f"{skill.evidence} {skill.skill_name}".lower()
    strong_patterns = [
        r"\b(led|owned|architected|designed|implemented|built|scaled|optimized|managed|delivered|launched)\b",
        r"\b[5-9]\+?\s*(years|yrs)\b",
        r"\b(10|11|12|13|14|15)\+?\s*(years|yrs)\b",
        r"\b(certified|certification|expert|specialist)\b",
    ]
    return any(re.search(pattern, evidence) for pattern in strong_patterns)


def _priority_rank(priority: str) -> int:
    return {"critical": 4, "high": 3, "medium": 2, "low": 1}.get(priority, 2)


def _level_rank(level: str) -> int:
    return {"beginner": 1, "intermediate": 2, "advanced": 3}.get(_normalize_level(level), 2)


def _dedupe_and_enforce(skills: list[SemanticSkill]) -> list[SemanticSkill]:
    merged: dict[str, SemanticSkill] = {}

    for raw_skill in skills:
        skill = raw_skill if isinstance(raw_skill, SemanticSkill) else SemanticSkill.model_validate(raw_skill)
        key = skill.canonical_name
        if not key:
            continue

        if key not in merged:
            merged[key] = skill
            continue

        existing = merged[key]
        sources = {existing.source, skill.source}
        if "both" in sources or {"jd", "resume"}.issubset(sources):
            existing.source = "both"
            existing.matched_with_jd = True
        elif "jd" in sources:
            existing.source = "jd"
        elif "resume" in sources:
            existing.source = "resume"

        if _level_rank(skill.proficiency_level) > _level_rank(existing.proficiency_level):
            existing.proficiency_level = skill.proficiency_level
        if _priority_rank(skill.priority) > _priority_rank(existing.priority):
            existing.priority = skill.priority
        existing.confidence = max(existing.confidence, skill.confidence)
        existing.inferred = existing.inferred and skill.inferred
        if skill.evidence and skill.evidence not in existing.evidence:
            existing.evidence = _limit_text("; ".join(part for part in [existing.evidence, skill.evidence] if part), 280)

    enforced = [_enforce_business_rules(skill) for skill in merged.values()]
    return sorted(enforced, key=lambda item: (-_priority_rank(item.priority), item.canonical_name))


def _enforce_business_rules(skill: SemanticSkill) -> SemanticSkill:
    source = _normalize_source(skill.source, skill.matched_with_jd)
    skill.source = source
    skill.matched_with_jd = source == "both"

    is_soft = skill.category in SOFT_CATEGORIES

    if source == "both":
        skill.priority = "critical"
        skill.confidence = max(skill.confidence, 0.92)
        if not is_soft and _level_rank(skill.proficiency_level) < _level_rank("advanced"):
            skill.proficiency_level = "advanced"
        elif is_soft and skill.proficiency_level == "advanced" and skill.confidence < 0.97:
            skill.proficiency_level = "intermediate"

    elif source == "jd":
        skill.priority = "high" if skill.priority != "critical" else skill.priority
        skill.confidence = max(skill.confidence, 0.84)
        if not is_soft and _level_rank(skill.proficiency_level) < _level_rank("advanced"):
            skill.proficiency_level = "advanced"
        elif is_soft and skill.proficiency_level == "advanced":
            skill.proficiency_level = "intermediate"

    elif source == "resume":
        if skill.priority not in {"medium", "low"}:
            skill.priority = "medium"
        if _level_rank(skill.proficiency_level) > _level_rank("intermediate") and not _has_strong_resume_evidence(skill):
            skill.proficiency_level = "intermediate"

    else:
        skill.priority = "low"
        if _level_rank(skill.proficiency_level) > _level_rank("intermediate"):
            skill.proficiency_level = "intermediate"

    if is_soft and skill.proficiency_level == "advanced" and skill.confidence < 0.98:
        skill.proficiency_level = "intermediate"

    if skill.inferred:
        skill.confidence = min(skill.confidence, 0.88)

    return skill


def _parse_json_object(content: str) -> dict:
    cleaned = str(content or "").strip()
    cleaned = re.sub(r"^```(?:json)?\s*|\s*```$", "", cleaned, flags=re.IGNORECASE | re.DOTALL).strip()

    try:
        parsed = json.loads(cleaned)
    except Exception:
        start = cleaned.find("{")
        end = cleaned.rfind("}")
        if start == -1 or end == -1 or end < start:
            raise
        parsed = json.loads(cleaned[start:end + 1])

    if not isinstance(parsed, dict):
        raise ValueError("LLM output must be a JSON object")
    return parsed


def _build_prompt(jd_text: Optional[str], resume_text: Optional[str]) -> str:
    flow_name = "candidate-based" if jd_text and resume_text else "role-based" if jd_text else "resume-only"
    schema = {
        "role": "short role title or empty string",
        "role_type": "tech | non-tech | hybrid | unknown",
        "role_seniority": "junior | mid | senior | lead | executive | unknown",
        "role_expectations": ["role expectation"],
        "inferred_competencies": ["canonical competency"],
        "extraction_confidence": 0.0,
        "skills": [
            {
                "skill_name": "Display Name",
                "canonical_name": "canonical lowercase name",
                "category": "technical | business | soft | certification | methodology | domain",
                "proficiency_level": "beginner | intermediate | advanced",
                "confidence": 0.0,
                "inferred": False,
                "source": "jd | resume | both",
                "evidence": "short supporting phrase from the document",
                "priority": "critical | high | medium | low",
                "matched_with_jd": False,
            }
        ],
    }

    return f"""
You are a deterministic semantic talent intelligence extraction engine.

Flow: {flow_name}

Objective:
- Extract role information, required skills, candidate skills, overlapping skills, inferred competencies,
  proficiency levels, confidence, priority, and evidence.
- Work across technical, non-technical, hybrid, and future unknown roles.
- Prefer semantic understanding over keyword matching.

Extraction coverage:
- Technical skills, programming languages, frameworks, tools, platforms, cloud, databases.
- Business/functional competencies in HR, finance, sales, marketing, operations, legal, compliance, product, strategy.
- Leadership, communication, stakeholder, project, process, certifications, methodologies, and domain expertise.
- Strongly implied competencies are allowed only when the text supports them. Mark them inferred=true.

Critical business rules:
1. JD skills have highest priority.
2. Skills present in BOTH JD and Resume: source="both", matched_with_jd=true, priority="critical",
   proficiency_level must be "advanced", confidence should be highest.
3. Skills present ONLY in JD: source="jd", priority="high" or "critical",
   proficiency_level should be "advanced" because they are role expectations.
4. Skills present ONLY in Resume: source="resume", priority="medium" or "low",
   proficiency_level should be "intermediate" by default. Use "advanced" only with strong evidence
   such as ownership, architecture, measurable impact, certification, or many years of use.
5. Soft skills should mostly be "beginner" or "intermediate". Use "advanced" only with exceptional evidence.
6. Never output "expert". If the source implies expert-level ability, output "advanced".
7. Every inferred skill must include inferred=true, confidence, and evidence/context.

Normalization rules:
- canonical_name must be lowercase and concise.
- Deduplicate semantically equivalent skills.
- Do not build separate duplicate entries for aliases or spelling variants.
- Keep skill_name user-friendly.

Output requirements:
- Return raw JSON only. No markdown, no comments, no preamble.
- Use this exact top-level shape:
{json.dumps(schema, indent=2)}

--- JOB DESCRIPTION ---
{jd_text or ""}

--- RESUME / CV ---
{resume_text or ""}
""".strip()


async def extract_skill_intelligence_llm(
    *,
    jd_text: Optional[str] = None,
    resume_text: Optional[str] = None,
    max_retries: int = 2,
) -> SkillIntelligenceResult:
    if not (jd_text or resume_text):
        raise SkillExtractionFallbackNeeded("No text supplied for extraction")

    prompt = _build_prompt(jd_text, resume_text)
    last_error: Optional[Exception] = None

    for attempt in range(1, max_retries + 1):
        try:
            print(f"[Skill Intelligence] LLM extraction attempt {attempt}/{max_retries}")
            llm = _get_llm()
            messages = [
                {
                    "role": "system",
                    "content": (
                        "You are a deterministic information extraction engine. "
                        "Return valid JSON only. Use the same output for the same input."
                    ),
                },
                {"role": "user", "content": prompt},
            ]
            response = await asyncio.to_thread(llm.invoke, messages)
            content = response.content if hasattr(response, "content") else str(response)
            print("[Skill Intelligence] Raw LLM response preview:")
            print(str(content)[:1200])

            parsed = _parse_json_object(str(content))
            result = SkillIntelligenceResult.model_validate(parsed)

            if not result.skills:
                raise SkillExtractionFallbackNeeded("LLM returned no skills")

            if result.extraction_confidence and result.extraction_confidence < 0.25:
                raise SkillExtractionFallbackNeeded(
                    f"LLM extraction confidence critically low: {result.extraction_confidence}"
                )

            print(
                "[Skill Intelligence] LLM extraction succeeded:",
                {
                    "skills": len(result.skills),
                    "role": result.role,
                    "role_type": result.role_type,
                    "confidence": result.extraction_confidence,
                },
            )
            return result

        except SkillExtractionFallbackNeeded:
            raise
        except Exception as exc:
            last_error = exc
            print(f"[Skill Intelligence][WARN] LLM parse/invoke failed on attempt {attempt}: {exc}")
            prompt += f"""

Repair instruction for retry:
Your previous response failed validation with this error: {exc}
Return only one valid JSON object using the required schema.
"""

    raise SkillExtractionFallbackNeeded(f"LLM extraction failed after retries: {last_error}")


def build_fallback_skill_intelligence(
    *,
    jd_text: Optional[str] = None,
    resume_text: Optional[str] = None,
    fallback_extractor: FallbackExtractor,
    reason: str,
) -> SkillIntelligenceResult:
    print(f"[Skill Intelligence] Using regex/dictionary fallback. Reason: {reason}")
    skills: list[SemanticSkill] = []

    if jd_text:
        for name, (level, category, confidence) in fallback_extractor(jd_text, "job_description").items():
            skills.append(
                SemanticSkill(
                    skill_name=name,
                    canonical_name=name,
                    category=category,
                    proficiency_level=level,
                    confidence=confidence,
                    inferred=False,
                    source="jd",
                    priority="high",
                    evidence="Matched by legacy JD fallback extractor.",
                )
            )

    if resume_text:
        for name, (level, category, confidence) in fallback_extractor(resume_text, "resume").items():
            skills.append(
                SemanticSkill(
                    skill_name=name,
                    canonical_name=name,
                    category=category,
                    proficiency_level=level,
                    confidence=min(confidence, 0.82),
                    inferred=False,
                    source="resume",
                    priority="medium",
                    evidence="Matched by legacy resume fallback extractor.",
                )
            )

    result = SkillIntelligenceResult(
        skills=skills,
        extraction_strategy="fallback",
        fallback_reason=reason,
    )
    if not result.extraction_confidence and result.skills:
        result.extraction_confidence = round(sum(skill.confidence for skill in result.skills) / len(result.skills), 3)
    return result


async def extract_skill_intelligence(
    *,
    jd_text: Optional[str] = None,
    resume_text: Optional[str] = None,
    fallback_extractor: FallbackExtractor,
) -> SkillIntelligenceResult:
    try:
        return await extract_skill_intelligence_llm(jd_text=jd_text, resume_text=resume_text)
    except SkillExtractionFallbackNeeded as exc:
        return build_fallback_skill_intelligence(
            jd_text=jd_text,
            resume_text=resume_text,
            fallback_extractor=fallback_extractor,
            reason=str(exc),
        )
