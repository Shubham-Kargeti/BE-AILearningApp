"""Recommended Courses API - AI-powered course recommendations using vector search."""
from fastapi import APIRouter, Query, HTTPException
from typing import Optional
from langchain_community.vectorstores import FAISS
from langchain_huggingface import HuggingFaceEmbeddings
import math
import os
import json
import logging
from pathlib import Path

# Import response schemas from schemas.py
from app.models.schemas import RecommendedCoursesResponse
from app.services.course_catalog import (
    DATA_DIR,
    catalog_signature,
    get_allowed_levels,
    normalize_course_level,
    resolve_course_master_path,
    search_course_catalog,
)

router = APIRouter()
logger = logging.getLogger(__name__)

# Load embedding model & FAISS index (if available)
embedding_model = HuggingFaceEmbeddings(model_name="sentence-transformers/all-MiniLM-L6-v2")
vectorstore = None
INDEX_DIR = str(DATA_DIR / "course_faiss_index")
INDEX_FILE = os.path.join(INDEX_DIR, "index.faiss")
try:
    if os.path.exists(INDEX_FILE):
        vectorstore = FAISS.load_local(
            INDEX_DIR,
            embedding_model,
            allow_dangerous_deserialization=True
        )
        logger.info("Loaded FAISS course index from %s", INDEX_DIR)
    else:
        logger.warning("FAISS index not found at %s - vector search disabled until index is available.", INDEX_FILE)
except Exception as e:
    vectorstore = None
    logger.exception("Failed to load FAISS index: %s", e)

EXCEL_PATH = str(resolve_course_master_path())


def is_course_index_stale() -> bool:
    """Return True when the FAISS index cannot represent the latest Excel file."""
    signature = catalog_signature(EXCEL_PATH)
    if not signature:
        return False
    if not os.path.exists(INDEX_FILE):
        return True
    try:
        return signature[1] > Path(INDEX_FILE).stat().st_mtime_ns
    except OSError:
        return True


async def fallback_search(
    topic: str,
    level: Optional[str] = None,
    limit: Optional[int] = None,
):
    """Excel-based course search. This stays current even when FAISS is stale."""
    return search_course_catalog(topic, level=level, limit=limit)

def sanitize_for_json(data):
    """Recursively sanitize dict/list to remove NaN/inf floats."""
    if isinstance(data, dict):
        return {k: sanitize_for_json(v) for k, v in data.items()}
    elif isinstance(data, list):
        return [sanitize_for_json(v) for v in data]
    elif isinstance(data, float):
        if not math.isfinite(data):
            return None
        return float(data)
    else:
        return data


def _course_key(course: dict) -> str:
    name = str(course.get("name") or "").strip().casefold()
    url = str(course.get("url") or "").strip().casefold()
    topic = str(course.get("topic") or "").strip().casefold()
    return url or f"{name}|{topic}"


def _merge_recommendations(
    primary: list[dict],
    secondary: list[dict],
    max_results: Optional[int] = 10,
) -> list[dict]:
    merged = []
    seen = set()

    for course in [*primary, *secondary]:
        key = _course_key(course)
        if not key or key in seen:
            continue
        seen.add(key)
        merged.append(course)
        if max_results is not None and len(merged) >= max_results:
            break

    return merged


def _vector_search_courses(topic: str, level: Optional[str], k: int = 10) -> list[dict]:
    if vectorstore is None:
        return []

    try:
        results = vectorstore.similarity_search_with_score(
            topic, k=k, filter={"type": "resource"}
        )
    except Exception as e:
        logger.exception("Vector search failed, falling back to Excel search: %s", e)
        return []

    recommended = []
    allowed_levels = set(get_allowed_levels(level)) if level else None

    for doc, score in results:
        try:
            score_value = float(score)
        except Exception:
            score_value = None

        if score_value is not None and not math.isfinite(score_value):
            score_value = None

        course_level = normalize_course_level(doc.metadata.get("course_level", ""))
        if not course_level:
            continue
        if allowed_levels and course_level not in allowed_levels:
            continue

        recommended.append({
            "name": doc.metadata.get("name", "") or "",
            "topic": doc.metadata.get("topic", "") or "",
            "collection": doc.metadata.get("collection", "") or "",
            "category": doc.metadata.get("category", "") or "",
            "description": doc.metadata.get("description", "") or "",
            "url": doc.metadata.get("url", "") or "",
            "score": score_value,
            "course_level": course_level
        })

    return recommended


async def recommend_courses_for_topic(
    topic: str,
    level: Optional[str],
    max_results: Optional[int] = 10,
) -> list[dict]:
    """
    Return recommendations from the latest Excel data plus FAISS when available.

    When the Excel has changed after the FAISS index was built, Excel matches are
    prioritized so newly added courses are immediately usable.
    """
    vector_results = _vector_search_courses(topic, level, k=max_results or 10)
    catalog_limit = None if max_results is None else max(max_results * 3, 20)
    catalog_results = await fallback_search(topic, level, limit=catalog_limit)

    if is_course_index_stale() and catalog_results:
        return _merge_recommendations(catalog_results, vector_results, max_results=max_results)

    return _merge_recommendations(vector_results, catalog_results, max_results=max_results)

@router.get("/recommended-courses/", response_model=RecommendedCoursesResponse)
async def recommended_courses(
    topic: str = Query(
        ...,
        description="Skill or topic to search for course recommendations",
        min_length=2,
        max_length=100,
        example="Python"
    ),
    # level: Optional[str] = Query(
    #     None,
    #     description="Filter courses by level (Beginner, Intermediate, Advanced). Case-insensitive. Empty courses excluded."
    # )
    marks: int = Query(
        ...,
        description="Obtained marks as a percentage from 0 to 100",
        ge=0,
        le=100,
        example=70
    )
):
    """
    🎓 Get AI-Powered Course Recommendations

    Returns personalized course recommendations based on a skill or topic using advanced
    vector similarity search powered by FAISS and HuggingFace embeddings.

    Details:
    - Uses semantic search via FAISS vector DB when available.
    - Always searches the latest Excel masterdata so new courses work before an index rebuild.
    - All fields of each course (name, topic, collection, category, description, url, score, course_level) are included in the output.
    - Only courses with a non-empty Course Level are recommended.
    - If level is specified, only courses matching the allowed levels for that input level are returned (case-insensitive).
    """
    
    def marks_to_level(marks: int) -> str:
        if 0 <= marks <= 50:
            return "Beginner"
        elif marks <= 80:
            return "Intermediate"
        elif marks <= 100:
            return "Advanced"
        raise HTTPException(
            status_code=400,
            detail="Marks must be between 0 and 100."
        )

    try:
        normalized_level = marks_to_level(marks)

        recommended = await recommend_courses_for_topic(
            topic,
            normalized_level,
            max_results=10,
        )

        safe_response = sanitize_for_json({
            "topic": topic,
            "recommended_courses": recommended
        })
        json.dumps(safe_response)
        return safe_response

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error: {e}")
