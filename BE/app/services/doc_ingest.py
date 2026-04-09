import os
import logging
from typing import List, Tuple, Optional, Dict, Any

from langchain_community.vectorstores import FAISS
from langchain_huggingface import HuggingFaceEmbeddings
from langchain_core.documents import Document
import shutil

logger = logging.getLogger(__name__)

INDEX_DIR = os.path.join("data", "question_docs_faiss_index")
EMBEDDING_MODEL = "sentence-transformers/all-MiniLM-L6-v2"


def _ensure_index_dir():
    os.makedirs(INDEX_DIR, exist_ok=True)


def index_document(doc_id: str, text: str, metadata: Optional[Dict[str, Any]] = None) -> None:
    """Index a single document (split into chunks) into the FAISS index.

    The function stores chunks as Documents with metadata containing doc_id and extra metadata.
    If an index already exists it will be loaded and extended; otherwise a new index is created.
    """
    _ensure_index_dir()

    if os.path.exists(INDEX_DIR):
            shutil.rmtree(INDEX_DIR)
            os.makedirs(INDEX_DIR, exist_ok=True)

    # Simple chunking by paragraph - could be replaced with smarter chunking
    paragraphs = [p.strip() for p in text.split("\n") if p.strip()]
    documents: List[Document] = []
    for i, p in enumerate(paragraphs):
        documents.append(Document(page_content=p, metadata={"doc_id": doc_id, "chunk_index": i, **(metadata or {})}))

    embedding_model = HuggingFaceEmbeddings(model_name=EMBEDDING_MODEL)

    try:
        # ALWAYS CREATE FRESH INDEX (no append, no old data)
        if os.path.exists(INDEX_DIR):
            shutil.rmtree(INDEX_DIR)

        os.makedirs(INDEX_DIR, exist_ok=True)

        vs = FAISS.from_documents(documents, embedding_model)
        vs.save_local(INDEX_DIR)

        logger.info("Created fresh FAISS index with %d chunks", len(documents))

    except Exception as e:
        logger.exception("Failed to index document %s: %s", doc_id, e)
        raise


def query_text(
    q: str,
    top_k: int = 5,
    doc_id: Optional[str] = None
) -> List[Tuple[Dict[str, Any], Optional[float]]]:

    if not os.path.exists(INDEX_DIR) or not os.listdir(INDEX_DIR):
        return []

    embedding_model = HuggingFaceEmbeddings(model_name=EMBEDDING_MODEL)
    vs = FAISS.load_local(INDEX_DIR, embedding_model, allow_dangerous_deserialization=True)
    print("TOTAL DOCS IN INDEX:", len(vs.docstore._dict))

    # 🔥 STEP 1: Extract ALL docs from index
    all_docs = vs.docstore._dict.values()

    # 🔥 STEP 2: Filter ONLY current doc_id BEFORE embedding search
    if doc_id:
        filtered_docs = [
            doc for doc in all_docs
            if doc.metadata.get("doc_id") == doc_id
        ]
    else:
        filtered_docs = list(all_docs)

    if not filtered_docs:
        return []

    # 🔥 STEP 3: Create TEMP FAISS index ONLY for this doc
    temp_vs = FAISS.from_documents(filtered_docs, embedding_model)

    try:
        results = temp_vs.similarity_search_with_score(q, k=top_k)
    except Exception:
        return []

    hits = []

    for doc, score in results:
        meta = doc.metadata or {}

        hit = {
            "id": f"{meta.get('doc_id')}::chunk:{meta.get('chunk_index')}",
            "meta": meta,
            "text": doc.page_content
        }

        hits.append((hit, float(score) if score is not None else None))

    return hits
