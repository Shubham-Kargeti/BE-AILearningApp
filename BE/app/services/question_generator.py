"""RAG-first question generator service.

Responsibilities:
- Query vector store for context (RAG).
- If retrieval confidence is sufficient, ask LLM to generate grounded MCQ(s).
- Otherwise fall back to an LLM-only generation.
- Run light QC and persist to QuestionBank.
"""
from typing import List, Dict, Any, Optional
import json
import time
import httpx

try:
    from app.services.doc_ingest import query_text
except Exception:
    # Optional dependency in some test/dev environments; allow monkeypatching
    def query_text(q, top_k=5):
        raise RuntimeError("doc_ingest.query_text not available")
from app.db.models import Question
from app.db.session import get_db_sync_engine
from sqlalchemy.orm import sessionmaker
from config import get_settings

settings = get_settings()


def _call_llm(prompt: str, timeout: int = 30) -> str:
    """Very small wrapper to call OpenAI Chat Completions API if configured.

    Falls back to a safe stub when OPENAI_API_KEY not present (useful for local dev/testing).
    """
    api_key = getattr(settings, "OPENAI_API_KEY", None)
    model = getattr(settings, "OPENAI_MODEL", "gpt-3.5-turbo")

    if not api_key:
        # Stubbed response for local testing (very simple predictable output)
        # Returns a JSON string we can parse below
        stub = {
            "question_text": "What is Python primarily used for?",
            "options": {"A": "Web development", "B": "Cooking", "C": "Car repair", "D": "Gardening"},
            "correct_answer": "A",
            "explanation": "Python is a general purpose programming language commonly used for web development, scripting, data science, and more." 
        }
        return json.dumps(stub)

    headers = {"Authorization": f"Bearer {api_key}"}
    payload = {
        "model": model,
        "messages": [{"role": "user", "content": prompt}],
        "temperature": getattr(settings, "LLM_TEMPERATURE", 0.2),
        "max_tokens": 512,
    }

    url = getattr(settings, "OPENAI_API_URL", "https://api.openai.com/v1/chat/completions")

    with httpx.Client(timeout=timeout) as client:
        r = client.post(url, headers=headers, json=payload)
        r.raise_for_status()
        data = r.json()
        # Extract content in the standard OpenAI Chat format
        content = data.get("choices", [{}])[0].get("message", {}).get("content", "")
        return content


def _build_grounded_prompt(topic: str, snippets: List[Dict[str, Any]], n: int = 1) -> str:
    snippet_texts = "\n---\n".join([f"Snippet {i+1}: {s['text']}" for i, s in enumerate(snippets)])
    prompt = (
        f"You are a helpful assistant that creates high-quality multiple-choice questions (MCQ).\n"
        f"Create {n} MCQ(s) on the topic: {topic}. Use the following snippets as a source and ground the question(s) in them. Do NOT invent facts beyond the snippets.\n\n"
        f"{snippet_texts}\n\n"
        "Return the output in JSON format with fields: question_text, options (mapping A..D to text), correct_answer (A/B/C/D), explanation."
    )
    return prompt


def _parse_llm_output(output: str) -> Optional[Dict[str, Any]]:
    # Expecting JSON, but be defensive
    try:
        obj = json.loads(output)
        if all(k in obj for k in ("question_text", "options", "correct_answer")):
            return obj
    except Exception:
        # Try to find first JSON object in text
        try:
            start = output.index("{")
            obj = json.loads(output[start:])
            if all(k in obj for k in ("question_text", "options", "correct_answer")):
                return obj
        except Exception:
            return None
    return None


def _basic_qc(item: Dict[str, Any]) -> bool:
    # Basic checks: question_text non-empty, options >= 2, correct_answer in options
    q = item.get("question_text")
    opts = item.get("options") or {}
    corr = item.get("correct_answer")
    if not q or not isinstance(q, str) or not q.strip():
        return False
    # Require exactly 4 options labeled A..D for higher quality MCQs
    expected_keys = {"A", "B", "C", "D"}
    if not isinstance(opts, dict) or set(opts.keys()) != expected_keys:
        return False
    if corr not in expected_keys:
        return False
    return True


