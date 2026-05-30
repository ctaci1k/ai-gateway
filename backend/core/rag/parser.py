# backend/core/rag/parser.py
"""Extract plain text from uploaded documents (PH10). Supports PDF and text."""

import io

from pypdf import PdfReader

from core.errors import ValidationError

PDF_TYPES = {"application/pdf"}
TEXT_TYPES = {"text/plain", "text/markdown"}
SUPPORTED_EXTENSIONS = (".pdf", ".txt", ".md")


def _is_pdf(filename: str, content_type: str) -> bool:
    return content_type in PDF_TYPES or filename.lower().endswith(".pdf")


def _is_text(filename: str, content_type: str) -> bool:
    return content_type in TEXT_TYPES or filename.lower().endswith((".txt", ".md"))


def extract_text(filename: str, content_type: str, data: bytes) -> str:
    """Return the document text, or raise ValidationError for unsupported input.

    Each failure carries a distinct ``code`` so the frontend can show a precise,
    localized message instead of the raw English text (PH13).
    """
    if not data:
        raise ValidationError("Uploaded file is empty", code="empty_file")

    if _is_pdf(filename, content_type):
        try:
            reader = PdfReader(io.BytesIO(data))
            text = "\n".join(page.extract_text() or "" for page in reader.pages)
        except Exception as error:  # malformed PDF
            raise ValidationError(
                f"Could not read PDF: {error}", code="unreadable_pdf"
            ) from error
    elif _is_text(filename, content_type):
        try:
            text = data.decode("utf-8")
        except UnicodeDecodeError:
            text = data.decode("utf-8", errors="replace")
    else:
        raise ValidationError(
            "Unsupported file type. Allowed: PDF, TXT, MD",
            code="unsupported_type",
        )

    text = text.strip()
    if not text:
        raise ValidationError(
            "No extractable text found in the document", code="no_text"
        )
    return text
