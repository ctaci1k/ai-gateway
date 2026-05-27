# backend/services/orchestrator_service.py

from services.provider_service import (
    ProviderService
)

from selector.ai_selector import (
    AISelector
)


class OrchestratorService:

    @staticmethod
    async def process_chat(
        message: str,
        provider_names: list[str] | None = None,
        compare_mode: bool = False,
        selector_enabled: bool = False
    ):

        execution_result = (
            await ProviderService.execute_many(
                message=message,
                provider_names=provider_names
            )
        )

        all_responses = (
            execution_result["all_responses"]
        )

        failed_providers = (
            execution_result["failed_providers"]
        )

        execution_metadata = (
            execution_result["execution_metadata"]
        )

        best_response = ""

        selected_model = None

        selector_scores = {}

        selector_reason = None

        if selector_enabled:

            selector_input = {}

            for provider_name, response_data in (
                all_responses.items()
            ):

                selector_input[provider_name] = (
                    response_data["response"]
                )

            selector_result = (
                AISelector.select_best_response(
                    responses=selector_input
                )
            )

            selected_model = (
                selector_result["selected_model"]
            )

            best_response = (
                selector_result["best_response"]
            )

            selector_scores = (
                selector_result["scores"]
            )

            selector_reason = (
                selector_result["reason"]
            )

        else:

            if all_responses:

                selected_model = next(
                    iter(all_responses)
                )

                best_response = (
                    all_responses[
                        selected_model
                    ]["response"]
                )

        response_payload = {
            "best_response": best_response,
            "selected_model": selected_model,
            "all_responses": all_responses,
            "failed_providers": failed_providers,
            "execution_metadata": execution_metadata,
            "compare_mode": compare_mode,
            "selector_enabled": selector_enabled,
            "selector_scores": selector_scores,
            "selector_reason": selector_reason,
        }

        if compare_mode:

            response_payload[
                "comparison_count"
            ] = len(all_responses)

        return response_payload