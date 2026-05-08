import argparse
import logging
import os
import shutil
import sys
from pathlib import Path

from langchain_community.vectorstores import FAISS
from langchain_huggingface import HuggingFaceEmbeddings
from langchain_core.documents import Document

sys.path.append(str(Path(__file__).resolve().parents[2]))

from app.services.course_catalog import load_course_catalog, resolve_course_master_path

logger = logging.getLogger(__name__)


def build_index(excel_path: str, output_dir: str, model_name: str = "sentence-transformers/all-MiniLM-L6-v2") -> str:
    """Build a FAISS index from the provided Excel file and save to output_dir.

    Returns the path to the saved index directory.
    """
    resolved_excel_path = resolve_course_master_path(excel_path)
    if not resolved_excel_path.exists():
        raise FileNotFoundError(f"Excel file not found at {resolved_excel_path}")

    documents = []
    for row in load_course_catalog(resolved_excel_path):
        text_blob = "; ".join(
            value
            for key, value in row.items()
            if isinstance(value, str) and value and not key.startswith("_")
        )

        metadata = {
            "type": "resource",
            "name": row.get("name", ""),
            "topic": row.get("topic", ""),
            "collection": row.get("collection", ""),
            "category": row.get("category", ""),
            "description": row.get("description", ""),
            "url": row.get("url", ""),
            "course_level": row.get("course_level", ""),
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
