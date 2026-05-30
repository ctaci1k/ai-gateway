# backend/selector/selector_prompt.py

import json

from core.prompts import render_prompt


class SelectorPromptBuilder:

    @staticmethod
    def build_selector_prompt(
        user_message: str, responses: dict, personalization_context: dict | None = None
    ) -> str:

        if personalization_context is None:
            personalization_context = {}

        formatted_responses = []
        for provider_name, response in responses.items():
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
