# backend/tests/test_provider_service.py

import asyncio
import time

import pytest

from providers.base_provider import BaseProvider
from services.provider_service import ProviderService, classify_provider_failure


class _FakeProvider(BaseProvider):
    """Minimal provider double honoring the BaseProvider contract.

    Subclasses override ``generate``; ``generate_full`` is inherited from the
    base (delegates to ``generate`` with unknown token usage), matching how real
    providers behave when they don't report usage (PH15).
    """

    async def generate(self, message):
        raise NotImplementedError

    async def generate_structured(self, message):
        return {}

    async def generate_stream(self, message):
        yield ""


class _BlockingProvider(_FakeProvider):
    """Mimics a real provider: a synchronous SDK call offloaded to a thread."""

    model_name = "slow-model"

    async def generate(self, message):
        await asyncio.to_thread(time.sleep, 0.15)
        return "done"


class _OkProvider(_FakeProvider):
    model_name = "fake-model"

    async def generate(self, message):
        return f"echo:{message}"


class _FailProvider(_FakeProvider):
    model_name = "broken-model"

    async def generate(self, message):
        raise RuntimeError("boom")


@pytest.fixture
def patched_providers(monkeypatch):
    mapping = {"groq": _OkProvider(), "cerebras": _FailProvider()}
    monkeypatch.setattr(
        ProviderService, "get_provider", staticmethod(lambda name: mapping.get(name))
    )
    return mapping


async def test_execute_many_aggregates_success_and_failure(patched_providers):
    result = await ProviderService.execute_many(
        message="ping", provider_names=["groq", "cerebras"]
    )

    assert "groq" in result["all_responses"]
    assert result["all_responses"]["groq"]["response"] == "echo:ping"

    failed = result["failed_providers"]
    assert len(failed) == 1
    assert failed[0]["provider"] == "cerebras"
    # PH13: each failed provider carries a reason code for the UI.
    assert failed[0]["reason"] == "unavailable"

    summary = result["execution_summary"]
    assert summary["total_models"] == 2
    assert summary["successful_models"] == 1
    assert summary["failed_models"] == 1


async def test_execute_many_deduplicates_provider_names(patched_providers):
    result = await ProviderService.execute_many(
        message="ping", provider_names=["groq", "groq", "groq"]
    )
    assert result["execution_summary"]["total_models"] == 1


async def test_providers_run_concurrently(monkeypatch):
    # Three blocking 0.15s providers should finish in ~0.15s (concurrent),
    # not ~0.45s (serial), proving true-async offloading + gather (B4).
    monkeypatch.setattr(
        ProviderService,
        "get_provider",
        staticmethod(lambda name: _BlockingProvider()),
    )
    start = time.perf_counter()
    result = await ProviderService.execute_many(
        message="ping", provider_names=["groq", "cerebras", "sambanova"]
    )
    elapsed = time.perf_counter() - start
    assert result["execution_summary"]["successful_models"] == 3
    assert elapsed < 0.35


def test_classify_provider_failure():
    assert (
        classify_provider_failure("Error code: 429 - queue_exceeded") == "rate_limited"
    )
    assert classify_provider_failure("You exceeded your quota") == "rate_limited"
    assert classify_provider_failure("Read timed out") == "timeout"
    assert (
        classify_provider_failure("groq returned an empty response") == "empty_response"
    )
    assert classify_provider_failure("connection reset") == "unavailable"


async def test_unknown_provider_marked_failed(monkeypatch):
    monkeypatch.setattr(
        ProviderService, "get_provider", staticmethod(lambda name: None)
    )
    result = await ProviderService.execute_many(message="ping", provider_names=["nope"])
    assert result["failed_providers"][0]["provider"] == "nope"
    assert result["execution_summary"]["successful_models"] == 0
