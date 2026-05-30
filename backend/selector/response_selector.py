# backend/selector/response_selector.py

from config.selector_config import (
    ALLOWED_MODELS,
    SELECTOR_MAX_RETRIES,
    SELECTOR_MIN_CONFIDENCE,
    SELECTOR_MODEL,
    SELECTOR_PROVIDER,
)
from core.logging import get_logger, log_event
from selector.selector_fallback import SelectorFallback
from selector.selector_parser import SelectorParser
from selector.selector_prompt import SelectorPromptBuilder
from services.provider_service import ProviderService

logger = get_logger("selector")

# Concrete reasons why the rule-based fallback was used, surfaced to the UI so
# the user understands the judge did not decide "arbitrarily" (D1/D2). Kept as
# stable string codes; the frontend maps them to localized banner text.
FALLBACK_JUDGE_UNAVAILABLE = "judge_unavailable"  # timeout / rate-limit / network
FALLBACK_INVALID_RESPONSE = "invalid_response"  # unparseable / bad selection
FALLBACK_LOW_CONFIDENCE = "low_confidence"  # confidence below threshold


class ResponseSelector:

    @staticmethod
    def build_personalization_context(personalization_profile: dict):

        if not personalization_profile:

            return {}

        return {
            "preferred_models": (personalization_profile.get("preferred_models", {})),
            "manual_model_selections": (
                personalization_profile.get("manual_model_selections", {})
            ),
            "favorite_response_style": (
                personalization_profile.get("favorite_response_style")
            ),
            "response_style_preferences": (
                personalization_profile.get("response_style_preferences", {})
            ),
        }

    @staticmethod
    async def select_best_response(
        user_message: str,
        responses: dict,
        personalization_profile: dict | None = None,
    ):
        personalization_context = ResponseSelector.build_personalization_context(
            personalization_profile or {}
        )

        selector_prompt = SelectorPromptBuilder.build_selector_prompt(
            user_message=user_message,
            responses=responses,
            personalization_context=personalization_context,
        )

        # Retry the judge on transient failures / unparseable output (D-6).
        # Track the most recent failure so the fallback can explain *why* it ran
        # (D1/D2). Default assumes the judge never returned anything usable.
        attempts = max(1, SELECTOR_MAX_RETRIES + 1)
        fallback_reason = FALLBACK_JUDGE_UNAVAILABLE
        for attempt in range(attempts):
            try:
                selector_response = await ProviderService.execute_selector_ai(
                    message=selector_prompt,
                    provider_name=SELECTOR_PROVIDER,
                )
            except Exception as error:
                fallback_reason = FALLBACK_JUDGE_UNAVAILABLE
                log_event(
                    logger,
                    "selector_attempt_failed",
                    attempt=attempt + 1,
                    error=str(error),
                )
                continue

            if not isinstance(selector_response, dict) or "error" in selector_response:
                fallback_reason = FALLBACK_INVALID_RESPONSE
                log_event(
                    logger,
                    "selector_invalid_response",
                    attempt=attempt + 1,
                )
                continue

            selector_response["selector_provider"] = SELECTOR_PROVIDER
            selector_response["selector_model"] = SELECTOR_MODEL

            parsed_response = SelectorParser.parse_selector_response(selector_response)
            selected_model = parsed_response.selected_model

            # A model the judge named that we cannot honour is an invalid result.
            if selected_model not in ALLOWED_MODELS or selected_model not in responses:
                fallback_reason = FALLBACK_INVALID_RESPONSE
                log_event(
                    logger,
                    "selector_invalid_selection",
                    attempt=attempt + 1,
                    selected_model=selected_model,
                )
                continue

            # Enforce the minimum confidence threshold (D-6).
            if parsed_response.confidence < SELECTOR_MIN_CONFIDENCE:
                fallback_reason = FALLBACK_LOW_CONFIDENCE
                log_event(
                    logger,
                    "selector_low_confidence",
                    confidence=parsed_response.confidence,
                    min_confidence=SELECTOR_MIN_CONFIDENCE,
                    selected_model=selected_model,
                )
                break

            return {
                "selected_model": selected_model,
                "best_response": responses[selected_model],
                "confidence": parsed_response.confidence,
                "reason": parsed_response.reason,
                "scores": parsed_response.scores,
                "fallback_used": False,
                "fallback_reason": None,
                "selector_provider": SELECTOR_PROVIDER,
                "selector_model": SELECTOR_MODEL,
                "personalization_used": bool(personalization_context),
                "personalization_context": personalization_context,
            }

        log_event(logger, "selector_fallback", reason=fallback_reason)
        return SelectorFallback.execute_fallback(
            responses=responses, fallback_reason=fallback_reason
        )
