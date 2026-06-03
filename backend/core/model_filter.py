# backend/core/model_filter.py
"""Heuristic "looks like a chat model" filter for BYOK model discovery (PH30/D).

A provider's ``GET /models`` lists everything it serves — including embeddings,
TTS/whisper, image and rerank models that can't answer a chat turn. We tag each
discovered id with a chat flag (a hint, not a hard rule): the full list is always
returned and the FE decides whether to hide non-chat models or "show all".
Conservative on purpose — only obvious non-chat families are excluded."""

# Substrings that strongly indicate a non-chat model. Matched case-insensitively
# anywhere in the id. Kept conservative to avoid hiding real chat models.
_NON_CHAT_HINTS = (
    "embed",  # text-embedding-*, *-embedding, embed
    "tts",
    "whisper",
    "speech",
    "audio",
    "transcribe",
    "dall-e",
    "dalle",
    "image",
    "vision-encoder",
    "rerank",
    "reranker",
    "moderation",
    "guardrail",
    "clip",
    "stable-diffusion",
    "sdxl",
    "flux",
    "bge-",
    "e5-",
)


def is_chat_model(model_id: str) -> bool:
    """True when ``model_id`` doesn't look like a known non-chat family."""
    name = (model_id or "").lower()
    return not any(hint in name for hint in _NON_CHAT_HINTS)
