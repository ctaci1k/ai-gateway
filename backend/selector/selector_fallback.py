# backend/selector/selector_fallback.py

from selector.ai_selector import AISelector


class SelectorFallback:

    @staticmethod
    def execute_fallback(responses: dict, fallback_reason: str | None = None):

        fallback_result = AISelector.select_best_response(responses=responses)

        fallback_result["fallback_used"] = True

        # Concrete reason the judge was bypassed (D1/D2), surfaced to the UI.
        fallback_result["fallback_reason"] = fallback_reason

        fallback_result["confidence"] = 0.5

        fallback_result["selector_provider"] = "fallback"

        fallback_result["selector_model"] = "rule-based-selector"

        return fallback_result
