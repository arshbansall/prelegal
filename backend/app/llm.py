"""The one module that calls an LLM: LiteLLM → OpenRouter → gpt-oss-120b on Cerebras.

Responses use Structured Outputs: the caller passes a Pydantic model, LiteLLM
sends it as a strict JSON schema, and the reply is validated back into it.
"""

from litellm import completion
from pydantic import BaseModel

MODEL = "openrouter/openai/gpt-oss-120b"
EXTRA_BODY = {"provider": {"order": ["cerebras"]}}
# Kept below the ~30s proxy timeout of `next dev`.
TIMEOUT_SECONDS = 25


class LLMUnavailable(Exception):
    """No API key is configured, so the LLM cannot be called."""


class LLMError(Exception):
    """The LLM call failed or returned output that doesn't match the schema."""


def structured_completion[T: BaseModel](
    messages: list[dict[str, str]], response_model: type[T], *, api_key: str | None
) -> T:
    """Calls the model and returns its reply parsed as `response_model`."""
    if not api_key:
        raise LLMUnavailable("OPENROUTER_API_KEY is not set")
    try:
        response = completion(
            model=MODEL,
            messages=messages,
            response_format=response_model,
            reasoning_effort="low",
            extra_body=EXTRA_BODY,
            api_key=api_key,
            timeout=TIMEOUT_SECONDS,
        )
        return response_model.model_validate_json(response.choices[0].message.content)
    except Exception as exc:
        raise LLMError(f"{type(exc).__name__}: {exc}") from exc
