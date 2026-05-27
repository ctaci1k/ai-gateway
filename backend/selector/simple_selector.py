# backend/selector/simple_selector.py

class SimpleSelector:

    @staticmethod
    def select_best_response(
        responses: dict
    ):

        if not responses:

            return {
                "selected_model": None,
                "best_response": ""
            }

        selected_model = next(
            iter(responses)
        )

        best_response = responses[
            selected_model
        ]

        return {
            "selected_model": selected_model,
            "best_response": best_response
        }