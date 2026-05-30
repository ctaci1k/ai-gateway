# backend/schemas/common.py

from pydantic import BaseModel


class ErrorDetail(BaseModel):
    code: str
    message: str


class ErrorResponse(BaseModel):
    """Unified error envelope (decision D-5)."""

    error: ErrorDetail


class MessageResponse(BaseModel):
    message: str
