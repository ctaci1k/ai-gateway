# backend/providers/openai_compatible.py
"""Shared provider implementation for any SDK exposing the OpenAI-style
``client.chat.completions.create`` interface (Groq, Cerebras, SambaNova).

All blocking SDK calls run in worker threads so ``asyncio.gather`` over several
providers yields real concurrency (B4), and JSON parsing is centralised via
``extract_json`` (B7).
"""

import asyncio
from collections.abc import AsyncGenerator

from core.config import get_settings
from core.errors import ProviderError
from core.prompts import get_prompt
from providers.base_provider import BaseProvider, aiter_in_thread, extract_json


class OpenAICompatibleProvider(BaseProvider):

    # Subclasses set: provider_name, model_name, capability flags, and build
    # ``self.client`` + ``self.model`` in __init__.

    def _create(self, **kwargs):
        return self.client.chat.completions.create(model=self.model, **kwargs)

    def _max_tokens(self) -> int:
        # Explicit output budget so reasoning models reliably emit visible
        # content instead of spending it all on hidden reasoning. Per-provider
        # budget from the registry (PH16); falls back to the global default.
        return self.max_output_tokens or get_settings().responder_max_tokens

    async def generate_full(self, message: str) -> dict:
        response = await asyncio.to_thread(
            self._create,
            messages=[{"role": "user", "content": message}],
            max_tokens=self._max_tokens(),
        )
        content = response.choices[0].message.content
        # A reasoning model that exhausts its budget on hidden reasoning returns
        # empty content; treat that as a provider failure so Compare never shows
        # an empty card (E3).
        if not content or not content.strip():
            raise ProviderError(
                f"{self.provider_name} returned an empty response "
                "(model produced no visible content)"
            )
        # OpenAI-style usage (PH15). Defensive: some SDKs may omit it.
        total_tokens = None
        usage = getattr(response, "usage", None)
        if usage is not None:
            total_tokens = getattr(usage, "total_tokens", None)
        return {"text": content, "total_tokens": total_tokens}

    async def generate(self, message: str) -> str:
        return (await self.generate_full(message))["text"]

    async def validate_credentials(self) -> None:
        """Lightweight live check that the key/model/endpoint work (BYOK, PH17).

        Sends a tiny completion; raises on any API error (bad key, unknown
        model, unreachable endpoint). An empty completion still counts as
        success — the point is that the call authenticates and the model exists.
        Nothing is stored."""
        await asyncio.to_thread(
            self._create,
            messages=[{"role": "user", "content": "ping"}],
            max_tokens=16,
        )

    async def generate_stream(self, message: str) -> AsyncGenerator[str, None]:
        def make_iter():
            return self._create(
                messages=[{"role": "user", "content": message}],
                stream=True,
                max_tokens=self._max_tokens(),
            )

        produced = False
        async for chunk in aiter_in_thread(make_iter):
            if not chunk.choices:
                continue
            delta = chunk.choices[0].delta.content
            if delta:
                produced = True
                yield delta

        if not produced:
            raise ProviderError(
                f"{self.provider_name} returned an empty response "
                "(model produced no visible content)"
            )

    async def generate_structured(self, message: str):
        response = await asyncio.to_thread(
            self._create,
            messages=[
                {"role": "system", "content": get_prompt("provider_json_system")},
                {"role": "user", "content": message},
            ],
        )
        content = response.choices[0].message.content
        try:
            return extract_json(content)
        except ValueError:
            return {"error": "Invalid JSON response", "raw_response": content}

    async def generate_selector_response(self, message: str):
        # Import here to avoid a module-load dependency on selector config.
        from config.selector_config import SELECTOR_MAX_TOKENS, SELECTOR_TEMPERATURE

        response = await asyncio.to_thread(
            self._create,
            temperature=SELECTOR_TEMPERATURE,
            max_tokens=SELECTOR_MAX_TOKENS,
            messages=[
                {"role": "system", "content": get_prompt("provider_selector_system")},
                {"role": "user", "content": message},
            ],
        )
        # Raise on unparseable output so the selector can retry / fall back.
        return extract_json(response.choices[0].message.content)
