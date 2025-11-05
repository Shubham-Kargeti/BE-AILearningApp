# app/main.py
from fastapi import FastAPI
from config import GROQ_API_KEY
from groq import Groq

app = FastAPI()

# Initialize Groq client
groq_client = Groq(api_key=GROQ_API_KEY)

@app.get("/")
async def read_root():
    return {"message": "Learning App Backend"}

@app.get("/ai-demo")
async def ai_demo():
    response = groq_client.chat.completions.create(
        model="llama-3.3-70b-versatile",
        messages=[
            {"role": "system", "content": "You are an educational assistant."},
            {"role": "user", "content": "Explain the importance of scoring rules."},
        ],
    )
    print(response)
    return {"response": response.choices[0].message.content}
