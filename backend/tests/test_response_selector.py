# backend/tests/test_response_selector.py


from selector.response_selector import ResponseSelector
from services.provider_service import ProviderService

RESPONSES = {"groq": "answer A", "cerebras": "answer B"}


def _judge_returning(payload):
    async def _fake(message, provider_name="gemini"):
        if isinstance(payload, Exception):
            raise payload
        return dict(payload)

    return _fake


async def test_high_confidence_selection_has_no_fallback_reason(monkeypatch):
    monkeypatch.setattr(
        ProviderService,
        "execute_selector_ai",
        staticmethod(
            _judge_returning(
                {
                    "selected_model": "groq",
                    "confidence": 0.9,
                    "reason": "ok",
                    "scores": {},
                }
            )
        ),
    )
    result = await ResponseSelector.select_best_response("q", RESPONSES)
    assert result["fallback_used"] is False
    assert result["fallback_reason"] is None


async def test_judge_exception_reason_is_unavailable(monkeypatch):
    monkeypatch.setattr(
        ProviderService,
        "execute_selector_ai",
        staticmethod(_judge_returning(RuntimeError("judge down"))),
    )
    result = await ResponseSelector.select_best_response("q", RESPONSES)
    assert result["fallback_used"] is True
    assert result["fallback_reason"] == "judge_unavailable"


async def test_invalid_response_reason(monkeypatch):
    monkeypatch.setattr(
        ProviderService,
        "execute_selector_ai",
        staticmethod(_judge_returning({"error": "broken"})),
    )
    result = await ResponseSelector.select_best_response("q", RESPONSES)
    assert result["fallback_used"] is True
    assert result["fallback_reason"] == "invalid_response"


async def test_invalid_selection_reason(monkeypatch):
    monkeypatch.setattr(
        ProviderService,
        "execute_selector_ai",
        staticmethod(
            _judge_returning(
                {"selected_model": "not-a-model", "confidence": 0.9, "scores": {}}
            )
        ),
    )
    result = await ResponseSelector.select_best_response("q", RESPONSES)
    assert result["fallback_used"] is True
    assert result["fallback_reason"] == "invalid_response"


async def test_low_confidence_reason(monkeypatch):
    monkeypatch.setattr(
        ProviderService,
        "execute_selector_ai",
        staticmethod(
            _judge_returning(
                {
                    "selected_model": "groq",
                    "confidence": 0.1,
                    "reason": "meh",
                    "scores": {},
                }
            )
        ),
    )
    result = await ResponseSelector.select_best_response("q", RESPONSES)
    assert result["fallback_used"] is True
    assert result["fallback_reason"] == "low_confidence"


async def test_valid_high_confidence_selection(monkeypatch):
    monkeypatch.setattr(
        ProviderService,
        "execute_selector_ai",
        staticmethod(
            _judge_returning(
                {
                    "selected_model": "cerebras",
                    "confidence": 0.9,
                    "reason": "best",
                    "scores": {"groq": 70, "cerebras": 90},
                }
            )
        ),
    )
    result = await ResponseSelector.select_best_response("q", RESPONSES)
    assert result["selected_model"] == "cerebras"
    assert result["fallback_used"] is False
    assert result["best_response"] == "answer B"


async def test_low_confidence_falls_back(monkeypatch):
    monkeypatch.setattr(
        ProviderService,
        "execute_selector_ai",
        staticmethod(
            _judge_returning(
                {
                    "selected_model": "groq",
                    "confidence": 0.1,
                    "reason": "meh",
                    "scores": {},
                }
            )
        ),
    )
    result = await ResponseSelector.select_best_response("q", RESPONSES)
    assert result["fallback_used"] is True
    assert result["selector_provider"] == "fallback"


async def test_judge_exception_falls_back(monkeypatch):
    monkeypatch.setattr(
        ProviderService,
        "execute_selector_ai",
        staticmethod(_judge_returning(RuntimeError("judge down"))),
    )
    result = await ResponseSelector.select_best_response("q", RESPONSES)
    assert result["fallback_used"] is True


async def test_invalid_model_then_retry_success(monkeypatch):
    calls = {"n": 0}

    async def _fake(message, provider_name="gemini"):
        calls["n"] += 1
        if calls["n"] == 1:
            return {"selected_model": "not-a-model", "confidence": 0.9}
        return {
            "selected_model": "groq",
            "confidence": 0.8,
            "reason": "ok",
            "scores": {},
        }

    monkeypatch.setattr(ProviderService, "execute_selector_ai", staticmethod(_fake))
    result = await ResponseSelector.select_best_response("q", RESPONSES)
    assert calls["n"] == 2
    assert result["selected_model"] == "groq"
    assert result["fallback_used"] is False
