from langchain_groq import ChatGroq
from config import GROQ_API_KEY
from langchain_core.prompts import ChatPromptTemplate, HumanMessagePromptTemplate, SystemMessagePromptTemplate
from app.models.schemas import MCQQuestion, MCQOption
import json
import re

system_message = SystemMessagePromptTemplate.from_template(
    "You are an expert in creating multiple-choice tests."
    " Generate exactly 10 multiple-choice questions based on the topic and difficulty level."
    " Questions must reflect the skill level:"
    " - Beginner: easy questions focusing on basic concepts and understanding."
    " - Intermediate: moderate difficulty with some application and architecture questions."
    " - Expert: advanced, challenging questions about design, architecture, code understanding, edge cases, and optimization."
    " Each question should have 4 answer options (A, B, C, D) with a clearly indicated correct answer."
    "\n\nIMPORTANT: Return ONLY a valid JSON array like:"
    '\n[{{"question_id": 1, "question_text": "Question here?", '
    '"options": [{{"option_id": "A", "text": "Option A"}}, {{"option_id": "B", "text": "Option B"}}, '
    '{{"option_id": "C", "text": "Option C"}}, {{"option_id": "D", "text": "Option D"}}], "correct_answer": "A"}}]'
    "\n\nNo other text or formatting."
)

human_message = HumanMessagePromptTemplate.from_template(
    "Topic: {topic}\nDifficulty Level (beginner, intermediate, expert): {level}"
)

chat_prompt = ChatPromptTemplate.from_messages([system_message, human_message])

llm = ChatGroq(model="llama-3.3-70b-versatile", temperature=0, api_key=GROQ_API_KEY)

def parse_mcqs_from_response(response_text: str):
    cleaned = re.sub(r'``````', '', response_text.strip())
    mcqs_data = json.loads(cleaned)
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

def generate_mcqs_for_topic(topic: str, level: str):
    prompt_messages = chat_prompt.format_messages(topic=topic, level=level)
    response = llm.invoke(prompt_messages)
    print("Raw LLM Response:")
    print(response.content)
    questions = parse_mcqs_from_response(response.content)
    return questions