def generate_questions_from_rag(topic: str, count: int = 5, min_retrieval: float = 0.0) -> List[int]:
    """RAG-first generation: for each item, try retrieval and generate; fallback to LLM-only if needed.

    Returns list of QuestionBank IDs created.
    """
    created_ids: List[int] = []

    for i in range(count):
        # Query vector store (defensive - treat errors as no hits)
        try:
            snippets = query_text(topic, top_k=getattr(settings, "RETRIEVAL_TOP_K", 5))
        except Exception:
            snippets = []
        use_rag = len(snippets) > 0

        if use_rag:
            prompt = _build_grounded_prompt(topic, [s[0] for s in snippets], count=1)
            raw = _call_llm(prompt)
            parsed = _parse_llm_output(raw)
            source_type = "rag"
        else:
            # LLM fallback
            prompt = f"Create one MCQ on the topic: {topic} with 4 options and indicate the correct one. Return JSON as in the schema."
            raw = _call_llm(prompt)
            parsed = _parse_llm_output(raw)
            source_type = "llm"

        if not parsed or not _basic_qc(parsed):
            # Failed QC - skip saving this item
            continue

        # Persist to DB using a synchronous engine (suitable for background workers)
        engine = get_db_sync_engine()
        Session = sessionmaker(bind=engine)
        with Session() as session:
            qb = Question(
                question_text=parsed["question_text"],
                options=parsed.get("options") or {},
                correct_answer=parsed.get("correct_answer"),
                jd_id=None,
            )
            session.add(qb)
            session.commit()
            session.refresh(qb)
            created_ids.append(qb.id)

    return created_ids


def _fetch_jd_text(assessment_id: str) -> Optional[str]:
    """Fetch JD text for a given assessment (synchronous DB access)."""
    from app.db.session import get_db_sync_engine
    from sqlalchemy import select
    from app.db.models import Assessment, JobDescription
    from sqlalchemy.orm import sessionmaker

    engine = get_db_sync_engine()
    Session = sessionmaker(bind=engine)
    with Session() as session:
        stmt = select(Assessment).where(Assessment.assessment_id == assessment_id)
        res = session.execute(stmt)
        assess = res.scalars().first()
        if not assess or not assess.jd_id:
            return None
        stmt2 = select(JobDescription).where(JobDescription.jd_id == assess.jd_id)
        res2 = session.execute(stmt2)
        jd = res2.scalars().first()
        return jd.extracted_text if jd else None


