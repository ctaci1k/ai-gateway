# backend/providers/gemini_provider.py

import os
import json

from typing import AsyncGenerator

import google.generativeai as genai

from dotenv import load_dotenv

from providers.base_provider import BaseProvider

load_dotenv()


class GeminiProvider(BaseProvider):

    provider_name = "gemini"

    model_name = "gemini-2.5-flash-lite"

    supports_streaming = True

    supports_structured_output = True

    supports_tool_calling = False

    supports_vision = True

    supports_selector_execution = True

    max_context_window = 1000000

    def __init__(self):

        genai.configure(
            api_key=os.getenv(
                "GEMINI_API_KEY"
            )
        )

        self.model = genai.GenerativeModel(
            self.model_name
        )

    async def generate(
        self,
        message: str
    ) -> str:

        response = self.model.generate_content(
            message
        )

        return response.text

    async def generate_stream(
        self,
        message: str
    ) -> AsyncGenerator[str, None]:

        stream = self.model.generate_content(

            message,

            stream=True
        )

        for chunk in stream:

            if chunk.text:

                yield chunk.text

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

        response = self.model.generate_content(

            f"""
Return ONLY valid JSON.

{message}
"""
        )

        content = self.clean_json_response(
            response.text
        )

        try:

            return json.loads(content)

        except Exception:

            return {

                "error": "Invalid JSON response",

                "raw_response": content
            }

    async def generate_selector_response(
        self,
        message: str
    ):

        response = self.model.generate_content(

            f"""
You are an AI response evaluator.

Return ONLY valid JSON.

{message}
"""
        )

        content = self.clean_json_response(
            response.text
        )

        try:

            return json.loads(content)

        except Exception:

            return {

                "error": "Invalid selector JSON",

                "raw_response": content
            }