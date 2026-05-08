import argparse
import logging
import os
import shutil
import sys
from pathlib import Path

from langchain_community.vectorstores import FAISS
from langchain_core.documents import Document
from langchain_huggingface import HuggingFaceEmbeddings

# Add project root to sys.path
BASE_DIR = Path(__file__).resolve().parents[2]
sys.path.append(str(BASE_DIR))

from app.services.course_catalog import (
    load_course_catalog,
    resolve_course_master_path,
)

logger = logging.getLogger(__name__)


def build_index(
    excel_path: str,
    output_dir: str,
    model_name: str = "sentence-transformers/all-MiniLM-L6-v2",
) -> str:
    """
    Build FAISS index from Courses Masterdata.xlsx
    """

    excel_path = resolve_course_master_path(excel_path)
    output_dir = Path(output_dir)

    logger.info("Using Excel file: %s", excel_path)

    if not excel_path.exists():
        raise FileNotFoundError(
            f"Excel file not found at:\n{excel_path}"
        )

    # Load rows from excel
    rows = load_course_catalog(excel_path)

    documents = []

    for row in rows:
        text_blob = "; ".join(
            value
            for key, value in row.items()
            if isinstance(value, str)
            and value
            and not key.startswith("_")
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

        documents.append(
            Document(
                page_content=text_blob,
                metadata=metadata,
            )
        )

    if not documents:
        raise ValueError("No documents created from Excel file")

    logger.info("Total documents created: %s", len(documents))

    # Load embedding model
    logger.info("Loading embedding model: %s", model_name)

    embedding_model = HuggingFaceEmbeddings(
        model_name=model_name
    )

    # Create FAISS vector store
    logger.info("Creating FAISS vector index...")

    vectorstore = FAISS.from_documents(
        documents,
        embedding_model,
    )

    # Remove old index if exists
    # Remove old FAISS index safely
    if output_dir.exists():
        logger.info("Removing old FAISS index...")

        try:
            shutil.rmtree(output_dir)

        except PermissionError:
            logger.warning(
                "Could not delete old index folder. "
                "Files may be in use."
            )
    
            # Delete files individually
            for item in output_dir.glob("*"):
                try:
                    if item.is_file():
                        item.unlink()
    
                    elif item.is_dir():
                        shutil.rmtree(item, ignore_errors=True)
    
                except Exception as e:
                    logger.warning(
                        "Failed to remove %s : %s",
                        item,
                        e,
                    )
    
    output_dir.mkdir(parents=True, exist_ok=True)

    # Save index
    vectorstore.save_local(str(output_dir))

    logger.info("FAISS index saved successfully at: %s", output_dir)

    return str(output_dir)


def main():
    # Paths based on your project structure
    default_excel_path = (
        BASE_DIR
        / "data"
        / "Courses Masterdata.xlsx"
    )

    default_output_dir = (
        BASE_DIR
        / "data"
        / "course_faiss_index"
    )

    parser = argparse.ArgumentParser(
        description="Build course FAISS vector index"
    )

    parser.add_argument(
        "--excel",
        default=str(default_excel_path),
        help="Path to Courses Masterdata.xlsx",
    )

    parser.add_argument(
        "--out",
        default=str(default_output_dir),
        help="Output directory for FAISS index",
    )

    parser.add_argument(
        "--model",
        default="sentence-transformers/all-MiniLM-L6-v2",
        help="Embedding model name",
    )

    args = parser.parse_args()

    logging.basicConfig(
        level=logging.INFO,
        format="%(levelname)s - %(message)s",
    )

    try:
        build_index(
            excel_path=args.excel,
            output_dir=args.out,
            model_name=args.model,
        )

    except Exception as e:
        logger.exception("Failed to build FAISS index")
        raise e


if __name__ == "__main__":
    main()