import sqlite3

from fastapi.testclient import TestClient

from app.config import Settings
from app.main import create_app


def user_rows(settings: Settings) -> list[tuple[int, str]]:
    with sqlite3.connect(settings.db_path) as conn:
        return conn.execute("SELECT id, email FROM users ORDER BY id").fetchall()


def test_health(client: TestClient) -> None:
    response = client.get("/api/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_login_creates_user(client: TestClient, settings: Settings) -> None:
    response = client.post("/api/auth/login", json={"email": "ada@acme.com", "password": "secret"})

    assert response.status_code == 200
    body = response.json()
    assert body == {"id": body["id"], "email": "ada@acme.com"}
    assert user_rows(settings) == [(body["id"], "ada@acme.com")]


def test_login_accepts_any_password(client: TestClient) -> None:
    for password in ["", "x", "something else entirely"]:
        response = client.post("/api/auth/login", json={"email": "ada@acme.com", "password": password})
        assert response.status_code == 200


def test_login_reuses_existing_user_and_normalizes_email(client: TestClient, settings: Settings) -> None:
    first = client.post("/api/auth/login", json={"email": "ada@acme.com", "password": "a"}).json()
    second = client.post("/api/auth/login", json={"email": "  ADA@Acme.com ", "password": "b"}).json()

    assert second == first
    assert len(user_rows(settings)) == 1


def test_login_requires_email(client: TestClient) -> None:
    for body in [{"email": "   ", "password": "x"}, {"password": "x"}]:
        assert client.post("/api/auth/login", json=body).status_code == 422


def test_database_is_recreated_on_startup(settings: Settings) -> None:
    with TestClient(create_app(settings)) as client:
        client.post("/api/auth/login", json={"email": "ada@acme.com", "password": "x"})
    assert len(user_rows(settings)) == 1

    with TestClient(create_app(settings)):
        assert user_rows(settings) == []


def test_unknown_api_path_returns_json_404(client: TestClient) -> None:
    response = client.get("/api/does-not-exist")
    assert response.status_code == 404
    assert response.json() == {"detail": "Not found"}


def test_serves_frontend_pages(client: TestClient) -> None:
    assert client.get("/").text == "<h1>app</h1>"
    assert client.get("/login/").text == "<h1>login</h1>"
    # Without the trailing slash, StaticFiles redirects to the directory URL.
    assert client.get("/login").text == "<h1>login</h1>"

    missing = client.get("/no-such-page/")
    assert missing.status_code == 404
    assert missing.text == "<h1>not found</h1>"


def test_runs_without_frontend_build(settings: Settings, tmp_path) -> None:
    settings.static_dir = tmp_path / "missing"
    with TestClient(create_app(settings)) as client:
        assert client.get("/api/health").status_code == 200
        assert client.get("/").status_code == 404
