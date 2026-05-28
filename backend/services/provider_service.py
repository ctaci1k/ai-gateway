# backend/services/provider_service.py

import asyncio
import time

from config.selector_config import (
    SELECTOR_TIMEOUT
)

from providers.groq_provider import GroqProvider
from providers.cerebras_provider import CerebrasProvider
from providers.sambanova_provider import SambaNovaProvider
from providers.gemini_provider import GeminiProvider


class ProviderService:

    providers = {
        "groq": GroqProvider(),
        "cerebras": CerebrasProvider(),
        "sambanova": SambaNovaProvider(),
    }

    @staticmethod
    def get_provider(provider_name: str):

        return ProviderService.providers.get(
            provider_name
        )

    @staticmethod
    def get_default_provider():

        return ProviderService.providers.get(
            "groq"
        )

    @staticmethod
    def get_all_providers():

        return list(
            ProviderService.providers.keys()
        )

    @staticmethod
    def get_all_provider_info():

        providers_info = []

        for provider in (
            ProviderService.providers.values()
        ):

            providers_info.append(
                provider.get_provider_info()
            )

        return providers_info

    @staticmethod
    async def generate(
        message: str,
        provider_name: str = "groq"
    ):

        provider = ProviderService.get_provider(
            provider_name
        )

        if not provider:

            provider = (
                ProviderService.get_default_provider()
            )

        return await provider.generate(
            message
        )

    @staticmethod
    async def execute_many(
        message: str,
        provider_names: list[str] | None = None
    ):

        if not provider_names:

            provider_names = [
                "groq",
                "cerebras",
                "sambanova"
            ]

        unique_provider_names = list(
            dict.fromkeys(provider_names)
        )

        tasks = [

            ProviderService._safe_generate(

                provider_name=provider_name,

                message=message

            )

            for provider_name in (
                unique_provider_names
            )
        ]

        results = await asyncio.gather(
            *tasks
        )

        all_responses = {}

        failed_providers = []

        execution_metadata = []

        total_execution_time = 0

        successful_models = 0

        failed_models = 0

        for result in results:

            provider_name = result["provider"]

            execution_metadata.append({

                "provider": provider_name,

                "success": result["success"],

                "execution_time": result[
                    "execution_time"
                ],

                "model": result.get("model"),

                "error": result.get("error")
            })

            total_execution_time += result[
                "execution_time"
            ]

            if result["success"]:

                successful_models += 1

                all_responses[provider_name] = {

                    "response": result[
                        "response"
                    ],

                    "model": result["model"],

                    "execution_time": result[
                        "execution_time"
                    ],

                    "provider": provider_name,

                    "success": True
                }

            else:

                failed_models += 1

                failed_providers.append({

                    "provider": provider_name,

                    "error": result["error"]
                })

        average_execution_time = 0

        if results:

            average_execution_time = round(

                total_execution_time / len(results),

                2
            )

        execution_summary = {

            "total_models": len(results),

            "successful_models": (
                successful_models
            ),

            "failed_models": (
                failed_models
            ),

            "average_execution_time": (
                average_execution_time
            )
        }

        return {

            "all_responses": all_responses,

            "failed_providers": (
                failed_providers
            ),

            "execution_metadata": (
                execution_metadata
            ),

            "execution_summary": (
                execution_summary
            )
        }

    @staticmethod
    async def _safe_generate(
        provider_name: str,
        message: str
    ):

        start_time = time.perf_counter()

        try:

            provider = (
                ProviderService.get_provider(
                    provider_name
                )
            )

            if not provider:

                return {

                    "provider": provider_name,

                    "success": False,

                    "error": "Provider not found",

                    "execution_time": 0,

                    "model": None
                }

            response = await provider.generate(
                message
            )

            execution_time = round(

                time.perf_counter() - start_time,

                2
            )

            return {

                "provider": provider_name,

                "success": True,

                "response": response,

                "model": provider.model_name,

                "execution_time": (
                    execution_time
                )
            }

        except Exception as error:

            execution_time = round(

                time.perf_counter() - start_time,

                2
            )

            return {

                "provider": provider_name,

                "success": False,

                "error": str(error),

                "execution_time": (
                    execution_time
                ),

                "model": None
            }

    @staticmethod
    async def generate_stream(
        message: str,
        provider_name: str = "groq"
    ):

        provider = ProviderService.get_provider(
            provider_name
        )

        if not provider:

            provider = (
                ProviderService.get_default_provider()
            )

        async for chunk in provider.generate_stream(
            message
        ):

            yield {

                "type": "token",

                "content": chunk,

                "provider": (
                    provider.provider_name
                ),

                "model": (
                    provider.model_name
                ),
            }

    @staticmethod
    async def generate_structured(
        message: str,
        provider_name: str = "groq"
    ):

        provider = ProviderService.get_provider(
            provider_name
        )

        if not provider:

            provider = (
                ProviderService.get_default_provider()
            )

        return await provider.generate_structured(
            message
        )

    @staticmethod
    async def execute_selector_ai(
        message: str,
        provider_name: str = "gemini"
    ):

        if provider_name == "gemini":

            provider = GeminiProvider()

        else:

            provider = ProviderService.get_provider(
                provider_name
            )

            if not provider:

                provider = (
                    ProviderService.get_default_provider()
                )

        return await asyncio.wait_for(

            provider.generate_selector_response(
                message
            ),

            timeout=SELECTOR_TIMEOUT
        )