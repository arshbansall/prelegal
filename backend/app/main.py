from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException
from fastapi.staticfiles import StaticFiles

from app.config import Settings
from app.db import init_db
from app.routers import auth, chat, health


def create_app(settings: Settings | None = None) -> FastAPI:
    settings = settings or Settings()

    @asynccontextmanager
    async def lifespan(app: FastAPI) -> AsyncIterator[None]:
        app.state.sessionmaker = init_db(settings.db_path)
        yield

    app = FastAPI(title="Prelegal", lifespan=lifespan)
    app.state.settings = settings
    app.include_router(health.router)
    app.include_router(auth.router)
    app.include_router(chat.router)

    @app.api_route("/api/{path:path}", methods=["GET", "POST", "PUT", "PATCH", "DELETE"], include_in_schema=False)
    def api_not_found(path: str) -> None:
        """Unknown API paths get a JSON 404 rather than the frontend's HTML page."""
        raise HTTPException(status_code=404, detail="Not found")

    # Mounted last so the API routes above take precedence. html=True serves
    # index.html for directories (e.g. /login/) and 404.html for unknown paths.
    if settings.static_dir.is_dir():
        app.mount("/", StaticFiles(directory=settings.static_dir, html=True), name="frontend")

    return app


app = create_app()
