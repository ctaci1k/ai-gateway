# backend/tests/test_tokens.py
"""Token estimation fallback (PH27/B2, D-18)."""

from core.tokens import estimate_tokens


def test_estimate_empty_is_zero():
    assert estimate_tokens() == 0
    assert estimate_tokens("", None) == 0


def test_estimate_rounds_up_quarter_chars():
    # 4 chars -> 1 token; 5 chars -> ceil(5/4) = 2.
    assert estimate_tokens("abcd") == 1
    assert estimate_tokens("abcde") == 2


def test_estimate_sums_all_texts_ignoring_none():
    # "hello" (5) + "world!" (6) = 11 chars -> ceil(11/4) = 3.
    assert estimate_tokens("hello", None, "world!") == 3
