"""Calls the real model (OpenRouter → Cerebras). Run with `uv run pytest -m live`."""

import pytest
from fastapi.testclient import TestClient

from app.config import Settings
from app.documents import DOCUMENTS
from app.main import create_app

API_KEY = Settings().openrouter_api_key

pytestmark = [
    pytest.mark.live,
    pytest.mark.skipif(not API_KEY, reason="OPENROUTER_API_KEY is not set"),
]


def test_fills_fields_from_a_conversation(settings: Settings) -> None:
    settings.openrouter_api_key = API_KEY
    messages = [
        {"role": "assistant", "content": "Hi! Who are the two parties, and why are you sharing information?"},
        {
            "role": "user",
            "content": "Acme Corp and Beta LLC are exploring a joint venture. Use Delaware law, with courts "
            "in Wilmington. Confidentiality should last forever.",
        },
    ]
    values = {"effectiveDate": "2026-10-16"}

    with TestClient(create_app(settings)) as client:
        response = client.post(
            "/api/chat",
            json={"messages": messages, "documentId": "mutual-nda", "values": values, "today": "2026-10-16"},
        )

    assert response.status_code == 200, response.text
    body = response.json()
    updates = body["updates"]
    assert body["reply"].strip()
    assert "delaware" in updates["governingLaw"].lower()
    assert "wilmington" in updates["jurisdiction"].lower()
    assert updates["confidentialityType"] == "perpetual"
    companies = {updates.get("party1", {}).get("company"), updates.get("party2", {}).get("company")}
    assert {"Acme Corp", "Beta LLC"} <= companies
    assert body["complete"] is False  # signer details are still missing


def test_reports_complete_once_the_last_details_are_given(settings: Settings) -> None:
    settings.openrouter_api_key = API_KEY
    values = {
        "effectiveDate": "2026-10-16",
        "purpose": "Exploring a joint venture.",
        "governingLaw": "Delaware",
        "jurisdiction": "courts located in Wilmington, DE",
        "party1": {"company": "Acme Corp"},
        "party2": {"company": "Beta LLC"},
    }
    messages = [
        {"role": "assistant", "content": "Who signs for each company, and what are their notice addresses?"},
        {
            "role": "user",
            "content": "Ada Lovelace (CEO, ada@acme.com) signs for Acme. Alan Turing, CTO, signs for Beta; "
            "notices to alan@beta.com.",
        },
    ]

    with TestClient(create_app(settings)) as client:
        response = client.post(
            "/api/chat",
            json={"messages": messages, "documentId": "mutual-nda", "values": values, "today": "2026-10-16"},
        )

    assert response.status_code == 200, response.text
    body = response.json()
    assert body["updates"]["party1"]["name"] == "Ada Lovelace"
    assert body["updates"]["party2"]["noticeAddress"] == "alan@beta.com"
    assert body["complete"] is True


GREETING = {"role": "assistant", "content": "Hi! What kind of agreement do you need, and who are the parties?"}


def post(settings: Settings, text: str, document_id: str | None = None, values: dict | None = None) -> dict:
    settings.openrouter_api_key = API_KEY
    body = {
        "messages": [GREETING, {"role": "user", "content": text}],
        "documentId": document_id,
        "values": values or {"effectiveDate": "2026-10-16"},
        "today": "2026-10-16",
    }
    with TestClient(create_app(settings)) as client:
        response = client.post("/api/chat", json=body)
    assert response.status_code == 200, response.text
    return response.json()


def test_chooses_the_agreement_and_fills_it_in(settings: Settings) -> None:
    body = post(settings, "Initech wants to let Globex trial our analytics product for 60 days before buying.")

    assert body["documentId"] == "pilot"
    updates = body["updates"]
    assert "60" in updates["terms"]["pilotPeriod"]
    companies = {updates.get("party1", {}).get("company"), updates.get("party2", {}).get("company")}
    assert {"Initech", "Globex"} <= companies


def test_offers_the_closest_agreement_for_an_unsupported_one(settings: Settings) -> None:
    body = post(settings, "I need an employment contract for a new software engineer.")

    assert body["documentId"] is None
    assert body["updates"] == {}
    reply = body["reply"].lower()
    assert any(spec.name.lower() in reply for spec in DOCUMENTS.values())  # suggests or lists what we can draft


def test_switches_agreement_on_request(settings: Settings) -> None:
    values = {"effectiveDate": "2026-10-16", "governingLaw": "Delaware", "party1": {"company": "Acme"}}
    body = post(settings, "Actually, we need a Data Processing Agreement instead of an NDA.", "mutual-nda", values)

    assert body["documentId"] == "dpa"
