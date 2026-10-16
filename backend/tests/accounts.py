"""Helpers for tests that need a signed-in user."""

from collections.abc import Iterator
from contextlib import contextmanager
from typing import Any

from fastapi.testclient import TestClient

from app.config import Settings
from app.main import create_app

PASSWORD = "correct horse battery"


def sign_up(client: TestClient, email: str = "ada@acme.com", password: str = PASSWORD) -> dict[str, Any]:
    """Creates an account and returns the response (`{token, user}`)."""
    response = client.post("/api/auth/signup", json={"email": email, "password": password})
    assert response.status_code == 201, response.text
    return response.json()


def bearer(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def sign_in_new_user(client: TestClient, email: str = "ada@acme.com") -> TestClient:
    """Signs up `email` and sends its token with every later request from `client`."""
    client.headers.update(bearer(sign_up(client, email)["token"]))
    return client


@contextmanager
def signed_in_client(settings: Settings) -> Iterator[TestClient]:
    """A client for an app built from `settings`, signed in as a new user."""
    with TestClient(create_app(settings)) as client:
        yield sign_in_new_user(client)
