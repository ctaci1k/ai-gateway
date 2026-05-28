# backend/selector/response_selector.py

from config.selector_config import (
    SELECTOR_PROVIDER
)

from config.selector_config import (
    SELECTOR_MODEL
)

from services.provider_service import (
    ProviderService
)

from selector.selector_prompt import (
    SelectorPromptBuilder
)

from selector.selector_parser import (
    SelectorParser
)

from selector.selector_fallback import (
    SelectorFallback
)


class ResponseSelector:

    ALLOWED_MODELS = [
        "groq",
        "cerebras",
        "sambanova"
    ]

    @staticmethod
    async def select_best_response(
        user_message: str,
        responses: dict
    ):

        try:

            selector_prompt = (
                SelectorPromptBuilder.build_selector_prompt(
                    user_message=user_message,
                    responses=responses
                )
            )

            selector_response = (
                await ProviderService.execute_selector_ai(
                    message=selector_prompt,
                    provider_name=(
                        SELECTOR_PROVIDER
                    )
                )
            )

            selector_response[
                "selector_provider"
            ] = SELECTOR_PROVIDER

            selector_response[
                "selector_model"
            ] = SELECTOR_MODEL

            parsed_response = (
                SelectorParser.parse_selector_response(
                    selector_response
                )
            )

            selected_model = (
                parsed_response.selected_model
            )

            if (
                selected_model
                not in ResponseSelector.ALLOWED_MODELS
            ):

                return (
                    SelectorFallback.execute_fallback(
                        responses=responses
                    )
                )

            if selected_model not in responses:

                return (
                    SelectorFallback.execute_fallback(
                        responses=responses
                    )
                )

            return {

                "selected_model": (
                    selected_model
                ),

                "best_response": (
                    responses[selected_model]
                ),

                "confidence": (
                    parsed_response.confidence
                ),

                "reason": (
                    parsed_response.reason
                ),

                "scores": (
                    parsed_response.scores
                ),

                "fallback_used": False,

                "selector_provider": (
                    SELECTOR_PROVIDER
                ),

                "selector_model": (
                    SELECTOR_MODEL
                )
            }

        except Exception:

            return (
                SelectorFallback.execute_fallback(
                    responses=responses
                )
            )