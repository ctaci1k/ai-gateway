# backend/services/provider_service.py

import asyncio
import time

from config.selector_config import SELECTOR_MODEL, SELECTOR_PROVIDER, SELECTOR_TIMEOUT
from core.logging import get_logger, log_event
from providers.cerebras_provider import CerebrasProvider
from providers.gemini_provider import GeminiProvider
from providers.groq_provider import GroqProvider
from providers.sambanova_provider import SambaNovaProvider

logger = get_logger("provider")


def classify_provider_failure(error: str) -> str:
    """Map a provider error string to a stable reason code so the UI can show a
    localized, human reason in the failed model's column (PH13)."""
    text = (error or "").lower()
    if "empty response" in text or "no visible content" in text:
        return "empty_response"
    if (
        "429" in text
        or "rate" in text
        or "quota" in text
        or "too many" in text
        or "queue" in text
    ):
        return "rate_limited"
    if "timeout" in text or "timed out" in text:
        return "timeout"
    return "unavailable"


class ProviderService:

    providers = {
        "groq": GroqProvider(),
        "cerebras": CerebrasProvider(),
        "sambanova": SambaNovaProvider(),
    }

    @staticmethod
    def get_provider(provider_name: str):

        return ProviderService.providers.get(provider_name)

    @staticmethod
    def get_default_provider():

        return ProviderService.providers.get("groq")

    @staticmethod
    def get_all_providers():

        return list(ProviderService.providers.keys())

    @staticmethod
    def get_all_provider_info():

        providers_info = []

        for provider in ProviderService.providers.values():

            providers_info.append(provider.get_provider_info())

        return providers_info

    @staticmethod
    async def generate(message: str, provider_name: str = "groq"):

        provider = ProviderService.get_provider(provider_name)

        if not provider:

            provider = ProviderService.get_default_provider()

        return await provider.generate(message)

    @staticmethod
    async def execute_many(message: str, provider_names: list[str] | None = None):

        if not provider_names:

            provider_names = ["groq", "cerebras", "sambanova"]

        unique_provider_names = list(dict.fromkeys(provider_names))

        tasks = [
            ProviderService._safe_generate(provider_name=provider_name, message=message)
            for provider_name in (unique_provider_names)
        ]

        results = await asyncio.gather(*tasks)

        all_responses = {}

        failed_providers = []

        execution_metadata = []

        total_execution_time = 0

        successful_models = 0

        failed_models = 0

        # Sum of reported usage across successful responders (PH15, D-10); None
        # contributions are ignored. The whole turn counts as one request.
        total_tokens = 0

        any_tokens = False

        for result in results:

            provider_name = result["provider"]

            execution_metadata.append(
                {
                    "provider": provider_name,
                    "success": result["success"],
                    "execution_time": result["execution_time"],
                    "model": result.get("model"),
                    "error": result.get("error"),
                }
            )

            total_execution_time += result["execution_time"]

            if result["success"]:

                successful_models += 1

                tokens = result.get("total_tokens")

                if tokens is not None:

                    total_tokens += tokens

                    any_tokens = True

                all_responses[provider_name] = {
                    "response": result["response"],
                    "model": result["model"],
                    "execution_time": result["execution_time"],
                    "total_tokens": tokens,
                    "provider": provider_name,
                    "success": True,
                }

            else:

                failed_models += 1

                failed_providers.append(
                    {
                        "provider": provider_name,
                        "error": result["error"],
                        "reason": result.get("reason"),
                    }
                )

        average_execution_time = 0

        if results:

            average_execution_time = round(total_execution_time / len(results), 2)

        execution_summary = {
            "total_models": len(results),
            "successful_models": (successful_models),
            "failed_models": (failed_models),
            "average_execution_time": (average_execution_time),
        }

        return {
            "all_responses": all_responses,
            "failed_providers": (failed_providers),
            "execution_metadata": (execution_metadata),
            "execution_summary": (execution_summary),
            # Aggregate usage for the turn; None when no provider reported it.
            "total_tokens": (total_tokens if any_tokens else None),
        }

    @staticmethod
    async def _safe_generate(provider_name: str, message: str):

        start_time = time.perf_counter()

        try:

            provider = ProviderService.get_provider(provider_name)

            if not provider:

                return {
                    "provider": provider_name,
                    "success": False,
                    "error": "Provider not found",
                    "execution_time": 0,
                    "model": None,
                }

            result = await provider.generate_full(message)

            execution_time = round(time.perf_counter() - start_time, 2)

            return {
                "provider": provider_name,
                "success": True,
                "response": result["text"],
                "total_tokens": result.get("total_tokens"),
                "model": provider.model_name,
                "execution_time": (execution_time),
            }

        except Exception as error:

            execution_time = round(time.perf_counter() - start_time, 2)

            reason = classify_provider_failure(str(error))

            log_event(
                logger,
                "provider_error",
                provider=provider_name,
                error=str(error),
                reason=reason,
                execution_time=execution_time,
            )

            return {
                "provider": provider_name,
                "success": False,
                "error": str(error),
                "reason": reason,
                "execution_time": (execution_time),
                "model": None,
            }

    @staticmethod
    async def generate_stream(message: str, provider_name: str = "groq"):

        provider = ProviderService.get_provider(provider_name)

        if not provider:

            provider = ProviderService.get_default_provider()

        async for chunk in provider.generate_stream(message):

            yield {
                "type": "token",
                "content": chunk,
                "provider": (provider.provider_name),
                "model": (provider.model_name),
            }

    @staticmethod
    async def generate_structured(message: str, provider_name: str = "groq"):

        provider = ProviderService.get_provider(provider_name)

        if not provider:

            provider = ProviderService.get_default_provider()

        return await provider.generate_structured(message)

    @staticmethod
    def build_judge():
        """Build the judge provider from selector config.

        The judge model is decoupled from the responder roster: for Groq we run
        a dedicated, neutral model (``SELECTOR_MODEL``, e.g. qwen3-32b) rather
        than the groq responder's model, so the judge has no self-bias.
        """
        if SELECTOR_PROVIDER == "gemini":
            return GeminiProvider()

        if SELECTOR_PROVIDER == "groq":
            judge = GroqProvider()
            judge.model = SELECTOR_MODEL
            return judge

        return ProviderService.get_provider(SELECTOR_PROVIDER) or (
            ProviderService.get_default_provider()
        )

    @staticmethod
    async def execute_selector_ai(message: str, provider_name: str = SELECTOR_PROVIDER):

        provider = ProviderService.build_judge()

        return await asyncio.wait_for(
            provider.generate_selector_response(message), timeout=SELECTOR_TIMEOUT
        )
