"""Calls the real model (OpenRouter → Cerebras). Run with `uv run pytest -m live`."""

import pytest
from fastapi.testclient import TestClient

from app.config import Settings
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
        response = client.post("/api/chat", json={"messages": messages, "values": values, "today": "2026-10-16"})

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
        response = client.post("/api/chat", json={"messages": messages, "values": values, "today": "2026-10-16"})

    assert response.status_code == 200, response.text
    body = response.json()
    assert body["updates"]["party1"]["name"] == "Ada Lovelace"
    assert body["updates"]["party2"]["noticeAddress"] == "alan@beta.com"
    assert body["complete"] is True
