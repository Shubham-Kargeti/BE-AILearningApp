from fastapi import FastAPI
from app.api.mcq_generation import router as mcq_generation_router
from app.api.test_session import router as test_router
from config import GROQ_API_KEY
from groq import Groq
from sqlalchemy import create_engine, text
import os
from sqlalchemy.orm import sessionmaker
from app.api.recommended_courses import router as recommended_courses_router

app = FastAPI()

DATABASE_URL = (
    f"postgresql://{os.getenv('DB_USER')}:{os.getenv('DB_PASSWORD')}"
    f"@{os.getenv('DB_HOST')}:{os.getenv('DB_PORT')}/{os.getenv('DB_NAME')}"
)

print(DATABASE_URL)
engine = create_engine(DATABASE_URL)

Session = sessionmaker(bind=engine)
session = Session()

groq_client = Groq(api_key=GROQ_API_KEY)

app.include_router(mcq_generation_router, prefix="/api")
app.include_router(test_router, prefix="/api")
app.include_router(recommended_courses_router, prefix="/api")


@app.get("/")
async def read_root():
    return {"message": "Learning App Backend"}

@app.post("/test-db")
def test_db():
    with Session() as session:
        session.execute(text("CREATE TABLE IF NOT EXISTS test_table(id SERIAL PRIMARY KEY, name VARCHAR(50));"))
        session.execute(text("INSERT INTO test_table(name) VALUES ('Sample Entry');"))
        session.commit()
        result = session.execute(text("SELECT * FROM test_table;"))
        rows = [dict(row._mapping) for row in result]
    print({"rows": rows})
    return {"rows": rows}

@app.get("/view-test-table")
def view_test_table():
    with Session() as session:
        session.execute(text("CREATE TABLE IF NOT EXISTS test_table(id SERIAL PRIMARY KEY, name VARCHAR(50));"))
        result = session.execute(text("SELECT * FROM test_table;"))
        rows = [dict(row._mapping) for row in result]
    print({"rows": rows})
    return {"rows": rows}

@app.delete("/delete-test-table")
def delete_test_table():
    with Session() as session:
        # Delete all entries
        session.execute(text("DELETE FROM test_table;"))
        # Drop the table
        session.execute(text("DROP TABLE IF EXISTS test_table;"))
        session.commit()
    return {"message": "test_table deleted along with all entries."}