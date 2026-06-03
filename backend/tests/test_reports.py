# backend/tests/test_reports.py
"""Usage Reports aggregations + API (PH27, D-18).

Repository-level tests drive the DB directly in the test's event loop (like the
``repo`` fixture) for full control over timestamps/models/billable/chat_id. HTTP
tests use the ``client`` fixture for auth isolation + CSV.
"""

from datetime import datetime, timedelta
from types import SimpleNamespace

import pytest

from core.db import dispose_engine, session_scope
from db.models import UsageEvent
from memory.chats_repository import SavedChatRepository
from memory.usage_report_repository import UsageReportRepository
from memory.usage_repository import UsageRepository
from services.orchestrator_service import OrchestratorService
from tests.conftest import TEST_REGISTRATION_CODE, _fresh_schema

_BASE = datetime(2026, 6, 1, 12, 0, 0)  # naive UTC anchor


@pytest.fixture
async def env():
    from services.auth_service import AuthService

    await _fresh_schema()
    alice = await AuthService.register("alice", "password123")
    bob = await AuthService.register("bob", "password123")
    yield SimpleNamespace(alice=alice.id, bob=bob.id)
    await dispose_engine()


async def _add(
    user_id,
    *,
    created_at,
    mode="single",
    model="groq",
    tokens=10,
    success=True,
    billable=True,
    estimated=False,
    chat_id=None,
    message="hi",
    key_fingerprint=None,
):
    async with session_scope() as session:
        session.add(
            UsageEvent(
                user_id=user_id,
                created_at=created_at,
                mode=mode,
                message=message,
                selected_model=model,
                total_tokens=tokens,
                success=success,
                billable=billable,
                token_estimated=estimated,
                chat_id=chat_id,
                key_fingerprint=key_fingerprint,
            )
        )


# --- Per-user isolation -----------------------------------------------------


async def test_per_user_isolation(env):
    for i in range(3):
        await _add(env.alice, created_at=_BASE + timedelta(minutes=i))
    for i in range(2):
        await _add(env.bob, created_at=_BASE + timedelta(minutes=i))

    alice_summary = await UsageReportRepository(env.alice).summary(None, None)
    bob_summary = await UsageReportRepository(env.bob).summary(None, None)
    assert alice_summary["total_requests"] == 3
    assert bob_summary["total_requests"] == 2


# --- Summary ----------------------------------------------------------------


async def test_summary_aggregates(env):
    await _add(env.alice, created_at=_BASE, mode="single", model="groq", tokens=10)
    await _add(
        env.alice,
        created_at=_BASE + timedelta(hours=1),
        mode="compare",
        model="cerebras",
        tokens=20,
        estimated=True,
    )
    await _add(
        env.alice,
        created_at=_BASE + timedelta(hours=2),
        mode="single",
        model="groq",
        tokens=5,
        success=False,
        billable=False,
    )

    s = await UsageReportRepository(env.alice).summary(None, None)
    assert s["total_requests"] == 3
    assert s["total_tokens"] == 35
    assert s["tokens_estimated"] is True
    assert s["by_mode"] == {"single": 2, "compare": 1}
    assert s["billable_vs_own"] == {"billable": 2, "own_key": 1}
    assert s["success_rate"] == round(2 / 3, 4)
    assert s["first_event"] == _BASE
    assert s["last_event"] == _BASE + timedelta(hours=2)


# --- By model ---------------------------------------------------------------


async def test_by_model(env):
    await _add(env.alice, created_at=_BASE, model="groq", tokens=10)
    await _add(
        env.alice, created_at=_BASE + timedelta(minutes=1), model="groq", tokens=5
    )
    await _add(
        env.alice,
        created_at=_BASE + timedelta(minutes=2),
        model="cerebras",
        tokens=7,
        success=False,
    )

    models = await UsageReportRepository(env.alice).by_model(None, None)
    by = {m["model"]: m for m in models}
    assert by["groq"]["requests"] == 2
    assert by["groq"]["total_tokens"] == 15
    assert by["groq"]["successful"] == 2
    assert by["cerebras"]["requests"] == 1
    assert by["cerebras"]["successful"] == 0
    # Busiest first.
    assert models[0]["model"] == "groq"


# --- Key-source attribution (PH31, D-21) ------------------------------------


