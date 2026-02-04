"""Recommended Courses API - AI-powered course recommendations using vector search."""
from fastapi import APIRouter, Query, HTTPException
from typing import List, Optional
from langchain_community.vectorstores import FAISS
from langchain_huggingface import HuggingFaceEmbeddings
import math
import pandas as pd
import os
import json
import logging

# Import response schemas from schemas.py
from app.models.schemas import CourseRecommendation, RecommendedCoursesResponse

router = APIRouter()
logger = logging.getLogger(__name__)

# Load embedding model & FAISS index (if available)
embedding_model = HuggingFaceEmbeddings(model_name="sentence-transformers/all-MiniLM-L6-v2")
vectorstore = None
INDEX_DIR = os.path.join("data", "course_faiss_index")
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

# Load Excel course data and clean
EXCEL_PATH = os.path.join("data", "Courses Masterdata.xlsx")
if os.path.exists(EXCEL_PATH):
    try:
        df_courses = pd.read_excel(EXCEL_PATH)
        df_courses = df_courses.fillna("")
    except Exception:
        logger.exception("Failed to load course Excel data at %s", EXCEL_PATH)
        df_courses = pd.DataFrame()
else:
    logger.warning("Course master Excel file not found at %s - fallback search will be limited.", EXCEL_PATH)
    df_courses = pd.DataFrame()

def get_allowed_levels(input_level: str):
    """Returns list of allowed course levels for a given input level."""
    level_map = {
        "Beginner": ["Beginner", "Beginner/Intermediate", "Beginner/Advanced", "Beginner/Intermediate/Advanced"],
        "Intermediate": ["Beginner/Intermediate", "Intermediate", "Intermediate/Advanced", "Beginner/Intermediate/Advanced"],
        "Advanced": ["Advanced", "Beginner/Advanced", "Intermediate/Advanced", "Beginner/Intermediate/Advanced"]
    }
    return level_map.get(input_level, [])

async def fallback_search(topic: str, level: Optional[str] = None):
    """Simple Excel-based fallback if vector results are few. Optionally filter by level."""
    topic_lower = topic.lower()
    filtered = df_courses[
        df_courses['Skill/Topic Pathways'].str.lower().str.contains(topic_lower, na=False)
        | df_courses['Pathway Display Name'].str.lower().str.contains(topic_lower, na=False)
        | df_courses['Collection Name'].str.lower().str.contains(topic_lower, na=False)
    ]

    # Exclude courses with empty Course Level
    filtered = filtered[filtered['Course Level'].str.strip() != ""]

    if level:
        allowed_levels = get_allowed_levels(level)
        filtered = filtered[filtered['Course Level'].isin(allowed_levels)]

    results = []
    for _, row in filtered.iterrows():
        results.append({
            "name": row.get('Pathway Display Name', "") or "",
            "topic": row.get('Skill/Topic Pathways', "") or "",
            "collection": row.get('Collection Name', "") or "",
            "category": row.get('Category', "") or "",
            "description": row.get('Description', "") or "",
            "url": row.get('Pathway URL', "") or "",
            "score": None,
            "course_level": row.get('Course Level', "") or ""
        })
    return results

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
        description="Obtained marks out of 10",
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
    - Uses semantic search via FAISS vector DB (top 10 results)
    - All fields of each course (name, topic, collection, category, description, url, score, course_level) are included in the output.
    - If fewer than 3 vector matches, does a keyword-based fallback from the Excel masterdata.
    - Only courses with a non-empty Course Level are recommended.
    - If level is specified, only courses matching the allowed levels for that input level are returned (case-insensitive).
    """
    
    def marks_to_level(marks: int) -> str:
        if 0 <= marks <= 50:
            return "Beginner"
        elif 60 <= marks <= 80:
            return "Intermediate"
        elif 90 <= marks <= 100:
            return "Advanced"
        else:
            raise HTTPException(
                status_code=400,
                detail="Marks must be between 0 and 100."
            )

    try:
        normalized_level = marks_to_level(marks)

        # Try vector search if index available, otherwise skip to fallback
        results = []
        if vectorstore is not None:
            try:
                results = vectorstore.similarity_search_with_score(
                    topic, k=10, filter={"type": "resource"}
                )
            except Exception as e:
                logger.exception("Vector search failed, falling back to keyword search: %s", e)
                results = []

        recommended = []
        allowed_levels = get_allowed_levels(normalized_level) if normalized_level else None

        for doc, score in results:
            try:
                score_value = float(score)
            except Exception:
                score_value = None

            if score_value is not None and not math.isfinite(score_value):
                score_value = None

            course_level = doc.metadata.get("course_level", "").strip()
            if not course_level:
                continue
            if normalized_level and course_level not in allowed_levels:
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

        if len(recommended) < 3:
            fallback_results = await fallback_search(topic, normalized_level)
            existing_names = {r["name"] for r in recommended}
            for fr in fallback_results:
                if fr["name"] not in existing_names:
                    recommended.append(fr)

        safe_response = sanitize_for_json({
            "topic": topic,
            "recommended_courses": recommended
        })
        json.dumps(safe_response)
        return safe_response

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error: {e}")