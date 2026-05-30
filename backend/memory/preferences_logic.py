# backend/memory/preferences_logic.py
"""Pure personalization-preference logic.

Shared by every ChatRepository implementation (in-memory and SQL) so the
counting/aggregation rules live in exactly one place. Functions mutate and
return the given ``prefs`` dict.
"""

from typing import Any


def default_preferences() -> dict[str, Any]:
    return {
        "preferred_models": {},
        "manual_model_selections": {},
        "response_style_preferences": {},
        "response_interactions": {
            "viewed_responses": 0,
            "manual_selections": 0,
            "selector_agreements": 0,
            "selector_disagreements": 0,
        },
        "selector_usage_count": 0,
        "compare_mode_usage_count": 0,
        "total_messages": 0,
        "favorite_response_style": None,
    }


def apply_message(
    prefs: dict[str, Any],
    selected_model: str | None = None,
    selector_used: bool = False,
    compare_mode: bool = False,
) -> dict[str, Any]:
    prefs["total_messages"] += 1

    if selector_used:
        prefs["selector_usage_count"] += 1

    if compare_mode:
        prefs["compare_mode_usage_count"] += 1

    if selected_model:
        preferred = prefs["preferred_models"]
        preferred[selected_model] = preferred.get(selected_model, 0) + 1

    return prefs


def apply_manual_selection(
    prefs: dict[str, Any],
    selected_model: str,
    selector_model: str | None = None,
) -> dict[str, Any]:
    interactions = prefs["response_interactions"]
    interactions["manual_selections"] += 1

    manual = prefs["manual_model_selections"]
    manual[selected_model] = manual.get(selected_model, 0) + 1

    if selector_model:
        if selected_model == selector_model:
            interactions["selector_agreements"] += 1
        else:
            interactions["selector_disagreements"] += 1

    return prefs


def personalization_profile(prefs: dict[str, Any]) -> dict[str, Any]:
    return {
        "preferred_models": prefs["preferred_models"],
        "manual_model_selections": prefs["manual_model_selections"],
        "response_style_preferences": prefs["response_style_preferences"],
        "favorite_response_style": prefs["favorite_response_style"],
        "response_interactions": prefs["response_interactions"],
    }


def build_interaction_record(
    *,
    user_message: str,
    best_response: str,
    all_responses: dict,
    selected_model: str | None = None,
    failed_providers: list | None = None,
    selector_used: bool = False,
    execution_metadata: list | None = None,
    execution_summary: dict | None = None,
    selector_scores: dict | None = None,
    selector_reason: str | None = None,
    selector_metadata: dict | None = None,
    compare_mode: bool = False,
    selector_provider: str | None = None,
    selector_model: str | None = None,
    selector_confidence: float = 0,
    selector_fallback_used: bool = False,
    manual_override: bool = False,
    manually_selected_model: str | None = None,
) -> dict[str, Any]:
    """Build one history record (mirrors the legacy ChatBuffer message shape)."""
    return {
        "user_message": user_message,
        "best_response": best_response,
        "selected_model": selected_model,
        "all_responses": all_responses,
        "failed_providers": failed_providers or [],
        "selector_used": selector_used,
        "execution_metadata": execution_metadata or [],
        "execution_summary": execution_summary or {},
        "selector_scores": selector_scores or {},
        "selector_reason": selector_reason,
        "selector_metadata": selector_metadata or {},
        "selector_provider": selector_provider,
        "selector_model": selector_model,
        "selector_confidence": selector_confidence,
        "selector_fallback_used": selector_fallback_used,
        "compare_mode": compare_mode,
        "compare_summary": {
            "total_models": len(all_responses),
            "failed_models": len(failed_providers or []),
            "selected_model": selected_model,
        },
        "manual_override": manual_override,
        "manually_selected_model": manually_selected_model,
    }
