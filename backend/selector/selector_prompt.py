# backend/selector/selector_prompt.py

import hashlib
import json

from core.prompts import render_prompt


class SelectorPromptBuilder:

    @staticmethod
    def _ordered_responses(user_message: str, responses: dict) -> list[tuple[str, str]]:
        """Order responses deterministically per request, but NOT always in the
        same provider order (anti-positional bias, PH16/E).

        A judge can drift toward "first listed = best". Sorting by a hash of
        ``(user_message, provider)`` gives a stable order for a given request
        while varying which provider appears first across requests, so position
        no longer correlates with the winner. The ordering is purely cosmetic:
        each response is labelled with its provider name, so the verdict is keyed
        by name regardless of position.
        """

        def order_key(item: tuple[str, str]) -> str:
            provider_name = item[0]
            digest = hashlib.sha256(
                f"{user_message}|{provider_name}".encode()
            ).hexdigest()
            return digest

        return sorted(responses.items(), key=order_key)

    @staticmethod
    def build_selector_prompt(
        user_message: str, responses: dict, personalization_context: dict | None = None
    ) -> str:

        if personalization_context is None:
            personalization_context = {}

        formatted_responses = []
        for provider_name, response in SelectorPromptBuilder._ordered_responses(
            user_message, responses
        ):
            formatted_responses.append(
                f"\nMODEL NAME:\n{provider_name}\n\nMODEL RESPONSE:\n{response}\n"
            )
        responses_block = "\n\n".join(formatted_responses)

        personalization_block = ""
        if personalization_context:
            personalization_block = render_prompt(
                "selector_personalization_block",
                preferred_models=json.dumps(
                    personalization_context.get("preferred_models", {}), indent=2
                ),
                manual_model_selections=json.dumps(
                    personalization_context.get("manual_model_selections", {}), indent=2
                ),
                favorite_response_style=personalization_context.get(
                    "favorite_response_style"
                ),
                response_style_preferences=json.dumps(
                    personalization_context.get("response_style_preferences", {}),
                    indent=2,
                ),
            )

        return render_prompt(
            "selector_judge",
            user_message=user_message,
            responses_block=responses_block,
            personalization_block=personalization_block,
        )
