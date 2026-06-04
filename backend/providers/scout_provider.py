# backend/providers/scout_provider.py
#
# Slot-3 responder: a SECOND Groq-hosted model (Llama 4 Scout), distinct from the
# slot-1 Groq model (Llama 3.3 70B). It replaced the Gemini slot in PH36/D-26
# because the Gemini Flash free tier is geo-blocked in the EEA (RESOURCE_EXHAUSTED
# with a free-tier limit of 0). Llama 4 Scout was chosen for its high Groq
# free-tier throughput (~30k tokens/min ≈ 10-15 req/min, 1000 req/day) which works
# in Poland and reuses the existing GROQ_API_KEY (no new key). The model id is
# env-overridable via SCOUT_MODEL; the truthful display name lives in
# config/models_config.py. The judge (Qwen) shares no family with either Llama
# responder, so there is no self-bias.

from groq import Groq

from config.models_config import get_model_spec
from core.config import get_settings
from providers.openai_compatible import OpenAICompatibleProvider


class ScoutProvider(OpenAICompatibleProvider):

    provider_name = "scout"

    supports_streaming = True
    supports_structured_output = True
    supports_tool_calling = False
    supports_vision = False
    supports_selector_execution = True
    max_context_window = 128000

    def __init__(self):
        self.client = Groq(api_key=get_settings().groq_api_key)
        self.apply_model_spec(get_model_spec(self.provider_name))
