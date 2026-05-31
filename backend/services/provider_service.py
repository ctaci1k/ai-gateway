# backend/services/provider_service.py

import asyncio
import time

from openai import OpenAI

from config.models_config import get_model_spec
from config.selector_config import SELECTOR_MODEL, SELECTOR_PROVIDER, SELECTOR_TIMEOUT
from core.logging import get_logger, log_event
from providers.base_provider import BaseProvider
from providers.cerebras_provider import CerebrasProvider
from providers.gemini_provider import GeminiProvider
from providers.groq_provider import GroqProvider
from providers.openai_compatible import OpenAICompatibleProvider
from providers.sambanova_provider import SambaNovaProvider

logger = get_logger("provider")

# Fixed OpenAI-compatible endpoints for the built-in responder slots (BYOK,
# PH17). A user overriding a default slot supplies only key + model_id; the
# endpoint stays the provider's own. Custom (4th/5th) slots must carry base_url.
DEFAULT_BASE_URLS = {
    "groq": "https://api.groq.com/openai/v1",
    "cerebras": "https://api.cerebras.ai/v1",
    "sambanova": "https://api.sambanova.ai/v1",
}
# The judge defaults to Groq's endpoint (the built-in judge runs Qwen on Groq).
JUDGE_BYOK_SLOT = "byok-judge"

# BYOK request budget (PH21). Disable the OpenAI SDK's automatic retries: on a
# rate-limit (429) the default 2 retries back off ~10s then ~30s, which made key
# validation hang ~40s and trip the dev proxy with a 500. A generous per-request
# timeout still allows long real completions; validation uses a shorter cap.
BYOK_REQUEST_TIMEOUT_SECONDS = 60


class TransientProvider(OpenAICompatibleProvider):
    """An OpenAI-compatible provider built per-request from a user's BYOK key.

    Never cached or stored: the key lives only for the lifetime of one request
    and is discarded with the instance (NQ5). ``model_name`` is the user's exact
    ``model_id`` so the UI labels it truthfully (NQ4).
    """

    def __init__(self, *, slot, base_url, api_key, model_id, max_tokens=None):
        self.provider_name = slot
        # No SDK auto-retries (fail fast on 429/errors instead of ~40s backoff,
        # PH21) + an explicit request timeout.
        self.client = OpenAI(
            api_key=api_key,
            base_url=base_url,
            max_retries=0,
            timeout=BYOK_REQUEST_TIMEOUT_SECONDS,
        )
        self.model = model_id
        self.model_name = model_id
        self.display_name = model_id
        self.max_output_tokens = max_tokens


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
    def _transient_base_url(slot: str, base_url: str | None) -> str:
        """Resolve a BYOK slot's endpoint: explicit base_url, else the built-in
        provider endpoint for a default slot. Custom slots must supply one."""
        resolved = base_url or DEFAULT_BASE_URLS.get(slot)
        if not resolved:
            raise ValueError(f"BYOK slot '{slot}' requires a base_url")
        return resolved

    @staticmethod
    def build_transient_responder(entry: dict) -> "TransientProvider":
        """Build a per-request responder from a BYOK entry (never cached)."""
        slot = entry["slot"]
        spec = get_model_spec(slot)
        return TransientProvider(
            slot=slot,
            base_url=ProviderService._transient_base_url(slot, entry.get("base_url")),
            api_key=entry["api_key"],
            model_id=entry["model_id"],
            max_tokens=spec.max_tokens if spec else None,
        )

    @staticmethod
    def build_transient_judge(entry: dict) -> "TransientProvider":
        """Build a per-request judge from a BYOK entry (Groq endpoint default)."""
        return TransientProvider(
            slot=JUDGE_BYOK_SLOT,
            base_url=entry.get("base_url") or DEFAULT_BASE_URLS["groq"],
            api_key=entry["api_key"],
            model_id=entry["model_id"],
        )

    @staticmethod
    def resolve_responders(
        provider_slots: list[str], byok_responders: list[dict] | None
    ) -> dict[str, BaseProvider]:
        """Map each requested slot to a provider instance (PH17/BYOK).

        A slot with a BYOK entry uses a transient provider on the user's key;
        otherwise it falls back to the built-in singleton (the app's key). Slots
        that are neither known nor provided are dropped (defensive)."""
        byok_by_slot = {r["slot"]: r for r in (byok_responders or [])}
        resolved: dict[str, BaseProvider] = {}
        for slot in dict.fromkeys(provider_slots):
            if slot in byok_by_slot:
                resolved[slot] = ProviderService.build_transient_responder(
                    byok_by_slot[slot]
                )
            else:
                provider = ProviderService.get_provider(slot)
                if provider is not None:
                    resolved[slot] = provider
        return resolved

    @staticmethod
    async def execute_many(
        message: str,
        provider_names: list[str] | None = None,
        providers_map: dict[str, BaseProvider] | None = None,
    ):

        if providers_map is None:

            if not provider_names:

                provider_names = ["groq", "cerebras", "sambanova"]

            unique_provider_names = list(dict.fromkeys(provider_names))

            providers_map = {
                name: ProviderService.get_provider(name)
                for name in unique_provider_names
            }

        tasks = [
            ProviderService._safe_generate(
                slot=slot, provider=provider, message=message
            )
            for slot, provider in providers_map.items()
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
    async def _safe_generate(slot: str, provider, message: str):

        start_time = time.perf_counter()

        try:

            if not provider:

                return {
                    "provider": slot,
                    "success": False,
                    "error": "Provider not found",
                    "execution_time": 0,
                    "model": None,
                }

            result = await provider.generate_full(message)

            execution_time = round(time.perf_counter() - start_time, 2)

            return {
                "provider": slot,
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
                provider=slot,
                error=str(error),
                reason=reason,
                execution_time=execution_time,
            )

            return {
                "provider": slot,
                "success": False,
                "error": str(error),
                "reason": reason,
                "execution_time": (execution_time),
                "model": None,
            }

    @staticmethod
    async def generate_stream(message: str, provider_name: str = "groq", provider=None):

        # An explicit provider (e.g. a transient BYOK instance) takes precedence
        # over the named singleton (PH17); otherwise resolve by name.
        if provider is None:

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
    async def execute_selector_ai(message: str, judge_provider=None):

        # A BYOK judge instance overrides the built-in judge (PH17); the judge
        # is still decoupled from the responders, so there is no self-bias.
        provider = judge_provider or ProviderService.build_judge()

        return await asyncio.wait_for(
            provider.generate_selector_response(message), timeout=SELECTOR_TIMEOUT
        )
