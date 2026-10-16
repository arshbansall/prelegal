from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db import get_session
from app.models import User
from app.schemas import LoginRequest, UserOut

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/login")
def login(body: LoginRequest, session: Annotated[Session, Depends(get_session)]) -> UserOut:
    """Placeholder sign-in (PL-8): accepts any password and signs the user in by email.

    The user is created on first sign-in. No password is checked or stored and
    no token is issued; real authentication replaces this in a later ticket.
    """
    user = session.scalar(select(User).where(User.email == body.email))
    if user is None:
        user = User(email=body.email)
        session.add(user)
        session.commit()
    return UserOut.model_validate(user)
