from fastapi import FastAPI
from app.api.upload_jd import router as router
from config import GROQ_API_KEY
from groq import Groq

app = FastAPI()

# Initialize Groq client
groq_client = Groq(api_key=GROQ_API_KEY)

# Include JD Upload router
app.include_router(router, prefix="/api")

@app.get("/")
async def read_root():
    return {"message": "Learning App Backend"}
