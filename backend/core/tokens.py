# backend/core/tokens.py
"""Token estimation fallback (PH27/B2, D-18).

The canonical token figure in ``usage_events`` is the provider-reported usage
(Compare aggregates responder ``usage.total_tokens``; Single stream reads the
``include_usage`` final chunk). When a provider does not report usage, we fall
back to a cheap, dependency-free heuristic so reports still show a meaningful
number, flagged ``token_estimated=true`` in the UI.

Heuristic: ``ceil(total_chars / 4)`` — the common ~4-chars-per-token rule of
thumb for English/Latin text. tiktoken would be more precise but adds a heavy
dependency and model-specific encodings; out of scope (D-18).
"""

import math


def estimate_tokens(*texts: str | None) -> int:
    """Estimate token count for the concatenation of ``texts``.

    Sums character lengths (ignoring ``None``/empty) and divides by 4, rounding
    up. Returns 0 only when there is no text at all.
    """
    total_chars = sum(len(t) for t in texts if t)
    if total_chars <= 0:
        return 0
    return math.ceil(total_chars / 4)
