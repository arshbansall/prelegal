import re
from datetime import UTC, date, datetime
from typing import Annotated, Any, Literal, Self

from pydantic import (
    AfterValidator,
    BaseModel,
    ConfigDict,
    Field,
    StringConstraints,
    computed_field,
    field_validator,
    model_validator,
)
from pydantic.alias_generators import to_camel
from pydantic_core import PydanticCustomError

from app.documents import DOCUMENTS, DocumentId

# --- Accounts -------------------------------------------------------------------


def _email_address(value: str) -> str:
    if not re.fullmatch(r"[^@\s]+@[^@\s]+\.[^@\s]+", value):
        raise PydanticCustomError("email", "Enter a valid email address.")
    return value


Email = Annotated[
    str,
    StringConstraints(strip_whitespace=True, to_lower=True, max_length=254),
    AfterValidator(_email_address),
]

PASSWORD_MIN = 8
PASSWORD_MAX = 128


class LoginRequest(BaseModel):
    email: Email
    password: str = Field(min_length=1, max_length=PASSWORD_MAX)


class SignupRequest(LoginRequest):
    password: str = Field(min_length=PASSWORD_MIN, max_length=PASSWORD_MAX)

    @field_validator("password")
    @classmethod
    def _not_blank(cls, password: str) -> str:
        if not password.strip():
            raise PydanticCustomError("password", "Choose a password that isn’t only spaces.")
        return password


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    email: str


class AuthOut(BaseModel):
    """A new sign-in: the bearer token for later requests, and the user."""

    token: str
    user: UserOut


class CamelModel(BaseModel):
    """Uses camelCase JSON keys, matching the frontend's types (e.g. `NdaValues`)."""

    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)


# --- Mutual NDA values (mirrors NdaValues in frontend/src/lib/nda.ts) --------

# Length limits for document fields and chat messages. The frontend applies the
# same limits (frontend/src/lib/nda.ts and lib/chat.ts).
SHORT_TEXT_MAX = 500
LONG_TEXT_MAX = 4000
MESSAGE_MAX = 4000

ShortText = Annotated[str, Field(max_length=SHORT_TEXT_MAX)]
LongText = Annotated[str, Field(max_length=LONG_TEXT_MAX)]
MndaTermType = Literal["expires", "untilTerminated"]
ConfidentialityType = Literal["years", "perpetual"]


class Party(CamelModel):
    name: ShortText = ""
    title: ShortText = ""
    company: ShortText = ""
    notice_address: ShortText = ""


class NdaValues(CamelModel):
    """The document as the user currently sees it. Blank strings are unfilled."""

    purpose: LongText = ""
    effective_date: ShortText = ""
    mnda_term_type: MndaTermType = "expires"
    mnda_term_years: ShortText = "1"
    confidentiality_type: ConfidentialityType = "years"
    confidentiality_years: ShortText = "1"
    governing_law: ShortText = ""
    jurisdiction: ShortText = ""
    modifications: LongText = ""
    party1: Party = Party()
    party2: Party = Party()


TermKey = Annotated[str, Field(pattern=r"^[a-z][A-Za-z]*$", max_length=50)]


class DocumentValues(NdaValues):
    """The document being drafted (mirrors DocumentValues in frontend/src/lib/documents.ts).

    The parties, effective date, governing law and jurisdiction are shared by
    every agreement; the other NDA fields apply only to the NDA, and `terms`
    holds the key terms of the other agreements (see documents.json).
    """

    terms: dict[TermKey, LongText] = Field(default={}, max_length=50)


# DocumentValues fields every agreement has, kept when the user switches agreements.
SHARED_FIELDS = frozenset({"party1", "party2", "effective_date", "governing_law", "jurisdiction"})


def iso_date_or_none(value: str | None) -> str | None:
    if value in (None, ""):
        return value
    try:
        return date.fromisoformat(value).isoformat()
    except ValueError:
        return None


def is_valid_years(value: str) -> bool:
    """Same rule as the frontend's isValidYears: a whole number from 1 to 999."""
    return re.fullmatch(r"[1-9]\d{0,2}", value.strip()) is not None


def _years_or_none(value: str | None) -> str | None:
    return value.strip() if value is not None and is_valid_years(value) else None


def at_most(limit: int):
    def check(value: str | None) -> str | None:
        return value if value is None or len(value) <= limit else None

    return check


# Every field is required but nullable, as strict Structured Outputs require:
# null means "unchanged" and "" clears the field. Invalid dates and year counts
# from the model are dropped (treated as unchanged) rather than failing the turn,
# as are values too long for NdaValues.
# The party objects themselves are not nullable: given that option, the model
# sometimes nulls a whole party instead of filling in a company it was told.


