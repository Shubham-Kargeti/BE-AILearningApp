import pandas as pd
from langchain_community.vectorstores import FAISS
from langchain_community.embeddings import HuggingFaceEmbeddings
from langchain_core.documents import Document
import os

# Set file paths
EXCEL_PATH = os.path.join("data", "Courses Masterdata.xlsx")
VECTOR_INDEX_PATH = os.path.join("data", "course_faiss_index")  # You can change output path as needed

# Load Excel
df = pd.read_excel(EXCEL_PATH)

# Prepare documents from each row
documents = []
for _, row in df.iterrows():
    text_blob = "; ".join([
        str(row.get('Pathway Display Name', '')),
        str(row.get('Skill/Topic Pathways', '')),
        str(row.get('Levelup Badge', ''))  # This is optional, add/remove fields as needed
    ])
    documents.append(
        Document(
            page_content=text_blob,
            metadata={
                "type": "resource",
                "name": row.get("Pathway Display Name", ""),
                "topic": row.get("Skill/Topic Pathways", ""),
                "badge": row.get("Levelup Badge", ""),
                "url": row.get("Pathway URL", "")
            }
        )
    )

# Initialize embedding model
embedding_model = HuggingFaceEmbeddings(model_name="sentence-transformers/all-MiniLM-L6-v2")

# Create FAISS vector store
vectorstore = FAISS.from_documents(documents, embedding_model)

# Save index to disk
vectorstore.save_local(VECTOR_INDEX_PATH)
print(f"FAISS index saved to {VECTOR_INDEX_PATH}")