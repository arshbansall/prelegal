from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

BACKEND_DIR = Path(__file__).resolve().parent.parent
REPO_DIR = BACKEND_DIR.parent


class Settings(BaseSettings):
    """Runtime configuration, read from PRELEGAL_* environment variables.

    The defaults suit local development from a checkout; the Docker image
    overrides both paths.
    """

    model_config = SettingsConfigDict(env_prefix="PRELEGAL_")

    # SQLite database. It is deleted and recreated every time the app starts.
    db_path: Path = BACKEND_DIR / "data" / "prelegal.db"
    # The statically exported frontend (`npm run build` in frontend/).
    static_dir: Path = REPO_DIR / "frontend" / "out"
