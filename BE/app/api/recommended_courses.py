"""Recommended Courses API - AI-powered course recommendations using vector search."""
from fastapi import APIRouter, Query, HTTPException
from pydantic import BaseModel, Field
from typing import List, Optional
from langchain_community.vectorstores import FAISS
from langchain_huggingface import HuggingFaceEmbeddings
import math
import pandas as pd
import os
import json

router = APIRouter()


# Response Models for Swagger Documentation
class CourseRecommendation(BaseModel):
    """Individual course recommendation."""
    name: str = Field(..., description="Course pathway display name", example="Introduction to Python Programming")
    topic: str = Field(..., description="Skill/Topic pathway category", example="Python")
    badge: Optional[str] = Field(None, description="Levelup badge if available", example="Python Beginner")
    url: str = Field(..., description="Course pathway URL", example="https://example.com/courses/python-intro")
    score: Optional[float] = Field(None, description="Similarity score from vector search (lower is better)", example=0.85)


class RecommendedCoursesResponse(BaseModel):
    """Response containing recommended courses for a topic."""
    topic: str = Field(..., description="The search topic/skill requested", example="Python")
    recommended_courses: List[CourseRecommendation] = Field(..., description="List of recommended courses")

# Load embedding model & FAISS index
embedding_model = HuggingFaceEmbeddings(model_name="sentence-transformers/all-MiniLM-L6-v2")
vectorstore = FAISS.load_local(
    "data/course_faiss_index",
    embedding_model,
    allow_dangerous_deserialization=True
)

# Load Excel course data
EXCEL_PATH = os.path.join("data", "Courses Masterdata.xlsx")
df_courses = pd.read_excel(EXCEL_PATH)


async def fallback_search(topic: str):
    """Simple Excel-based fallback if vector results are few."""
    topic_lower = topic.lower()
    filtered = df_courses[
        df_courses['Skill/Topic Pathways'].str.lower().str.contains(topic_lower, na=False)
        | df_courses['Pathway Display Name'].str.lower().str.contains(topic_lower, na=False)
    ]

    results = []
    for _, row in filtered.iterrows():
        results.append({
            "name": row['Pathway Display Name'],
            "topic": row['Skill/Topic Pathways'],
            "badge": row.get('Levelup Badge', ''),
            "url": row['Pathway URL'],
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
        if not math.isfinite(data):  # catches inf, -inf, nan
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
    
    **How It Works:**
    1. 🔍 **Vector Search**: Uses semantic similarity search on course embeddings
    2. 🎯 **Smart Matching**: Finds courses most relevant to your topic
    3. 📊 **Scoring**: Ranks courses by similarity score (lower = better match)
    4. 🔄 **Fallback**: If few results, uses keyword-based search as backup
    
    **Search Algorithm:**
    - Primary: FAISS vector similarity search (k=10 top results)
    - Fallback: Excel-based keyword matching (if < 3 vector results)
    - Deduplication: Ensures no duplicate course recommendations
    
    **Use Cases:**
    - 📚 Learning path discovery for specific skills
    - 🎯 Course recommendations based on job descriptions
    - 🚀 Skill gap analysis and training suggestions
    - 💼 Employee upskilling and reskilling programs
    
    **Query Parameters:**
    - `topic`: The skill, technology, or subject area to search for
      - Examples: "Python", "Machine Learning", "Cloud Computing", "Data Analysis"
      - Minimum 2 characters, maximum 100 characters
    
    **Response Details:**
    Returns a list of recommended courses with:
    - **name**: Full course pathway name
    - **topic**: Skill/topic category
    - **badge**: Achievement badge (if available)
    - **url**: Direct link to the course
    - **score**: Similarity score (lower = better match, `null` for fallback results)
    
    **Example Request:**
    ```
    GET /api/v1/recommended-courses/?topic=Python
    ```
    
    **Example Response:**
    ```json
    {
      "topic": "Python",
      "recommended_courses": [
        {
          "name": "Introduction to Python Programming",
          "topic": "Python",
          "badge": "Python Beginner",
          "url": "https://example.com/courses/python-intro",
          "score": 0.65
        },
        {
          "name": "Advanced Python Techniques",
          "topic": "Python",
          "badge": "Python Expert",
          "url": "https://example.com/courses/python-advanced",
          "score": 0.78
        }
      ]
    }
    ```
    
    **Features:**
    - ⚡ Fast semantic search using FAISS vector database
    - 🧠 AI-powered embeddings (sentence-transformers/all-MiniLM-L6-v2)
    - 🎯 Up to 10 top-ranked course recommendations
    - 🔄 Automatic fallback for comprehensive results
    - 🛡️ Error handling and data sanitization
    
    **Error Handling:**
    - Returns 500 if vector search fails
    - Gracefully handles missing or malformed data
    - Sanitizes NaN/infinity values from scores
    
    **Technology Stack:**
    - 🔢 FAISS: Facebook AI Similarity Search
    - 🤗 HuggingFace: Transformer-based embeddings
    - 📊 Pandas: Course masterdata management
    """
    try:
        # --- Step 1: Vector similarity search ---
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
                "name": doc.metadata.get("name", ""),
                "topic": doc.metadata.get("topic", ""),
                "badge": doc.metadata.get("badge", ""),
                "url": doc.metadata.get("url", ""),
                "score": score_value
            })

        # --- Step 2: Fallback search if few vector results ---
        if len(recommended) < 3:
            fallback_results = await fallback_search(topic)
            existing_names = {r["name"] for r in recommended}
            for fr in fallback_results:
                if fr["name"] not in existing_names:
                    recommended.append(fr)

        # --- Step 3: Sanitize all data for JSON ---
        safe_response = sanitize_for_json({
            "topic": topic,
            "recommended_courses": recommended
        })

        # Double-check serialization (to prevent 500 JSON errors)
        json.dumps(safe_response)

        return safe_response

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error: {e}")