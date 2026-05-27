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

        selected_model_data = None

        selector_scores = {}

        selector_reason = None

        successful_providers = list(
            all_responses.keys()
        )

        total_requested_models = (
            len(provider_names)
            if provider_names
            else len(successful_providers)
        )

        if selector_enabled and all_responses:

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
                selector_result.get(
                    "scores",
                    {}
                )
            )

            selector_reason = (
                selector_result.get(
                    "reason"
                )
            )

            if (
                selected_model
                and selected_model in all_responses
            ):

                selected_model_data = (
                    all_responses[selected_model]
                )

        else:

            if all_responses:

                selected_model = next(
                    iter(all_responses)
                )

                selected_model_data = (
                    all_responses[selected_model]
                )

                best_response = (
                    selected_model_data["response"]
                )

        compare_summary = {

            "total_requested_models": (
                total_requested_models
            ),

            "successful_models": len(
                successful_providers
            ),

            "failed_models": len(
                failed_providers
            ),

            "selected_model": selected_model
        }

        response_payload = {

            "best_response": best_response,

            "selected_model": selected_model,

            "selected_model_data": (
                selected_model_data
            ),

            "all_responses": all_responses,

            "failed_providers": (
                failed_providers
            ),

            "execution_metadata": (
                execution_metadata
            ),

            "compare_mode": compare_mode,

            "selector_enabled": (
                selector_enabled
            ),

            "selector_scores": (
                selector_scores
            ),

            "selector_reason": (
                selector_reason
            ),

            "compare_summary": (
                compare_summary
            ),
        }

        if compare_mode:

            response_payload[
                "comparison_count"
            ] = len(all_responses)

        return response_payload