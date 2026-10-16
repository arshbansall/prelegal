"""Passwords, sign-in sessions and the `CurrentUser` dependency.

Passwords are hashed with scrypt (standard library). Signing in issues an
opaque random bearer token; the browser keeps it and sends it as
`Authorization: Bearer <token>`. Only the token's SHA-256 is stored, in the
`sessions` table, so signing out deletes the row and a leaked database holds
no usable tokens. Sessions end when the server restarts, since the database
is recreated.
"""

import hashlib
import hmac
import secrets
from typing import Annotated

from fastapi import Depends, Header, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db import DbSession
from app.models import AuthSession, User

# scrypt cost parameters: about 50 ms per hash and 16 MB of memory.
_SCRYPT_N, _SCRYPT_R, _SCRYPT_P = 2**14, 8, 1


def _scrypt(password: str, salt: bytes, n: int, r: int, p: int) -> bytes:
    return hashlib.scrypt(password.encode(), salt=salt, n=n, r=r, p=p, dklen=32)


def hash_password(password: str) -> str:
    """A salted hash, stored as `scrypt$n$r$p$salt$hash` (hex) so the cost can be raised later."""
    salt = secrets.token_bytes(16)
    digest = _scrypt(password, salt, _SCRYPT_N, _SCRYPT_R, _SCRYPT_P)
    return f"scrypt${_SCRYPT_N}${_SCRYPT_R}${_SCRYPT_P}${salt.hex()}${digest.hex()}"


def verify_password(password: str, stored: str) -> bool:
    try:
        scheme, n, r, p, salt, digest = stored.split("$")
        if scheme != "scrypt":
            return False
        actual = _scrypt(password, bytes.fromhex(salt), int(n), int(r), int(p))
    except ValueError:
        return False
    return hmac.compare_digest(actual, bytes.fromhex(digest))


# Checked when the email is unknown, so signing in takes as long as with a wrong password.
_UNKNOWN_USER_HASH = hash_password(secrets.token_urlsafe())


def authenticate(session: Session, email: str, password: str) -> User | None:
    """The user with this email and password, or None (without revealing which was wrong)."""
    user = session.scalar(select(User).where(User.email == email))
    if user is None:
        verify_password(password, _UNKNOWN_USER_HASH)
        return None
    return user if verify_password(password, user.password_hash) else None


def hash_token(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


def create_session(session: Session, user: User) -> str:
    """Signs `user` in and returns the new bearer token (committed)."""
    token = secrets.token_urlsafe(32)
    session.add(AuthSession(token_hash=hash_token(token), user_id=user.id))
    session.commit()
    return token


def current_session(session: DbSession, authorization: Annotated[str | None, Header()] = None) -> AuthSession:
    """FastAPI dependency: the sign-in session (and its user) of the request's bearer token, or 401."""
    scheme, _, token = (authorization or "").partition(" ")
    auth_session = (
        session.scalar(select(AuthSession).where(AuthSession.token_hash == hash_token(token)))
        if scheme.lower() == "bearer" and token
        else None
    )
    if auth_session is None:
        raise HTTPException(401, "Please sign in again.", headers={"WWW-Authenticate": "Bearer"})
    return auth_session


def current_user(auth_session: Annotated[AuthSession, Depends(current_session)]) -> User:
    """FastAPI dependency: the signed-in user, or 401."""
    return auth_session.user


CurrentSession = Annotated[AuthSession, Depends(current_session)]
CurrentUser = Annotated[User, Depends(current_user)]
