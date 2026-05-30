# backend/core/rag/chunking.py
"""Split document text into overlapping chunks for embedding (PH10).

A simple, deterministic character-window splitter that prefers to break on
paragraph/sentence boundaries near the window edge so chunks stay coherent.
"""


def chunk_text(text: str, chunk_size: int, overlap: int) -> list[str]:
    text = (text or "").strip()
    if not text:
        return []
    if chunk_size <= 0:
        return [text]
    overlap = max(0, min(overlap, chunk_size - 1))

    chunks: list[str] = []
    start = 0
    length = len(text)

    while start < length:
        end = min(start + chunk_size, length)
        # Prefer a natural boundary in the last 20% of the window.
        if end < length:
            window_start = start + int(chunk_size * 0.8)
            boundary = _last_boundary(text, window_start, end)
            if boundary > start:
                end = boundary

        chunk = text[start:end].strip()
        if chunk:
            chunks.append(chunk)

        if end >= length:
            break
        start = max(end - overlap, start + 1)

    return chunks


def _last_boundary(text: str, lo: int, hi: int) -> int:
    """Return the index just after the last paragraph/sentence break in [lo, hi)."""
    segment = text[lo:hi]
    for marker in ("\n\n", "\n", ". ", "! ", "? "):
        idx = segment.rfind(marker)
        if idx != -1:
            return lo + idx + len(marker)
    return hi
