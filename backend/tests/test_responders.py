# backend/tests/test_responders.py
"""Responder behaviour (PH13 / E): explicit max_tokens and empty-content
handling for OpenAI-compatible providers (Groq / Cerebras / SambaNova)."""

import types

import pytest

from core.config import get_settings
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
    # No per-provider budget on the fake → the global RESPONDER_MAX_TOKENS.
    assert provider.last_kwargs["max_tokens"] == get_settings().responder_max_tokens


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
    assert provider.last_kwargs["max_tokens"] == get_settings().responder_max_tokens


async def test_stream_empty_is_provider_failure():
    provider = _FakeProvider(stream_chunks=[_delta(None), _delta("")])
    with pytest.raises(ProviderError):
        [c async for c in provider.generate_stream("hi")]


class _NoStreamOptsProvider(OpenAICompatibleProvider):
    """A provider whose SDK rejects the ``stream_options`` kwarg (like the native
    Groq/Cerebras/SambaNova SDKs)."""

    provider_name = "fake"
    model_name = "fake-model"

    def __init__(self, stream_chunks):
        self._stream_chunks = stream_chunks
        self.used_stream_options = None

    def _create(self, **kwargs):
        if "stream_options" in kwargs:
            self.used_stream_options = True
            raise TypeError(
                "Completions.create() got an unexpected keyword argument "
                "'stream_options'"
            )
        self.used_stream_options = False
        return iter(self._stream_chunks)


async def test_stream_falls_back_when_stream_options_unsupported():
    # Regression (PH27/B1): a TypeError on the unknown stream_options kwarg must
    # not break streaming — it falls back to a plain stream (tokens estimated).
    provider = _NoStreamOptsProvider([_delta("foo"), _delta("bar")])
    chunks = [c async for c in provider.generate_stream("hi")]
    assert chunks == ["foo", "bar"]
    assert provider.used_stream_options is False


def test_registry_per_provider_budget_overrides_global():
    """A ModelSpec budget (e.g. GLM-4.7 reasoning headroom) wins over the global
    default; without a spec the provider falls back to RESPONDER_MAX_TOKENS."""
    from config.models_config import ModelSpec

    provider = _FakeProvider(content="x")
    assert provider._max_tokens() == get_settings().responder_max_tokens

    provider.apply_model_spec(
        ModelSpec(provider="fake", api_model_id="m", display_name="M", max_tokens=4096)
    )
    assert provider._max_tokens() == 4096
    assert provider.display_name == "M"


def test_cerebras_registry_budget_matches_settings():
    """The Cerebras spec uses the dedicated reasoning budget (OD-1)."""
    from config.models_config import get_model_spec

    spec = get_model_spec("cerebras")
    assert spec.max_tokens == get_settings().cerebras_max_tokens
    assert spec.api_model_id == get_settings().cerebras_model
