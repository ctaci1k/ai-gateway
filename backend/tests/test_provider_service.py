# backend/tests/test_provider_service.py

import asyncio
import time

import pytest

from providers.base_provider import BaseProvider
from services.orchestrator_service import OrchestratorService
from services.provider_service import ProviderService, classify_provider_failure


class _FakeProvider(BaseProvider):
    """Minimal provider double honoring the BaseProvider contract.

    Subclasses override ``generate``; ``generate_full`` is inherited from the
    base (delegates to ``generate`` with unknown token usage), matching how real
    providers behave when they don't report usage (PH15).
    """

    async def generate(self, message, history=None):
        raise NotImplementedError

    async def generate_structured(self, message):
        return {}

    async def generate_stream(self, message, history=None):
        yield ""


class _BlockingProvider(_FakeProvider):
    """Mimics a real provider: a synchronous SDK call offloaded to a thread."""

    model_name = "slow-model"

    async def generate(self, message, history=None):
        await asyncio.to_thread(time.sleep, 0.15)
        return "done"


class _OkProvider(_FakeProvider):
    model_name = "fake-model"

    async def generate(self, message, history=None):
        return f"echo:{message}"


class _FailProvider(_FakeProvider):
    model_name = "broken-model"

    async def generate(self, message, history=None):
        raise RuntimeError("boom")


@pytest.fixture
def patched_providers(monkeypatch):
    mapping = {"groq": _OkProvider(), "mistral": _FailProvider()}
    monkeypatch.setattr(
        ProviderService, "get_provider", staticmethod(lambda name: mapping.get(name))
    )
    return mapping


async def test_execute_many_aggregates_success_and_failure(patched_providers):
    result = await ProviderService.execute_many(
        message="ping", provider_names=["groq", "mistral"]
    )

    assert "groq" in result["all_responses"]
    assert result["all_responses"]["groq"]["response"] == "echo:ping"

    failed = result["failed_providers"]
    assert len(failed) == 1
    assert failed[0]["provider"] == "mistral"
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
        message="ping", provider_names=["groq", "mistral", "scout"]
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


# --- Self-describing turn: is_byok per-response (PH32, D-22) -----------------


def _transient(slot, model_id):
    from services.provider_service import TransientProvider

    return TransientProvider(
        slot=slot,
        base_url="https://example.test/v1",
        api_key="user-secret-key",
        model_id=model_id,
    )


async def test_execute_many_marks_is_byok_and_real_model():
    """A BYOK slot is flagged ``is_byok=True`` with its real model id; a built-in
    slot is ``is_byok=False`` — and the failed responder is self-describing too."""
    byok = _transient("groq", "gpt-4o")

    async def ok_full(message, history=None):
        return {"text": "hi", "total_tokens": 5}

    byok.generate_full = ok_full

    mistral = _OkProvider()  # built-in singleton → is_byok False
    failing = _transient("scout", "claude-x")

    async def boom(message, history=None):
        raise RuntimeError("boom")

    failing.generate_full = boom

    providers_map = {"groq": byok, "mistral": mistral, "scout": failing}
    result = await ProviderService.execute_many(
        message="ping", providers_map=providers_map
    )

    assert result["all_responses"]["groq"]["is_byok"] is True
    assert result["all_responses"]["groq"]["model"] == "gpt-4o"
    assert result["all_responses"]["mistral"]["is_byok"] is False

    failed = {f["provider"]: f for f in result["failed_providers"]}
    # A failed BYOK responder still carries its real model id + key source.
    assert failed["scout"]["is_byok"] is True
    assert failed["scout"]["model"] == "claude-x"

    meta = {m["provider"]: m for m in result["execution_metadata"]}
    assert meta["groq"]["is_byok"] is True
    assert meta["scout"]["is_byok"] is True
    assert meta["mistral"]["is_byok"] is False


# --- Response language directive (PH33/B3b, D-23) ----------------------------


async def test_process_chat_injects_language_directive(patched_providers):
    """The orchestrator prepends the response-language directive to the responder
    message (responders only); _OkProvider echoes what it received."""
    result = await OrchestratorService.process_chat(
        message="Cześć, co słychać?",
        provider_names=["groq"],
        response_locale="pl",
    )
    responder_text = result["all_responses"]["groq"]["response"]
    # The directive (Polish fallback) is present AND the original question is kept.
    assert "Polish" in responder_text
    assert "Cześć, co słychać?" in responder_text


async def test_process_chat_language_directive_defaults_to_english(patched_providers):
    result = await OrchestratorService.process_chat(
        message="Hello there",
        provider_names=["groq"],
        response_locale=None,
    )
    assert "English" in result["all_responses"]["groq"]["response"]


def test_interaction_record_preserves_is_byok():
    """The saved Compare turn keeps ``is_byok``/``model`` per response so replay
    is self-describing (PH32, D-22) — no current-keys lookup at render time."""
    from memory.preferences_logic import build_interaction_record

    record = build_interaction_record(
        user_message="q",
        best_response="a",
        all_responses={
            "groq": {"response": "a", "model": "gpt-4o", "is_byok": True},
        },
        failed_providers=[
            {"provider": "mistral", "model": "claude-x", "is_byok": True},
        ],
        selected_model="groq",
    )
    assert record["all_responses"]["groq"]["is_byok"] is True
    assert record["all_responses"]["groq"]["model"] == "gpt-4o"
    assert record["failed_providers"][0]["is_byok"] is True
    assert record["failed_providers"][0]["model"] == "claude-x"


def test_build_messages_prepends_history():
    """OpenAI-compatible providers prepend in-chat history before the current
    message so responders remember the thread (P3/PH40)."""
    from providers.openai_compatible import OpenAICompatibleProvider

    history = [
        {"role": "user", "content": "first?"},
        {"role": "assistant", "content": "answer."},
    ]
    assert OpenAICompatibleProvider._build_messages("now", history) == [
        {"role": "user", "content": "first?"},
        {"role": "assistant", "content": "answer."},
        {"role": "user", "content": "now"},
    ]
    # No history → just the current turn (a fresh chat).
    assert OpenAICompatibleProvider._build_messages("now", None) == [
        {"role": "user", "content": "now"},
    ]


async def test_execute_many_forwards_history_to_providers():
    """execute_many threads in-chat history through to every responder (P3/PH40)."""
    captured = {}

    class _CapturingProvider(_FakeProvider):
        model_name = "cap-model"

        async def generate_full(self, message, history=None):
            captured["message"] = message
            captured["history"] = history
            return {"text": "ok", "total_tokens": None}

    history = [
        {"role": "user", "content": "prev q"},
        {"role": "assistant", "content": "prev a"},
    ]
    result = await ProviderService.execute_many(
        message="now", providers_map={"groq": _CapturingProvider()}, history=history
    )

    assert result["all_responses"]["groq"]["response"] == "ok"
    assert captured["message"] == "now"
    assert captured["history"] == history