async def test_by_model_splits_same_model_by_key_source(env):
    # Same model "groq" run on the built-in app key (NULL) and on two different
    # own keys → three distinct rows split by (selected_model, key_fingerprint).
    await _add(env.alice, created_at=_BASE, model="groq", key_fingerprint=None)
    await _add(
        env.alice,
        created_at=_BASE + timedelta(minutes=1),
        model="groq",
        key_fingerprint=None,
    )
    await _add(
        env.alice,
        created_at=_BASE + timedelta(minutes=2),
        model="groq",
        key_fingerprint="gsk_••••OTzu",
    )
    await _add(
        env.alice,
        created_at=_BASE + timedelta(minutes=3),
        model="groq",
        key_fingerprint="gsk_••••AbCd",
    )

    models = await UsageReportRepository(env.alice).by_model(None, None)
    groq_rows = {m["key_fingerprint"]: m for m in models if m["model"] == "groq"}
    assert set(groq_rows) == {None, "gsk_••••OTzu", "gsk_••••AbCd"}
    assert groq_rows[None]["requests"] == 2
    assert groq_rows["gsk_••••OTzu"]["requests"] == 1
    assert groq_rows["gsk_••••AbCd"]["requests"] == 1


async def test_breakdown_splits_model_by_key_source(env):
    # Built-in groq (app) + own-key groq (own) → separate model nodes under their
    # respective access-key groups, each carrying its key_fingerprint.
    await _add(
        env.alice, created_at=_BASE, model="groq", billable=True, key_fingerprint=None
    )
    await _add(
        env.alice,
        created_at=_BASE + timedelta(minutes=1),
        model="groq",
        billable=False,
        key_fingerprint="gsk_••••OTzu",
    )

    groups = await UsageReportRepository(env.alice).breakdown(None, None)
    by_key = {g["access_key"]: g for g in groups}
    app_groq = by_key["app"]["models"][0]
    assert app_groq["model"] == "groq" and app_groq["key_fingerprint"] is None
    own_groq = by_key["own"]["models"][0]
    assert own_groq["model"] == "groq"
    assert own_groq["key_fingerprint"] == "gsk_••••OTzu"


async def test_events_and_csv_carry_key_fingerprint(env):
    await _add(
        env.alice, created_at=_BASE, key_fingerprint="gsk_••••OTzu", message="m0"
    )
    await _add(
        env.alice,
        created_at=_BASE + timedelta(minutes=1),
        key_fingerprint=None,
        message="m1",
    )

    page = await UsageReportRepository(env.alice).events(None, None)
    by_msg = {e["message"]: e for e in page["events"]}
    assert by_msg["m0"]["key_fingerprint"] == "gsk_••••OTzu"
    assert by_msg["m1"]["key_fingerprint"] is None

    rows = [
        r
        async for r in UsageReportRepository(env.alice).iter_events_for_csv(None, None)
    ]
    fps = {r.message: r.key_fingerprint for r in rows}
    assert fps["m0"] == "gsk_••••OTzu" and fps["m1"] is None


# --- By chat (incl. deleted/ad-hoc bucket) ----------------------------------


async def test_by_chat_groups_and_null_bucket(env):
    chat = await SavedChatRepository(env.alice).create_chat(
        title="My chat", mode="single", model="groq"
    )
    cid = chat["id"]
    await _add(env.alice, created_at=_BASE, chat_id=cid, tokens=10)
    await _add(
        env.alice, created_at=_BASE + timedelta(minutes=1), chat_id=cid, tokens=20
    )
    await _add(
        env.alice, created_at=_BASE + timedelta(minutes=2), chat_id=None, tokens=3
    )

    chats = await UsageReportRepository(env.alice).by_chat(None, None)
    by_id = {c["chat_id"]: c for c in chats}
    assert by_id[cid]["title"] == "My chat"
    assert by_id[cid]["requests"] == 2
    assert by_id[cid]["total_tokens"] == 30
    # Ad-hoc (no chat) collapses into the None bucket.
    assert by_id[None]["title"] is None
    assert by_id[None]["requests"] == 1


async def test_chat_delete_sets_event_chat_id_null(env):
    chat = await SavedChatRepository(env.alice).create_chat(
        title="Temp", mode="single", model="groq"
    )
    cid = chat["id"]
    await _add(env.alice, created_at=_BASE, chat_id=cid)

    await SavedChatRepository(env.alice).delete_chat(cid)

    # FK ondelete SET NULL: the audit row survives, detached from the chat.
    async with session_scope() as session:
        from sqlalchemy import select

        rows = (await session.execute(select(UsageEvent.chat_id))).scalars().all()
    assert rows == [None]
    chats = await UsageReportRepository(env.alice).by_chat(None, None)
    assert chats[0]["chat_id"] is None


