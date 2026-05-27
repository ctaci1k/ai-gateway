# backend/schemas/chat_schema.py

from pydantic import BaseModel, Field


class ChatRequest(BaseModel):

    message: str = Field(

        min_length=1,

        max_length=4000
    )

    provider: str = Field(

        default="groq",

        min_length=1
    )

    providers: list[str] | None = Field(
        default=None
    )

    compare_mode: bool = False

    selector_enabled: bool = False

    include_execution_metadata: bool = True

    include_selector_analysis: bool = True

    include_all_responses: bool = True
    