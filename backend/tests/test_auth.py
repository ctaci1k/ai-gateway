# backend/tests/test_auth.py

from tests.conftest import TEST_REGISTRATION_CODE


def _register(client, username, password="password123", code=TEST_REGISTRATION_CODE):
    return client.post(
        "/auth/register",
        json={
            "username": username,
            "password": password,
            "registration_code": code,
        },
    )


def test_register_login_me_logout_flow(client):
    reg = _register(client, "bob")
    assert reg.status_code == 200
    body = reg.json()
    assert body["user"]["username"] == "bob"
    csrf = body["csrf_token"]

    # /auth/me works with the session cookie.
    me = client.get("/auth/me")
    assert me.status_code == 200
    assert me.json()["username"] == "bob"

    # logout requires CSRF header.
    assert client.post("/auth/logout").status_code == 403
    out = client.post("/auth/logout", headers={"X-CSRF-Token": csrf})
    assert out.status_code == 200

    # session cleared.
    assert client.get("/auth/me").status_code == 401


def test_register_duplicate_username_conflict(client):
    assert _register(client, "carol").status_code == 200
    dup = _register(client, "carol")
    assert dup.status_code == 409
    assert dup.json()["error"]["code"] == "conflict"


def test_register_validation(client):
    assert _register(client, "ab").status_code == 400  # username too short
    assert _register(client, "validname", "short").status_code == 400  # weak password


def test_login_invalid_credentials(client):
    _register(client, "dave")
    bad = client.post("/auth/login", json={"username": "dave", "password": "wrongpass"})
    assert bad.status_code == 401
    assert bad.json()["error"]["code"] == "unauthorized"


def test_me_requires_auth(client):
    assert client.get("/auth/me").status_code == 401


async def test_data_isolated_per_user(repo):
    # `repo` is user "tester"; create a second user and confirm separation.
    from memory.sql_repository import SqlChatRepository
    from services.auth_service import AuthService

    await repo.add_message(
        user_message="from tester",
        best_response="r",
        all_responses={"groq": {"response": "r", "model": "m"}},
        selected_model="groq",
        compare_mode=True,
        selector_used=True,
    )

    other_user = await AuthService.register("other", "password123")
    other_repo = SqlChatRepository(other_user.id)

    tester_msgs = await repo.get_messages()
    other_msgs = await other_repo.get_messages()

    assert [m["user_message"] for m in tester_msgs] == ["from tester"]
    assert other_msgs == []
    assert (await other_repo.get_user_preferences())["total_messages"] == 0
