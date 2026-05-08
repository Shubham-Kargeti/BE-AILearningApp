"""Course masterdata loading and keyword search helpers.

The course catalog is intentionally driven by the Excel file so new pathways can
be added without changing recommendation code.
"""
from __future__ import annotations

from pathlib import Path
from typing import Any, Iterable, Optional
from xml.etree import ElementTree as ET
import logging
import math
import os
import re
import zipfile

logger = logging.getLogger(__name__)

COURSE_MASTER_FILENAME = "Courses Masterdata.xlsx"
DATA_DIR = Path(__file__).resolve().parents[2] / "data"
DEFAULT_EXCEL_PATH = DATA_DIR / COURSE_MASTER_FILENAME

COURSE_FIELD_ALIASES = {
    "name": ("Pathway Display Name", "Course Name", "Name", "Title"),
    "topic": ("Skill/Topic Pathways", "Skill Topic Pathways", "Topic", "Skill", "Skills"),
    "collection": ("Collection Name", "Collection"),
    "category": ("Category", "Course Category", "Type"),
    "description": ("Description", "Course Description", "Summary"),
    "url": ("Pathway URL", "Course URL", "URL", "Link"),
    "course_level": ("Course Level", "Level", "Difficulty"),
}

SEARCH_FIELDS = (
    "Pathway Display Name",
    "Skill/Topic Pathways",
    "Levelup Badge",
    "Collection Name",
    "Category",
    "Description",
)

FIELD_WEIGHTS = {
    "Skill/Topic Pathways": 6,
    "Pathway Display Name": 5,
    "Levelup Badge": 4,
    "Collection Name": 3,
    "Category": 2,
    "Description": 1,
}

STOP_WORDS = {
    "a",
    "an",
    "and",
    "are",
    "as",
    "at",
    "by",
    "for",
    "from",
    "in",
    "into",
    "is",
    "of",
    "on",
    "or",
    "the",
    "to",
    "with",
}

LEVEL_ALIASES = {
    "basic": "Beginner",
    "beginner": "Beginner",
    "foundation": "Beginner",
    "foundational": "Beginner",
    "intro": "Beginner",
    "introductory": "Beginner",
    "intermediate": "Intermediate",
    "medium": "Intermediate",
    "mid": "Intermediate",
    "advanced": "Advanced",
    "expert": "Advanced",
    "hard": "Advanced",
}

_CATALOG_CACHE: dict[tuple[str, int, int], list[dict[str, str]]] = {}


def resolve_course_master_path(path: Optional[str | os.PathLike[str]] = None) -> Path:
    """Resolve the course master Excel path across common launch directories."""
    if path:
        return Path(path).resolve()

    env_path = os.getenv("COURSE_MASTERDATA_PATH")
    if env_path:
        return Path(env_path).resolve()

    candidates = [
        Path("data") / COURSE_MASTER_FILENAME,
        DEFAULT_EXCEL_PATH,
        Path("BE") / "data" / COURSE_MASTER_FILENAME,
    ]
    for candidate in candidates:
        if candidate.exists():
            return candidate.resolve()

    return DEFAULT_EXCEL_PATH.resolve()


def _clean_cell(value: Any) -> str:
    if value is None:
        return ""
    if isinstance(value, float) and not math.isfinite(value):
        return ""
    text = str(value).strip()
    return "" if text.lower() in {"nan", "none", "null"} else text


def _read_excel_with_pandas(path: Path) -> list[dict[str, str]]:
    import pandas as pd

    df = pd.read_excel(path).fillna("")
    rows = df.to_dict(orient="records")
    return [
        {str(key).strip(): _clean_cell(value) for key, value in row.items()}
        for row in rows
    ]


def _column_index(cell_ref: str) -> int:
    letters = "".join(ch for ch in cell_ref if ch.isalpha())
    index = 0
    for ch in letters:
        index = index * 26 + ord(ch.upper()) - ord("A") + 1
    return index - 1


def _xml_text(element: ET.Element, namespace: dict[str, str]) -> str:
    return "".join(node.text or "" for node in element.findall(".//a:t", namespace))


