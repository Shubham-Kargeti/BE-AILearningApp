import json
import logging
import os
import re
import shutil
from collections import Counter
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

from langchain_core.documents import Document
from langchain_community.vectorstores import FAISS
from langchain_huggingface import HuggingFaceEmbeddings

logger = logging.getLogger(__name__)

BASE_INDEX_DIR = Path(os.getenv("QUESTION_DOC_INDEX_DIR", "data/question_docs_rag"))
EMBEDDING_MODEL = os.getenv("QUESTION_DOC_EMBEDDING_MODEL", "sentence-transformers/all-MiniLM-L6-v2")

DEFAULT_CHUNK_WORDS = int(os.getenv("QUESTION_DOC_CHUNK_WORDS", "160"))
DEFAULT_CHUNK_OVERLAP_WORDS = int(os.getenv("QUESTION_DOC_CHUNK_OVERLAP_WORDS", "40"))
MIN_CHUNK_WORDS = int(os.getenv("QUESTION_DOC_MIN_CHUNK_WORDS", "24"))
MAX_CHUNKS_PER_DOC = int(os.getenv("QUESTION_DOC_MAX_CHUNKS", "600"))


def _safe_doc_id(doc_id: str) -> str:
    safe = re.sub(r"[^a-zA-Z0-9_.-]", "_", str(doc_id or "").strip())
    if not safe:
        raise ValueError("doc_id is required")
    return safe[:160]


def _doc_dir(doc_id: str) -> Path:
    return BASE_INDEX_DIR / _safe_doc_id(doc_id)


def _faiss_dir(doc_id: str) -> Path:
    return _doc_dir(doc_id) / "faiss"


def _chunks_path(doc_id: str) -> Path:
    return _doc_dir(doc_id) / "chunks.json"


def _ensure_base_dir() -> None:
    BASE_INDEX_DIR.mkdir(parents=True, exist_ok=True)


def _normalize_text(text: str) -> str:
    normalized = str(text or "").replace("\r\n", "\n").replace("\r", "\n")
    normalized = re.sub(r"[ \t]+", " ", normalized)
    normalized = re.sub(r"\n{3,}", "\n\n", normalized)
    return normalized.strip()


def _split_sentences(text: str) -> List[str]:
    parts = re.split(r"(?<=[.!?])\s+(?=[A-Z0-9])|\n+", text)
    return [part.strip() for part in parts if part and part.strip()]


def _split_long_segment(segment: str, chunk_words: int, overlap_words: int) -> List[str]:
    words = segment.split()
    if len(words) <= chunk_words:
        return [segment.strip()]

    step = max(1, chunk_words - overlap_words)
    pieces = []
    for start in range(0, len(words), step):
        window = words[start:start + chunk_words]
        if len(window) < MIN_CHUNK_WORDS and pieces:
            break
        pieces.append(" ".join(window).strip())
    return pieces


def _tail_words(text: str, overlap_words: int) -> List[str]:
    if overlap_words <= 0:
        return []
    return text.split()[-overlap_words:]


