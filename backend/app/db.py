from collections.abc import Iterator
from pathlib import Path
from typing import Annotated

from fastapi import Depends, Request
from sqlalchemy import create_engine, event
from sqlalchemy.orm import Session, sessionmaker

from app.models import Base


def _enable_foreign_keys(dbapi_connection, _connection_record) -> None:
    """SQLite only enforces foreign keys when asked to, per connection."""
    dbapi_connection.execute("PRAGMA foreign_keys=ON")


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
    event.listen(engine, "connect", _enable_foreign_keys)
    Base.metadata.create_all(engine)
    return sessionmaker(engine, expire_on_commit=False)


def get_session(request: Request) -> Iterator[Session]:
    """FastAPI dependency: a database session for the duration of one request."""
    with request.app.state.sessionmaker() as session:
        yield session


DbSession = Annotated[Session, Depends(get_session)]
