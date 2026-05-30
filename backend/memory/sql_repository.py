# backend/memory/sql_repository.py
"""SQL-backed, per-user ChatRepository (async SQLAlchemy).

All state (history + personalization preferences) is isolated to a single
``user_id`` (PH8) and persists across restarts (PH4).
"""

import copy
import json
from typing import Any

from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm.attributes import flag_modified

from core.config import get_settings
from core.db import session_scope
from db.models import Interaction, Preference
from memory import preferences_logic
from memory.repository import ChatRepository


def _load_prefs_dict(pref: "Preference") -> dict[str, Any]:
    # Deep-copy so mutations don't touch SQLAlchemy's change-detection snapshot
    # (JSON columns don't track in-place edits).
    if pref.data:
        return copy.deepcopy(pref.data)
    return preferences_logic.default_preferences()


class SqlChatRepository(ChatRepository):
    def __init__(self, user_id: int):
        self._user_id = user_id

    async def _get_preference(self, session: AsyncSession) -> Preference:
        pref = await session.get(Preference, self._user_id)
        if pref is None:
            pref = Preference(
                user_id=self._user_id,
                data=preferences_logic.default_preferences(),
            )
            session.add(pref)
            await session.flush()
        return pref

    async def add_message(self, **kwargs) -> None:
        record = preferences_logic.build_interaction_record(**kwargs)

        async with session_scope() as session:
            pref = await self._get_preference(session)

            data = _load_prefs_dict(pref)
            preferences_logic.apply_message(
                data,
                selected_model=record["selected_model"],
                selector_used=record["selector_used"],
                compare_mode=record["compare_mode"],
            )
            if record["manually_selected_model"]:
                preferences_logic.apply_manual_selection(
                    data,
                    selected_model=record["manually_selected_model"],
                    selector_model=record["selected_model"],
                )
            pref.data = data
            flag_modified(pref, "data")

            session.add(Interaction(user_id=self._user_id, payload=record))
            await session.flush()

            await self._trim_history(session)

    async def _trim_history(self, session: AsyncSession) -> None:
        limit = get_settings().history_limit
        count = await session.scalar(
            select(func.count(Interaction.id)).where(
                Interaction.user_id == self._user_id
            )
        )
        if count and count > limit:
            stale = await session.execute(
                select(Interaction.id)
                .where(Interaction.user_id == self._user_id)
                .order_by(Interaction.created_at.asc(), Interaction.id.asc())
                .limit(count - limit)
            )
            stale_ids = [row[0] for row in stale.all()]
            if stale_ids:
                await session.execute(
                    delete(Interaction).where(Interaction.id.in_(stale_ids))
                )

    async def get_messages(self) -> list[dict[str, Any]]:
        async with session_scope() as session:
            limit = get_settings().history_limit
            result = await session.execute(
                select(Interaction.payload)
                .where(Interaction.user_id == self._user_id)
                .order_by(Interaction.created_at.desc(), Interaction.id.desc())
                .limit(limit)
            )
            payloads = [row[0] for row in result.all()]
            return list(reversed(payloads))

    async def track_manual_selection(
        self, selected_model: str, selector_model: str | None = None
    ) -> None:
        async with session_scope() as session:
            pref = await self._get_preference(session)
            data = _load_prefs_dict(pref)
            preferences_logic.apply_manual_selection(
                data, selected_model=selected_model, selector_model=selector_model
            )
            pref.data = data
            flag_modified(pref, "data")

    async def get_personalization_profile(self) -> dict[str, Any]:
        prefs = await self.get_user_preferences()
        return preferences_logic.personalization_profile(prefs)

    async def get_user_preferences(self) -> dict[str, Any]:
        async with session_scope() as session:
            pref = await self._get_preference(session)
            return dict(pref.data or preferences_logic.default_preferences())

    async def to_json(self) -> str:
        messages = await self.get_messages()
        preferences = await self.get_user_preferences()
        return json.dumps(
            {"messages": messages, "user_preferences": preferences},
            indent=2,
            ensure_ascii=False,
        )

    async def clear(self) -> None:
        async with session_scope() as session:
            await session.execute(
                delete(Interaction).where(Interaction.user_id == self._user_id)
            )
            pref = await self._get_preference(session)
            pref.data = preferences_logic.default_preferences()
            flag_modified(pref, "data")
