# backend/providers/base_provider.py

import asyncio
import json
import re
from abc import ABC, abstractmethod
from collections.abc import AsyncGenerator, Callable, Iterable
from dataclasses import dataclass
from typing import Any

# Matches a ```json ... ``` or ``` ... ``` fenced block, capturing the inner body.
_FENCE_RE = re.compile(r"```(?:json)?\s*(.*?)\s*```", re.DOTALL | re.IGNORECASE)


@dataclass
class StreamUsage:
    """Terminal usage marker emitted by ``generate_stream`` (PH27/B1, D-18).

    Streaming yields plain ``str`` token deltas; when the provider reports usage
    on the final ``include_usage`` chunk, it yields one of these at the end so
    the caller can record real token counts. Consumers that only want text
    ignore it (``isinstance`` check)."""

    total_tokens: int | None


def extract_json(content: str) -> Any:
    """Robustly parse a JSON object out of a model response.

    Handles markdown fences and surrounding prose by (1) trying the raw text,
    (2) trying any fenced block, and (3) falling back to the widest
    ``{...}`` / ``[...]`` slice. Raises ``ValueError`` if nothing parses.
    """
    if content is None:
        raise ValueError("Empty response content")

    text = content.strip()

    candidates = [text]

    fence_match = _FENCE_RE.search(text)
    if fence_match:
        candidates.append(fence_match.group(1).strip())

    for opener, closer in (("{", "}"), ("[", "]")):
        start = text.find(opener)
        end = text.rfind(closer)
        if start != -1 and end != -1 and end > start:
            candidates.append(text[start : end + 1])

    for candidate in candidates:
        if not candidate:
            continue
        try:
            return json.loads(candidate)
        except (json.JSONDecodeError, ValueError):
            continue

    raise ValueError("No valid JSON found in response")


async def aiter_in_thread(
    make_iter: Callable[[], Iterable[Any]],
) -> AsyncGenerator[Any, None]:
    """Drive a blocking (synchronous) iterator without blocking the event loop.

    The iterator is created and advanced inside worker threads, so provider
    SDKs that only expose synchronous streaming can still be consumed from
    async code (and concurrently with other providers).
    """
    sentinel = object()
    iterator = await asyncio.to_thread(lambda: iter(make_iter()))

    def _next() -> Any:
        try:
            return next(iterator)
        except StopIteration:
            return sentinel

    while True:
        item = await asyncio.to_thread(_next)
        if item is sentinel:
            break
        yield item


class BaseProvider(ABC):

    provider_name = "base"

    # Set from the model registry in __init__ (PH16). The class defaults are
    # only placeholders for providers that have no registry entry.
    model_name = "unknown"

    display_name = "unknown"

    # Per-provider output budget (PH16); None falls back to RESPONDER_MAX_TOKENS.
    max_output_tokens: int | None = None

    supports_streaming = True

    supports_structured_output = True

    supports_tool_calling = False

    supports_vision = False

    supports_selector_execution = True

    max_context_window = 8192

    @abstractmethod
    async def generate(self, message: str) -> str:
        pass

    async def generate_full(self, message: str) -> dict[str, Any]:
        """Generate a response plus usage metadata (PH15, D-10).

        Returns ``{"text": str, "total_tokens": int | None}``. Default delegates
        to ``generate`` with unknown token usage; providers that expose usage
        (see ``OpenAICompatibleProvider``) override this.
        """
        return {"text": await self.generate(message), "total_tokens": None}

    @abstractmethod
    async def generate_structured(self, message: str) -> Any:
        pass

    @abstractmethod
    async def generate_stream(self, message: str) -> AsyncGenerator[str, None]:
        pass

    async def generate_selector_response(self, message: str) -> Any:

        return await self.generate_structured(message)

    def apply_model_spec(self, spec) -> None:
        """Bind this instance to its registry ``ModelSpec`` (PH16, D-11).

        Sets the model id sent to the API, the truthful display name shown in
        the UI / ``/providers/info``, and the per-provider output budget. The
        spec is the single source of truth — providers no longer hardcode it.
        """
        if spec is None:
            self.model = self.model_name
            return
        self.model = spec.api_model_id
        self.model_name = spec.api_model_id
        self.display_name = spec.display_name
        self.max_output_tokens = spec.max_tokens

    def get_provider_info(self):

        return {
            "provider": self.provider_name,
            "model": self.model_name,
            "display_name": self.display_name,
            "supports_streaming": (self.supports_streaming),
            "supports_structured_output": (self.supports_structured_output),
            "supports_tool_calling": (self.supports_tool_calling),
            "supports_vision": (self.supports_vision),
            "supports_selector_execution": (self.supports_selector_execution),
            "max_context_window": (self.max_context_window),
        }
