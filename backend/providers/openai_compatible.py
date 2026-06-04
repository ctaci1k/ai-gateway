# backend/providers/openai_compatible.py
"""Shared provider implementation for any SDK exposing the OpenAI-style
``client.chat.completions.create`` interface (Groq, Mistral, NVIDIA NIM).

All blocking SDK calls run in worker threads so ``asyncio.gather`` over several
providers yields real concurrency (B4), and JSON parsing is centralised via
``extract_json`` (B7).
"""

import asyncio
from collections.abc import AsyncGenerator

from core.config import get_settings
from core.errors import ProviderError
from core.prompts import get_prompt
from providers.base_provider import (
    BaseProvider,
    StreamUsage,
    aiter_in_thread,
    extract_json,
)

# Fail-fast budget for a BYOK validation "ping" (PH21): short timeout so a slow
# or rate-limited endpoint returns a clean per-key error in seconds. Retries are
# already disabled on the transient client (max_retries=0).
VALIDATE_TIMEOUT_SECONDS = 12


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

    @staticmethod
    def _message_text(message) -> str | None:
        """Robustly extract the visible answer from a chat completion message
        (B3a/D-23).

        The OpenAI-compatible contract puts the answer in ``content``, but some
        reasoning endpoints (notably Mistral "magistral", and some DeepSeek/Qwen
        deployments) leave ``content`` empty and place the visible answer in a
        reasoning side-channel (``reasoning_content`` / ``reasoning``). Read those
        as fallbacks so a real answer is never dropped as "empty"."""
        content = getattr(message, "content", None)
        if content and content.strip():
            return content
        for field in ("reasoning_content", "reasoning"):
            alt = getattr(message, field, None)
            if alt and alt.strip():
                return alt
        return None

    def _empty_error(self, finish_reason) -> ProviderError:
        """Build a clear, classifiable failure when no visible content came back.

        Distinguishes a length-truncated turn (the model hit the output budget
        before emitting an answer — actionable, distinct reason) from a genuinely
        empty response. The wording is matched by ``classify_provider_failure`` to
        a stable reason code → localized UI text."""
        if finish_reason == "length":
            return ProviderError(
                f"{self.provider_name} hit the output length limit before "
                "producing an answer (output truncated)"
            )
        return ProviderError(
            f"{self.provider_name} returned an empty response "
            "(model produced no visible content)"
        )

    async def generate_full(self, message: str) -> dict:
        response = await asyncio.to_thread(
            self._create,
            messages=[{"role": "user", "content": message}],
            max_tokens=self._max_tokens(),
        )
        choice = response.choices[0]
        content = self._message_text(choice.message)
        # No visible content even after the reasoning-field fallbacks: surface a
        # clear, classifiable reason (truncated vs empty) so Compare never shows a
        # dead "empty response" card (E3, B3a).
        if not content or not content.strip():
            raise self._empty_error(getattr(choice, "finish_reason", None))
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
        Nothing is stored.

        Uses a short, no-retry timeout (PH21) so a slow or rate-limited endpoint
        fails fast with a clean per-key error instead of hanging (which tripped
        the dev proxy with a 500)."""
        client = self.client.with_options(timeout=VALIDATE_TIMEOUT_SECONDS)
        await asyncio.to_thread(
            lambda: client.chat.completions.create(
                model=self.model,
                messages=[{"role": "user", "content": "ping"}],
                max_tokens=16,
            )
        )

    async def list_models(self) -> list[str]:
        """List the model ids the endpoint exposes (BYOK discovery, PH30/D).

        Calls the OpenAI-compatible ``GET /models`` with a short, no-retry
        timeout (PH21) so a slow/unsupported endpoint fails fast. Returns the
        sorted ids; raises on any API error so the route can fall back to manual
        entry. Nothing is stored; the key is never logged."""
        client = self.client.with_options(timeout=VALIDATE_TIMEOUT_SECONDS)
        page = await asyncio.to_thread(client.models.list)
        ids = [getattr(m, "id", None) for m in page.data]
        return sorted(i for i in ids if i)

    async def generate_stream(
        self, message: str
    ) -> AsyncGenerator[str | StreamUsage, None]:
        def make_iter():
            base = dict(
                messages=[{"role": "user", "content": message}],
                stream=True,
                max_tokens=self._max_tokens(),
            )
            # Ask the server to emit a final usage chunk (empty choices + ``usage``)
            # so Single streams record real token counts (PH27/B1, D-18). Some
            # native provider SDKs (e.g. Groq) reject the unknown
            # ``stream_options`` kwarg with a TypeError; fall back to a plain
            # stream — tokens then come from the estimate (B2).
            try:
                return self._create(**base, stream_options={"include_usage": True})
            except TypeError:
                return self._create(**base)

        produced = False
        usage_tokens: int | None = None
        finish_reason = None
        reasoning_buf: list[str] = []
        async for chunk in aiter_in_thread(make_iter):
            # The include_usage final chunk carries usage with empty choices.
            usage = getattr(chunk, "usage", None)
            if usage is not None:
                usage_tokens = getattr(usage, "total_tokens", None)
            if not chunk.choices:
                continue
            choice = chunk.choices[0]
            fr = getattr(choice, "finish_reason", None)
            if fr:
                finish_reason = fr
            delta = choice.delta
            text = getattr(delta, "content", None)
            if text:
                produced = True
                yield text
            elif not produced:
                # Buffer the reasoning side-channel (B3a): if the content channel
                # stays empty (e.g. Mistral magistral), we still surface this as
                # the answer rather than dropping the turn as "empty".
                alt = getattr(delta, "reasoning_content", None) or getattr(
                    delta, "reasoning", None
                )
                if alt:
                    reasoning_buf.append(alt)

        if not produced:
            if reasoning_buf:
                yield "".join(reasoning_buf)
            else:
                raise self._empty_error(finish_reason)

        # Terminal usage marker (PH27/B1): only when the server reported it, so
        # text-only consumers (and providers without include_usage) are unaffected.
        if usage_tokens is not None:
            yield StreamUsage(total_tokens=usage_tokens)

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
