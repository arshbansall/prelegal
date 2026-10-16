import re
from datetime import date
from typing import Annotated, Any, Literal, Self

from pydantic import BaseModel, ConfigDict, Field, StringConstraints, field_validator, model_validator
from pydantic.alias_generators import to_camel

Email = Annotated[str, StringConstraints(strip_whitespace=True, to_lower=True, min_length=1, max_length=254)]


class LoginRequest(BaseModel):
    email: Email
    password: str = ""


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    email: str


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


def _iso_date_or_none(value: str | None) -> str | None:
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


def _at_most(limit: int):
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

    _check_length = field_validator("*")(_at_most(SHORT_TEXT_MAX))


class NdaUpdates(CamelModel):
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

    _check_date = field_validator("effective_date")(_iso_date_or_none)
    _check_years = field_validator("mnda_term_years", "confidentiality_years")(_years_or_none)
    _check_short = field_validator("governing_law", "jurisdiction")(_at_most(SHORT_TEXT_MAX))
    _check_long = field_validator("purpose", "modifications")(_at_most(LONG_TEXT_MAX))

    def changes(self) -> dict[str, Any]:
        """The changed fields as camelCase JSON, omitting nulls and unchanged parties."""
        data = self.model_dump(by_alias=True, exclude_none=True)
        return {key: value for key, value in data.items() if value != {}}


# --- Chat API -----------------------------------------------------------------


class ChatMessage(CamelModel):
    role: Literal["user", "assistant"]
    content: str = Field(min_length=1, max_length=MESSAGE_MAX)


class ChatRequest(CamelModel):
    messages: list[ChatMessage] = Field(min_length=1, max_length=60)
    values: NdaValues
    # The user's local date; defaults to the server's date.
    today: date | None = None

    @model_validator(mode="after")
    def _ends_with_user_message(self) -> Self:
        if self.messages[-1].role != "user":
            raise ValueError("The last message must be from the user.")
        return self


class ChatResponse(CamelModel):
    reply: str
    # Only the fields the AI changed (a partial NdaValues; see NdaUpdates.changes).
    updates: dict[str, Any]
    # Whether every required field is filled once `updates` are applied.
    complete: bool
