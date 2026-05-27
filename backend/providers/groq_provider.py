# backend/providers/groq_provider.py

import os
import json

from typing import AsyncGenerator

from groq import Groq
from dotenv import load_dotenv

from providers.base_provider import BaseProvider

load_dotenv()


class GroqProvider(BaseProvider):

    provider_name = "groq"

    model_name = "llama-3.3-70b-versatile"

    supports_streaming = True

    supports_structured_output = True

    supports_tool_calling = False

    supports_vision = False

    max_context_window = 128000

    def __init__(self):

        self.client = Groq(
            api_key=os.getenv("GROQ_API_KEY")
        )

        self.model = self.model_name

    async def generate(
        self,
        message: str
    ) -> str:

        response = self.client.chat.completions.create(

            model=self.model,

            messages=[
                {
                    "role": "user",
                    "content": message
                }
            ]
        )

        return response.choices[0].message.content

    async def generate_stream(
        self,
        message: str
    ) -> AsyncGenerator[str, None]:

        stream = self.client.chat.completions.create(

            model=self.model,

            messages=[
                {
                    "role": "user",
                    "content": message
                }
            ],

            stream=True
        )

        for chunk in stream:

            if not chunk.choices:
                continue

            delta = chunk.choices[0].delta.content

            if delta:

                yield delta

    def clean_json_response(
        self,
        content: str
    ) -> str:

        content = content.strip()

        if content.startswith("```json"):

            content = content.replace(
                "```json",
                ""
            )

        if content.endswith("```"):

            content = content[:-3]

        return content.strip()

    async def generate_structured(
        self,
        message: str
    ):

        response = self.client.chat.completions.create(

            model=self.model,

            messages=[
                {
                    "role": "system",
                    "content": (
                        "Return ONLY valid JSON. "
                        "Do not use markdown."
                    )
                },
                {
                    "role": "user",
                    "content": message
                }
            ]
        )

        content = response.choices[0].message.content

        content = self.clean_json_response(
            content
        )

        try:

            return json.loads(content)

        except Exception:

            return {
                "error": "Invalid JSON response",
                "raw_response": content
            }