def chunk_text(
    text: str,
    chunk_size: int = DEFAULT_CHUNK_WORDS,
    overlap: int = DEFAULT_CHUNK_OVERLAP_WORDS,
    min_words: int = MIN_CHUNK_WORDS,
    max_chunks: int = MAX_CHUNKS_PER_DOC,
) -> List[str]:
    """Split document text into sentence-aware overlapping word chunks.

    The previous 300-word window produced only a handful of chunks for normal
    documents. These smaller overlapped chunks give retrieval more recall while
    preserving enough surrounding context for grounded question generation.
    """
    normalized = _normalize_text(text)
    if not normalized:
        return []

    chunk_size = max(80, int(chunk_size or DEFAULT_CHUNK_WORDS))
    overlap = max(0, min(int(overlap or 0), chunk_size // 2))
    min_words = max(8, int(min_words or MIN_CHUNK_WORDS))

    paragraphs = [
        paragraph.strip()
        for paragraph in re.split(r"\n\s*\n", normalized)
        if paragraph.strip()
    ]
    segments: List[str] = []
    for paragraph in paragraphs or [normalized]:
        for sentence in _split_sentences(paragraph):
            segments.extend(_split_long_segment(sentence, chunk_size, overlap))

    chunks: List[str] = []
    current_words: List[str] = []

    def flush_current() -> None:
        nonlocal current_words
        if not current_words:
            return
        chunk = " ".join(current_words).strip()
        word_count = len(chunk.split())
        if word_count >= min_words or not chunks:
            chunks.append(chunk)
        current_words = _tail_words(chunk, overlap)

    for segment in segments:
        words = segment.split()
        if not words:
            continue

        if current_words and len(current_words) + len(words) > chunk_size:
            flush_current()

        if len(words) > chunk_size:
            for piece in _split_long_segment(segment, chunk_size, overlap):
                piece_words = piece.split()
                if current_words and len(current_words) + len(piece_words) > chunk_size:
                    flush_current()
                current_words.extend(piece_words)
                flush_current()
        else:
            current_words.extend(words)

        if len(chunks) >= max_chunks:
            break

    if len(chunks) < max_chunks and current_words:
        final_chunk = " ".join(current_words).strip()
        if len(final_chunk.split()) >= min_words or not chunks:
            chunks.append(final_chunk)

    deduped: List[str] = []
    seen = set()
    for chunk in chunks[:max_chunks]:
        key = re.sub(r"\W+", "", chunk.lower())[:500]
        if key and key not in seen:
            seen.add(key)
            deduped.append(chunk)

    if not deduped and normalized:
        words = normalized.split()
        deduped.append(" ".join(words[:chunk_size]))

    return deduped


def _documents_from_chunks(doc_id: str, chunks: List[str], metadata: Optional[Dict[str, Any]]) -> List[Document]:
    base_meta = dict(metadata or {})
    return [
        Document(
            page_content=chunk,
            metadata={
                **base_meta,
                "doc_id": doc_id,
                "chunk_index": index,
                "word_count": len(chunk.split()),
                "char_count": len(chunk),
            },
        )
        for index, chunk in enumerate(chunks)
    ]


def _write_chunks(doc_id: str, documents: List[Document]) -> None:
    payload = [
        {
            "text": doc.page_content,
            "meta": doc.metadata or {},
        }
        for doc in documents
    ]
    path = _chunks_path(doc_id)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, ensure_ascii=False), encoding="utf-8")


def _read_chunks(doc_id: str) -> List[Dict[str, Any]]:
    path = _chunks_path(doc_id)
    if not path.exists():
        return []
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        logger.exception("Failed to read chunk store for doc_id=%s", doc_id)
        return []

    if not isinstance(payload, list):
        return []

    chunks = []
    for item in payload:
        if not isinstance(item, dict):
            continue
        text = str(item.get("text") or "").strip()
        if not text:
            continue
        meta = item.get("meta") if isinstance(item.get("meta"), dict) else {}
        chunks.append({"text": text, "meta": meta})
    return chunks


