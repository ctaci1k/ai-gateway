# backend/selector/selector_fallback.py

from selector.ai_selector import (
    AISelector
)


class SelectorFallback:

    @staticmethod
    def execute_fallback(
        responses: dict
    ):

        fallback_result = (
            AISelector.select_best_response(
                responses=responses
            )
        )

        fallback_result[
            "fallback_used"
        ] = True

        fallback_result[
            "confidence"
        ] = 0.5

        fallback_result[
            "selector_provider"
        ] = "fallback"

        fallback_result[
            "selector_model"
        ] = "rule-based-selector"

        return fallback_result