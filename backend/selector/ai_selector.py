# backend/selector/ai_selector.py

from selector.base_selector import (
    BaseSelector
)


class AISelector(BaseSelector):

    selector_name = "ai-selector-v1"

    @staticmethod
    def select_best_response(
        responses: dict
    ):

        if not responses:

            return {
                "selected_model": None,
                "best_response": "",
                "reason": "No responses available"
            }

        best_provider = None

        best_response = ""

        best_score = -1

        scores = {}

        for provider_name, response in (
            responses.items()
        ):

            score = len(response)

            scores[provider_name] = score

            if score > best_score:

                best_score = score

                best_provider = provider_name

                best_response = response

        return {
            "selected_model": best_provider,
            "best_response": best_response,
            "scores": scores,
            "reason": (
                "Selected longest response"
            )
        }