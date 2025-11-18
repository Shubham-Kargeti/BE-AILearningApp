from fastapi import APIRouter, Query, HTTPException
from typing import List

router = APIRouter()

# In-memory topic to subskills mapping
TOPIC_SUBSKILLS_MAP = {
    "Python": ["Basics", "Data Structures", "Libraries"],
    "Machine Learning": ["Supervised", "Unsupervised", "Deep Learning"],
    "Agentic AI": ["LLMs", "Tool Use", "Workflows"]
}

@router.get("/subskills/", response_model=List[str])
async def get_subskills(topic: str = Query(..., description="Selected main topic")):
    subskills = TOPIC_SUBSKILLS_MAP.get(topic)
    if subskills is None:
        raise HTTPException(status_code=404, detail=f"No subskills found for topic '{topic}'")
    return subskills