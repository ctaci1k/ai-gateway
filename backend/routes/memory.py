# backend/routes/memory.py

from fastapi import APIRouter, Depends

from core.auth import current_user, require_csrf
from db.models import User
from memory.repository import get_chat_repository
from schemas.chat_response import MemoryResponse
from schemas.common import MessageResponse

router = APIRouter(tags=["memory"])


@router.get("/memory", response_model=MemoryResponse)
async def get_memory(user: User = Depends(current_user)):
    return MemoryResponse(memory=await get_chat_repository(user.id).get_messages())


@router.get("/memory/json")
async def memory_json(user: User = Depends(current_user)):
    return await get_chat_repository(user.id).to_json()


@router.delete(
    "/memory",
    response_model=MessageResponse,
    dependencies=[Depends(current_user), Depends(require_csrf)],
)
async def clear_memory(user: User = Depends(current_user)):
    await get_chat_repository(user.id).clear()
    return MessageResponse(message="Memory cleared")
