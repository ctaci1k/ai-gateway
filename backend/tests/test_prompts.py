# backend/tests/test_prompts.py

import pytest

from core.prompts import PromptError, get_prompt, prompt_version, render_prompt
from selector.selector_prompt import SelectorPromptBuilder


def test_version_is_int():
    assert isinstance(prompt_version(), int)
    assert prompt_version() >= 1


def test_get_known_prompt():
    template = get_prompt("selector_judge")
    assert "AI judge" in template
    assert "$user_message" in template


def test_unknown_prompt_raises():
    with pytest.raises(PromptError):
        get_prompt("does_not_exist")


def test_render_substitutes_placeholders_and_preserves_json():
    rendered = render_prompt(
        "selector_judge",
        user_message="What is 2+2?",
        responses_block="MODEL: groq",
        personalization_block="",
    )
    assert "What is 2+2?" in rendered
    assert "MODEL: groq" in rendered
    # Literal JSON example braces must survive templating.
    assert '"selected_model": "groq"' in rendered
    # No unfilled placeholders remain.
    assert "$user_message" not in rendered


def test_provider_system_prompts():
    assert "JSON" in get_prompt("provider_json_system")
    assert "evaluator" in get_prompt("provider_selector_system")


def test_builder_without_personalization():
    prompt = SelectorPromptBuilder.build_selector_prompt(
        user_message="Hello?",
        responses={"groq": "Hi", "cerebras": "Hello there"},
    )
    assert "Hello?" in prompt
    assert "groq" in prompt and "cerebras" in prompt
    assert "USER PERSONALIZATION PROFILE" not in prompt


def test_builder_with_personalization():
    prompt = SelectorPromptBuilder.build_selector_prompt(
        user_message="Hello?",
        responses={"groq": "Hi"},
        personalization_context={"preferred_models": {"groq": 3}},
    )
    assert "USER PERSONALIZATION PROFILE" in prompt
    assert "groq" in prompt