def generate_questions(topic: Optional[str] = None, assessment_id: Optional[str] = None, count: int = 5, mode: str = "rag", rag_pct: int = 100, min_retrieval: float = 0.0) -> List[int]:
    """Unified generator supporting mode: 'rag'|'llm'|'mix'.

    - If assessment_id provided, prefer JD as retrieval source and filter snippets by jd_id.
    - mode='rag' => try RAG for all items, fallback to LLM if retrieval insufficient.
    - mode='llm' => LLM-only generation.
    - mode='mix' => sample counts according to rag_pct.
    """
    created_ids: List[int] = []

    # If assessment_id provided, attempt to fetch JD text
    jd_text = None
    if assessment_id:
        try:
            jd_text = _fetch_jd_text(assessment_id)
        except Exception:
            jd_text = None

    if mode == "llm":
        # Pure LLM generation
        for _ in range(count):
            prompt = f"Create one MCQ question on the topic: {topic or assessment_id or 'general'}. Return JSON with question_text, options, correct_answer."
            raw = _call_llm(prompt)
            parsed = _parse_llm_output(raw)
            if not parsed or not _basic_qc(parsed):
                continue
            # persist
            engine = get_db_sync_engine()
            Session = sessionmaker(bind=engine)
            with Session() as session:
                qb = Question(
                    question_text=parsed["question_text"],
                    options=parsed.get("options") or {},
                    correct_answer=parsed.get("correct_answer"),
                    jd_id=assessment_id if assessment_id else None,
                )
                session.add(qb)
                session.commit()
                session.refresh(qb)
                created_ids.append(qb.id)
        return created_ids

    # For rag and mix modes, compute counts
    n_rag = count
    n_llm = 0
    if mode == "mix":
        n_rag = max(0, round(count * (rag_pct / 100.0)))
        n_llm = count - n_rag

    # RAG-based generation for n_rag items
    for _ in range(n_rag):
        # Query vector store using either JD text (preferred) or topic
        query_text_source = jd_text if jd_text else (topic or "")
        try:
            snippets = query_text(query_text_source, top_k=getattr(settings, "RETRIEVAL_TOP_K", 5))
        except Exception:
            snippets = []
        # If JD provided, filter snippets to those from the JD
        if assessment_id and snippets:
            snippets = [s for s in snippets if s[0].get("meta", {}).get("doc_id") == assessment_id or s[0].get("meta", {}).get("doc_id") == (assessment_id)]

        # Analyze retrieval results: support return format [(hit, score), ...] or [(hit, None), ...]
        hits_count = 0
        top_score = None
        if snippets:
            hits_count = len(snippets)
            # Extract numeric scores when present
            scores = [s[1] for s in snippets if isinstance(s, (list, tuple)) and isinstance(s[1], (int, float))]
            if scores:
                top_score = max(scores)

        # If a minimum retrieval score threshold is set, ensure top_score meets it
        if min_retrieval and (top_score is None or top_score < min_retrieval):
            snippets = []

        if snippets:
            prompt = _build_grounded_prompt(topic or assessment_id or "", [s[0] for s in snippets], count=1)
            raw = _call_llm(prompt)
            parsed = _parse_llm_output(raw)
            source_type = "rag"
            source_meta = {"snippets": [s[0].get("id") for s in snippets], "assessment_id": assessment_id, "top_score": top_score}
        else:
            # Fallback to LLM-only for this item
            prompt = f"Create one MCQ on the topic: {topic or assessment_id or 'general'}. Return JSON with question_text, options, correct_answer."
            raw = _call_llm(prompt)
            parsed = _parse_llm_output(raw)
            source_type = "llm"
            source_meta = {"fallback": True, "assessment_id": assessment_id}

        if not parsed or not _basic_qc(parsed):
            continue

        # persist
        engine = get_db_sync_engine()
        Session = sessionmaker(bind=engine)
        with Session() as session:
            qb = Question(
                question_text=parsed["question_text"],
                options=parsed.get("options") or {},
                correct_answer=parsed.get("correct_answer"),
                jd_id=assessment_id if assessment_id else None,
                source_type=source_type,
                source_meta=source_meta,
            )
            session.add(qb)
            session.commit()
            session.refresh(qb)
            created_ids.append(qb.id)

    # LLM generation for n_llm items
    for _ in range(n_llm):
        prompt = f"Create one MCQ question on the topic: {topic or assessment_id or 'general'}. Return JSON with question_text, options, correct_answer."
        raw = _call_llm(prompt)
        parsed = _parse_llm_output(raw)
        if not parsed or not _basic_qc(parsed):
            continue
        engine = get_db_sync_engine()
        Session = sessionmaker(bind=engine)
        with Session() as session:
            qb = Question(
                question_text=parsed["question_text"],
                options=parsed.get("options") or {},
                correct_answer=parsed.get("correct_answer"),
                jd_id=assessment_id if assessment_id else None,
            )
            session.add(qb)
            session.commit()
            session.refresh(qb)
            created_ids.append(qb.id)

    return created_ids

"""RAG-first question generator service.

This service attempts retrieval first and uses a grounded prompt to generate MCQs.
If retrieval yields insufficient context (fewer than min_hits), it falls back to a topic-only LLM generation.
"""
from typing import List, Dict, Any, Optional
import json
import asyncio
from config import get_settings
# doc_ingest.query_text imported above (if available)
try:
    from app.utils.generate_questions import _get_llm, chat_prompt, parse_mcqs_from_response
except Exception:
    _get_llm = None
    chat_prompt = None
    def parse_mcqs_from_response(x):
        raise RuntimeError("parse_mcqs_from_response not available in this environment")
from app.db.models import Question

settings = get_settings()


