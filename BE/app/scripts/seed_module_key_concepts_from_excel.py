import io
import pandas as pd
from sqlalchemy import select, delete
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import OnboardingModule, OnboardingModuleKeyConcept


EXCEL_PATH = "app/scripts/BCG_Onboarding_Quick_Reference_Developer_Handoff.xlsx"

MODULE_NO_TO_RANK = {
    1: 1,
    2: 2,
    3: 3,
    4: 4,
    5: 5,
    6: 6,
}

# Display types describe how the card should render on the UI.
# "Display directly on module page" -> static information card (no navigation).
# "Link to Resources page | URL TO BE ADDED" / "Direct clickable link | URL TO BE ADDED"
# -> should surface a link on the UI. The yellow cells still say "URL TO BE ADDED",
# so we persist a placeholder dummy link for now and let the UI render it.
# No schema changes are needed beyond the link_url column (per requirement).
LINK_DISPLAY_PREFIX = "Link to Resources page"
DIRECT_LINK_PREFIX = "Direct clickable link"
DUMMY_LINK_PLACEHOLDER = "https://resources.internal/url-to-be-added"
EMAIL_DISPLAY_PREFIX = "Display directly on module page"


def _resolve_link_url(display_type: str) -> str | None:
    """Return a link URL when the display type calls for one, else None."""
    display_type = display_type.strip()
    if display_type.startswith(EMAIL_DISPLAY_PREFIX):
        return None
    if display_type.startswith(LINK_DISPLAY_PREFIX) or display_type.startswith(
        DIRECT_LINK_PREFIX
    ):
        return DUMMY_LINK_PLACEHOLDER
    if display_type.startswith("http://") or display_type.startswith("https://"):
        return display_type
    if "@" in display_type and " " not in display_type.split(";")[0].strip():
        return display_type
    return None


async def seed_module_key_concepts_from_excel(db: AsyncSession) -> None:
    df = pd.read_excel(EXCEL_PATH, header=3)

    df = df.dropna(subset=["Module No."])

    modules_result = await db.execute(select(OnboardingModule))
    modules = modules_result.scalars().all()
    module_by_rank = {m.rank: m for m in modules}

    for module_no, group in df.groupby("Module No."):
        module = module_by_rank.get(MODULE_NO_TO_RANK.get(int(module_no)))
        if not module:
            continue

        await db.execute(
            delete(OnboardingModuleKeyConcept).where(
                OnboardingModuleKeyConcept.module_id == module.id
            )
        )

        concepts = []
        for _, row in group.iterrows():
            sequence = row.get("Sequence")
            if pd.isna(sequence):
                continue

            display_type = str(row.get("Display Type / Link", "")).strip()

            concepts.append(
                OnboardingModuleKeyConcept(
                    module_id=module.id,
                    title=str(row["Card Title"]).strip(),
                    description=str(row["One-line Description"]).strip(),
                    link_url=_resolve_link_url(display_type),
                    display_order=int(sequence),
                )
            )

        # Preserve the authored sequence ordering when persisting.
        concepts.sort(key=lambda c: c.display_order)
        db.add_all(concepts)
        await db.commit()

def _canonical_column(columns: list[str], *candidates: str) -> str | None:
    def normalize(value: str) -> str:
        return " ".join(
            str(value)
            .strip()
            .lower()
            .replace("/", " ")
            .replace("-", " ")
            .replace("_", " ")
            .replace("%", " ")
            .replace("(", " ")
            .replace(")", " ")
            .replace(".", " ")
            .replace(",", " ")
            .split()
        )

    normalized = {normalize(col): col for col in columns}
    for candidate in candidates:
        match = normalized.get(normalize(candidate))
        if match is not None:
            return match
    return None


def parse_key_concept_rows(excel_df: pd.DataFrame) -> list[dict]:
    """Parse a key concepts dataframe into a list of dicts.

    Each dict contains: module_no, title, description, link_url, display_order
    """
    if excel_df is None or excel_df.empty:
        return []

    df = excel_df.copy()
    # Header in the authored workbook starts at row index 3 (0-based) used by seed function.
    columns = list(df.columns)

    module_col = _canonical_column(columns, "Module No.", "Module No", "Module Number", "module_no")
    title_col = _canonical_column(columns, "Card Title", "Title", "card title", "card_title")
    desc_col = _canonical_column(columns, "One-line Description", "Description", "one-line description")
    sequence_col = _canonical_column(columns, "Sequence", "sequence")
    display_type_col = _canonical_column(columns, "Display Type / Link", "Display Type", "display type")

    if not module_col or not title_col or not sequence_col:
        return []

    df = df.dropna(subset=[module_col])

    rows: list[dict] = []
    for _, row in df.iterrows():
        sequence = row.get(sequence_col)
        if pd.isna(sequence):
            continue

        try:
            module_no = int(float(str(row.get(module_col, "").strip() or 0)) )
        except Exception:
            continue

        title = str(row.get(title_col, "") or "").strip()
        if not title:
            continue

        description = str(row.get(desc_col, "") or "").strip()

        display_type = str(row.get(display_type_col, "") or "").strip()

        try:
            link_url = _resolve_link_url(display_type)
        except Exception:
            link_url = None

        rows.append({
            "module_no": module_no,
            "title": title,
            "description": description,
            "link_url": link_url,
            "display_order": int(sequence),
        })

    # Preserve authored sequence ordering
    rows.sort(key=lambda r: (r["module_no"], r["display_order"]))
    return rows


def parse_key_concepts_file(file_bytes: bytes) -> list[dict]:
    return parse_key_concept_rows(pd.read_excel(io.BytesIO(file_bytes), header=3))
