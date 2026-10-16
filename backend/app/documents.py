"""The agreements Prelegal can draft, defined in documents.json at the repo root.

The frontend reads the same file at build time, so both sides agree on each
agreement's parties and key terms. The Mutual NDA's fields are defined in code
(app/nda_chat.py and frontend/src/lib/nda.ts) because it fills in Common
Paper's own cover page; every other agreement gets a cover page generated from
its `terms`.
"""

import os
from pathlib import Path
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, TypeAdapter
from pydantic.alias_generators import to_camel

from app.config import REPO_DIR

DOCUMENTS_PATH = Path(os.environ.get("PRELEGAL_DOCUMENTS_PATH", REPO_DIR / "documents.json"))
NDA_ID = "mutual-nda"


class _Spec(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, frozen=True)


class Term(_Spec):
    """A key term on the cover page, e.g. the Pilot Period."""

    key: str = Field(pattern=r"^[a-z][A-Za-z]*$")
    label: str
    hint: str
    required: bool = False
    # Pre-filled when the document is chosen, e.g. "None".
    default: str = ""
    # Multi-line text (a textarea in the form).
    long: bool = False


class DocumentSpec(_Spec):
    id: str
    name: str
    short_name: str
    description: str
    standard_terms: str
    # Only the Mutual NDA has a cover page template; the others are generated.
    cover_page: str | None = None
    # Role labels for party1 and party2, e.g. ("Provider", "Customer").
    parties: tuple[str, str]
    effective_date_label: str = "Effective Date"
    # Whether the cover page has Governing Law and Chosen Courts. Addenda
    # follow the agreement they supplement instead.
    governing_law: bool
    terms: tuple[Term, ...] = ()


def load_documents(path: Path = DOCUMENTS_PATH) -> dict[str, DocumentSpec]:
    specs = TypeAdapter(list[DocumentSpec]).validate_json(path.read_bytes())
    return {spec.id: spec for spec in specs}


DOCUMENTS = load_documents()

# The document ids, as a type for request validation and Structured Outputs.
DocumentId = Literal[tuple(DOCUMENTS)]  # type: ignore[valid-type]