def _build_grounded_prompt(topic: str, snippets: List[Dict[str, Any]], count: int) -> List[Any]:
    # Build a simple system+human prompt sequence similar to generate_questions
    system = (
        "You are an expert question writer. Generate exactly {count} multiple-choice questions "
        "based ONLY on the provided snippets. Each question should have 4 options (A-D) and a clearly labeled correct answer. "
        "Return ONLY valid JSON array of question objects: [{\"question_text\": ..., \"options\": [{\"option_id\": \"A\", \"text\": \"...\"}, ...], \"correct_answer\": \"A\"}]"
    ).replace("{count}", str(count))

    snippets_text = "\n\n".join([f"[source:{s.get('meta',{}).get('doc_id')}::chunk:{s.get('meta',{}).get('chunk_index')}] {s.get('text')}" for s in snippets])
    human = f"Topic: {topic}\nContext snippets:\n{snippets_text}\n\nGenerate {count} MCQs grounded in the snippets."
    # If chat_prompt is not available (test/dev), return a simple string prompt
    if chat_prompt is None:
        return human

    # Use the same prompt types used in generate_questions (ChatGroq expects formatted messages)
    messages = chat_prompt.format_messages(topic=topic, subtopics="", level="intermediate")
    # Replace the human message content with grounded human prompt
    messages[-1].content = human
    return messages


async def generate_questions_rag_first(topic: str, count: int = 5, min_hits: int = 1) -> List[Dict[str, Any]]:
    # Query vector store
    hits = query_text(topic, top_k=max(3, min_hits))

    use_rag = len(hits) >= min_hits

    if use_rag:
        # Build grounded prompt
        messages = _build_grounded_prompt(topic, [m for m, d in hits[:5]], count)
        try:
            if _get_llm is None:
                # No GROQ client available in this environment; fallback to topic-only generator
                raise RuntimeError("GROQ client not available")
            llm = _get_llm()
            response = await asyncio.to_thread(llm.invoke, messages)
            mcqs = parse_mcqs_from_response(response.content)
            # Convert MCQQuestion objects to dicts for persistence
            return [
                {
                    "question_text": q.question_text,
                    "choices": {opt.option_id: opt.text for opt in q.options},
                    "correct_answer": q.correct_answer,
                    "source_type": "rag",
                    "source_meta": {"retrieval_hits": [h.get("meta") for h, _ in hits[:5]]},
                    "quality_score": None,
                }
                for q in mcqs[:count]
            ]
        except Exception:
            # fallback to LLM generation
            use_rag = False

    # Fallback: use topic-only LLM generator
    # Reuse generate_questions prompt (system + human)
    if chat_prompt is None or _get_llm is None:
        # Use a simple string prompt and the OpenAI/_call_llm path when chat_prompt or GROQ client is absent
        prompt = f"Create {count} MCQ(s) on the topic: {topic}. Return a JSON array of questions with question_text, options (A..D), and correct_answer."
        raw = _call_llm(prompt)
        # parse as list
        try:
            mcqs = json.loads(raw)
        except Exception:
            mcqs = []
    else:
        prompt_messages = chat_prompt.format_messages(topic=topic, subtopics="", level="intermediate")
        llm = _get_llm()
        response = await asyncio.to_thread(llm.invoke, prompt_messages)
        mcqs = parse_mcqs_from_response(response.content)
    mcqs = parse_mcqs_from_response(response.content)
    return [
        {
            "question_text": q.question_text,
            "choices": {opt.option_id: opt.text for opt in q.options},
            "correct_answer": q.correct_answer,
            "source_type": "llm",
            "source_meta": {},
            "quality_score": None,
        }
        for q in mcqs[:count]
    ]


def persist_drafts_sync(db_session, generated: List[Dict[str, Any]]):
    """Persist generated question dicts into QuestionBank using a sync DB session."""
    for g in generated:
        qb = Question(
            question_text=g["question_text"],
            options=g.get("choices") or {},
            correct_answer=g.get("correct_answer"),
            jd_id=None,
            source_type=g.get("source_type"),
            source_meta=g.get("source_meta"),
            quality_score=g.get("quality_score"),
        )
        db_session.add(qb)
