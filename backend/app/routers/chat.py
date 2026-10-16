import logging
from datetime import date

from fastapi import APIRouter, HTTPException, Request

from app import drafting, llm
from app.auth import CurrentUser
from app.config import Settings
from app.schemas import ChatRequest, ChatResponse

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api", tags=["chat"])


@router.post("/chat")
def chat(body: ChatRequest, request: Request, _user: CurrentUser) -> ChatResponse:
    """One turn of the drafting conversation (signed-in users only).

    Stateless: the client sends the whole conversation, the agreement being
    drafted and its current values, and gets back the assistant's reply, the
    agreement (which the AI may have started or switched) and the fields it changed.
    """
    settings: Settings = request.app.state.settings
    history = [message.model_dump() for message in body.messages]

    try:
        return drafting.run_turn(
            history,
            body.document_id,
            body.values,
            body.today or date.today(),
            api_key=settings.openrouter_api_key,
        )
    except llm.LLMUnavailable:
        raise HTTPException(503, "The AI assistant isn’t set up: OPENROUTER_API_KEY is missing.") from None
    except llm.LLMError as exc:
        logger.warning("AI chat turn failed: %s", exc)
        raise HTTPException(502, "The AI assistant couldn’t respond. Please try again.") from None