# --- Timeseries -------------------------------------------------------------


async def test_timeseries_day_gap_filled(env):
    day0 = datetime(2026, 6, 1, 8, 0, 0)
    day2 = datetime(2026, 6, 3, 9, 0, 0)  # skip day1 → gap
    await _add(env.alice, created_at=day0, tokens=10)
    await _add(env.alice, created_at=day0 + timedelta(hours=2), tokens=5)
    await _add(env.alice, created_at=day2, tokens=8)

    points = await UsageReportRepository(env.alice).timeseries(None, None, "day")
    # Three consecutive day buckets (gap day filled with zeros).
    assert len(points) == 3
    assert points[0]["requests"] == 2 and points[0]["tokens"] == 15
    assert points[1]["requests"] == 0 and points[1]["tokens"] == 0
    assert points[2]["requests"] == 1 and points[2]["tokens"] == 8


async def test_timeseries_empty(env):
    points = await UsageReportRepository(env.alice).timeseries(None, None, "day")
    assert points == []


# --- Events pagination ------------------------------------------------------


async def test_events_keyset_pagination(env):
    for i in range(5):
        await _add(env.alice, created_at=_BASE + timedelta(minutes=i), message=f"m{i}")

    repo = UsageReportRepository(env.alice)
    page1 = await repo.events(None, None, limit=2)
    assert len(page1["events"]) == 2
    assert page1["next_cursor"] is not None
    # Newest first.
    assert page1["events"][0]["message"] == "m4"

    from memory.usage_report_repository import UsageReportRepository as _R  # noqa

    cur = page1["next_cursor"]
    # Decode like the route does.
    ts_str, id_str = cur.rsplit("|", 1)
    cursor = (datetime.fromisoformat(ts_str), int(id_str))
    page2 = await repo.events(None, None, cursor=cursor, limit=2)
    assert [e["message"] for e in page2["events"]] == ["m2", "m1"]
    assert page2["next_cursor"] is not None

    ts_str, id_str = page2["next_cursor"].rsplit("|", 1)
    page3 = await repo.events(
        None, None, cursor=(datetime.fromisoformat(ts_str), int(id_str)), limit=2
    )
    assert [e["message"] for e in page3["events"]] == ["m0"]
    assert page3["next_cursor"] is None


# --- Billable quota filter (A4) ---------------------------------------------


async def test_quota_counts_only_billable(env):
    now = datetime(2026, 6, 1, 12, 0, 0)
    await _add(env.alice, created_at=now, billable=True)
    await _add(env.alice, created_at=now + timedelta(seconds=1), billable=False)
    await _add(env.alice, created_at=now + timedelta(seconds=2), billable=True)

    # count_since must ignore the BYOK (non-billable) event.
    count = await UsageRepository(env.alice).count_since(now - timedelta(seconds=10))
    assert count == 2
    stamps = await UsageRepository(env.alice).timestamps_since(
        now - timedelta(seconds=10)
    )
    assert len(stamps) == 2


# --- Access-key filter + breakdown (PH28) -----------------------------------


async def test_access_filter_summary_and_events(env):
    await _add(env.alice, created_at=_BASE, billable=True, tokens=10, message="app1")
    await _add(
        env.alice,
        created_at=_BASE + timedelta(minutes=1),
        billable=False,
        tokens=20,
        message="own1",
    )
    await _add(
        env.alice,
        created_at=_BASE + timedelta(minutes=2),
        billable=True,
        tokens=5,
        message="app2",
    )
    repo = UsageReportRepository(env.alice)

    all_s = await repo.summary(None, None)
    assert all_s["total_requests"] == 3 and all_s["total_tokens"] == 35

    app_s = await repo.summary(None, None, billable=True)
    assert app_s["total_requests"] == 2 and app_s["total_tokens"] == 15

    own_s = await repo.summary(None, None, billable=False)
    assert own_s["total_requests"] == 1 and own_s["total_tokens"] == 20

    own_events = await repo.events(None, None, billable=False)
    assert [e["message"] for e in own_events["events"]] == ["own1"]


