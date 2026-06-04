# backend/config/models_config.py
"""Single source of truth for the responder model roster (PH16, D-11).

Each responder provider runs a truthfully-named model so Compare shows three
answers. The judge (Qwen, ``config/selector_config.py``) shares no family with
any responder — no self-bias. (Slots 1 and 3 are both Groq Llama models since
PH36/D-26 — Llama 3.3 70B and Llama 4 Scout — chosen for reliable EU free-tier
throughput; the judge is still neutral.) The API model id is overridable via env
(a deployment can swap a
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
        "mistral": ModelSpec(
            provider="mistral",
            api_model_id=settings.mistral_model,
            display_name="Mistral Small",
            max_tokens=settings.responder_max_tokens,
        ),
        "scout": ModelSpec(
            provider="scout",
            api_model_id=settings.scout_model,
            display_name="Llama 4 Scout",
            max_tokens=settings.responder_max_tokens,
        ),
    }


def get_model_spec(provider: str) -> ModelSpec | None:
    return get_model_registry().get(provider)
