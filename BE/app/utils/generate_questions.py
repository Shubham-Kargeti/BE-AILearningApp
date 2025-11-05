from langchain_groq import ChatGroq
from config import GROQ_API_KEY
from langchain_core.prompts import ChatPromptTemplate, HumanMessagePromptTemplate, SystemMessagePromptTemplate
from app.models.schemas import MCQQuestion, MCQOption
import json
import re

# System message defines the role and instructions clearly

system_message = SystemMessagePromptTemplate.from_template(
  "You are an expert in creating multiple-choice tests based on job descriptions."
    " Your task is to read the job description provided and extract all key requirements, such as technical or managerial skills."
    " Generate exactly 10 high-quality, challenging MCQ questions based solely on these requirements."
    " Each question should have 4 answer options (A, B, C, D) and clearly indicate the correct answer."
    " Ensure questions are relevant and challenging."
    "\n\nIMPORTANT: Return your response ONLY as a valid JSON array with this exact structure:"
    '\n[{{"question_id": 1, "question_text": "Question here?", "options": [{{"option_id": "A", "text": "Option A"}}, {{"option_id": "B", "text": "Option B"}}, {{"option_id": "C", "text": "Option C"}}, {{"option_id": "D", "text": "Option D"}}], "correct_answer": "A"}}, ...]'
    "\n\nDo not include any other text, explanations, or markdown formatting. Only return the JSON array."
)


# Human message contains the job description text to analyze
human_message = HumanMessagePromptTemplate.from_template(
    "Job Description:\n{job_description}"
)

# Combine system and human messages
chat_prompt = ChatPromptTemplate.from_messages([system_message, human_message])

# Initialize the Groq chat model
llm = ChatGroq(model="llama-3.3-70b-versatile", temperature=0, api_key=GROQ_API_KEY)

def parse_mcqs_from_response(response_text: str):
    """Parse the LLM response and extract JSON array of MCQs."""
    try:
        # Try to find JSON array in the response
        # Remove markdown code blocks if present
        cleaned = re.sub(r'```json\s*|\s*```', '', response_text.strip())
        
        # Parse JSON
        mcqs_data = json.loads(cleaned)
        
        # Convert to Pydantic models
        questions = []
        for mcq in mcqs_data:
            options = [MCQOption(**opt) for opt in mcq['options']]
            question = MCQQuestion(
                question_id=mcq['question_id'],
                question_text=mcq['question_text'],
                options=options,
                correct_answer=mcq['correct_answer']
            )
            questions.append(question)
        
        return questions
    except Exception as e:
        print(f"Error parsing MCQs: {e}")
        print(f"Response was: {response_text}")
        raise ValueError(f"Failed to parse MCQs from LLM response: {str(e)}")

# Then prepare messages by formatting
def generate_mcqs(jd_text: str):
    prompt_messages = chat_prompt.format_messages(job_description=jd_text)
    response = llm.invoke(prompt_messages)
    print("Raw LLM Response:")
    print(response.content)
    
    # Parse and return structured MCQs
    questions = parse_mcqs_from_response(response.content)
    return questions  