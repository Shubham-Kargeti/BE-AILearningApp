import argparse
import logging
import os
import shutil

import pandas as pd
from langchain_community.vectorstores import FAISS
from langchain_huggingface import HuggingFaceEmbeddings
from langchain_core.documents import Document

logger = logging.getLogger(__name__)


def build_index(excel_path: str, output_dir: str, model_name: str = "sentence-transformers/all-MiniLM-L6-v2") -> str:
    """Build a FAISS index from the provided Excel file and save to output_dir.

    Returns the path to the saved index directory.
    """
    if not os.path.exists(excel_path):
        raise FileNotFoundError(f"Excel file not found at {excel_path}")

    df = pd.read_excel(excel_path)
    df = df.fillna("")
    df = df.applymap(lambda x: x.strip() if isinstance(x, str) else x)

    documents = []
    for _, row in df.iterrows():
        text_blob = "; ".join([
            str(row.get("Pathway Display Name", "")),
            str(row.get("Skill/Topic Pathways", "")),
            str(row.get("Collection Name", "")),
            str(row.get("Category", "")),
            str(row.get("Description", "")),
            str(row.get("Course Level", "")),
        ])

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

    embedding_model = HuggingFaceEmbeddings(model_name=model_name)
    vectorstore = FAISS.from_documents(documents, embedding_model)

    # Delete old index
    if os.path.exists(output_dir):
        shutil.rmtree(output_dir)
    os.makedirs(output_dir, exist_ok=True)

    vectorstore.save_local(output_dir)
    logger.info("FAISS index rebuilt and saved to %s", output_dir)
    return output_dir


def main():
    parser = argparse.ArgumentParser(description="Build FAISS index from course master Excel file")
    parser.add_argument("--excel", default=os.path.join("data", "Courses Masterdata.xlsx"), help="Path to Courses Masterdata.xlsx")
    parser.add_argument("--out", default=os.path.join("data", "course_faiss_index"), help="Output directory for FAISS index")
    parser.add_argument("--model", default="sentence-transformers/all-MiniLM-L6-v2", help="Embedding model name")
    args = parser.parse_args()

    logging.basicConfig(level=logging.INFO)
    try:
        build_index(args.excel, args.out, model_name=args.model)
    except Exception as e:
        logger.exception("Failed to build FAISS index: %s", e)
        raise


if __name__ == "__main__":
    main()