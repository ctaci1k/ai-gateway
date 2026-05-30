# backend/routes/documents.py
"""RAG document management (PH10): upload, list, delete. Per-user isolated;
mutations require CSRF."""

from fastapi import APIRouter, Depends, File, UploadFile

from core.auth import current_user, require_csrf
from core.errors import ValidationError
from core.logging import get_logger, log_event
from db.models import User
from schemas.common import MessageResponse
from schemas.documents import DocumentListResponse, DocumentSummary
from services.rag_service import RagService

router = APIRouter(prefix="/documents", tags=["documents"])

logger = get_logger("documents")


@router.get("", response_model=DocumentListResponse)
async def list_documents(user: User = Depends(current_user)):
    documents = await RagService.list_documents(user.id)
    return DocumentListResponse(documents=documents)


@router.post(
    "",
    response_model=DocumentSummary,
    dependencies=[Depends(require_csrf)],
)
async def upload_document(
    file: UploadFile = File(...), user: User = Depends(current_user)
):
    data = await file.read()
    if not data:
        raise ValidationError("Uploaded file is empty", code="empty_file")

    summary = await RagService.ingest(
        user_id=user.id,
        filename=file.filename or "document",
        content_type=file.content_type or "application/octet-stream",
        data=data,
    )
    log_event(
        logger,
        "document_ingested",
        user_id=user.id,
        document_id=summary["id"],
        chunks=summary["chunk_count"],
    )
    return DocumentSummary(**summary)


@router.delete(
    "/{document_id}",
    response_model=MessageResponse,
    dependencies=[Depends(require_csrf)],
)
async def delete_document(document_id: int, user: User = Depends(current_user)):
    await RagService.delete_document(user.id, document_id)
    log_event(logger, "document_deleted", user_id=user.id, document_id=document_id)
    return MessageResponse(message="Document deleted")
