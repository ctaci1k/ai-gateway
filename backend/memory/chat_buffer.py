# backend/memory/chat_buffer.py

from collections import deque
import json


class ChatBuffer:

    def __init__(self, max_size=10):

        self.messages = deque(maxlen=max_size)

        self.user_preferences = {

            "preferred_models": {},

            "selector_usage_count": 0,

            "compare_mode_usage_count": 0,

            "total_messages": 0,

            "favorite_response_style": None
        }

    def update_preferences(

        self,
        selected_model=None,
        selector_used=False,
        compare_mode=False

    ):

        self.user_preferences[
            "total_messages"
        ] += 1

        if selector_used:

            self.user_preferences[
                "selector_usage_count"
            ] += 1

        if compare_mode:

            self.user_preferences[
                "compare_mode_usage_count"
            ] += 1

        if selected_model:

            current_count = (
                self.user_preferences[
                    "preferred_models"
                ].get(
                    selected_model,
                    0
                )
            )

            self.user_preferences[
                "preferred_models"
            ][selected_model] = (
                current_count + 1
            )

    def add_message(

        self,
        user_message,
        best_response,
        all_responses,
        selected_model=None,
        failed_providers=None,
        selector_used=False,
        execution_metadata=None,
        execution_summary=None,
        selector_scores=None,
        selector_reason=None,
        selector_metadata=None,
        compare_mode=False,
        selector_provider=None,
        selector_model=None,
        selector_confidence=0,
        selector_fallback_used=False

    ):

        if failed_providers is None:

            failed_providers = []

        if execution_metadata is None:

            execution_metadata = []

        if execution_summary is None:

            execution_summary = {}

        if selector_scores is None:

            selector_scores = {}

        if selector_metadata is None:

            selector_metadata = {}

        compare_summary = {

            "total_models": len(
                all_responses
            ),

            "failed_models": len(
                failed_providers
            ),

            "selected_model": selected_model
        }

        self.update_preferences(

            selected_model=selected_model,

            selector_used=selector_used,

            compare_mode=compare_mode
        )

        message = {

            "user_message": user_message,

            "best_response": best_response,

            "selected_model": selected_model,

            "all_responses": all_responses,

            "failed_providers": failed_providers,

            "selector_used": selector_used,

            "execution_metadata": (
                execution_metadata
            ),

            "execution_summary": (
                execution_summary
            ),

            "selector_scores": (
                selector_scores
            ),

            "selector_reason": (
                selector_reason
            ),

            "selector_metadata": (
                selector_metadata
            ),

            "selector_provider": (
                selector_provider
            ),

            "selector_model": (
                selector_model
            ),

            "selector_confidence": (
                selector_confidence
            ),

            "selector_fallback_used": (
                selector_fallback_used
            ),

            "compare_mode": compare_mode,

            "compare_summary": (
                compare_summary
            )
        }

        self.messages.append(message)

    def get_messages(self):

        return list(self.messages)

    def get_last_message(self):

        if not self.messages:

            return None

        return self.messages[-1]

    def get_compare_sessions(self):

        return [

            message

            for message in self.messages

            if message.get("compare_mode")
        ]

    def get_user_preferences(self):

        return self.user_preferences

    def to_json(self):

        payload = {

            "messages": list(
                self.messages
            ),

            "user_preferences": (
                self.user_preferences
            )
        }

        return json.dumps(

            payload,

            indent=2,

            ensure_ascii=False
        )

    def load_json(self, json_data):

        data = json.loads(json_data)

        if isinstance(data, list):

            self.messages.extend(data)

            return

        self.messages.extend(
            data.get(
                "messages",
                []
            )
        )

        self.user_preferences = data.get(
            "user_preferences",
            {}
        )

    def clear(self):

        self.messages.clear()

        self.user_preferences = {

            "preferred_models": {},

            "selector_usage_count": 0,

            "compare_mode_usage_count": 0,

            "total_messages": 0,

            "favorite_response_style": None
        }