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
        each response is labelled with a neutral name, so the verdict is keyed by
        that label regardless of position.
        """

        def order_key(item: tuple[str, str]) -> str:
            provider_name = item[0]
            digest = hashlib.sha256(
                f"{user_message}|{provider_name}".encode()
            ).hexdigest()
            return digest

        return sorted(responses.items(), key=order_key)

    @staticmethod
    def _example_scores(labels: list[str]) -> str:
        """Illustrative ``scores`` example JSON keyed by the actual labels."""
        lines = [
            f'          "{label}": {max(50, 90 - 4 * i)}'
            for i, label in enumerate(labels)
        ]
        scores_body = ",\n".join(lines)
        first = labels[0] if labels else "AI 1"
        return (
            "{\n"
            f'        "selected_model": "{first}",\n'
            '        "confidence": 0.95,\n'
            '        "reason": "Short explanation why this response was selected.",\n'
            '        "scores": {\n'
            f"{scores_body}\n"
            "        }\n"
            "      }"
        )

    @staticmethod
    def _relabel(counts: dict, slot_to_label: dict[str, str]) -> dict:
        """Re-key a personalization dict from slot → neutral label so the judge's
        preference hint matches the labels it actually sees. Keys not present in
        the current comparison are kept as-is (best effort)."""
        if not isinstance(counts, dict):
            return counts
        return {slot_to_label.get(slot, slot): value for slot, value in counts.items()}

    @staticmethod
    def build_selector_prompt(
        user_message: str, responses: dict, personalization_context: dict | None = None
    ) -> tuple[str, dict[str, str]]:
        """Build the judge prompt and the label→slot map.

        Responses are presented under neutral, brand-free labels ("AI 1".."AI N")
        so the judge cannot favour a known model name and CAN score/pick any
        participant, including custom BYOK slots (PH22). The caller maps the
        judge's verdict back to real slots via the returned map.
        """

        if personalization_context is None:
            personalization_context = {}

        ordered = SelectorPromptBuilder._ordered_responses(user_message, responses)
        label_to_slot: dict[str, str] = {}
        slot_to_label: dict[str, str] = {}
        formatted_responses = []
        for index, (slot, response) in enumerate(ordered):
            label = f"AI {index + 1}"
            label_to_slot[label] = slot
            slot_to_label[slot] = label
            formatted_responses.append(
                f"\nMODEL NAME:\n{label}\n\nMODEL RESPONSE:\n{response}\n"
            )
        responses_block = "\n\n".join(formatted_responses)

        labels = list(label_to_slot.keys())
        allowed_models_inline = ", ".join(labels)
        scores_example = SelectorPromptBuilder._example_scores(labels)

        personalization_block = ""
        if personalization_context:
            personalization_block = render_prompt(
                "selector_personalization_block",
                preferred_models=json.dumps(
                    SelectorPromptBuilder._relabel(
                        personalization_context.get("preferred_models", {}),
                        slot_to_label,
                    ),
                    indent=2,
                ),
                manual_model_selections=json.dumps(
                    SelectorPromptBuilder._relabel(
                        personalization_context.get("manual_model_selections", {}),
                        slot_to_label,
                    ),
                    indent=2,
                ),
                favorite_response_style=personalization_context.get(
                    "favorite_response_style"
                ),
                response_style_preferences=json.dumps(
                    personalization_context.get("response_style_preferences", {}),
                    indent=2,
                ),
            )

        prompt = render_prompt(
            "selector_judge",
            user_message=user_message,
            responses_block=responses_block,
            personalization_block=personalization_block,
            allowed_models_inline=allowed_models_inline,
            scores_example=scores_example,
        )
        return prompt, label_to_slot

    @staticmethod
    def remap_verdict_to_slots(
        selector_response: dict, label_to_slot: dict[str, str]
    ) -> dict:
        """Map the judge's ``selected_model`` and ``scores`` keys from neutral
        labels back to real slots (PH22). Keys that are already slots (e.g. a
        judge that echoed a real name) are left unchanged, so this is safe either
        way."""
        if not isinstance(selector_response, dict):
            return selector_response
        remapped = dict(selector_response)
        selected = remapped.get("selected_model")
        if isinstance(selected, str) and selected in label_to_slot:
            remapped["selected_model"] = label_to_slot[selected]
        scores = remapped.get("scores")
        if isinstance(scores, dict):
            remapped["scores"] = {
                label_to_slot.get(key, key): value for key, value in scores.items()
            }
        return remapped
