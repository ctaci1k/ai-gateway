# backend/selector/base_selector.py

from abc import ABC, abstractmethod


class BaseSelector(ABC):

    selector_name = "base-selector"

    @abstractmethod
    def select_best_response(
        self,
        responses: dict
    ):

        pass