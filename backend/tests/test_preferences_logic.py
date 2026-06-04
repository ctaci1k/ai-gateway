# backend/tests/test_preferences_logic.py

from memory import preferences_logic as pl


def test_default_preferences_shape():
    prefs = pl.default_preferences()
    for key in (
        "preferred_models",
        "manual_model_selections",
        "response_style_preferences",
        "response_interactions",
        "selector_usage_count",
        "compare_mode_usage_count",
        "total_messages",
        "favorite_response_style",
    ):
        assert key in prefs


def test_apply_message_increments_counters():
    prefs = pl.default_preferences()
    pl.apply_message(
        prefs, selected_model="groq", selector_used=True, compare_mode=True
    )
    assert prefs["total_messages"] == 1
    assert prefs["selector_usage_count"] == 1
    assert prefs["compare_mode_usage_count"] == 1
    assert prefs["preferred_models"]["groq"] == 1


def test_apply_manual_selection_agreement_and_disagreement():
    prefs = pl.default_preferences()
    pl.apply_manual_selection(prefs, selected_model="groq", selector_model="groq")
    pl.apply_manual_selection(prefs, selected_model="mistral", selector_model="groq")
    interactions = prefs["response_interactions"]
    assert interactions["manual_selections"] == 2
    assert interactions["selector_agreements"] == 1
    assert interactions["selector_disagreements"] == 1
    assert prefs["manual_model_selections"] == {"groq": 1, "mistral": 1}


def test_personalization_profile_subset():
    prefs = pl.default_preferences()
    profile = pl.personalization_profile(prefs)
    assert set(profile.keys()) == {
        "preferred_models",
        "manual_model_selections",
        "response_style_preferences",
        "favorite_response_style",
        "response_interactions",
    }


def test_build_interaction_record_defaults():
    record = pl.build_interaction_record(
        user_message="hi",
        best_response="hello",
        all_responses={"groq": {"response": "hello"}},
        selected_model="groq",
        compare_mode=True,
    )
    assert record["user_message"] == "hi"
    assert record["failed_providers"] == []
    assert record["compare_summary"]["total_models"] == 1
    assert record["compare_summary"]["selected_model"] == "groq"
