from fastapi import FastAPI
from app.api.upload_jd import router as upload_router
from app.api.test_session import router as test_router
from config import GROQ_API_KEY
from groq import Groq

app = FastAPI()

# Initialize Groq client
groq_client = Groq(api_key=GROQ_API_KEY)

# Include routers
app.include_router(upload_router, prefix="/api")
app.include_router(test_router, prefix="/api")

@app.get("/")
async def read_root():
    return {"message": "Learning App Backend"}
