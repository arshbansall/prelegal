from datetime import date

import pytest
from litellm.llms.base_llm.base_utils import type_to_response_format_param

from app import agreement_chat
from app.documents import DOCUMENTS
from app.drafting import SelectionTurn, apply_updates, build_messages, switch_document, turn_model
from app.schemas import DocumentValues, Party

PILOT = DOCUMENTS["pilot"]


@pytest.mark.parametrize("document_id", [None, *DOCUMENTS])
def test_every_response_schema_is_strict(document_id: str | None) -> None:
    """Strict Structured Outputs need every property required and no extras, at every level."""
    schema = type_to_response_format_param(turn_model(document_id))["json_schema"]
    assert schema["strict"] is True

    objects = [schema["schema"], *schema["schema"].get("$defs", {}).values()]
    for obj in objects:
        assert obj["additionalProperties"] is False
        assert sorted(obj["required"]) == sorted(obj["properties"])
    assert schema["schema"]["properties"]["documentId"]["anyOf"][0]["enum"] == list(DOCUMENTS)


def test_agreement_schema_has_the_terms_and_shared_fields() -> None:
    schema = type_to_response_format_param(turn_model("pilot"))["json_schema"]["schema"]
    updates = schema["$defs"]["PilotUpdates"]["properties"]
    assert list(updates) == ["effectiveDate", "terms", "governingLaw", "jurisdiction", "party1", "party2"]
    assert list(schema["$defs"]["PilotTerms"]["properties"]) == ["product", "pilotPeriod", "generalCapAmount"]
    assert turn_model(None) is SelectionTurn


def complete_pilot() -> DocumentValues:
    signer = {"name": "Ada", "company": "Initech", "notice_address": "ada@initech.com"}
    return DocumentValues(
        effective_date="2026-10-16",
        governing_law="Delaware",
        jurisdiction="courts located in New Castle, DE",
        party1=Party(**signer),
        party2=Party(**signer),
        terms={"product": "Analytics", "pilotPeriod": "60 days", "generalCapAmount": "$10,000"},
    )


def test_missing_fields_uses_the_agreement_labels_and_roles() -> None:
    assert agreement_chat.missing_fields(PILOT, complete_pilot()) == []

    values = complete_pilot()
    values.terms["pilotPeriod"] = " "
    values.jurisdiction = ""
    values.party2.company = ""
    assert agreement_chat.missing_fields(PILOT, values) == ["Pilot Period", "Chosen Courts", "Customer company"]


def test_missing_fields_skips_optional_terms_and_governing_law_for_addenda() -> None:
    baa = DOCUMENTS["baa"]
    missing = agreement_chat.missing_fields(baa, DocumentValues())
    assert missing[:3] == ["BAA Effective Date", "Agreement", "Breach Notification Period"]
    assert "Limitations" not in missing
    assert "Governing Law" not in missing
    assert "Company company" in missing


def test_switch_document_keeps_shared_fields_and_sets_defaults() -> None:
    nda = DocumentValues(
        purpose="Exploring a deal.",
        governing_law="Delaware",
        mnda_term_type="untilTerminated",
        party1=Party(company="Acme"),
        terms={"product": "old"},
    )

    csa = switch_document(nda, "csa")
    assert csa.governing_law == "Delaware"
    assert csa.party1.company == "Acme"
    assert csa.purpose == ""
    assert csa.mnda_term_type == "expires"
    assert csa.terms["dpa"] == "None"
    assert csa.terms["cloudService"] == ""
    assert "product" not in csa.terms

    back = switch_document(csa, "mutual-nda")
    assert back.purpose.startswith("Evaluating whether")
    assert back.terms == {}
    assert back.party1.company == "Acme"


def test_apply_updates_merges_terms() -> None:
    updates_model = turn_model("pilot").model_fields["updates"].annotation
    updates = updates_model.model_validate(
        {
            "effectiveDate": None,
            "terms": {"product": None, "pilotPeriod": "90 days", "generalCapAmount": None},
            "governingLaw": None,
            "jurisdiction": None,
            "party1": {"name": None, "title": "CEO", "company": None, "noticeAddress": None},
            "party2": {"name": None, "title": None, "company": None, "noticeAddress": None},
        }
    )

    result = apply_updates(complete_pilot(), updates)

    assert result.terms == {"product": "Analytics", "pilotPeriod": "90 days", "generalCapAmount": "$10,000"}
    assert result.party1.title == "CEO"
    assert result.party1.company == "Initech"


def test_prompt_describes_the_agreement_fields() -> None:
    [system] = build_messages([], "dpa", switch_document(DocumentValues(), "dpa"), date(2026, 10, 16))
    prompt = system["content"]

    assert "## Current document: Data Processing Agreement" in prompt
    assert "- party1 (the Provider) and party2 (the Customer)" in prompt
    assert '- specialCategoryData (Special Category Data, optional): Any sensitive data' in prompt
    assert 'Default: "None".' in prompt
    assert "governingLaw (Governing Law)" not in prompt
    assert "tell the user the DPA is complete" in prompt


def test_visible_values_shows_only_this_agreements_fields() -> None:
    values = complete_pilot()
    values.purpose = "NDA only"
    values.terms["cloudService"] = "CSA only"

    shown = agreement_chat.visible_values(PILOT, values)

    assert set(shown) == {"effectiveDate", "governingLaw", "jurisdiction", "party1", "party2", "terms"}
    assert set(shown["terms"]) == {"product", "pilotPeriod", "generalCapAmount"}
    assert set(agreement_chat.visible_values(DOCUMENTS["sla"], values)) == {"effectiveDate", "party1", "party2", "terms"}
