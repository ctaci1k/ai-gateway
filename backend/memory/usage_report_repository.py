# backend/memory/usage_report_repository.py
"""Read-only aggregations over the ``usage_events`` ledger for Usage Reports
(PH27, D-18).

Separate from :class:`memory.usage_repository.UsageRepository` (the writer +
quota reader): this repository never mutates and is strictly per-user — every
query is scoped to ``user_id`` so a user only ever sees their own activity. The
admin bonus (G) reuses it with a target user id under ``require_admin``.

Time bounds are naive-UTC datetimes (the ledger stores naive UTC; routes parse
the ISO ``from``/``to`` query params). Grouping for the timeseries is done in
Python over the selected rows so the math is identical on SQLite and Postgres
(no ``date_trunc`` / ``strftime`` divergence).
"""

from datetime import datetime, timedelta
from typing import Any

from sqlalchemy import case, func, select

from core.db import session_scope
from db.models import Chat, UsageEvent
from services.provider_service import JUDGE_BYOK_SLOT

# Bucket the activity timeseries either per day or per hour.
BUCKET_DAY = "day"
BUCKET_HOUR = "hour"

# Safety cap so a wide window with a fine bucket can't gap-fill into a huge list.
_MAX_BUCKETS = 750

# Keyset page size for the activity log.
DEFAULT_EVENTS_LIMIT = 50
MAX_EVENTS_LIMIT = 200


def _tokens_sum() -> Any:
    """SUM(total_tokens) coalesced to 0 (NULL token rows contribute nothing)."""
    return func.coalesce(func.sum(UsageEvent.total_tokens), 0)


def _success_sum() -> Any:
    return func.coalesce(func.sum(case((UsageEvent.success.is_(True), 1), else_=0)), 0)


def _floor_bucket(ts: datetime, bucket: str) -> datetime:
    if bucket == BUCKET_HOUR:
        return ts.replace(minute=0, second=0, microsecond=0)
    return ts.replace(hour=0, minute=0, second=0, microsecond=0)


def _step(bucket: str) -> timedelta:
    return timedelta(hours=1) if bucket == BUCKET_HOUR else timedelta(days=1)


