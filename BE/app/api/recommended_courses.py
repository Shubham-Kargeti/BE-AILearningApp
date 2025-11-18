"""Recommended Courses API - AI-powered course recommendations using vector search."""
from fastapi import APIRouter, Query, HTTPException
from typing import List
from langchain_community.vectorstores import FAISS
from langchain_huggingface import HuggingFaceEmbeddings
import math
import pandas as pd
import os
import json

# Import response schemas from schemas.py
from app.models.schemas import CourseRecommendation, RecommendedCoursesResponse

router = APIRouter()

# Load embedding model & FAISS index
embedding_model = HuggingFaceEmbeddings(model_name="sentence-transformers/all-MiniLM-L6-v2")
vectorstore = FAISS.load_local(
    "data/course_faiss_index",
    embedding_model,
    allow_dangerous_deserialization=True
)

# Load Excel course data and clean
EXCEL_PATH = os.path.join("data", "Courses Masterdata.xlsx")
df_courses = pd.read_excel(EXCEL_PATH)
df_courses = df_courses.fillna("")

async def fallback_search(topic: str):
    """Simple Excel-based fallback if vector results are few."""
    topic_lower = topic.lower()
    filtered = df_courses[
        df_courses['Skill/Topic Pathways'].str.lower().str.contains(topic_lower, na=False)
        | df_courses['Pathway Display Name'].str.lower().str.contains(topic_lower, na=False)
        | df_courses['Collection Name'].str.lower().str.contains(topic_lower, na=False)
    ]

    results = []
    for _, row in filtered.iterrows():
        results.append({
            "name": row.get('Pathway Display Name', "") or "",
            "topic": row.get('Skill/Topic Pathways', "") or "",
            "collection": row.get('Collection Name', "") or "",
            "category": row.get('Category', "") or "",
            "description": row.get('Description', "") or "",
            "url": row.get('Pathway URL', "") or "",
            "score": None
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
    )
):
    """
    🎓 Get AI-Powered Course Recommendations

    Returns personalized course recommendations based on a skill or topic using advanced 
    vector similarity search powered by FAISS and HuggingFace embeddings.

    Details:
    - Uses semantic search via FAISS vector DB (top 10 results)
    - All fields of each course (name, topic, collection, category, description, url, score) are included in the output.
    - If fewer than 3 vector matches, does a keyword-based fallback from the Excel masterdata.
    """
    try:
        # Step 1: Vector similarity search
        results = vectorstore.similarity_search_with_score(
            topic, k=10, filter={"type": "resource"}
        )

        recommended = []
        for doc, score in results:
            try:
                score_value = float(score)
            except Exception:
                score_value = None

            if score_value is not None and not math.isfinite(score_value):
                score_value = None

            recommended.append({
                "name": doc.metadata.get("name", "") or "",
                "topic": doc.metadata.get("topic", "") or "",
                "collection": doc.metadata.get("collection", "") or "",
                "category": doc.metadata.get("category", "") or "",
                "description": doc.metadata.get("description", "") or "",
                "url": doc.metadata.get("url", "") or "",
                "score": score_value
            })

        # Step 2: Fallback for low results
        if len(recommended) < 3:
            fallback_results = await fallback_search(topic)
            existing_names = {r["name"] for r in recommended}
            for fr in fallback_results:
                if fr["name"] not in existing_names:
                    recommended.append(fr)

        # Step 3: Sanitize results for JSON
        safe_response = sanitize_for_json({
            "topic": topic,
            "recommended_courses": recommended
        })

        # Double-check serialization (to prevent 500 JSON errors)
        json.dumps(safe_response)

        return safe_response

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error: {e}")