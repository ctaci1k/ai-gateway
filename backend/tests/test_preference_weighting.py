# backend/tests/test_preference_weighting.py
"""Bounded manual-preference post-weighting of the judge verdict (PH16/E, D-11).

Covers the three guarantees: (a) on comparable answers a repeatedly
manually-selected model wins; (b) the choice is order-independent; (c) a clearly
better answer is never overridden.
"""

from selector.preference_weighting import (
    PREFERENCE_NEAR_TIE_MARGIN,
    apply_preference_weighting,
)

RESPONSES = {"groq": "A", "cerebras": "B", "sambanova": "C"}


def _ctx(manual=None, preferred=None):
    return {
        "manual_model_selections": manual or {},
        "preferred_models": preferred or {},
    }


def test_near_tie_shifts_to_manually_preferred_model():
    # Judge narrowly picks groq; user has manually chosen cerebras repeatedly.
    scores = {"groq": 80, "cerebras": 78, "sambanova": 60}
    final, info = apply_preference_weighting(
        "groq", scores, RESPONSES, _ctx(manual={"cerebras": 4})
    )
    assert final == "cerebras"
    assert info["applied"] is True
    assert info["from"] == "groq" and info["to"] == "cerebras"


def test_clearly_better_answer_is_not_overridden():
    # groq is clearly ahead (gap > margin); preference must NOT override it.
    scores = {"groq": 95, "cerebras": 78, "sambanova": 60}
    final, info = apply_preference_weighting(
        "groq", scores, RESPONSES, _ctx(manual={"cerebras": 10})
    )
    assert final == "groq"
    assert info["applied"] is False


def test_no_preferences_leaves_pick_unchanged():
    scores = {"groq": 80, "cerebras": 79}
    final, info = apply_preference_weighting("groq", scores, RESPONSES, _ctx())
    assert final == "groq"
    assert info["applied"] is False


def test_choice_is_order_independent():
    scores_a = {"groq": 80, "cerebras": 78, "sambanova": 79}
    scores_b = {"sambanova": 79, "cerebras": 78, "groq": 80}
    responses_b = {"sambanova": "C", "cerebras": "B", "groq": "A"}
    ctx = _ctx(manual={"cerebras": 5})
    final_a, _ = apply_preference_weighting("groq", scores_a, RESPONSES, ctx)
    final_b, _ = apply_preference_weighting("groq", scores_b, responses_b, ctx)
    assert final_a == final_b == "cerebras"


def test_does_not_shift_when_pick_is_already_most_preferred():
    scores = {"groq": 80, "cerebras": 78}
    final, info = apply_preference_weighting(
        "groq", scores, RESPONSES, _ctx(manual={"groq": 3, "cerebras": 1})
    )
    assert final == "groq"
    assert info["applied"] is False


def test_manual_outweighs_preferred_on_ties():
    # Equal judge scores; cerebras has more manual picks, groq more passive
    # preferred tallies. Manual (the explicit override) must win.
    scores = {"groq": 80, "cerebras": 80}
    final, _ = apply_preference_weighting(
        "groq",
        scores,
        RESPONSES,
        _ctx(manual={"cerebras": 2}, preferred={"groq": 3}),
    )
    assert final == "cerebras"


def test_margin_boundary_is_inclusive():
    # Exactly at the margin counts as a near-tie (eligible).
    scores = {"groq": 80, "cerebras": 80 - PREFERENCE_NEAR_TIE_MARGIN}
    final, info = apply_preference_weighting(
        "groq", scores, RESPONSES, _ctx(manual={"cerebras": 3})
    )
    assert final == "cerebras"
    assert info["applied"] is True


def test_criteria_override_disables_nudge():
    # PH33/B5: with explicit user criteria the judge's verdict is authoritative —
    # the manual-preference nudge is disabled even on a genuine near-tie.
    scores = {"groq": 80, "cerebras": 78, "sambanova": 60}
    final, info = apply_preference_weighting(
        "groq",
        scores,
        RESPONSES,
        _ctx(manual={"cerebras": 4}),
        criteria_override=True,
    )
    assert final == "groq"
    assert info["applied"] is False
    assert info["suppressed_by_criteria"] is True
