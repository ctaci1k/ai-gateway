# backend/config/selector_config.py

# Single source of truth for the responder models the judge may pick from.
ALLOWED_MODELS = [
    "groq",
    "cerebras",
    "sambanova",
]

# Judge runs on Groq (PH13): Gemini free tier caps generate_content at 20/day,
# which exhausted the judge constantly. Groq allows ~60/min and ~14.4k/day, so
# the judge stays available. Gemini is still used for embeddings (separate, much
# larger quota).
#
# The judge model is *neutral* — qwen3-32b shares no family with any responder
# in the registry (config/models_config.py: Llama / GLM / DeepSeek), so there is
# no self-bias toward any answer. It is served by Groq on the same key.
SELECTOR_PROVIDER = "groq"

SELECTOR_MODEL = "qwen/qwen3-32b"

SELECTOR_TIMEOUT = 20

SELECTOR_MAX_RETRIES = 2

SELECTOR_TEMPERATURE = 0.1

# Generous budget: qwen3-32b is a reasoning model and may spend tokens thinking
# before emitting the JSON verdict, so leave room for both.
SELECTOR_MAX_TOKENS = 2048

SELECTOR_USE_STRUCTURED_OUTPUT = True

SELECTOR_ENABLE_FALLBACK = True

SELECTOR_FALLBACK_SELECTOR = "rule_based"

SELECTOR_MIN_CONFIDENCE = 0.65

SELECTOR_ENABLE_REASONING = True

SELECTOR_ENABLE_DETAILED_SCORING = True

SELECTOR_ENABLE_PROVIDER_METADATA = True
