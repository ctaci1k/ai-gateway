# backend/selector/selector_parser.py

from schemas.selector_schema import (
    SelectorResultSchema
)


class SelectorParser:

    ALLOWED_MODELS = [
        "groq",
        "cerebras",
        "sambanova"
    ]

    @staticmethod
    def parse_selector_response(
        response: dict
    ) -> SelectorResultSchema:

        selected_model = response.get(
            "selected_model",
            ""
        )

        if (
            selected_model
            not in SelectorParser.ALLOWED_MODELS
        ):

            selected_model = ""

        confidence = response.get(
            "confidence",
            0.0
        )

        if not isinstance(
            confidence,
            (int, float)
        ):

            confidence = 0.0

        scores = response.get(
            "scores",
            {}
        )

        if not isinstance(
            scores,
            dict
        ):

            scores = {}

        reason = response.get(
            "reason",
            ""
        )

        if not isinstance(
            reason,
            str
        ):

            reason = ""

        return SelectorResultSchema(

            selected_model=selected_model,

            confidence=float(confidence),

            reason=reason,

            scores=scores,

            fallback_used=response.get(
                "fallback_used",
                False
            ),

            selector_provider=response.get(
                "selector_provider",
                ""
            ),

            selector_model=response.get(
                "selector_model",
                ""
            )
        )