async def test_breakdown_tree_shape(env):
    chat = await SavedChatRepository(env.alice).create_chat(
        title="Chat A", mode="single", model="groq"
    )
    cid = chat["id"]
    # app key → groq → Chat A (x2) + ad-hoc (x1); own key → cerebras → ad-hoc (x1)
    await _add(
        env.alice, created_at=_BASE, billable=True, model="groq", chat_id=cid, tokens=10
    )
    await _add(
        env.alice,
        created_at=_BASE + timedelta(minutes=1),
        billable=True,
        model="groq",
        chat_id=cid,
        tokens=20,
    )
    await _add(
        env.alice,
        created_at=_BASE + timedelta(minutes=2),
        billable=True,
        model="groq",
        chat_id=None,
        tokens=3,
    )
    await _add(
        env.alice,
        created_at=_BASE + timedelta(minutes=3),
        billable=False,
        model="cerebras",
        chat_id=None,
        tokens=7,
    )

    groups = await UsageReportRepository(env.alice).breakdown(None, None)
    by_key = {g["access_key"]: g for g in groups}
    assert by_key["app"]["requests"] == 3 and by_key["app"]["total_tokens"] == 33
    assert by_key["own"]["requests"] == 1 and by_key["own"]["total_tokens"] == 7

    groq = next(m for m in by_key["app"]["models"] if m["model"] == "groq")
    assert groq["requests"] == 3
    chat_ids = {c["chat_id"] for c in groq["chats"]}
    assert chat_ids == {cid, None}
    named = next(c for c in groq["chats"] if c["chat_id"] == cid)
    assert named["title"] == "Chat A" and named["requests"] == 2

    # Filtered breakdown returns only the requested access group.
    own_only = await UsageReportRepository(env.alice).breakdown(
        None, None, billable=False
    )
    assert [g["access_key"] for g in own_only] == ["own"]


# --- CSV export iterator ----------------------------------------------------


async def test_iter_events_for_csv_yields_all(env):
    for i in range(3):
        await _add(env.alice, created_at=_BASE + timedelta(minutes=i), message=f"m{i}")

    rows = [
        r
        async for r in UsageReportRepository(env.alice).iter_events_for_csv(None, None)
    ]
    assert [r.message for r in rows] == ["m0", "m1", "m2"]  # oldest first


# --- HTTP: auth isolation + CSV ---------------------------------------------


def test_reports_require_auth(client):
    assert client.get("/reports/summary").status_code == 401
    assert client.get("/reports/by-model").status_code == 401
    assert client.get("/reports/events.csv").status_code == 401


_PROVIDER_RESPONSE = {
    "response": "hello",
    "model": "m",
    "execution_time": 1.0,
    "provider": "groq",
    "success": True,
}


async def _fake_process_chat(**kwargs):
    return {
        "best_response": "hello",
        "selected_model": "groq",
        "selected_model_data": _PROVIDER_RESPONSE,
        "all_responses": {"groq": _PROVIDER_RESPONSE},
        "failed_providers": [],
        "execution_metadata": [],
        "execution_summary": {},
        "compare_mode": kwargs.get("compare_mode", False),
        "selector_enabled": kwargs.get("selector_enabled", False),
        "selector_scores": {},
        "selector_metadata": {},
        "selector_reason": None,
        "compare_summary": {},
        "total_tokens": 42,
    }


def test_reports_summary_and_csv_http(client, monkeypatch):
    monkeypatch.setattr(
        OrchestratorService, "process_chat", staticmethod(_fake_process_chat)
    )
    resp = client.post(
        "/auth/register",
        json={
            "username": "carol",
            "password": "password123",
            "registration_code": TEST_REGISTRATION_CODE,
        },
    )
    assert resp.status_code == 200, resp.text
    csrf = {"X-CSRF-Token": resp.json()["csrf_token"]}

    chat = client.post(
        "/chat",
        json={"message": "hello world", "provider": "groq"},
        headers=csrf,
    )
    assert chat.status_code == 200, chat.text

    summary = client.get("/reports/summary").json()
    assert summary["total_requests"] == 1
    assert summary["total_tokens"] == 42
    assert summary["tokens_estimated"] is False

    csv_resp = client.get("/reports/events.csv")
    assert csv_resp.status_code == 200
    assert csv_resp.headers["content-type"].startswith("text/csv")
    body = csv_resp.text
    assert "created_at,mode,model,key_fingerprint" in body
    assert "hello world" in body
