import pandas as pd
from langchain_community.vectorstores import FAISS
from langchain_huggingface import HuggingFaceEmbeddings
from langchain_core.documents import Document
import os

# Set file paths
EXCEL_PATH = os.path.join("data", "Courses Masterdata.xlsx")
VECTOR_INDEX_PATH = os.path.join("data", "course_faiss_index")

# Load Excel
df = pd.read_excel(EXCEL_PATH)
df = df.fillna("")

# Strip whitespace from all strings (important)
df = df.applymap(lambda x: x.strip() if isinstance(x, str) else x)

documents = []

for _, row in df.iterrows():
    # Build combined searchable text
    text_blob = "; ".join([
        str(row.get("Pathway Display Name", "")),
        str(row.get("Skill/Topic Pathways", "")),
        str(row.get("Collection Name", "")),
        str(row.get("Category", "")),
        str(row.get("Description", "")),
        str(row.get("Course Level", "")),
    ])

    # Build metadata (ensure consistent key names)
    metadata = {
        "type": "resource",
        "name": str(row.get("Pathway Display Name", "")),
        "topic": str(row.get("Skill/Topic Pathways", "")),
        "collection": str(row.get("Collection Name", "")),
        "category": str(row.get("Category", "")),
        "description": str(row.get("Description", "")),
        "url": str(row.get("Pathway URL", "")),
        "course_level": str(row.get("Course Level", "")),  
    }

    documents.append(Document(page_content=text_blob, metadata=metadata))

# Initialize embedding model
embedding_model = HuggingFaceEmbeddings(
    model_name="sentence-transformers/all-MiniLM-L6-v2"
)

# Create FAISS vector store
vectorstore = FAISS.from_documents(documents, embedding_model)

# Delete old index before saving new one
if os.path.exists(VECTOR_INDEX_PATH):
    import shutil
    shutil.rmtree(VECTOR_INDEX_PATH)

# Save index to disk
vectorstore.save_local(VECTOR_INDEX_PATH)
print(f"FAISS index rebuilt and saved to {VECTOR_INDEX_PATH}")