def _read_excel_with_stdlib(path: Path) -> list[dict[str, str]]:
    """Read the first worksheet of an xlsx file without optional dependencies."""
    namespace = {
        "a": "http://schemas.openxmlformats.org/spreadsheetml/2006/main",
        "r": "http://schemas.openxmlformats.org/officeDocument/2006/relationships",
    }

    with zipfile.ZipFile(path) as workbook:
        shared_strings: list[str] = []
        if "xl/sharedStrings.xml" in workbook.namelist():
            root = ET.fromstring(workbook.read("xl/sharedStrings.xml"))
            shared_strings = [_xml_text(item, namespace) for item in root.findall("a:si", namespace)]

        workbook_root = ET.fromstring(workbook.read("xl/workbook.xml"))
        first_sheet = workbook_root.find(".//a:sheet", namespace)
        if first_sheet is None:
            return []

        relationship_id = first_sheet.attrib.get(
            "{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id"
        )
        relationships = ET.fromstring(workbook.read("xl/_rels/workbook.xml.rels"))
        target = None
        for rel in relationships:
            if rel.attrib.get("Id") == relationship_id:
                target = rel.attrib.get("Target")
                break

        if not target:
            return []

        sheet_path = target if target.startswith("xl/") else f"xl/{target.lstrip('/')}"
        sheet_root = ET.fromstring(workbook.read(sheet_path))

        raw_rows: list[list[str]] = []
        for row in sheet_root.findall(".//a:sheetData/a:row", namespace):
            values: list[str] = []
            for cell in row.findall("a:c", namespace):
                index = _column_index(cell.attrib.get("r", "A1"))
                while len(values) <= index:
                    values.append("")

                cell_type = cell.attrib.get("t")
                value_node = cell.find("a:v", namespace)
                inline_node = cell.find("a:is", namespace)

                if cell_type == "s" and value_node is not None:
                    value = shared_strings[int(value_node.text or "0")]
                elif cell_type == "inlineStr" and inline_node is not None:
                    value = _xml_text(inline_node, namespace)
                elif value_node is not None:
                    value = value_node.text or ""
                else:
                    value = ""

                values[index] = _clean_cell(value)
            raw_rows.append(values)

    if not raw_rows:
        return []

    headers = [header.strip() for header in raw_rows[0]]
    width = len(headers)
    rows = []
    for raw_row in raw_rows[1:]:
        padded = raw_row + [""] * (width - len(raw_row))
        rows.append({headers[index]: _clean_cell(padded[index]) for index in range(width)})
    return rows


def _normalize_row(row: dict[str, str]) -> dict[str, str]:
    normalized = {str(key).strip(): _clean_cell(value) for key, value in row.items()}

    for canonical, aliases in COURSE_FIELD_ALIASES.items():
        for alias in aliases:
            if alias in normalized and normalized[alias]:
                normalized[canonical] = normalized[alias]
                break
        else:
            normalized[canonical] = ""

    normalized["course_level"] = normalize_course_level(normalized.get("course_level", ""))
    if "Course Level" in normalized:
        normalized["Course Level"] = normalized["course_level"]
    return normalized


def load_course_catalog(path: Optional[str | os.PathLike[str]] = None) -> list[dict[str, str]]:
    """Load and cache the Excel course catalog, reloading when the file changes."""
    resolved = resolve_course_master_path(path)
    if not resolved.exists():
        logger.warning("Course master Excel file not found at %s", resolved)
        return []

    stat = resolved.stat()
    cache_key = (str(resolved.resolve()), stat.st_mtime_ns, stat.st_size)
    cached = _CATALOG_CACHE.get(cache_key)
    if cached is not None:
        return cached

    try:
        raw_rows = _read_excel_with_pandas(resolved)
    except Exception as pandas_error:
        try:
            raw_rows = _read_excel_with_stdlib(resolved)
        except Exception:
            logger.exception("Failed to load course master Excel data at %s", resolved)
            return []
        else:
            logger.info("Loaded course catalog using stdlib xlsx reader after pandas failed: %s", pandas_error)

    rows = [_normalize_row(row) for row in raw_rows]

    for old_key in list(_CATALOG_CACHE):
        if old_key[0] == cache_key[0]:
            _CATALOG_CACHE.pop(old_key, None)
    _CATALOG_CACHE[cache_key] = rows
    return rows


def normalize_course_level(level: Any) -> str:
    text = _clean_cell(level)
    if not text or text.lower() in {"empty", "n/a", "na", "not applicable"}:
        return ""

    parts = [part for part in re.split(r"[/,;|]+", text) if part.strip()]
    normalized_parts = []
    for part in parts or [text]:
        key = re.sub(r"[^a-z]+", "", part.lower())
        normalized = LEVEL_ALIASES.get(key)
        if normalized and normalized not in normalized_parts:
            normalized_parts.append(normalized)

    return "/".join(normalized_parts) if normalized_parts else text


