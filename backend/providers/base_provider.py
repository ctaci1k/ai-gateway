# backend/providers/base_provider.py

from abc import ABC, abstractmethod
from typing import AsyncGenerator, Any


class BaseProvider(ABC):

    provider_name = "base"

    model_name = "unknown"

    supports_streaming = True

    supports_structured_output = True

    supports_tool_calling = False

    supports_vision = False

    max_context_window = 8192

    @abstractmethod
    async def generate(
        self,
        message: str
    ) -> str:
        pass

    @abstractmethod
    async def generate_structured(
        self,
        message: str
    ) -> Any:
        pass

    @abstractmethod
    async def generate_stream(
        self,
        message: str
    ) -> AsyncGenerator[str, None]:
        pass

    def get_provider_info(self):

        return {
            "provider": self.provider_name,
            "model": self.model_name,
            "supports_streaming": self.supports_streaming,
            "supports_structured_output": self.supports_structured_output,
            "supports_tool_calling": self.supports_tool_calling,
            "supports_vision": self.supports_vision,
            "max_context_window": self.max_context_window,
        }