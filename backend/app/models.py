from datetime import UTC, datetime
from typing import Any

from sqlalchemy import JSON, ForeignKey, String
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship


def _now() -> datetime:
    return datetime.now(UTC)


class Base(DeclarativeBase):
    pass


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    email: Mapped[str] = mapped_column(String(254), unique=True, index=True)
    # scrypt hash with its salt and parameters (see app/auth.py).
    password_hash: Mapped[str] = mapped_column(String(300))
    created_at: Mapped[datetime] = mapped_column(default=_now)


class AuthSession(Base):
    """A signed-in browser. Only the SHA-256 of its bearer token is stored."""

    __tablename__ = "sessions"

    id: Mapped[int] = mapped_column(primary_key=True)
    token_hash: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    created_at: Mapped[datetime] = mapped_column(default=_now)

    # Loaded with the session, since every authenticated request needs both.
    user: Mapped[User] = relationship(lazy="joined")


class SavedDocument(Base):
    """An agreement a user saved: its values and the chat that drafted it, so it can be resumed."""

    __tablename__ = "documents"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    # The agreement's id in documents.json, e.g. "mutual-nda".
    document_id: Mapped[str] = mapped_column(String(50))
    title: Mapped[str] = mapped_column(String(300))
    # A DocumentValues and a list of ChatMessages, as camelCase JSON.
    values: Mapped[dict[str, Any]] = mapped_column(JSON)
    messages: Mapped[list[dict[str, Any]]] = mapped_column(JSON)
    # Whether the effective date was set by hand (otherwise it follows today).
    date_edited: Mapped[bool] = mapped_column(default=False)
    created_at: Mapped[datetime] = mapped_column(default=_now)
    updated_at: Mapped[datetime] = mapped_column(default=_now, onupdate=_now)
