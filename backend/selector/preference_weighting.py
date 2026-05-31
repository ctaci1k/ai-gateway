# backend/selector/preference_weighting.py
"""Deterministic, bounded post-weighting of the judge's verdict (PH16/E, D-11).

The AI judge (Qwen) is the primary decision-maker. On top of it we apply a small
preference nudge derived from the user's manual selections so that, *on
comparable answers*, the judge's pick shifts toward the model the user keeps
choosing — that is the whole point of letting a user override the judge.

The nudge is strictly limited so it can only re-rank **near-tied** top
candidates and can NEVER override a clearly better answer:

* a candidate is only eligible if its judge score is within
  ``PREFERENCE_NEAR_TIE_MARGIN`` of the judge's own pick;
* among eligible candidates we choose the one with the highest preference
  weight, and only switch if that weight is *strictly* higher than the current
  pick's.

It is fully deterministic (no randomness, order-independent — it operates on a
score map keyed by provider) and transparent (returns an info block that the
orchestrator surfaces in ``selector_metadata`` and the reason text).
"""

from config.selector_config import ALLOWED_MODELS

# Judge scores are on a 0-100 scale. Preference only re-ranks candidates whose
# score is within this many points of the judge's pick, so any answer the judge
# rated clearly higher (a larger gap) is never overridden.
PREFERENCE_NEAR_TIE_MARGIN = 5.0


def _score_of(scores: dict, provider: str) -> float | None:
    value = scores.get(provider)
    if isinstance(value, bool):  # bools are ints in Python; reject them
        return None
    if isinstance(value, int | float):
        return float(value)
    return None


def _preference_weight(
    provider: str, manual_selections: dict, preferred_models: dict
) -> int:
    # Manual picks are the explicit human override → weighted double the
    # judge-agreement-derived preferred_models tally.
    return 2 * manual_selections.get(provider, 0) + preferred_models.get(provider, 0)


def apply_preference_weighting(
    selected_model: str,
    scores: dict,
    responses: dict,
    personalization_context: dict | None,
) -> tuple[str, dict]:
    """Return ``(final_model, info)``.

    ``final_model`` is the judge's pick, possibly shifted to a near-tied model
    the user prefers more. ``info`` documents whether/why a shift happened.
    """
    info: dict = {"applied": False}

    if not personalization_context:
        return selected_model, info

    manual = personalization_context.get("manual_model_selections") or {}
    preferred = personalization_context.get("preferred_models") or {}
    if not manual and not preferred:
        return selected_model, info

    base = _score_of(scores, selected_model)
    if base is None:
        # No comparable score for the judge's pick → nothing to weigh against.
        return selected_model, info

    # Eligible = honourable models whose score is within the near-tie band.
    contenders = [
        provider
        for provider in responses
        if provider in ALLOWED_MODELS
        and (s := _score_of(scores, provider)) is not None
        and s >= base - PREFERENCE_NEAR_TIE_MARGIN
    ]
    if selected_model not in contenders:
        contenders.append(selected_model)

    current_weight = _preference_weight(selected_model, manual, preferred)

    # Highest preference weight wins; ties break toward higher score, then toward
    # keeping the judge's pick, then a stable provider order.
    def rank(provider: str) -> tuple:
        return (
            _preference_weight(provider, manual, preferred),
            _score_of(scores, provider) or 0.0,
            provider == selected_model,
            provider,
        )

    best = max(contenders, key=rank)
    best_weight = _preference_weight(best, manual, preferred)

    if best != selected_model and best_weight > current_weight:
        info = {
            "applied": True,
            "from": selected_model,
            "to": best,
            "from_weight": current_weight,
            "to_weight": best_weight,
            "near_tie_margin": PREFERENCE_NEAR_TIE_MARGIN,
        }
        return best, info

    return selected_model, info
