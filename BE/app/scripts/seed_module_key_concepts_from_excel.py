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
