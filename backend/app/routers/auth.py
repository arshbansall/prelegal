from fastapi import APIRouter, HTTPException, Response
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.auth import CurrentSession, CurrentUser, authenticate, create_session, hash_password
from app.db import DbSession
from app.models import User
from app.schemas import AuthOut, LoginRequest, SignupRequest, UserOut

router = APIRouter(prefix="/api/auth", tags=["auth"])


def _signed_in(session: Session, user: User) -> AuthOut:
    return AuthOut(token=create_session(session, user), user=UserOut.model_validate(user))


@router.post("/signup", status_code=201)
def signup(body: SignupRequest, session: DbSession) -> AuthOut:
    """Creates an account and signs it in."""
    user = User(email=body.email, password_hash=hash_password(body.password))
    session.add(user)
    try:
        session.commit()
    except IntegrityError:  # The email is taken (the column is unique).
        session.rollback()
        raise HTTPException(409, "An account with this email already exists. Sign in instead.") from None
    return _signed_in(session, user)


@router.post("/login")
def login(body: LoginRequest, session: DbSession) -> AuthOut:
    user = authenticate(session, body.email, body.password)
    if user is None:
        raise HTTPException(401, "Incorrect email or password.")
    return _signed_in(session, user)


@router.get("/me")
def me(user: CurrentUser) -> UserOut:
    """The signed-in user; 401 if the token is unknown (e.g. after the server restarted)."""
    return UserOut.model_validate(user)


@router.post("/logout", status_code=204)
def logout(auth_session: CurrentSession, session: DbSession) -> Response:
    """Ends this sign-in session; the user's other sessions are unaffected."""
    session.delete(auth_session)
    session.commit()
    return Response(status_code=204)
