import logging
from datetime import date

from fastapi import APIRouter, HTTPException, Request

from app import llm
from app.config import Settings
from app.nda_chat import NdaChatTurn, apply_updates, build_messages, missing_fields
from app.schemas import ChatRequest, ChatResponse

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api", tags=["chat"])


@router.post("/chat")
def chat(body: ChatRequest, request: Request) -> ChatResponse:
    """One turn of the Mutual NDA drafting conversation.

    Stateless: the client sends the whole conversation and the current
    document, and gets back the assistant's reply and the fields it changed.
    """
    settings: Settings = request.app.state.settings
    history = [message.model_dump() for message in body.messages]
    messages = build_messages(history, body.values, body.today or date.today())

    try:
        turn = llm.structured_completion(messages, NdaChatTurn, api_key=settings.openrouter_api_key)
    except llm.LLMUnavailable:
        raise HTTPException(503, "The AI assistant isn’t set up: OPENROUTER_API_KEY is missing.") from None
    except llm.LLMError as exc:
        logger.warning("AI chat turn failed: %s", exc)
        raise HTTPException(502, "The AI assistant couldn’t respond. Please try again.") from None

    complete = not missing_fields(apply_updates(body.values, turn.updates))
    return ChatResponse(reply=turn.reply, updates=turn.updates.changes(), complete=complete)
