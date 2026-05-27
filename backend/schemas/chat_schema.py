# backend/schemas/chat_schema.py

from pydantic import BaseModel, Field


class ChatRequest(BaseModel):

    message: str = Field(
        min_length=1,
        max_length=2000
    )

    provider: str = Field(
        default="groq",
        min_length=1
    )

    providers: list[str] | None = None

    compare_mode: bool = False

    selector_enabled: bool = False