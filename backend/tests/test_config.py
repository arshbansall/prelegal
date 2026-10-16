from pathlib import Path

import pytest

from app.config import Settings


def test_reads_openrouter_key_without_prefix(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("OPENROUTER_API_KEY", "from-env")
    assert Settings(_env_file=None).openrouter_api_key == "from-env"


def test_reads_openrouter_key_from_env_file(monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> None:
    monkeypatch.delenv("OPENROUTER_API_KEY", raising=False)
    env_file = tmp_path / ".env"
    env_file.write_text("OPENROUTER_API_KEY=from-file\nUNRELATED=ignored\n")

    assert Settings(_env_file=env_file).openrouter_api_key == "from-file"


def test_environment_overrides_env_file(monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> None:
    monkeypatch.setenv("OPENROUTER_API_KEY", "from-env")
    env_file = tmp_path / ".env"
    env_file.write_text("OPENROUTER_API_KEY=from-file\n")

    assert Settings(_env_file=env_file).openrouter_api_key == "from-env"


def test_key_is_optional(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("OPENROUTER_API_KEY", raising=False)
    assert Settings(_env_file=None).openrouter_api_key is None
