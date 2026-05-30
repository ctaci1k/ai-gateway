# backend/tests/test_responders.py
"""Responder behaviour (PH13 / E): explicit max_tokens and empty-content
handling for OpenAI-compatible providers (Groq / Cerebras / SambaNova)."""

import types

import pytest

from core.errors import ProviderError
from providers.openai_compatible import OpenAICompatibleProvider


def _message(content):
    return types.SimpleNamespace(
        choices=[types.SimpleNamespace(message=types.SimpleNamespace(content=content))]
    )


def _delta(content):
    return types.SimpleNamespace(
        choices=[types.SimpleNamespace(delta=types.SimpleNamespace(content=content))]
    )


class _FakeProvider(OpenAICompatibleProvider):
    provider_name = "fake"
    model_name = "fake-model"

    def __init__(self, *, content=None, stream_chunks=None):
        self._content = content
        self._stream_chunks = stream_chunks or []
        self.last_kwargs = None

    def _create(self, **kwargs):
        self.last_kwargs = kwargs
        if kwargs.get("stream"):
            return iter(self._stream_chunks)
        return _message(self._content)


async def test_generate_passes_explicit_max_tokens():
    provider = _FakeProvider(content="hello")
    result = await provider.generate("hi")
    assert result == "hello"
    assert provider.last_kwargs["max_tokens"] == 1024


async def test_generate_empty_content_is_provider_failure():
    provider = _FakeProvider(content="")
    with pytest.raises(ProviderError):
        await provider.generate("hi")


async def test_generate_whitespace_content_is_provider_failure():
    provider = _FakeProvider(content="   \n  ")
    with pytest.raises(ProviderError):
        await provider.generate("hi")


async def test_generate_none_content_is_provider_failure():
    provider = _FakeProvider(content=None)
    with pytest.raises(ProviderError):
        await provider.generate("hi")


async def test_stream_passes_max_tokens_and_yields():
    provider = _FakeProvider(stream_chunks=[_delta("foo"), _delta(None), _delta("bar")])
    chunks = [c async for c in provider.generate_stream("hi")]
    assert chunks == ["foo", "bar"]
    assert provider.last_kwargs["max_tokens"] == 1024


async def test_stream_empty_is_provider_failure():
    provider = _FakeProvider(stream_chunks=[_delta(None), _delta("")])
    with pytest.raises(ProviderError):
        [c async for c in provider.generate_stream("hi")]
