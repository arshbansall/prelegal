"""The drafting conversation for every agreement except the Mutual NDA.

Each agreement's cover page fields come from its entry in documents.json: the
shared fields (parties, effective date and, unless it is an addendum,
governing law and chosen courts) plus its key `terms`. Its Structured Outputs
schema is generated from the same entry.
"""

from functools import cache
from typing import Any

from pydantic import ConfigDict, Field, create_model, field_validator

from app.documents import DOCUMENTS, DocumentSpec, Term
from app.schemas import (
    LONG_TEXT_MAX,
    SHARED_FIELDS,
    SHORT_TEXT_MAX,
    DocumentValues,
    PartyUpdates,
    Turn,
    Updates,
    at_most,
    iso_date_or_none,
)


def _pascal(document_id: str) -> str:
    return "".join(part.capitalize() for part in document_id.split("-"))


@cache
def turn_model(document_id: str) -> type[Turn]:
    """The reply schema for one agreement: `documentId`, `updates` (its fields), then `reply`.

    Like NdaUpdates, every field is required but nullable (null = unchanged),
    and invalid or over-long values are dropped rather than failing the turn.
    """
    spec = DOCUMENTS[document_id]
    name = _pascal(document_id)

    # Term keys are already camelCase, so this model has no alias generator.
    terms = create_model(
        f"{name}Terms",
        __config__=ConfigDict(extra="forbid"),
        __validators__={
            f"_check_{term.key}": field_validator(term.key)(at_most(LONG_TEXT_MAX if term.long else SHORT_TEXT_MAX))
            for term in spec.terms
        },
        **{term.key: (str | None, ...) for term in spec.terms},
    )

    fields: dict[str, Any] = {
        "effective_date": (str | None, Field(description="yyyy-mm-dd")),
        "terms": (terms, ...),
    }
    validators: dict[str, Any] = {"_check_date": field_validator("effective_date")(iso_date_or_none)}
    if spec.governing_law:
        fields |= {"governing_law": (str | None, ...), "jurisdiction": (str | None, ...)}
        validators["_check_law"] = field_validator("governing_law", "jurisdiction")(at_most(SHORT_TEXT_MAX))
    fields |= {"party1": (PartyUpdates, ...), "party2": (PartyUpdates, ...)}

    updates = create_model(f"{name}Updates", __base__=Updates, __validators__=validators, **fields)
    return create_model(f"{name}Turn", __base__=Turn, updates=(updates, ...), reply=(str, ...))


def missing_fields(spec: DocumentSpec, values: DocumentValues) -> list[str]:
    """Labels of the required fields that are still blank. Party titles are optional."""
    required = [(spec.effective_date_label, values.effective_date)]
    required += [(term.label, values.terms.get(term.key, "")) for term in spec.terms if term.required]
    if spec.governing_law:
        required += [("Governing Law", values.governing_law), ("Chosen Courts", values.jurisdiction)]
    for role, party in zip(spec.parties, (values.party1, values.party2)):
        required += [
            (f"{role} signer's name", party.name),
            (f"{role} company", party.company),
            (f"{role} notice address", party.notice_address),
        ]
    return [label for label, value in required if not value.strip()]


def visible_values(spec: DocumentSpec, values: DocumentValues) -> dict[str, Any]:
    """The values that appear on this agreement's cover page, as camelCase JSON."""
    shown = SHARED_FIELDS if spec.governing_law else SHARED_FIELDS - {"governing_law", "jurisdiction"}
    data = values.model_dump(by_alias=True, include=shown)
    data["terms"] = {term.key: values.terms.get(term.key, "") for term in spec.terms}
    return data


def _describe(term: Term) -> str:
    optional = "" if term.required else ", optional"
    default = f' Default: "{term.default}".' if term.default else ""
    return f"  - {term.key} ({term.label}{optional}): {term.hint}{default}"


def describe_fields(spec: DocumentSpec) -> str:
    """The cover page fields, for the system prompt."""
    lines = [
        f"This is a cover page for the Common Paper {spec.name}. Its Standard Terms refer "
        "to these fields by the names in parentheses.",
        "",
        "### Cover page fields",
        f"- effectiveDate ({spec.effective_date_label}): yyyy-mm-dd. It defaults to today. "
        "Convert relative dates (\"next Monday\") using today's date.",
        "- terms: the agreement's key terms. Fill in the required ones; offer the optional ones "
        "once those are done.",
        *(_describe(term) for term in spec.terms),
    ]
    if spec.governing_law:
        lines += [
            '- governingLaw (Governing Law): the US state whose law governs, e.g. "Delaware".',
            "- jurisdiction (Chosen Courts): the courts for disputes, written as \"courts located in "
            '<city or county>, <state abbreviation>", e.g. "courts located in New Castle, DE".',
        ]
    party1, party2 = spec.parties
    lines += [
        f"- party1 (the {party1}) and party2 (the {party2}), each with: name (the person "
        "signing), title (their job title), company, and noticeAddress (an email or postal "
        "address for legal notices). As soon as the user names the companies, fill in both "
        "party1.company and party2.company.",
        "",
        "A good order to ask in: the parties and what the agreement is for, then the key terms"
        + (", then governing law and courts" if spec.governing_law else "")
        + ", then each party's signer details.",
    ]
    return "\n".join(lines)
