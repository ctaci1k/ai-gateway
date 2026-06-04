# backend/tests/test_repository.py

import json

from memory.sql_repository import SqlChatRepository


def _msg(repo, text, model="groq"):
    return repo.add_message(
        user_message=text,
        best_response="resp",
        all_responses={model: {"response": "resp", "model": "m"}},
        selected_model=model,
        compare_mode=True,
        selector_used=True,
    )


async def test_add_and_get_messages(repo):
    await _msg(repo, "first")
    await _msg(repo, "second")
    messages = await repo.get_messages()
    assert [m["user_message"] for m in messages] == ["first", "second"]


async def test_preferences_accumulate(repo):
    await _msg(repo, "a", model="groq")
    await _msg(repo, "b", model="groq")
    prefs = await repo.get_user_preferences()
    assert prefs["total_messages"] == 2
    assert prefs["preferred_models"]["groq"] == 2
    profile = await repo.get_personalization_profile()
    assert profile["preferred_models"]["groq"] == 2


async def test_sliding_window_trims_to_history_limit(repo):
    # Default HISTORY_LIMIT is 10.
    for i in range(13):
        await _msg(repo, f"m{i}")
    messages = await repo.get_messages()
    assert len(messages) == 10
    # Oldest three evicted; window keeps m3..m12.
    assert messages[0]["user_message"] == "m3"
    assert messages[-1]["user_message"] == "m12"


async def test_persistence_across_new_repository_instance(repo):
    await _msg(repo, "persisted")
    # A brand-new repository instance for the same user reads the same database.
    other = SqlChatRepository(repo._user_id)
    messages = await other.get_messages()
    assert any(m["user_message"] == "persisted" for m in messages)


async def test_clear_resets_history_and_preferences(repo):
    await _msg(repo, "x")
    await repo.clear()
    assert await repo.get_messages() == []
    prefs = await repo.get_user_preferences()
    assert prefs["total_messages"] == 0


async def test_track_manual_selection(repo):
    await repo.track_manual_selection(selected_model="mistral", selector_model="groq")
    prefs = await repo.get_user_preferences()
    assert prefs["manual_model_selections"]["mistral"] == 1
    assert prefs["response_interactions"]["selector_disagreements"] == 1


async def test_to_json_roundtrip(repo):
    await _msg(repo, "hello")
    payload = json.loads(await repo.to_json())
    assert "messages" in payload and "user_preferences" in payload
    assert payload["messages"][0]["user_message"] == "hello"
