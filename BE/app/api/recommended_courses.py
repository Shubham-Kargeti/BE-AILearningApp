from fastapi import APIRouter, Query, HTTPException
from langchain_community.vectorstores import FAISS
from langchain_huggingface import HuggingFaceEmbeddings
import math
import pandas as pd
import os
import json

router = APIRouter()

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


@router.get("/recommended-courses/")
async def recommended_courses(topic: str = Query(...)):
    """Return top recommended courses for a given topic."""
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