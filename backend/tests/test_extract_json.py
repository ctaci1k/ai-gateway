# backend/tests/test_extract_json.py

import pytest

from providers.base_provider import extract_json


def test_plain_json():
    assert extract_json('{"a": 1}') == {"a": 1}


def test_json_fence():
    assert extract_json('```json\n{"a": 1}\n```') == {"a": 1}


def test_bare_fence():
    assert extract_json('```\n{"a": 1}\n```') == {"a": 1}


def test_json_embedded_in_prose():
    text = 'Sure! Here is the result: {"selected_model": "groq"} — done.'
    assert extract_json(text) == {"selected_model": "groq"}


def test_array_json():
    assert extract_json("[1, 2, 3]") == [1, 2, 3]


def test_invalid_raises():
    with pytest.raises(ValueError):
        extract_json("no json here at all")


def test_none_raises():
    with pytest.raises(ValueError):
        extract_json(None)
