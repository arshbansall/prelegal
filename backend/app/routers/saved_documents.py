"""The signed-in user's saved agreements (`/api/documents`).

Not to be confused with app/documents.py, the catalog of agreements that can
be drafted. Each user only sees their own documents: another user's id is
reported as not found.
"""

from fastapi import APIRouter, HTTPException, Response
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.auth import CurrentUser
from app.db import DbSession
from app.documents import DOCUMENTS
from app.models import SavedDocument, User
from app.schemas import DocumentValues, SavedDocumentIn, SavedDocumentOut, SavedDocumentSummary

router = APIRouter(prefix="/api/documents", tags=["documents"])


def title_for(document_id: str, values: DocumentValues) -> str:
    """The parties' companies, e.g. "Acme Corp & Beta LLC", or "Untitled <agreement>" before they're known."""
    companies = [company for party in (values.party1, values.party2) if (company := party.company.strip())]
    return " & ".join(companies) if companies else f"Untitled {DOCUMENTS[document_id].short_name}"


def _apply(document: SavedDocument, body: SavedDocumentIn) -> None:
    document.document_id = body.document_id
    document.title = title_for(body.document_id, body.values)
    document.values = body.values.model_dump(by_alias=True)
    document.messages = [message.model_dump() for message in body.messages]
    document.date_edited = body.date_edited


def _owned(session: Session, user: User, document_id: int) -> SavedDocument:
    document = session.scalar(
        select(SavedDocument).where(SavedDocument.id == document_id, SavedDocument.user_id == user.id)
    )
    if document is None:
        raise HTTPException(404, "Document not found.")
    return document


@router.get("")
def list_documents(user: CurrentUser, session: DbSession) -> list[SavedDocumentSummary]:
    """The user's documents, most recently saved first."""
    documents = session.scalars(
        select(SavedDocument)
        .where(SavedDocument.user_id == user.id)
        .order_by(SavedDocument.updated_at.desc(), SavedDocument.id.desc())
    )
    return [SavedDocumentSummary.model_validate(document) for document in documents]


@router.post("", status_code=201)
def create_document(body: SavedDocumentIn, user: CurrentUser, session: DbSession) -> SavedDocumentOut:
    document = SavedDocument(user_id=user.id)
    _apply(document, body)
    session.add(document)
    session.commit()
    return SavedDocumentOut.model_validate(document)


@router.get("/{document_id}")
def get_document(document_id: int, user: CurrentUser, session: DbSession) -> SavedDocumentOut:
    return SavedDocumentOut.model_validate(_owned(session, user, document_id))


@router.put("/{document_id}")
def update_document(document_id: int, body: SavedDocumentIn, user: CurrentUser, session: DbSession) -> SavedDocumentOut:
    document = _owned(session, user, document_id)
    _apply(document, body)
    session.commit()
    return SavedDocumentOut.model_validate(document)


@router.delete("/{document_id}", status_code=204)
def delete_document(document_id: int, user: CurrentUser, session: DbSession) -> Response:
    session.delete(_owned(session, user, document_id))
    session.commit()
    return Response(status_code=204)
