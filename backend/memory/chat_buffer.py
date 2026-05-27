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
        selector_used=False

    ):

        if failed_providers is None:

            failed_providers = []

        message = {

            "user_message": user_message,

            "best_response": best_response,

            "selected_model": selected_model,

            "all_responses": all_responses,

            "failed_providers": failed_providers,

            "selector_used": selector_used
        }

        self.messages.append(message)

    def get_messages(self):

        return list(self.messages)

    def to_json(self):

        return json.dumps(
            list(self.messages),
            indent=2
        )

    def load_json(self, json_data):

        data = json.loads(json_data)

        self.messages.extend(data)

    def clear(self):

        self.messages.clear()