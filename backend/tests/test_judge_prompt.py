# backend/tests/test_judge_prompt.py
"""Per-user judge-prompt override (PH24, E2): persistence, the GET/PUT endpoint
with placeholder validation, and that the override drives the built prompt."""

from core.prompts import default_judge_prompt
from selector.selector_prompt import SelectorPromptBuilder
from tests.conftest import TEST_REGISTRATION_CODE

_RESPONSES = {"groq": "answer A", "cerebras": "answer B"}

_VALID_OVERRIDE = (
    "CUSTOM JUDGE. Pick from: $allowed_models_inline\n"
    "$personalization_block\n"
    "QUESTION: $user_message\n"
    "RESPONSES: $responses_block\n"
    "JSON: $scores_example"
)


def test_build_uses_override_when_present():
    prompt, _ = SelectorPromptBuilder.build_selector_prompt(
        user_message="hi", responses=_RESPONSES, judge_prompt_override=_VALID_OVERRIDE
    )
    assert prompt.startswith("CUSTOM JUDGE.")
    # Placeholders are substituted, not left literal.
    assert "$user_message" not in prompt
    assert "hi" in prompt


def test_build_uses_default_when_no_override():
    prompt, _ = SelectorPromptBuilder.build_selector_prompt(
        user_message="hi", responses=_RESPONSES
    )
    assert "CUSTOM JUDGE." not in prompt
    assert "AI judge" in prompt or "AI judge" in prompt.lower()


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


def test_put_judge_prompt_rejects_missing_placeholders(auth_client):
    client, headers = auth_client
    resp = client.put(
        "/preferences/judge-prompt",
        json={"override": "just some text without placeholders"},
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
