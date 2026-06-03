# backend/tests/test_prompts.py

import pytest

from core.prompts import (
    PromptError,
    get_prompt,
    language_directive,
    prompt_version,
    render_prompt,
    with_language_directive,
)
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
        responses_block="MODEL: AI 1",
        personalization_block="",
        allowed_models_list="        - AI 1",
        allowed_models_inline="AI 1",
        scores_example='{"selected_model": "AI 1", "scores": {"AI 1": 90}}',
    )
    assert "What is 2+2?" in rendered
    assert "MODEL: AI 1" in rendered
    # Literal JSON braces in an injected value must survive templating.
    assert '"selected_model": "AI 1"' in rendered
    # No unfilled placeholders remain.
    assert "$user_message" not in rendered
    assert "$scores_example" not in rendered


def test_provider_system_prompts():
    assert "JSON" in get_prompt("provider_json_system")
    assert "evaluator" in get_prompt("provider_selector_system")


def test_builder_without_personalization():
    prompt, label_to_slot = SelectorPromptBuilder.build_selector_prompt(
        user_message="Hello?",
        responses={"groq": "Hi", "cerebras": "Hello there"},
    )
    assert "Hello?" in prompt
    # Responses are shown under neutral, brand-free AI labels (PH22), mapped back
    # to real slots by the caller.
    assert "AI 1" in prompt and "AI 2" in prompt
    assert "Hi" in prompt and "Hello there" in prompt
    assert set(label_to_slot.values()) == {"groq", "cerebras"}
    # Brand names are never leaked to the judge.
    assert "groq" not in prompt and "cerebras" not in prompt
    assert "USER PERSONALIZATION PROFILE" not in prompt


def test_builder_with_personalization():
    prompt, label_to_slot = SelectorPromptBuilder.build_selector_prompt(
        user_message="Hello?",
        responses={"groq": "Hi"},
        personalization_context={
            "preferred_models": {"groq": 3},
            "manual_model_selections": {"cerebras": 2},
        },
    )
    assert "USER PERSONALIZATION PROFILE" in prompt
    assert "Manually Selected Models" in prompt
    assert label_to_slot == {"AI 1": "groq"}
    # The in-comparison model appears by its neutral label, not its brand name.
    assert '"AI 1": 3' in prompt
    assert "groq" not in prompt


def test_remap_verdict_to_slots_maps_labels():
    label_to_slot = {"AI 1": "groq", "AI 2": "custom-abc"}
    verdict = {"selected_model": "AI 2", "scores": {"AI 1": 70, "AI 2": 92}}
    remapped = SelectorPromptBuilder.remap_verdict_to_slots(verdict, label_to_slot)
    assert remapped["selected_model"] == "custom-abc"
    assert remapped["scores"] == {"groq": 70, "custom-abc": 92}


def test_remap_verdict_passes_through_unknown_keys():
    # A judge that echoed real slot names instead of labels is left unchanged.
    label_to_slot = {"AI 1": "groq"}
    verdict = {"selected_model": "groq", "scores": {"groq": 88}}
    remapped = SelectorPromptBuilder.remap_verdict_to_slots(verdict, label_to_slot)
    assert remapped["selected_model"] == "groq"
    assert remapped["scores"] == {"groq": 88}


def test_language_directive_maps_locale_to_fallback_language():
    assert "Ukrainian" in language_directive("uk")
    assert "Polish" in language_directive("pl")
    assert "English" in language_directive("en")
    # Unknown / None locales fall back to English.
    assert "English" in language_directive(None)
    assert "English" in language_directive("zz")
    # Case-insensitive.
    assert "Polish" in language_directive("PL")


def test_with_language_directive_prepends_and_preserves_message():
    out = with_language_directive("Cześć, co słychać?", "pl")
    assert "Polish" in out  # the directive
    assert "same language" in out.lower()
    assert "Cześć, co słychać?" in out  # original message preserved
    # The directive comes first, the message after.
    assert out.index("Polish") < out.index("Cześć")


def test_response_ordering_is_deterministic_but_not_position_fixed():
    # Anti-positional bias (PH16/E): ordering is stable for a given request but
    # the first-listed provider varies across requests, so "first = winner"
    # drift no longer tracks the insertion order.
    responses = {"groq": "a", "cerebras": "b", "sambanova": "c"}
    first = SelectorPromptBuilder._ordered_responses("hello", responses)
    again = SelectorPromptBuilder._ordered_responses("hello", responses)
    assert first == again  # deterministic per request

    firsts = {
        SelectorPromptBuilder._ordered_responses(f"q{i}", responses)[0][0]
        for i in range(40)
    }
    assert len(firsts) > 1  # not always the same provider first
