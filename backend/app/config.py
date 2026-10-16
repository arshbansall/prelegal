from pathlib import Path

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict

BACKEND_DIR = Path(__file__).resolve().parent.parent
REPO_DIR = BACKEND_DIR.parent


class Settings(BaseSettings):
    """Runtime configuration, read from PRELEGAL_* environment variables.

    The defaults suit local development from a checkout; the Docker image
    overrides both paths. The repository's .env file is also read, so local
    development picks up OPENROUTER_API_KEY; in Docker it is passed with
    --env-file instead (environment variables take precedence over the file).
    """

    model_config = SettingsConfigDict(
        env_prefix="PRELEGAL_",
        env_file=REPO_DIR / ".env",
        extra="ignore",
        populate_by_name=True,
    )

    # SQLite database. It is deleted and recreated every time the app starts.
    db_path: Path = BACKEND_DIR / "data" / "prelegal.db"
    # The statically exported frontend (`npm run build` in frontend/).
    static_dir: Path = REPO_DIR / "frontend" / "out"
    # OpenRouter key for the AI chat. Named without the PRELEGAL_ prefix, as in .env.
    openrouter_api_key: str | None = Field(default=None, validation_alias="OPENROUTER_API_KEY")
