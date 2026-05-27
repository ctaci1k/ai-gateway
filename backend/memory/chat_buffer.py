# backend/memory/chat_buffer.py

from collections import deque
import json


class ChatBuffer:

    def __init__(self, max_size=10):

        self.messages = deque(maxlen=max_size)

    def add_message(

        self,
        user_message,
        best_response,
        all_responses,
        selected_model=None,
        failed_providers=None,
        selector_used=False,
        execution_metadata=None,
        selector_scores=None,
        selector_reason=None,
        compare_mode=False

    ):

        if failed_providers is None:

            failed_providers = []

        if execution_metadata is None:

            execution_metadata = []

        if selector_scores is None:

            selector_scores = {}

        compare_summary = {

            "total_models": len(
                all_responses
            ),

            "failed_models": len(
                failed_providers
            ),

            "selected_model": selected_model
        }

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

            "selector_scores": (
                selector_scores
            ),

            "selector_reason": (
                selector_reason
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

    def to_json(self):

        return json.dumps(

            list(self.messages),

            indent=2,

            ensure_ascii=False
        )

    def load_json(self, json_data):

        data = json.loads(json_data)

        self.messages.extend(data)

    def clear(self):

        self.messages.clear()