# backend/tests/test_judge_prompt.py
"""Per-user judging criteria (PH24/E2, refined): only the criteria are editable;
the mechanical scaffold (role, rules, JSON/0-100 contract) is fixed. Tests cover
persistence, the GET/PUT endpoint, and that the criteria are injected into the
always-applied scaffold."""

from core.prompts import default_judge_prompt
from selector.selector_prompt import SelectorPromptBuilder
from tests.conftest import TEST_REGISTRATION_CODE

_RESPONSES = {"groq": "answer A", "mistral": "answer B"}

# The override is now just judging criteria — free text, no placeholders.
_VALID_OVERRIDE = "Prefer concise answers; reward concrete code examples."


def test_override_criteria_injected_into_fixed_scaffold():
    prompt, _ = SelectorPromptBuilder.build_selector_prompt(
        user_message="hi", responses=_RESPONSES, judge_prompt_override=_VALID_OVERRIDE
    )
    # The user's criteria appear...
    assert "reward concrete code examples" in prompt
    # ...inside the fixed scaffold: role lock + 0-100 contract are always present,
    # and the data placeholders are substituted (not left literal).
    assert "AI judge" in prompt
    assert "0-100" in prompt
    assert "$user_message" not in prompt and "$judging_criteria" not in prompt
    assert "hi" in prompt


def test_build_uses_default_criteria_when_no_override():
    prompt, _ = SelectorPromptBuilder.build_selector_prompt(
        user_message="hi", responses=_RESPONSES
    )
    assert "Prefer concise answers" not in prompt
    # Default criteria + fixed scaffold.
    assert "Evaluate primarily based on" in prompt
    assert "AI judge" in prompt and "0-100" in prompt


async def test_repository_set_get_clear(repo):
    assert await repo.get_judge_prompt_override() is None
    await repo.set_judge_prompt_override(_VALID_OVERRIDE)
    assert await repo.get_judge_prompt_override() == _VALID_OVERRIDE
    # Blank clears back to the built-in default.
    await repo.set_judge_prompt_override("   ")
    assert await repo.get_judge_prompt_override() is None


def test_get_judge_prompt_endpoint(auth_client):
    client, _ = auth_client
    resp = client.get("/preferences/judge-prompt")
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["override"] is None
    assert body["default"] == default_judge_prompt()


def test_put_judge_prompt_saves_and_resets(auth_client):
    client, headers = auth_client
    saved = client.put(
        "/preferences/judge-prompt",
        json={"override": _VALID_OVERRIDE},
        headers=headers,
    )
    assert saved.status_code == 200, saved.text
    assert saved.json()["override"] == _VALID_OVERRIDE
    assert client.get("/preferences/judge-prompt").json()["override"] == _VALID_OVERRIDE

    # null resets to the built-in default.
    reset = client.put(
        "/preferences/judge-prompt", json={"override": None}, headers=headers
    )
    assert reset.status_code == 200
    assert reset.json()["override"] is None


def test_put_judge_prompt_accepts_free_text_criteria(auth_client):
    # Plain criteria with no placeholders are now valid (the scaffold is fixed).
    client, headers = auth_client
    resp = client.put(
        "/preferences/judge-prompt",
        json={"override": "Favor short, well-structured answers."},
        headers=headers,
    )
    assert resp.status_code == 200, resp.text
    assert resp.json()["override"] == "Favor short, well-structured answers."


def test_put_judge_prompt_rejects_overlong_criteria(auth_client):
    client, headers = auth_client
    resp = client.put(
        "/preferences/judge-prompt",
        json={"override": "x" * 9000},
        headers=headers,
    )
    assert resp.status_code == 400
    assert resp.json()["error"]["code"] == "validation_error"


def test_put_judge_prompt_requires_csrf(auth_client):
    client, _ = auth_client
    assert (
        client.put(
            "/preferences/judge-prompt", json={"override": _VALID_OVERRIDE}
        ).status_code
        == 403
    )


def test_judge_prompt_isolated_per_user(client):
    a = client.post(
        "/auth/register",
        json={
            "username": "alice",
            "password": "password123",
            "registration_code": TEST_REGISTRATION_CODE,
        },
    )
    alice_csrf = {"X-CSRF-Token": a.json()["csrf_token"]}
    client.put(
        "/preferences/judge-prompt",
        json={"override": _VALID_OVERRIDE},
        headers=alice_csrf,
    )

    client.post(
        "/auth/register",
        json={
            "username": "bob",
            "password": "password123",
            "registration_code": TEST_REGISTRATION_CODE,
        },
    )
    # Bob has no override (per-user isolation).
    assert client.get("/preferences/judge-prompt").json()["override"] is None
