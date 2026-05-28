# backend/selector/base_selector.py

from abc import ABC, abstractmethod


class BaseSelector(ABC):

    selector_name = "base-selector"

    selector_version = "1.0"

    selector_type = "rule-based"

    supports_reasoning = False

    supports_detailed_scoring = False

    @classmethod
    def get_selector_metadata(cls):

        return {

            "selector_name": (
                cls.selector_name
            ),

            "selector_version": (
                cls.selector_version
            ),

            "selector_type": (
                cls.selector_type
            ),

            "supports_reasoning": (
                cls.supports_reasoning
            ),

            "supports_detailed_scoring": (
                cls.supports_detailed_scoring
            )
        }

    @staticmethod
    @abstractmethod
    def select_best_response(
        responses: dict
    ):

        pass