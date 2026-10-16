from datetime import date
from typing import Any

from litellm.llms.base_llm.base_utils import type_to_response_format_param

from app.nda_chat import NdaChatTurn, apply_updates, build_messages, missing_fields
from app.schemas import NdaUpdates, NdaValues, Party, PartyUpdates

UNCHANGED_PARTY = {"name": None, "title": None, "company": None, "notice_address": None}
UNCHANGED = {field: None for field in NdaUpdates.model_fields} | {
    "party1": UNCHANGED_PARTY,
    "party2": UNCHANGED_PARTY,
}


def updates(**changes: Any) -> NdaUpdates:
    return NdaUpdates.model_validate(UNCHANGED | changes)


def complete_values() -> NdaValues:
    signer = {"name": "Ada", "company": "Acme", "notice_address": "ada@acme.com"}
    return NdaValues(
        purpose="Exploring a deal.",
        effective_date="2026-10-16",
        governing_law="Delaware",
        jurisdiction="courts located in New Castle, DE",
        party1=Party(**signer),
        party2=Party(**signer),
    )


def test_apply_updates_merges_fields_and_parties() -> None:
    values = NdaValues(governing_law="Delaware", party1=Party(name="Ada", company="Acme"))

    result = apply_updates(
        values,
        updates(jurisdiction="courts located in Wilmington, DE", party1=PartyUpdates(**UNCHANGED_PARTY | {"title": "CEO"})),
    )

    assert result.governing_law == "Delaware"
    assert result.jurisdiction == "courts located in Wilmington, DE"
    assert result.party1 == Party(name="Ada", title="CEO", company="Acme")
    assert result.party2 == Party()
    assert values.party1.title == ""  # the input is not mutated


def test_apply_updates_clears_fields_set_to_empty_string() -> None:
    result = apply_updates(NdaValues(governing_law="Delaware"), updates(governing_law=""))
    assert result.governing_law == ""


def test_missing_fields() -> None:
    assert missing_fields(complete_values()) == []

    values = complete_values()
    values.party2.notice_address = "  "
    values.governing_law = ""
    assert missing_fields(values) == ["governing law", "Party 2 notice address"]


def test_missing_fields_checks_year_counts_only_when_used() -> None:
    values = complete_values()
    values.mnda_term_years = "0"
    values.confidentiality_years = ""
    assert missing_fields(values) == ["MNDA term length in years", "confidentiality term length in years"]

    values.mnda_term_type = "untilTerminated"
    values.confidentiality_type = "perpetual"
    assert missing_fields(values) == []


def test_build_messages_lists_missing_fields_or_none() -> None:
    [system] = build_messages([], complete_values(), date(2026, 10, 16))
    assert "Required fields still missing: none." in system["content"]

    [system, user] = build_messages([{"role": "user", "content": "Hi"}], NdaValues(), date(2026, 10, 16))
    assert "Required fields still missing: purpose, effective date," in system["content"]
    assert user == {"role": "user", "content": "Hi"}


def test_response_schema_is_strict() -> None:
    """Strict Structured Outputs need every property required and no extras, at every level."""
    schema = type_to_response_format_param(NdaChatTurn)["json_schema"]
    assert schema["strict"] is True

    objects = [schema["schema"], *schema["schema"]["$defs"].values()]
    assert len(objects) == 3  # NdaChatTurn, NdaUpdates, PartyUpdates
    for obj in objects:
        assert obj["additionalProperties"] is False
        assert sorted(obj["required"]) == sorted(obj["properties"])

    update_fields = schema["schema"]["$defs"]["NdaUpdates"]["properties"]
    assert "governingLaw" in update_fields  # camelCase, as in the prompt and the frontend
    assert "noticeAddress" in schema["schema"]["$defs"]["PartyUpdates"]["properties"]