def get_allowed_levels(input_level: str) -> list[str]:
    """Return level bands that are appropriate for a learner level."""
    normalized = normalize_course_level(input_level)
    level_map = {
        "Beginner": [
            "Beginner",
            "Beginner/Intermediate",
            "Beginner/Advanced",
            "Beginner/Intermediate/Advanced",
        ],
        "Intermediate": [
            "Beginner/Intermediate",
            "Intermediate",
            "Intermediate/Advanced",
            "Beginner/Intermediate/Advanced",
        ],
        "Advanced": [
            "Advanced",
            "Beginner/Advanced",
            "Intermediate/Advanced",
            "Beginner/Intermediate/Advanced",
        ],
    }
    return level_map.get(normalized, [])


def _tokenize(text: str) -> list[str]:
    normalized = re.sub(r"[^a-z0-9+#.]+", " ", text.lower())
    return [
        token
        for token in normalized.split()
        if len(token) > 1 and token not in STOP_WORDS
    ]


def _field_value(row: dict[str, str], field: str) -> str:
    return row.get(field, "") or row.get(field.lower(), "") or ""


def _row_search_text(row: dict[str, str]) -> str:
    fields = [field for field in SEARCH_FIELDS if _field_value(row, field)]
    if not fields:
        fields = [key for key, value in row.items() if isinstance(value, str) and value]
    return " ".join(_field_value(row, field) for field in fields).lower()


def _course_matches_level(row: dict[str, str], level: Optional[str]) -> bool:
    course_level = normalize_course_level(row.get("course_level") or row.get("Course Level"))
    if not course_level:
        return False
    if not level:
        return True
    return course_level in set(get_allowed_levels(level))


def _match_score(row: dict[str, str], query: str, query_tokens: list[str]) -> int:
    score = 0
    normalized_query = query.lower().strip()
    compact_query = re.sub(r"[^a-z0-9]+", "", normalized_query)
    row_text = _row_search_text(row)
    compact_row_text = re.sub(r"[^a-z0-9]+", "", row_text)

    if normalized_query and normalized_query in row_text:
        score += 12
    elif compact_query and compact_query in compact_row_text:
        score += 10

    for field in SEARCH_FIELDS:
        value = _field_value(row, field).lower()
        if not value:
            continue

        weight = FIELD_WEIGHTS.get(field, 1)
        field_tokens = set(_tokenize(value))
        compact_value = re.sub(r"[^a-z0-9]+", "", value)

        if normalized_query and normalized_query == value.strip():
            score += weight * 6
        elif normalized_query and normalized_query in value:
            score += weight * 3
        elif compact_query and compact_query in compact_value:
            score += weight * 3

        matched_tokens = 0
        for token in query_tokens:
            if token in field_tokens:
                matched_tokens += 1
                score += weight * 2
            elif len(token) > 3 and token in value:
                matched_tokens += 1
                score += weight

        if query_tokens and matched_tokens == len(query_tokens):
            score += weight * 2

    return score


def course_to_recommendation(row: dict[str, str], score: Optional[float] = None) -> dict[str, Any]:
    """Convert a catalog row to the API recommendation shape."""
    return {
        "name": row.get("name", "") or "",
        "topic": row.get("topic", "") or "",
        "collection": row.get("collection", "") or "",
        "category": row.get("category", "") or "",
        "description": row.get("description", "") or "",
        "url": row.get("url", "") or "",
        "score": score,
        "course_level": row.get("course_level", "") or "",
    }


def search_course_catalog(
    query: str,
    level: Optional[str] = None,
    limit: Optional[int] = None,
    catalog: Optional[Iterable[dict[str, str]]] = None,
) -> list[dict[str, Any]]:
    """Search the course masterdata with weighted keyword matching."""
    query = _clean_cell(query)
    if not query:
        return []

    rows = list(catalog if catalog is not None else load_course_catalog())
    query_tokens = _tokenize(query)
    if not query_tokens:
        return []

    scored_rows = []
    for index, row in enumerate(rows):
        if not _course_matches_level(row, level):
            continue

        score = _match_score(row, query, query_tokens)
        if score <= 0:
            continue
        scored_rows.append((score, index, row))

    scored_rows.sort(key=lambda item: (-item[0], item[1]))

    recommendations = []
    seen = set()
    for _, _, row in scored_rows:
        key = (
            (row.get("url") or "").casefold(),
            (row.get("name") or "").casefold(),
            (row.get("topic") or "").casefold(),
        )
        if key in seen:
            continue
        seen.add(key)
        recommendations.append(course_to_recommendation(row))
        if limit is not None and len(recommendations) >= limit:
            break

    return recommendations


def catalog_signature(path: Optional[str | os.PathLike[str]] = None) -> Optional[tuple[Path, int, int]]:
    resolved = resolve_course_master_path(path)
    if not resolved.exists():
        return None
    stat = resolved.stat()
    return resolved, stat.st_mtime_ns, stat.st_size
