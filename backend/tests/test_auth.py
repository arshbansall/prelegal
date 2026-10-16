import sqlite3

import pytest
from fastapi.testclient import TestClient

from app.auth import hash_password, hash_token, verify_password
from app.config import Settings
from tests.accounts import PASSWORD, bearer, sign_up


def stored_user(settings: Settings) -> tuple[str, str]:
    with sqlite3.connect(settings.db_path) as conn:
        return conn.execute("SELECT email, password_hash FROM users").fetchone()


def session_hashes(settings: Settings) -> list[str]:
    with sqlite3.connect(settings.db_path) as conn:
        return [row[0] for row in conn.execute("SELECT token_hash FROM sessions")]


# --- Passwords ------------------------------------------------------------------


def test_password_hash_round_trip() -> None:
    stored = hash_password("s3cret-password")

    assert stored.startswith("scrypt$")
    assert "s3cret-password" not in stored
    assert verify_password("s3cret-password", stored)
    assert not verify_password("wrong-password", stored)


def test_password_hashes_are_salted() -> None:
    assert hash_password("same password") != hash_password("same password")


@pytest.mark.parametrize("stored", ["", "plain", "bcrypt$1$2$3$aa$bb", "scrypt$x$8$1$aa$bb", "scrypt$16384$8$1$zz$bb"])
def test_malformed_password_hashes_never_match(stored: str) -> None:
    assert not verify_password("anything", stored)


# --- Sign up --------------------------------------------------------------------


def test_signup_creates_the_account_and_signs_in(client: TestClient, settings: Settings) -> None:
    body = sign_up(client, "  Ada@Acme.com ")

    assert body == {"token": body["token"], "user": {"id": body["user"]["id"], "email": "ada@acme.com"}}
    email, password_hash = stored_user(settings)
    assert email == "ada@acme.com"
    assert verify_password(PASSWORD, password_hash)
    # Only the token's hash is stored.
    assert session_hashes(settings) == [hash_token(body["token"])]
    assert client.get("/api/auth/me", headers=bearer(body["token"])).json() == body["user"]


def test_signup_rejects_an_email_already_registered(client: TestClient) -> None:
    sign_up(client, "ada@acme.com")

    response = client.post("/api/auth/signup", json={"email": "ADA@acme.com", "password": PASSWORD})

    assert response.status_code == 409
    assert response.json() == {"detail": "An account with this email already exists. Sign in instead."}


@pytest.mark.parametrize(
    ("body", "message"),
    [
        ({"email": "not-an-email", "password": PASSWORD}, "Enter a valid email address."),
        ({"email": "   ", "password": PASSWORD}, "Enter a valid email address."),
        ({"email": "ada@acme.com", "password": "short"}, "String should have at least 8 characters"),
        ({"email": "ada@acme.com", "password": " " * 10}, "Choose a password that isn’t only spaces."),
        ({"email": "ada@acme.com", "password": "x" * 129}, "String should have at most 128 characters"),
        ({"password": PASSWORD}, "Field required"),
    ],
)
def test_signup_validates_the_email_and_password(client: TestClient, body: dict, message: str) -> None:
    response = client.post("/api/auth/signup", json=body)

    assert response.status_code == 422
    assert response.json()["detail"][0]["msg"] == message


# --- Sign in and out ------------------------------------------------------------


def test_login_with_the_right_password_issues_a_new_token(client: TestClient) -> None:
    first = sign_up(client)

    response = client.post("/api/auth/login", json={"email": " ADA@acme.com", "password": PASSWORD})

    assert response.status_code == 200
    body = response.json()
    assert body["user"] == first["user"]
    assert body["token"] != first["token"]
    # Both sessions are valid.
    for token in (first["token"], body["token"]):
        assert client.get("/api/auth/me", headers=bearer(token)).status_code == 200


@pytest.mark.parametrize(
    ("email", "password"),
    [("ada@acme.com", "wrong password"), ("nobody@acme.com", PASSWORD)],
)
def test_login_failures_do_not_reveal_whether_the_email_exists(client: TestClient, email: str, password: str) -> None:
    sign_up(client)

    response = client.post("/api/auth/login", json={"email": email, "password": password})

    assert response.status_code == 401
    assert response.json() == {"detail": "Incorrect email or password."}


@pytest.mark.parametrize("password", ["", "x" * 129])
def test_login_validates_the_password_length(client: TestClient, password: str) -> None:
    assert client.post("/api/auth/login", json={"email": "ada@acme.com", "password": password}).status_code == 422


@pytest.mark.parametrize(
    "headers",
    [{}, {"Authorization": "Bearer"}, {"Authorization": "Basic abc"}, {"Authorization": "Bearer not-a-token"}],
)
def test_me_requires_a_valid_token(client: TestClient, headers: dict[str, str]) -> None:
    sign_up(client)

    response = client.get("/api/auth/me", headers=headers)

    assert response.status_code == 401
    assert response.headers["www-authenticate"] == "Bearer"


def test_logout_ends_only_that_session(client: TestClient, settings: Settings) -> None:
    first = sign_up(client)["token"]
    second = client.post("/api/auth/login", json={"email": "ada@acme.com", "password": PASSWORD}).json()["token"]

    assert client.post("/api/auth/logout", headers=bearer(first)).status_code == 204

    assert client.get("/api/auth/me", headers=bearer(first)).status_code == 401
    assert client.get("/api/auth/me", headers=bearer(second)).status_code == 200
    assert session_hashes(settings) == [hash_token(second)]


def test_logout_requires_sign_in(client: TestClient) -> None:
    assert client.post("/api/auth/logout").status_code == 401
