# backend/services/orchestrator_service.py

from core.prompts import render_prompt, with_language_directive
from selector.response_selector import ResponseSelector
from services.provider_service import ProviderService


class OrchestratorService:

    @staticmethod
    async def process_chat(
        message: str,
        provider_names: list[str] | None = None,
        compare_mode: bool = False,
        selector_enabled: bool = False,
        personalization_profile: dict | None = None,
        rag_context: str | None = None,
        providers_map: dict | None = None,
        judge_provider=None,
        judge_label: dict | None = None,
        judge_prompt_override: str | None = None,
        response_locale: str | None = None,
    ):

        if personalization_profile is None:

            personalization_profile = {}

        # RAG (PH10): responders answer the question grounded in retrieved
        # context; the judge still evaluates against the original question.
        responder_message = message
        if rag_context:
            responder_message = render_prompt(
                "rag_augmented", context=rag_context, question=message
            )

        # Response language (PH33/B3b, D-23): responders answer in the user's
        # message language (fallback = UI locale). Applied to the responder
        # message ONLY — the judge still receives the original `message`.
        responder_message = with_language_directive(responder_message, response_locale)

        # BYOK (PH17): when a providers_map is supplied the responders run on the
        # user's transient keys; otherwise the built-in singletons are used.
        execution_result = await ProviderService.execute_many(
            message=responder_message,
            provider_names=provider_names,
            providers_map=providers_map,
        )

        all_responses = execution_result["all_responses"]

        failed_providers = execution_result["failed_providers"]

        execution_metadata = execution_result["execution_metadata"]

        execution_summary = execution_result["execution_summary"]

        total_tokens = execution_result.get("total_tokens")

        best_response = ""

        selected_model = None

        selected_model_data = None

        selector_scores = {}

        selector_reason = None

        selector_confidence = 0

        selector_provider = None

        selector_model = None

        selector_fallback_used = False

        selector_fallback_reason = None

        preference_weighting = None

        successful_providers = list(all_responses.keys())

        total_requested_models = (
            len(provider_names) if provider_names else len(successful_providers)
        )

        if selector_enabled and all_responses:

            selector_input = {}

            for provider_name, response_data in all_responses.items():

                selector_input[provider_name] = response_data["response"]

            selector_result = await ResponseSelector.select_best_response(
                user_message=message,
                responses=selector_input,
                personalization_profile=(personalization_profile),
                judge_provider=judge_provider,
                judge_label=judge_label,
                judge_prompt_override=judge_prompt_override,
            )

            selected_model = selector_result.get("selected_model")

            best_response = selector_result.get("best_response", "")

            selector_scores = selector_result.get("scores", {})

            selector_reason = selector_result.get("reason")

            selector_confidence = selector_result.get("confidence", 0)

            selector_provider = selector_result.get("selector_provider")

            selector_model = selector_result.get("selector_model")

            selector_fallback_used = selector_result.get("fallback_used", False)

            selector_fallback_reason = selector_result.get("fallback_reason")

            preference_weighting = selector_result.get("preference_weighting")

            if selected_model and selected_model in all_responses:

                selected_model_data = all_responses[selected_model]

        else:

            if all_responses:

                selected_model = next(iter(all_responses))

                selected_model_data = all_responses[selected_model]

                best_response = selected_model_data["response"]

        compare_summary = {
            "total_requested_models": (total_requested_models),
            "successful_models": len(successful_providers),
            "failed_models": len(failed_providers),
            "selected_model": (selected_model),
            "selector_enabled": (selector_enabled),
            "total_compared_responses": len(all_responses),
        }

        selector_metadata = {
            "selector_provider": (selector_provider),
            "selector_model": (selector_model),
            "selector_confidence": (selector_confidence),
            "fallback_used": (selector_fallback_used),
            "fallback_reason": (selector_fallback_reason),
            "selected_model": (selected_model),
            "selection_reason": (selector_reason),
            "scores": (selector_scores),
            "personalization_enabled": bool(personalization_profile),
            # Transparent record of any manual-preference nudge (PH16/E, D-11);
            # None when the judge was not used or no nudge applied.
            "preference_weighting": (preference_weighting),
        }

        response_payload = {
            "best_response": best_response,
            "selected_model": (selected_model),
            "selected_model_data": (selected_model_data),
            "all_responses": (all_responses),
            "failed_providers": (failed_providers),
            "execution_metadata": (execution_metadata),
            "execution_summary": (execution_summary),
            "compare_mode": (compare_mode),
            "selector_enabled": (selector_enabled),
            "selector_scores": (selector_scores),
            "selector_reason": (selector_reason),
            "selector_metadata": (selector_metadata),
            "compare_summary": (compare_summary),
            "personalization_profile": (personalization_profile),
            # Aggregate token usage for the turn (PH15); None when unknown.
            "total_tokens": (total_tokens),
        }

        if compare_mode:

            response_payload["comparison_count"] = len(all_responses)

        return response_payload
