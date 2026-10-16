from collections.abc import Iterator
from pathlib import Path

from fastapi import Request
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

from app.models import Base


def init_db(db_path: Path) -> sessionmaker[Session]:
    """Create a fresh, empty SQLite database at `db_path`.

    The database is temporary by design: any existing file (and its WAL/SHM
    side files) is deleted, then every table is created from the models.
    """
    for suffix in ("", "-wal", "-shm"):
        Path(f"{db_path}{suffix}").unlink(missing_ok=True)
    db_path.parent.mkdir(parents=True, exist_ok=True)

    # check_same_thread=False: FastAPI runs sync endpoints in a thread pool,
    # and each request gets its own session.
    engine = create_engine(f"sqlite:///{db_path}", connect_args={"check_same_thread": False})
    Base.metadata.create_all(engine)
    return sessionmaker(engine, expire_on_commit=False)


def get_session(request: Request) -> Iterator[Session]:
    """FastAPI dependency: a database session for the duration of one request."""
    with request.app.state.sessionmaker() as session:
        yield session
