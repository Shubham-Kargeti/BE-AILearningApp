from fastapi import APIRouter, File, UploadFile, HTTPException
from app.utils.generate_questions import generate_mcqs_for_topic
from app.utils.text_extract import extract_text
import uuid

router = APIRouter()

# Allowed extensions
ALLOWED_EXTENSIONS = {"pdf", "docx"}

# Simple in-memory JD store by UUID
memory_store = {}

def allowed_file(filename: str) -> bool:
    ext = filename.split(".")[-1].lower()
    return ext in ALLOWED_EXTENSIONS


@router.post("/upload-jd/")
async def upload_jd(file: UploadFile = File(...)):
    if not file.filename or not allowed_file(file.filename):
        raise HTTPException(status_code=400, detail="Only .docx and .pdf files are allowed")
    file_bytes = await file.read()
    # Extract text
    try:
        jd_text = extract_text(file_bytes, file.filename)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
    jd_id = str(uuid.uuid4())
    
    # Generate MCQs
    try:
        mcq_questions = generate_mcqs_for_topic(jd_text)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"MCQ generation failed: {str(e)}")
    
    # Store JD with questions
    memory_store[jd_id] = {
        "text": jd_text, 
        "filename": file.filename,
        "questions": [q.model_dump() for q in mcq_questions]
    }
    
    return {
        "message": f"JD uploaded and MCQs generated successfully", 
        "jd_id": jd_id, 
        "questions": mcq_questions
    }
