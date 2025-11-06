from fastapi import APIRouter, Query, HTTPException
from app.utils.generate_questions import generate_mcqs_for_topic

router = APIRouter()

@router.get("/generate-mcqs/")
async def generate_mcqs(topic: str = Query(...), level: str = Query(...)):
    try:
        mcqs = generate_mcqs_for_topic(topic, level)
        return {"message": "MCQs generated successfully", "mcq_questions": [q.model_dump() for q in mcqs]}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))