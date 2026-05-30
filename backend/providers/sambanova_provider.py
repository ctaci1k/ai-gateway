# backend/providers/sambanova_provider.py

from openai import OpenAI

from core.config import get_settings
from providers.openai_compatible import OpenAICompatibleProvider


class SambaNovaProvider(OpenAICompatibleProvider):

    provider_name = "sambanova"
    model_name = "Meta-Llama-3.3-70B-Instruct"

    supports_streaming = True
    supports_structured_output = True
    supports_tool_calling = False
    supports_vision = False
    supports_selector_execution = True
    max_context_window = 128000

    def __init__(self):
        self.client = OpenAI(
            api_key=get_settings().sambanova_api_key,
            base_url="https://api.sambanova.ai/v1",
        )
        self.model = self.model_name