def index_document(doc_id: str, text: str, metadata: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    """Create an isolated temporary RAG index for one uploaded document.

    Chunks are always persisted as JSON. FAISS is added when embeddings are
    available; if embeddings fail, retrieval can still use the lexical fallback.
    """
    safe_doc_id = _safe_doc_id(doc_id)
    _ensure_base_dir()

    doc_path = _doc_dir(safe_doc_id)
    if doc_path.exists():
        shutil.rmtree(doc_path)
    doc_path.mkdir(parents=True, exist_ok=True)

    chunks = chunk_text(text)
    documents = _documents_from_chunks(safe_doc_id, chunks, metadata)
    _write_chunks(safe_doc_id, documents)

    result = {
        "doc_id": safe_doc_id,
        "chunks": len(documents),
        "embedding_indexed": False,
        "embedding_model": EMBEDDING_MODEL,
        "warning": None,
    }

    if not documents:
        result["warning"] = "No readable text chunks were produced from the uploaded document."
        logger.warning("No chunks produced for doc_id=%s", safe_doc_id)
        return result

    try:
        embedding_model = HuggingFaceEmbeddings(model_name=EMBEDDING_MODEL)
        vs = FAISS.from_documents(documents, embedding_model)
        faiss_path = _faiss_dir(safe_doc_id)
        faiss_path.mkdir(parents=True, exist_ok=True)
        vs.save_local(str(faiss_path))
        result["embedding_indexed"] = True
        logger.info("Created isolated FAISS index for doc_id=%s with %d chunks", safe_doc_id, len(documents))
    except Exception as exc:
        result["warning"] = f"Embedding index unavailable; lexical fallback will be used. {exc}"
        logger.exception("Failed to build FAISS index for doc_id=%s", safe_doc_id)

    return result


def _hit_from_document(doc: Document, score: Optional[float], retrieval: str) -> Tuple[Dict[str, Any], Optional[float]]:
    meta = dict(doc.metadata or {})
    doc_id = meta.get("doc_id")
    chunk_index = meta.get("chunk_index")
    normalized_score = None
    if isinstance(score, (int, float)):
        normalized_score = 1.0 / (1.0 + max(0.0, float(score)))

    return (
        {
            "id": f"{doc_id}::chunk:{chunk_index}",
            "meta": {
                **meta,
                "retrieval": retrieval,
                "relevance_score": normalized_score,
            },
            "text": doc.page_content,
        },
        normalized_score,
    )


def _tokenize(text: str) -> List[str]:
    return [
        token
        for token in re.findall(r"[a-zA-Z0-9][a-zA-Z0-9_+#.-]*", str(text or "").lower())
        if len(token) > 2
    ]


def _lexical_query(q: str, chunks: List[Dict[str, Any]], top_k: int) -> List[Tuple[Dict[str, Any], Optional[float]]]:
    query_terms = Counter(_tokenize(q))
    if not chunks:
        return []

    scored = []
    for chunk in chunks:
        text = chunk["text"]
        meta = dict(chunk.get("meta") or {})
        chunk_terms = Counter(_tokenize(text))

        overlap = sum(min(query_terms[token], chunk_terms.get(token, 0)) for token in query_terms)
        density = overlap / max(1, sum(query_terms.values()))
        exact_bonus = 0.2 if q and str(q).lower() in text.lower() else 0.0
        score = density + exact_bonus

        scored.append(
            (
                score,
                {
                    "id": f"{meta.get('doc_id')}::chunk:{meta.get('chunk_index')}",
                    "meta": {
                        **meta,
                        "retrieval": "lexical",
                        "relevance_score": score,
                    },
                    "text": text,
                },
            )
        )

    scored.sort(key=lambda item: item[0], reverse=True)

    # Even weak lexical matches are useful as a last-resort document fallback.
    return [(hit, float(score)) for score, hit in scored[:top_k]]


def query_text(q: str, top_k: int = 5, doc_id: Optional[str] = None) -> List[Tuple[Dict[str, Any], Optional[float]]]:
    """Retrieve chunks from one isolated document index.

    A missing doc_id intentionally returns no results so previous uploads cannot
    leak into new assessment generations.
    """
    if not doc_id:
        logger.info("Skipping RAG query without doc_id to avoid shared retrieval state.")
        return []

    safe_doc_id = _safe_doc_id(doc_id)
    chunks = _read_chunks(safe_doc_id)
    if not chunks:
        return []

    top_k = max(1, min(int(top_k or 1), len(chunks)))
    faiss_path = _faiss_dir(safe_doc_id)

    if faiss_path.exists() and any(faiss_path.iterdir()):
        try:
            embedding_model = HuggingFaceEmbeddings(model_name=EMBEDDING_MODEL)
            vs = FAISS.load_local(
                str(faiss_path),
                embedding_model,
                allow_dangerous_deserialization=True,
            )

            fetch_k = min(len(chunks), max(top_k * 4, top_k + 8))
            scored_docs = vs.similarity_search_with_score(q, k=fetch_k)
            score_by_chunk = {
                doc.metadata.get("chunk_index"): score
                for doc, score in scored_docs
                if doc.metadata
            }

            try:
                selected_docs = vs.max_marginal_relevance_search(q, k=top_k, fetch_k=fetch_k)
            except Exception:
                selected_docs = [doc for doc, _ in scored_docs[:top_k]]

            hits = [
                _hit_from_document(
                    doc,
                    score_by_chunk.get((doc.metadata or {}).get("chunk_index")),
                    "faiss_mmr",
                )
                for doc in selected_docs[:top_k]
            ]
            if hits:
                return hits
        except Exception:
            logger.exception("FAISS retrieval failed for doc_id=%s; using lexical fallback", safe_doc_id)

    return _lexical_query(q, chunks, top_k)


def get_document_stats(doc_id: Optional[str]) -> Dict[str, Any]:
    if not doc_id:
        return {"doc_id": None, "chunks": 0, "embedding_indexed": False}

    safe_doc_id = _safe_doc_id(doc_id)
    chunks = _read_chunks(safe_doc_id)
    return {
        "doc_id": safe_doc_id,
        "chunks": len(chunks),
        "embedding_indexed": _faiss_dir(safe_doc_id).exists(),
    }


def cleanup_document(doc_id: Optional[str]) -> None:
    if not doc_id:
        return

    try:
        doc_path = _doc_dir(_safe_doc_id(doc_id))
        if doc_path.exists():
            shutil.rmtree(doc_path)
            logger.info("Cleaned temporary RAG index for doc_id=%s", doc_id)
    except Exception:
        logger.exception("Failed to clean temporary RAG index for doc_id=%s", doc_id)
