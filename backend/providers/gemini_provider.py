# backend/providers/gemini_provider.py

import asyncio
from collections.abc import AsyncGenerator

import google.generativeai as genai

from config.selector_config import SELECTOR_MAX_TOKENS, SELECTOR_TEMPERATURE
from core.config import get_settings
from providers.base_provider import BaseProvider, aiter_in_thread, extract_json


class GeminiProvider(BaseProvider):

    provider_name = "gemini"
    model_name = "gemini-2.5-flash-lite"

    supports_streaming = True
    supports_structured_output = True
    supports_tool_calling = False
    supports_vision = True
    supports_selector_execution = True
    max_context_window = 1000000

    def __init__(self):
        genai.configure(api_key=get_settings().gemini_api_key)
        self.model = genai.GenerativeModel(self.model_name)

    async def generate(self, message: str) -> str:
        response = await asyncio.to_thread(self.model.generate_content, message)
        return response.text

    async def generate_stream(self, message: str) -> AsyncGenerator[str, None]:
        def make_iter():
            return self.model.generate_content(message, stream=True)

        async for chunk in aiter_in_thread(make_iter):
            if chunk.text:
                yield chunk.text

    async def generate_structured(self, message: str):
        response = await asyncio.to_thread(
            self.model.generate_content,
            message,
            generation_config={"response_mime_type": "application/json"},
        )
        try:
            return extract_json(response.text)
        except ValueError:
            return {
                "error": "Invalid JSON response",
                "raw_response": response.text,
            }

    async def generate_selector_response(self, message: str):
        """Run the judge with structured-JSON output and selector tuning.

        Uses ``response_mime_type=application/json`` plus the configured
        temperature / max-tokens. Raises on unparseable output so the caller
        can retry or fall back.
        """
        response = await asyncio.to_thread(
            self.model.generate_content,
            message,
            generation_config={
                "response_mime_type": "application/json",
                "temperature": SELECTOR_TEMPERATURE,
                "max_output_tokens": SELECTOR_MAX_TOKENS,
            },
        )
        # Let ValueError propagate; ResponseSelector handles retries/fallback.
        return extract_json(response.text)