class PartyUpdates(CamelModel):
    name: str | None
    title: str | None
    company: str | None
    notice_address: str | None

    _check_length = field_validator("*")(at_most(SHORT_TEXT_MAX))


class Updates(CamelModel):
    """Base for each agreement's updates model (NdaUpdates, and the generated ones in agreement_chat)."""

    def changes(self) -> dict[str, Any]:
        """The changed fields as camelCase JSON, omitting nulls and unchanged parties or terms."""
        data = self.model_dump(by_alias=True, exclude_none=True)
        return {key: value for key, value in data.items() if value != {}}


class NdaUpdates(Updates):
    purpose: str | None
    effective_date: str | None = Field(description="yyyy-mm-dd")
    mnda_term_type: MndaTermType | None
    mnda_term_years: str | None = Field(description="Whole number of years, e.g. 2")
    confidentiality_type: ConfidentialityType | None
    confidentiality_years: str | None = Field(description="Whole number of years, e.g. 2")
    governing_law: str | None
    jurisdiction: str | None
    modifications: str | None
    party1: PartyUpdates
    party2: PartyUpdates

    _check_date = field_validator("effective_date")(iso_date_or_none)
    _check_years = field_validator("mnda_term_years", "confidentiality_years")(_years_or_none)
    _check_short = field_validator("governing_law", "jurisdiction")(at_most(SHORT_TEXT_MAX))
    _check_long = field_validator("purpose", "modifications")(at_most(LONG_TEXT_MAX))


class Turn(CamelModel):
    """Base for what the model returns each turn (via Structured Outputs).

    Subclasses declare `updates` (if any) and then `reply`, so the model
    decides on the document first, then extracts the user's values, and only
    then writes its reply; extracting before replying makes it more reliable
    at capturing all of them.
    """

    document_id: DocumentId | None = Field(
        description="An agreement's id, only to start or switch to it; otherwise null"
    )

    @field_validator("reply", check_fields=False)
    @classmethod
    def _usable_reply(cls, reply: str) -> str:
        """The reply joins the conversation the client sends back, so it must be a valid message."""
        reply = reply.strip()
        if not reply:
            raise ValueError("The reply is empty.")
        return reply[:MESSAGE_MAX]


# --- Chat API -----------------------------------------------------------------


class ChatMessage(CamelModel):
    role: Literal["user", "assistant"]
    content: str = Field(min_length=1, max_length=MESSAGE_MAX)


class ChatRequest(CamelModel):
    messages: list[ChatMessage] = Field(min_length=1, max_length=60)
    # The agreement being drafted; None until the user has chosen one.
    document_id: DocumentId | None = None
    values: DocumentValues
    # The user's local date; defaults to the server's date.
    today: date | None = None

    @model_validator(mode="after")
    def _ends_with_user_message(self) -> Self:
        if self.messages[-1].role != "user":
            raise ValueError("The last message must be from the user.")
        return self


class ChatResponse(CamelModel):
    reply: str
    # The agreement being drafted after this turn. When it differs from the
    # request's, the client switches first (keeping the shared fields), then
    # applies `updates`.
    document_id: str | None
    # Only the fields the AI changed (a partial DocumentValues).
    updates: dict[str, Any]
    # Whether every required field is filled once `updates` are applied.
    complete: bool


# --- Saved documents ----------------------------------------------------------------


def _as_utc(value: datetime) -> datetime:
    # SQLite returns naive datetimes; they are stored in UTC.
    return value if value.tzinfo else value.replace(tzinfo=UTC)


UtcDatetime = Annotated[datetime, AfterValidator(_as_utc)]

# Enough for a long drafting conversation; the chat sends only the latest 40 to the AI.
SAVED_MESSAGES_MAX = 200


class SavedDocumentIn(CamelModel):
    """What the browser saves: enough to resume drafting where the user left off."""

    document_id: DocumentId
    values: DocumentValues
    messages: list[ChatMessage] = Field(default=[], max_length=SAVED_MESSAGES_MAX)
    # Whether the effective date was set (otherwise it follows today's date).
    date_edited: bool = False


class SavedDocumentSummary(CamelModel):
    """Read from a SavedDocument row."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    document_id: str
    # Derived from the parties, e.g. "Acme Corp & Beta LLC" (see saved_documents.title_for).
    title: str
    created_at: UtcDatetime
    updated_at: UtcDatetime

    @computed_field
    @property
    def document_name(self) -> str:
        """The agreement's name, e.g. "Mutual Non-Disclosure Agreement"."""
        return DOCUMENTS[self.document_id].name


class SavedDocumentOut(SavedDocumentSummary):
    values: DocumentValues
    messages: list[ChatMessage]
    date_edited: bool
