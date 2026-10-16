from datetime import datetime
from typing import Any

import pytest
from fastapi.testclient import TestClient

from app.routers.saved_documents import title_for
from app.schemas import DocumentValues
from tests.accounts import bearer, sign_up

MESSAGES = [
    {"role": "assistant", "content": "Hi! What do you need?"},
    {"role": "user", "content": "An NDA between Acme Corp and Beta LLC."},
]


def nda(**values: Any) -> dict[str, Any]:
    return {
        "documentId": "mutual-nda",
        "values": {"party1": {"company": "Acme Corp"}, "party2": {"company": "Beta LLC"}, **values},
        "messages": MESSAGES,
        "dateEdited": True,
    }


def save(client: TestClient, body: dict[str, Any] | None = None) -> dict[str, Any]:
    response = client.post("/api/documents", json=body or nda())
    assert response.status_code == 201, response.text
    return response.json()


def test_documents_require_sign_in(client: TestClient) -> None:
    for method, path in [("GET", ""), ("POST", ""), ("GET", "/1"), ("PUT", "/1"), ("DELETE", "/1")]:
        response = client.request(method, f"/api/documents{path}", json=nda())
        assert response.status_code == 401, (method, path)


def test_saves_and_returns_the_document(auth_client: TestClient) -> None:
    saved = save(auth_client, nda(purpose="Exploring a partnership.", effectiveDate="2026-11-01"))

    assert saved["id"] > 0
    assert saved["documentId"] == "mutual-nda"
    assert saved["documentName"] == "Mutual Non-Disclosure Agreement"
    assert saved["title"] == "Acme Corp & Beta LLC"
    assert saved["messages"] == MESSAGES
    assert saved["dateEdited"] is True
    # Values are stored as a complete DocumentValues, defaults included.
    assert saved["values"]["purpose"] == "Exploring a partnership."
    assert saved["values"]["effectiveDate"] == "2026-11-01"
    assert saved["values"]["mndaTermType"] == "expires"
    assert saved["values"]["party1"] == {"name": "", "title": "", "company": "Acme Corp", "noticeAddress": ""}
    # Timestamps are UTC.
    assert datetime.fromisoformat(saved["createdAt"]).utcoffset().total_seconds() == 0

    assert auth_client.get(f"/api/documents/{saved['id']}").json() == saved


def test_lists_summaries_most_recently_saved_first(auth_client: TestClient) -> None:
    first = save(auth_client)
    second = save(auth_client, {"documentId": "pilot", "values": {"terms": {"product": "Analytics"}}})
    # Updating the first moves it to the top.
    auth_client.put(f"/api/documents/{first['id']}", json=nda(purpose="Updated."))

    documents = auth_client.get("/api/documents").json()

    assert [document["id"] for document in documents] == [first["id"], second["id"]]
    assert documents[1] == {
        "id": second["id"],
        "documentId": "pilot",
        "documentName": "Pilot Agreement",
        "title": "Untitled Pilot Agreement",
        "createdAt": second["createdAt"],
        "updatedAt": second["updatedAt"],
    }


def test_update_replaces_the_document(auth_client: TestClient) -> None:
    saved = save(auth_client)
    changed = {
        "documentId": "pilot",
        "values": {"party1": {"company": "Initech"}, "terms": {"product": "Analytics"}},
        "messages": [*MESSAGES, {"role": "assistant", "content": "Switched to the pilot."}],
        "dateEdited": False,
    }

    response = auth_client.put(f"/api/documents/{saved['id']}", json=changed)

    assert response.status_code == 200
    body = response.json()
    assert body["id"] == saved["id"]
    assert body["documentId"] == "pilot"
    assert body["title"] == "Initech"
    assert body["values"]["terms"] == {"product": "Analytics"}
    assert body["messages"] == changed["messages"]
    assert body["dateEdited"] is False
    assert body["createdAt"] == saved["createdAt"]
    assert body["updatedAt"] >= saved["updatedAt"]
    assert len(auth_client.get("/api/documents").json()) == 1


def test_delete_removes_the_document(auth_client: TestClient) -> None:
    saved = save(auth_client)

    assert auth_client.delete(f"/api/documents/{saved['id']}").status_code == 204

    assert auth_client.get(f"/api/documents/{saved['id']}").status_code == 404
    assert auth_client.get("/api/documents").json() == []


def test_users_only_see_their_own_documents(auth_client: TestClient) -> None:
    saved = save(auth_client)
    other = bearer(sign_up(auth_client, "alan@beta.com")["token"])

    assert auth_client.get("/api/documents", headers=other).json() == []
    for method in ("GET", "PUT", "DELETE"):
        response = auth_client.request(method, f"/api/documents/{saved['id']}", json=nda(), headers=other)
        assert response.status_code == 404, method
        assert response.json() == {"detail": "Document not found."}
    # The owner's document is untouched.
    assert auth_client.get(f"/api/documents/{saved['id']}").json() == saved


def test_unknown_document_is_not_found(auth_client: TestClient) -> None:
    assert auth_client.get("/api/documents/999").status_code == 404
    assert auth_client.put("/api/documents/999", json=nda()).status_code == 404


@pytest.mark.parametrize(
    "body",
    [
        {**nda(), "documentId": "no-such-agreement"},
        {**nda(), "documentId": None},
        {**nda(), "values": {"purpose": "x" * 4001}},
        {**nda(), "messages": [{"role": "system", "content": "Hi"}]},
        {**nda(), "messages": [{"role": "user", "content": "Hi"}] * 201},
    ],
)
def test_rejects_invalid_documents(auth_client: TestClient, body: dict[str, Any]) -> None:
    assert auth_client.post("/api/documents", json=body).status_code == 422


@pytest.mark.parametrize(
    ("values", "title"),
    [
        ({"party1": {"company": "Acme Corp"}, "party2": {"company": "Beta LLC"}}, "Acme Corp & Beta LLC"),
        ({"party2": {"company": "  Beta LLC "}}, "Beta LLC"),
        ({"party1": {"company": "   "}}, "Untitled Mutual NDA"),
    ],
)
def test_title_comes_from_the_parties(values: dict[str, Any], title: str) -> None:
    assert title_for("mutual-nda", DocumentValues.model_validate(values)) == title
