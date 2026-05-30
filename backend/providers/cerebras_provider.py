# backend/providers/cerebras_provider.py

from openai import OpenAI

from core.config import get_settings
from providers.openai_compatible import OpenAICompatibleProvider


class CerebrasProvider(OpenAICompatibleProvider):

    provider_name = "cerebras"
    model_name = "gpt-oss-120b"

    supports_streaming = True
    supports_structured_output = True
    supports_tool_calling = False
    supports_vision = False
    supports_selector_execution = True
    max_context_window = 8192

    def __init__(self):
        self.client = OpenAI(
            api_key=get_settings().cerebras_api_key,
            base_url="https://api.cerebras.ai/v1",
        )
        self.model = self.model_name
