# backend/tests/test_ai_selector.py

from selector.ai_selector import AISelector


def test_empty_responses_returns_none():
    result = AISelector.select_best_response({})
    assert result["selected_model"] is None
    assert result["best_response"] == ""


def test_picks_highest_scoring_response():
    responses = {
        "groq": "ok",
        "mistral": (
            "Because this is a structured, detailed answer.\n"
            "- First point with example\n"
            "- Then a second point\n"
            "Therefore the summary is important. " * 20
        ),
    }
    result = AISelector.select_best_response(responses)
    assert result["selected_model"] == "mistral"
    assert result["scores"]["mistral"] >= result["scores"]["groq"]
    assert result["best_response"] == responses["mistral"]


def test_scores_present_for_all_providers():
    responses = {"groq": "a", "scout": "b"}
    result = AISelector.select_best_response(responses)
    assert set(result["scores"].keys()) == {"groq", "scout"}
