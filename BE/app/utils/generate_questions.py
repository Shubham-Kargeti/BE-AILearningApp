from langchain_groq import ChatGroq
from config import GROQ_API_KEY
from langchain_core.prompts import ChatPromptTemplate, HumanMessagePromptTemplate, SystemMessagePromptTemplate

# System message defines the role and instructions clearly

system_message = SystemMessagePromptTemplate.from_template(
    "You are an expert in creating multiple-choice tests based on job descriptions."
    " Your task is to read the job description provided and extract all key requirements, such as technical or managerial skills."
    " Generate exactly 10 high-quality, challenging MCQ questions based solely on these requirements."
    " Each question must have 4 answer options and clearly indicate the correct answer."
    " Do not include any introductory text, explanatory sentences, or summaries."
    " Only provide the numbered list of questions with answer options and the correct answer."
)


# Human message contains the job description text to analyze
human_message = HumanMessagePromptTemplate.from_template(
    "Job Description:\n{job_description}"
)

# Combine system and human messages
chat_prompt = ChatPromptTemplate.from_messages([system_message, human_message])

# Initialize the Groq chat model
llm = ChatGroq(model="llama-3.3-70b-versatile", temperature=0, api_key=GROQ_API_KEY)

# Then prepare messages by formatting
def generate_mcqs(jd_text: str):
    prompt_messages = chat_prompt.format_messages(job_description=jd_text)
    response = llm.invoke(prompt_messages)
    print(response.content)
    return response.content  