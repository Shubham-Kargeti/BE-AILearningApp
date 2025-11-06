from fastapi import FastAPI
from app.api.mcq_generation import router as mcq_generation_router
from app.api.test_session import router as test_router
from config import GROQ_API_KEY
from groq import Groq

app = FastAPI()

groq_client = Groq(api_key=GROQ_API_KEY)

app.include_router(mcq_generation_router, prefix="/api")
app.include_router(test_router, prefix="/api")

@app.get("/")
async def read_root():
    return {"message": "Learning App Backend"}