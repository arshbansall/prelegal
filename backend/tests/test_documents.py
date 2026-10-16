"""documents.json must stay consistent with catalog.json and the templates it names."""

import json
import re

import pytest

from app.config import REPO_DIR
from app.documents import DOCUMENTS, NDA_ID, DocumentSpec

TEMPLATES_DIR = REPO_DIR / "templates"
CATALOG = json.loads((REPO_DIR / "catalog.json").read_text())

# Variables a template uses that belong to another agreement, so this one's
# cover page doesn't define them.
DEFINED_ELSEWHERE = {"sla": {"Subscription Period"}}  # from the Cloud Service Agreement


def test_every_catalog_template_belongs_to_one_document() -> None:
    used = [spec.standard_terms for spec in DOCUMENTS.values()]
    used += [spec.cover_page for spec in DOCUMENTS.values() if spec.cover_page]
    assert sorted(used) == sorted(entry["filename"] for entry in CATALOG)


def test_ids_and_term_keys_are_unique() -> None:
    assert len(DOCUMENTS) == len(json.loads((REPO_DIR / "documents.json").read_text()))
    for spec in DOCUMENTS.values():
        keys = [term.key for term in spec.terms]
        assert len(keys) == len(set(keys)), spec.id


def test_only_the_nda_uses_a_cover_page_template() -> None:
    assert [spec.id for spec in DOCUMENTS.values() if spec.cover_page] == [NDA_ID]
    assert DOCUMENTS[NDA_ID].terms == ()


def _variables(spec: DocumentSpec) -> set[str]:
    """The variable names a template highlights, e.g. "Pilot Period", without possessives or plurals."""
    text = (TEMPLATES_DIR / spec.standard_terms).read_text()
    names = re.findall(r'<span class="\w+_link">([^<]+)</span>', text)
    return {re.sub(r"(’s|'s|s)$", "", name) for name in names}


@pytest.mark.parametrize("spec", [s for s in DOCUMENTS.values() if s.id != NDA_ID], ids=lambda s: s.id)
def test_cover_page_defines_every_template_variable(spec: DocumentSpec) -> None:
    defined = {term.label for term in spec.terms} | set(spec.parties)
    defined |= {spec.effective_date_label, "Notice Address"}
    if spec.governing_law:
        defined |= {"Governing Law", "Chosen Courts"}
    defined = {re.sub(r"s$", "", name) for name in defined}
    defined |= DEFINED_ELSEWHERE.get(spec.id, set())

    assert _variables(spec) - defined == set()