class UsageReportRepository:
    """Per-user, read-only report aggregations over ``usage_events``."""

    def __init__(self, user_id: int):
        self._user_id = user_id

    def _scope(
        self,
        start: datetime | None,
        end: datetime | None,
        billable: bool | None = None,
    ):
        """Common WHERE: this user + the [start, end) window + optional access-key
        filter. ``billable`` True = app-key turns, False = own-key (BYOK), None =
        both (PH28). Bounds are all optional."""
        clauses = [UsageEvent.user_id == self._user_id]
        if start is not None:
            clauses.append(UsageEvent.created_at >= start)
        if end is not None:
            clauses.append(UsageEvent.created_at < end)
        if billable is not None:
            clauses.append(UsageEvent.billable.is_(billable))
        return clauses

    async def summary(
        self,
        start: datetime | None,
        end: datetime | None,
        billable: bool | None = None,
    ) -> dict[str, Any]:
        """Headline KPIs for the Overview tab."""
        scope = self._scope(start, end, billable)
        async with session_scope() as session:
            totals = (
                await session.execute(
                    select(
                        func.count(UsageEvent.id),
                        _tokens_sum(),
                        _success_sum(),
                        func.min(UsageEvent.created_at),
                        func.max(UsageEvent.created_at),
                        func.count(func.distinct(UsageEvent.chat_id)),
                        func.coalesce(
                            func.sum(
                                case(
                                    (UsageEvent.token_estimated.is_(True), 1),
                                    else_=0,
                                )
                            ),
                            0,
                        ),
                    ).where(*scope)
                )
            ).one()
            (
                total_requests,
                total_tokens,
                successful,
                first_event,
                last_event,
                distinct_chats,
                estimated_count,
            ) = totals

            by_mode_rows = (
                await session.execute(
                    select(UsageEvent.mode, func.count(UsageEvent.id))
                    .where(*scope)
                    .group_by(UsageEvent.mode)
                )
            ).all()
            by_billable_rows = (
                await session.execute(
                    select(UsageEvent.billable, func.count(UsageEvent.id))
                    .where(*scope)
                    .group_by(UsageEvent.billable)
                )
            ).all()

        by_mode = {"single": 0, "compare": 0}
        for mode, count in by_mode_rows:
            by_mode[mode] = count
        billable_vs_own = {"billable": 0, "own_key": 0}
        for billable, count in by_billable_rows:
            billable_vs_own["billable" if billable else "own_key"] = count

        total_requests = total_requests or 0
        success_rate = (successful / total_requests) if total_requests else 0.0

        return {
            "total_requests": total_requests,
            "total_tokens": int(total_tokens or 0),
            "tokens_estimated": bool(estimated_count),
            "by_mode": by_mode,
            "billable_vs_own": billable_vs_own,
            "distinct_chats": distinct_chats or 0,
            "success_rate": round(success_rate, 4),
            "first_event": first_event,
            "last_event": last_event,
        }

    async def by_model(
        self,
        start: datetime | None,
        end: datetime | None,
        billable: bool | None = None,
    ) -> list[dict[str, Any]]:
        """Per-model breakdown, busiest first.

        PH31 (D-21): rows are split by ``(selected_model, key_fingerprint)`` so the
        same model appears separately when run on the built-in app key
        (``key_fingerprint=NULL``) vs the user's own key (masked), and once per
        distinct own key. ``key_fingerprint`` is returned for the UI badge.

        PH32 (D-22): the grouping also includes ``model_name`` (the REAL model),
        so an own key pointed at different real models on the same slot splits
        into separate rows; ``model_name`` is returned for the truthful label
        (built-in → the slot label; BYOK → the real model id).

        PH34 (D-24, B9b): a DERIVED row per added (BYOK) judge is appended (the
        judge is never a winning ledger row, so it would otherwise be invisible).
        Judge rows are tagged ``role="judge"`` and carry the judge's real model +
        masked key; their tokens are 0 (the turn's tokens belong to the winning
        row — never doubled). The judge is own-key by definition, so judge rows
        are omitted under the app-key (``billable=True``) filter.
        """
        scope = self._scope(start, end, billable)
        async with session_scope() as session:
            rows = (
                await session.execute(
                    select(
                        UsageEvent.selected_model,
                        UsageEvent.key_fingerprint,
                        UsageEvent.model_name,
                        func.count(UsageEvent.id),
                        _tokens_sum(),
                        _success_sum(),
                    )
                    .where(*scope)
                    .group_by(
                        UsageEvent.selected_model,
                        UsageEvent.key_fingerprint,
                        UsageEvent.model_name,
                    )
                    .order_by(func.count(UsageEvent.id).desc())
                )
            ).all()
        result = [
            {
                "model": model,
                "key_fingerprint": key_fingerprint,
                "model_name": model_name,
                "role": "responder",
                "requests": requests,
                "total_tokens": int(tokens or 0),
                "successful": int(successful or 0),
            }
            for (
                model,
                key_fingerprint,
                model_name,
                requests,
                tokens,
                successful,
            ) in rows
        ]
        # Append derived own-key judge rows (B9b): not under the app-key filter.
        if billable is not True:
            result.extend(await self._judge_model_rows(start, end))
        return result

    async def _judge_model_rows(
        self, start: datetime | None, end: datetime | None
    ) -> list[dict[str, Any]]:
        """Derived per-judge rows for ``by_model`` (PH34, D-24, B9b).

        Grouped by ``(judge_model_name, judge_key_fingerprint)`` over turns where
        an own-key judge participated (``judge_key_fingerprint`` not NULL), within
        the time window only — NOT filtered by the turn's ``billable``, because
        the judge is own-key regardless of whether the turn itself was charged.
        ``model`` is the judge slot id (the FE shows the real model via
        ``model_name``); tokens are 0 (never double the winning row's tokens)."""
        clauses = [
            UsageEvent.user_id == self._user_id,
            UsageEvent.judge_key_fingerprint.is_not(None),
        ]
        if start is not None:
            clauses.append(UsageEvent.created_at >= start)
        if end is not None:
            clauses.append(UsageEvent.created_at < end)
        async with session_scope() as session:
            rows = (
                await session.execute(
                    select(
                        UsageEvent.judge_model_name,
                        UsageEvent.judge_key_fingerprint,
                        func.count(UsageEvent.id),
                        _success_sum(),
                    )
                    .where(*clauses)
                    .group_by(
                        UsageEvent.judge_model_name,
                        UsageEvent.judge_key_fingerprint,
                    )
                    .order_by(func.count(UsageEvent.id).desc())
                )
            ).all()
        return [
            {
                "model": JUDGE_BYOK_SLOT,
                "key_fingerprint": judge_fp,
                "model_name": judge_model,
                "role": "judge",
                "requests": requests,
                "total_tokens": 0,
                "successful": int(successful or 0),
            }
            for (judge_model, judge_fp, requests, successful) in rows
        ]

    async def by_chat(
        self,
        start: datetime | None,
        end: datetime | None,
        billable: bool | None = None,
    ) -> list[dict[str, Any]]:
        """Per-chat breakdown (LEFT JOIN chats). Events whose chat was deleted
        (chat_id SET NULL) or that were ad-hoc (no chat) collapse into a single
        ``chat_id=None`` bucket the UI labels as deleted/ad-hoc."""
        scope = self._scope(start, end, billable)
        async with session_scope() as session:
            rows = (
                await session.execute(
                    select(
                        UsageEvent.chat_id,
                        Chat.title,
                        Chat.mode,
                        Chat.model,
                        func.count(UsageEvent.id),
                        _tokens_sum(),
                        func.max(UsageEvent.created_at),
                        # PH32 (D-22): a representative REAL model for the chat so
                        # the By-chat row shows the truth (built-in → slot label
                        # via the FE fallback; BYOK → the real model id).
                        func.max(UsageEvent.model_name),
                    )
                    .outerjoin(Chat, Chat.id == UsageEvent.chat_id)
                    .where(*scope)
                    .group_by(UsageEvent.chat_id, Chat.title, Chat.mode, Chat.model)
                    .order_by(func.count(UsageEvent.id).desc())
                )
            ).all()
        return [
            {
                "chat_id": chat_id,
                "title": title,
                "mode": mode,
                "model": model,
                "model_name": model_name,
                "requests": requests,
                "total_tokens": int(tokens or 0),
                "last_event": last_event,
            }
            for (
                chat_id,
                title,
                mode,
                model,
                requests,
                tokens,
                last_event,
                model_name,
            ) in rows
        ]

    async def timeseries(
        self,
        start: datetime | None,
        end: datetime | None,
        bucket: str,
        billable: bool | None = None,
    ) -> list[dict[str, Any]]:
        """Requests + tokens grouped per day/hour, gap-filled and ascending.

        Grouping happens in Python over the selected ``(created_at, tokens)``
        rows so SQLite and Postgres agree. Buckets use naive UTC; the FE labels
        them in the viewer's locale. Gap-filling spans the data's own range (or
        the requested window when bounds are given), capped at ``_MAX_BUCKETS``.
        """
        if bucket not in (BUCKET_DAY, BUCKET_HOUR):
            bucket = BUCKET_DAY
        scope = self._scope(start, end, billable)
        async with session_scope() as session:
            rows = (
                await session.execute(
                    select(UsageEvent.created_at, UsageEvent.total_tokens).where(*scope)
                )
            ).all()

        agg: dict[datetime, dict[str, int]] = {}
        for created_at, tokens in rows:
            key = _floor_bucket(created_at, bucket)
            slot = agg.setdefault(key, {"requests": 0, "tokens": 0})
            slot["requests"] += 1
            slot["tokens"] += int(tokens or 0)

        if not agg:
            return []

        step = _step(bucket)
        lo = _floor_bucket(start, bucket) if start is not None else min(agg)
        hi = _floor_bucket(end, bucket) if end is not None else max(agg)
        # Never gap-fill below the first/above the last actual data point.
        lo = min(lo, min(agg))
        hi = max(hi, max(agg))

        span = int((hi - lo) / step) + 1
        if span > _MAX_BUCKETS:
            # Too many buckets to gap-fill cleanly: return only populated ones.
            return [
                {
                    "bucket": key,
                    "requests": agg[key]["requests"],
                    "tokens": agg[key]["tokens"],
                }
                for key in sorted(agg)
            ]

        series: list[dict[str, Any]] = []
        cursor = lo
        while cursor <= hi:
            slot = agg.get(cursor, {"requests": 0, "tokens": 0})
            series.append(
                {
                    "bucket": cursor,
                    "requests": slot["requests"],
                    "tokens": slot["tokens"],
                }
            )
            cursor += step
        return series

    async def events(
        self,
        start: datetime | None,
        end: datetime | None,
        cursor: tuple[datetime, int] | None = None,
        limit: int = DEFAULT_EVENTS_LIMIT,
        billable: bool | None = None,
    ) -> dict[str, Any]:
        """Keyset-paginated activity log, newest first.

        Orders by ``(created_at DESC, id DESC)``; ``cursor`` is the last seen
        ``(created_at, id)`` pair. Returns one extra row internally to compute
        the next cursor without a count query. LEFT JOIN chats for the title.
        """
        limit = max(1, min(limit, MAX_EVENTS_LIMIT))
        scope = self._scope(start, end, billable)
        async with session_scope() as session:
            query = (
                select(
                    UsageEvent.id,
                    UsageEvent.created_at,
                    UsageEvent.mode,
                    UsageEvent.selected_model,
                    UsageEvent.model_name,
                    UsageEvent.total_tokens,
                    UsageEvent.token_estimated,
                    UsageEvent.success,
                    UsageEvent.billable,
                    UsageEvent.key_fingerprint,
                    UsageEvent.judge_model_name,
                    UsageEvent.judge_key_fingerprint,
                    UsageEvent.message,
                    UsageEvent.chat_id,
                    Chat.title,
                )
                .outerjoin(Chat, Chat.id == UsageEvent.chat_id)
                .where(*scope)
            )
            if cursor is not None:
                cur_ts, cur_id = cursor
                # Strictly older than the cursor row in (created_at, id) order.
                query = query.where(
                    (UsageEvent.created_at < cur_ts)
                    | ((UsageEvent.created_at == cur_ts) & (UsageEvent.id < cur_id))
                )
            query = query.order_by(
                UsageEvent.created_at.desc(), UsageEvent.id.desc()
            ).limit(limit + 1)
            rows = (await session.execute(query)).all()

        has_more = len(rows) > limit
        rows = rows[:limit]
        items = [
            {
                "id": r.id,
                "created_at": r.created_at,
                "mode": r.mode,
                "model": r.selected_model,
                "model_name": r.model_name,
                "total_tokens": r.total_tokens,
                "token_estimated": r.token_estimated,
                "success": r.success,
                "billable": r.billable,
                "key_fingerprint": r.key_fingerprint,
                # B9b: the added (BYOK) judge for this turn, inline (NULL = a
                # built-in / no judge) — shown as a small secondary badge so the
                # activity log stays one row per turn (the ledger invariant).
                "judge_model_name": r.judge_model_name,
                "judge_key_fingerprint": r.judge_key_fingerprint,
                "message": r.message,
                "chat_id": r.chat_id,
                "chat_title": r.title,
            }
            for r in rows
        ]
        next_cursor: str | None = None
        if has_more and items:
            last = rows[-1]
            next_cursor = f"{last.created_at.isoformat()}|{last.id}"
        return {"events": items, "next_cursor": next_cursor}

    async def breakdown(
        self,
        start: datetime | None,
        end: datetime | None,
        billable: bool | None = None,
    ) -> list[dict[str, Any]]:
        """Nested drill-down tree for the Breakdown accordion (PH28).

        ``access key (app|own) -> model -> chats``, with requests + tokens summed
        at every level. Built in Python from one flat scan (LEFT JOIN chats) so
        the accordion can expand instantly without extra round-trips. When
        ``billable`` is set, only that access-key group is returned.

        PH31 (D-21): the model level is keyed by ``(model, key_fingerprint)`` so
        the same model splits into separate nodes by key source (built-in vs each
        own key); ``key_fingerprint`` is carried on each model node for the badge.
        The top-level access-key grouping (PH28) is unchanged.

        PH32 (D-22): the model-node key also includes ``model_name`` (the REAL
        model), carried on each node so the UI shows the truthful label (built-in
        → the slot label; BYOK → the real model id).
        """
        scope = self._scope(start, end, billable)
        async with session_scope() as session:
            rows = (
                await session.execute(
                    select(
                        UsageEvent.billable,
                        UsageEvent.selected_model,
                        UsageEvent.key_fingerprint,
                        UsageEvent.model_name,
                        UsageEvent.chat_id,
                        Chat.title,
                        Chat.mode,
                        UsageEvent.total_tokens,
                    )
                    .outerjoin(Chat, Chat.id == UsageEvent.chat_id)
                    .where(*scope)
                )
            ).all()

        # groups[access_key] = {requests, tokens, models[(model, fp, model_name)] =
        #   {model, key_fingerprint, model_name, requests, tokens,
        #   chats[chat_id] = {chat_id, title, mode, requests, tokens}}}
        groups: dict[str, dict[str, Any]] = {}
        for (
            is_billable,
            model,
            key_fingerprint,
            model_name,
            chat_id,
            title,
            mode,
            tokens,
        ) in rows:
            tok = int(tokens or 0)
            access_key = "app" if is_billable else "own"
            group = groups.setdefault(
                access_key, {"requests": 0, "tokens": 0, "models": {}}
            )
            group["requests"] += 1
            group["tokens"] += tok

            model_node = group["models"].setdefault(
                (model, key_fingerprint, model_name),
                {
                    "model": model,
                    "key_fingerprint": key_fingerprint,
                    "model_name": model_name,
                    "requests": 0,
                    "tokens": 0,
                    "chats": {},
                },
            )
            model_node["requests"] += 1
            model_node["tokens"] += tok

            chat_node = model_node["chats"].setdefault(
                chat_id,
                {
                    "chat_id": chat_id,
                    "title": title,
                    "mode": mode,
                    "requests": 0,
                    "total_tokens": 0,
                },
            )
            chat_node["requests"] += 1
            chat_node["total_tokens"] += tok

        # Derived own-key judge nodes (B9b): appended under the "own" group so the
        # added judge is visible. Omitted under the app-key filter. They do NOT
        # change the group's top-level requests/tokens (PH28 access-key totals
        # stay turn-based, D-21); they're additional model nodes (role="judge").
        if billable is not True:
            judge_nodes = await self._judge_breakdown_nodes(start, end)
            if judge_nodes:
                own = groups.setdefault(
                    "own", {"requests": 0, "tokens": 0, "models": {}}
                )
                for jn in judge_nodes:
                    own["models"][
                        ("__judge__", jn["key_fingerprint"], jn["model_name"])
                    ] = {
                        "model": jn["model"],
                        "key_fingerprint": jn["key_fingerprint"],
                        "model_name": jn["model_name"],
                        "role": "judge",
                        "requests": jn["requests"],
                        "tokens": 0,
                        "chats": jn["chats"],
                    }

        def _sorted(nodes: list[dict[str, Any]]) -> list[dict[str, Any]]:
            return sorted(nodes, key=lambda n: n["requests"], reverse=True)

        result: list[dict[str, Any]] = []
        for access_key in ("app", "own"):
            group = groups.get(access_key)
            if group is None:
                continue
            models = []
            for mnode in group["models"].values():
                models.append(
                    {
                        "model": mnode["model"],
                        "key_fingerprint": mnode["key_fingerprint"],
                        "model_name": mnode["model_name"],
                        # responder nodes (built before B9b) have no role key.
                        "role": mnode.get("role", "responder"),
                        "requests": mnode["requests"],
                        "total_tokens": mnode["tokens"],
                        "chats": _sorted(list(mnode["chats"].values())),
                    }
                )
            result.append(
                {
                    "access_key": access_key,
                    "requests": group["requests"],
                    "total_tokens": group["tokens"],
                    "models": _sorted(models),
                }
            )
        return result

    async def _judge_breakdown_nodes(
        self, start: datetime | None, end: datetime | None
    ) -> list[dict[str, Any]]:
        """Derived own-key judge model-nodes (with per-chat children) for the
        Breakdown accordion (PH34, D-24, B9b). Scoped to the time window over
        turns where an own-key judge participated (NOT filtered by ``billable``);
        node tokens are 0 (never double the winning row's tokens)."""
        clauses = [
            UsageEvent.user_id == self._user_id,
            UsageEvent.judge_key_fingerprint.is_not(None),
        ]
        if start is not None:
            clauses.append(UsageEvent.created_at >= start)
        if end is not None:
            clauses.append(UsageEvent.created_at < end)
        async with session_scope() as session:
            rows = (
                await session.execute(
                    select(
                        UsageEvent.judge_model_name,
                        UsageEvent.judge_key_fingerprint,
                        UsageEvent.chat_id,
                        Chat.title,
                        Chat.mode,
                    )
                    .outerjoin(Chat, Chat.id == UsageEvent.chat_id)
                    .where(*clauses)
                )
            ).all()

        nodes: dict[tuple, dict[str, Any]] = {}
        for judge_model, judge_fp, chat_id, title, mode in rows:
            node = nodes.setdefault(
                (judge_fp, judge_model),
                {
                    "model": JUDGE_BYOK_SLOT,
                    "key_fingerprint": judge_fp,
                    "model_name": judge_model,
                    "requests": 0,
                    "chats": {},
                },
            )
            node["requests"] += 1
            chat_node = node["chats"].setdefault(
                chat_id,
                {
                    "chat_id": chat_id,
                    "title": title,
                    "mode": mode,
                    "requests": 0,
                    "total_tokens": 0,
                },
            )
            chat_node["requests"] += 1
        # ``chats`` stays a dict (chat_id → node) so the breakdown integration can
        # treat a judge node exactly like a responder node (it does
        # ``list(mnode["chats"].values())``).
        return list(nodes.values())

    async def iter_events_for_csv(
        self,
        start: datetime | None,
        end: datetime | None,
        billable: bool | None = None,
    ):
        """Yield every event row in the window (oldest first) for CSV streaming.

        Pulls in id-ordered pages so the full export never materializes in
        memory at once (C3). Per-user scoped like every other method here.
        """
        scope = self._scope(start, end, billable)
        page = 1000
        last_id = 0
        while True:
            async with session_scope() as session:
                rows = (
                    await session.execute(
                        select(
                            UsageEvent.id,
                            UsageEvent.created_at,
                            UsageEvent.mode,
                            UsageEvent.selected_model,
                            UsageEvent.model_name,
                            UsageEvent.total_tokens,
                            UsageEvent.token_estimated,
                            UsageEvent.success,
                            UsageEvent.billable,
                            UsageEvent.key_fingerprint,
                            UsageEvent.judge_model_name,
                            UsageEvent.judge_key_fingerprint,
                            UsageEvent.message,
                            Chat.title,
                        )
                        .outerjoin(Chat, Chat.id == UsageEvent.chat_id)
                        .where(*scope, UsageEvent.id > last_id)
                        .order_by(UsageEvent.id.asc())
                        .limit(page)
                    )
                ).all()
            if not rows:
                break
            for r in rows:
                yield r
            last_id = rows[-1].id
            if len(rows) < page:
                break
