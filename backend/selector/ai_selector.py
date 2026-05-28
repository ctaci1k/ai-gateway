# backend/selector/ai_selector.py

import re

from selector.base_selector import (
    BaseSelector
)


class AISelector(BaseSelector):

    selector_name = "fallback-selector"

    selector_version = "4.0"

    selector_type = "rule-based-fallback"

    supports_reasoning = True

    supports_detailed_scoring = True

    @staticmethod
    def calculate_length_score(
        response: str
    ) -> int:

        response_length = len(response)

        if response_length >= 2000:
            return 30

        if response_length >= 1200:
            return 25

        if response_length >= 700:
            return 20

        if response_length >= 300:
            return 15

        return 5

    @staticmethod
    def calculate_structure_score(
        response: str
    ) -> int:

        score = 0

        structure_patterns = [
            "\n",
            ":",
            "- ",
            "* ",
            "1.",
            "2.",
            "3."
        ]

        for pattern in structure_patterns:

            if pattern in response:
                score += 3

        return min(score, 20)

    @staticmethod
    def calculate_readability_score(
        response: str
    ) -> int:

        score = 0

        sentences = re.split(
            r"[.!?]",
            response
        )

        average_sentence_length = 0

        if sentences:

            average_sentence_length = (
                len(response.split()) / len(sentences)
            )

        if average_sentence_length < 12:
            score += 15

        elif average_sentence_length < 20:
            score += 12

        elif average_sentence_length < 30:
            score += 8

        else:
            score += 4

        if "\n" in response:
            score += 5

        return min(score, 20)

    @staticmethod
    def calculate_explanation_score(
        response: str
    ) -> int:

        score = 0

        explanation_keywords = [

            "because",
            "therefore",
            "for example",
            "however",
            "step",
            "first",
            "then",
            "finally",
            "important",
            "summary"
        ]

        response_lower = response.lower()

        for keyword in explanation_keywords:

            if keyword in response_lower:
                score += 2

        return min(score, 20)

    @staticmethod
    def calculate_style_score(
        response: str
    ) -> int:

        score = 10

        if "```" in response:
            score += 5

        if len(response.split()) > 150:
            score += 5

        return min(score, 15)

    @staticmethod
    def calculate_final_score(
        length_score: int,
        structure_score: int,
        readability_score: int,
        explanation_score: int,
        style_score: int
    ) -> int:

        return (

            length_score +

            structure_score +

            readability_score +

            explanation_score +

            style_score
        )

    @staticmethod
    def build_reasoning(
        provider_name: str,
        score_breakdown: dict
    ) -> str:

        return (

            f"{provider_name} selected by fallback "
            f"selector because it achieved the "
            f"highest total score. "

            f"Length: {score_breakdown['length_score']}, "

            f"Structure: {score_breakdown['structure_score']}, "

            f"Readability: {score_breakdown['readability_score']}, "

            f"Explanation: {score_breakdown['explanation_score']}, "

            f"Style: {score_breakdown['style_score']}."
        )

    @staticmethod
    def build_selector_metadata():

        return (
            AISelector.get_selector_metadata()
        )

    @staticmethod
    def select_best_response(
        responses: dict
    ):

        if not responses:

            return {

                "selected_model": None,

                "best_response": "",

                "reason": "No responses available",

                "selector_metadata": (
                    AISelector.build_selector_metadata()
                )
            }

        best_provider = None

        best_response = ""

        best_score = -1

        scores = {}

        detailed_scores = {}

        selector_reason = ""

        for provider_name, response in (
            responses.items()
        ):

            length_score = (
                AISelector.calculate_length_score(
                    response
                )
            )

            structure_score = (
                AISelector.calculate_structure_score(
                    response
                )
            )

            readability_score = (
                AISelector.calculate_readability_score(
                    response
                )
            )

            explanation_score = (
                AISelector.calculate_explanation_score(
                    response
                )
            )

            style_score = (
                AISelector.calculate_style_score(
                    response
                )
            )

            total_score = (
                AISelector.calculate_final_score(
                    length_score=length_score,
                    structure_score=structure_score,
                    readability_score=readability_score,
                    explanation_score=explanation_score,
                    style_score=style_score
                )
            )

            score_data = {

                "total_score": total_score,

                "length_score": (
                    length_score
                ),

                "structure_score": (
                    structure_score
                ),

                "readability_score": (
                    readability_score
                ),

                "explanation_score": (
                    explanation_score
                ),

                "style_score": (
                    style_score
                )
            }

            scores[provider_name] = (
                total_score
            )

            detailed_scores[provider_name] = (
                score_data
            )

            if total_score > best_score:

                best_score = total_score

                best_provider = provider_name

                best_response = response

                selector_reason = (
                    AISelector.build_reasoning(
                        provider_name=provider_name,
                        score_breakdown=score_data
                    )
                )

        return {

            "selected_model": best_provider,

            "best_response": best_response,

            "scores": scores,

            "detailed_scores": (
                detailed_scores
            ),

            "reason": selector_reason,

            "selector_metadata": (
                AISelector.build_selector_metadata()
            )
        }