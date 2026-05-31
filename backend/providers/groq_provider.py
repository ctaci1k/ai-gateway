# backend/providers/groq_provider.py

from groq import Groq

from config.models_config import get_model_spec
from core.config import get_settings
from providers.openai_compatible import OpenAICompatibleProvider


class GroqProvider(OpenAICompatibleProvider):

    provider_name = "groq"

    supports_streaming = True
    supports_structured_output = True
    supports_tool_calling = False
    supports_vision = False
    supports_selector_execution = True
    max_context_window = 128000

    def __init__(self):
        self.client = Groq(api_key=get_settings().groq_api_key)
        self.apply_model_spec(get_model_spec(self.provider_name))
