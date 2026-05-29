# backend/selector/selector_prompt.py

import json


class SelectorPromptBuilder:

    @staticmethod
    def build_selector_prompt(
        user_message: str,
        responses: dict,
        personalization_context: dict | None = None
    ) -> str:

        if personalization_context is None:

            personalization_context = {}

        formatted_responses = []

        for provider_name, response in (
            responses.items()
        ):

            formatted_responses.append(

                f"""
MODEL NAME:
{provider_name}

MODEL RESPONSE:
{response}
"""
            )

        responses_block = "\n\n".join(
            formatted_responses
        )

        preferred_models = (
            personalization_context.get(
                "preferred_models",
                {}
            )
        )

        favorite_response_style = (
            personalization_context.get(
                "favorite_response_style"
            )
        )

        response_style_preferences = (
            personalization_context.get(
                "response_style_preferences",
                {}
            )
        )

        personalization_block = ""

        if personalization_context:

            personalization_block = f"""

USER PERSONALIZATION PROFILE:

Preferred Models:
{json.dumps(preferred_models, indent=2)}

Favorite Response Style:
{favorite_response_style}

Response Style Preferences:
{json.dumps(response_style_preferences, indent=2)}

IMPORTANT PERSONALIZATION RULES:

- Personalization should ONLY be a secondary factor.
- Response quality is ALWAYS the highest priority.
- Do NOT select a weaker response only because
  it matches user preferences.
- Use preferences only as a small weighting signal
  when multiple responses are similarly strong.
"""

        output_schema = {

            "selected_model": "groq",

            "confidence": 0.95,

            "reason": (
                "Short explanation why this "
                "response was selected."
            ),

            "scores": {

                "groq": 90,
                "cerebras": 82,
                "sambanova": 88
            }
        }

        return f"""

You are NOT a chatbot.

You are NOT allowed to answer the user.

You are ONLY an AI judge.

Your ONLY task is:
select the best response from the provided models.

IMPORTANT RULES:

- You MUST select ONLY one of:
  - groq
  - cerebras
  - sambanova

- You are NOT allowed to invent model names.

- You are NOT allowed to generate your own answer.

- You are NOT allowed to improve responses.

- You are NOT participating in the conversation.

- You ONLY evaluate the existing responses.

Evaluate primarily based on:

- correctness
- completeness
- clarity
- usefulness
- structure
- reasoning quality

{personalization_block}

USER QUESTION:
{user_message}

MODEL RESPONSES:
{responses_block}

Return ONLY valid JSON.

Expected JSON format:

{json.dumps(output_schema, indent=2)}

Do not use markdown.

Do not add explanations outside JSON.

The selected_model field MUST contain ONLY:
groq, cerebras, or sambanova.

"""