# backend/schemas/selector_schema.py

from pydantic import BaseModel
from pydantic import Field


class SelectorScoreSchema(BaseModel):

    provider: str

    score: float = Field(
        ge=0,
        le=100
    )


class SelectorResultSchema(BaseModel):

    selected_model: str

    confidence: float = Field(
        ge=0,
        le=1
    )

    reason: str

    scores: dict[str, float]

    fallback_used: bool = False

    selector_provider: str

    selector_model: str