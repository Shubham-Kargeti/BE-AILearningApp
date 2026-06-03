"""Centralized LLM configuration and client factories."""

from dataclasses import dataclass
from typing import Any

from langchain_openai import ChatOpenAI

from config import get_settings


@dataclass(frozen=True)
class LLMConfig:
    provider: str
    model: str
    temperature: float
    max_tokens: int
    api_key: str
    api_url: str


def get_llm_config() -> LLMConfig:
    settings = get_settings()
    return LLMConfig(
        provider=settings.LLM_PROVIDER,
        model=settings.LLM_MODEL,
        temperature=settings.LLM_TEMPERATURE,
        max_tokens=settings.LLM_MAX_TOKENS,
        api_key=settings.OPENAI_API_KEY,
        api_url=settings.OPENAI_API_URL,
    )


def get_llm_model_name() -> str:
    return get_llm_config().model


def create_chat_llm(**overrides: Any) -> ChatOpenAI:
    """Create a LangChain chat LLM using the shared backend configuration."""
    config = get_llm_config()
    if config.provider.lower() != "openai":
        raise RuntimeError(f"Unsupported LLM_PROVIDER for ChatOpenAI: {config.provider}")
    if not config.api_key:
        raise RuntimeError("OPENAI_API_KEY is not configured")

    params = {
        "model": config.model,
        "temperature": config.temperature,
        "api_key": config.api_key,
    }
    if config.max_tokens:
        params["max_tokens"] = config.max_tokens
    params.update(overrides)
    return ChatOpenAI(**params)


def build_chat_completion_payload(messages: list[dict[str, str]], **overrides: Any) -> dict[str, Any]:
    """Build a direct chat-completions payload from the shared LLM config."""
    config = get_llm_config()
    payload: dict[str, Any] = {
        "model": config.model,
        "messages": messages,
        "temperature": config.temperature,
        "max_tokens": config.max_tokens,
    }
    payload.update(overrides)
    return payload
