from dotenv import load_dotenv
import os

# Load .env file from root folder
load_dotenv()

GROQ_API_KEY = os.getenv("GROQ_API_KEY")
