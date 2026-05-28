# backend/selector/selector_prompt.py

import json


class SelectorPromptBuilder:

    @staticmethod
    def build_selector_prompt(
        user_message: str,
        responses: dict
    ) -> str:

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

Evaluate based on:

- correctness
- completeness
- clarity
- usefulness
- structure
- reasoning quality

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