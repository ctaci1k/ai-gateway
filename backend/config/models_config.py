# backend/config/models_config.py
"""Single source of truth for the responder model roster (PH16, D-11).

Each responder provider runs a *distinct*, truthfully-named model so Compare
shows three genuinely different answers (different model families) and the judge
(Qwen, ``config/selector_config.py``) shares no family with any responder — no
self-bias. The API model id is overridable via env (a deployment can swap a
model without code changes); the ``display_name`` is the truthful, human label
shown in the UI and ``/providers/info`` (no vendor fiction). ``max_tokens`` is
the per-provider output budget — reasoning models need more headroom or they
spend the whole budget on hidden reasoning and return empty content.
"""

from dataclasses import dataclass

from core.config import get_settings


@dataclass(frozen=True)
class ModelSpec:
    provider: str
    api_model_id: str
    display_name: str
    max_tokens: int


def get_model_registry() -> dict[str, ModelSpec]:
    settings = get_settings()
    return {
        "groq": ModelSpec(
            provider="groq",
            api_model_id=settings.groq_model,
            display_name="Llama 3.3 70B",
            max_tokens=settings.responder_max_tokens,
        ),
        "cerebras": ModelSpec(
            provider="cerebras",
            api_model_id=settings.cerebras_model,
            display_name="GLM-4.7",
            max_tokens=settings.cerebras_max_tokens,
        ),
        "sambanova": ModelSpec(
            provider="sambanova",
            api_model_id=settings.sambanova_model,
            display_name="DeepSeek V3.1",
            max_tokens=settings.responder_max_tokens,
        ),
    }


def get_model_spec(provider: str) -> ModelSpec | None:
    return get_model_registry().get(provider)
