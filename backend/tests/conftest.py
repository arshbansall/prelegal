from collections.abc import Iterator
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.config import Settings
from app.main import create_app
from tests.accounts import sign_in_new_user


@pytest.fixture
def settings(tmp_path: Path) -> Settings:
    """Settings pointing at a temporary database and a fake frontend build."""
    static_dir = tmp_path / "static"
    (static_dir / "login").mkdir(parents=True)
    (static_dir / "index.html").write_text("<h1>app</h1>")
    (static_dir / "login" / "index.html").write_text("<h1>login</h1>")
    (static_dir / "404.html").write_text("<h1>not found</h1>")
    # _env_file=None keeps a developer's real .env (and API key) out of tests.
    return Settings(
        _env_file=None,
        db_path=tmp_path / "data" / "prelegal.db",
        static_dir=static_dir,
        openrouter_api_key="test-key",
    )


@pytest.fixture
def client(settings: Settings) -> Iterator[TestClient]:
    # Entering the context runs the app's lifespan, which creates the database.
    with TestClient(create_app(settings)) as client:
        yield client


@pytest.fixture
def auth_client(client: TestClient) -> TestClient:
    """`client`, signed in as a new user (ada@acme.com)."""
    return sign_in_new_user(client)
