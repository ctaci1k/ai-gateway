# backend/memory/byok_repository.py
"""Per-user repository for BYOK credentials, encrypted at rest (PH30, D-20).

Reverses D-12: keys are now persisted per-account so they survive across devices
and sessions. The plaintext key is decrypted ONLY here (in memory, at use time)
and NEVER logged. Each row is sealed with the AES-256-GCM envelope in
core/secret_box.py (AAD binds it to user_id+slot). Scoped to one ``user_id``
(per-user isolation, PH8) — account A can never read account B's rows.
"""

from typing import Any

from sqlalchemy import delete, select

from core.db import session_scope
from core.secret_box import decrypt_secret, encrypt_secret
from db.models import ByokCredential
from schemas.chat_schema import ByokConfig, ByokJudge, ByokResponder
from services.provider_service import JUDGE_BYOK_SLOT


def _last4(api_key: str) -> str:
    key = (api_key or "").strip()
    return key[-4:] if len(key) >= 4 else key


def _metadata(row: ByokCredential) -> dict[str, Any]:
    """Write-only metadata (no secret): what the UI may read back."""
    return {
        "slot": row.slot,
        "base_url": row.base_url or "",
        "model_id": row.model_id,
        "last4": row.key_last4 or "",
        "custom": row.custom,
    }


class ByokRepository:
    def __init__(self, user_id: int):
        self._user_id = user_id

    async def list_metadata(self) -> list[dict[str, Any]]:
        """All of this user's stored slots as write-only metadata (no keys)."""
        async with session_scope() as session:
            rows = (
                await session.scalars(
                    select(ByokCredential)
                    .where(ByokCredential.user_id == self._user_id)
                    .order_by(ByokCredential.slot.asc())
                )
            ).all()
            return [_metadata(r) for r in rows]

    async def resolve_key(self, slot: str) -> tuple[str, str | None, str] | None:
        """Decrypt one stored slot for server-side use (validation / discovery).

        Returns ``(api_key, base_url, model_id)`` or None when the slot has no
        stored credential. Decryption happens only here, in memory; the key is
        never logged."""
        async with session_scope() as session:
            row = await session.scalar(
                select(ByokCredential).where(
                    ByokCredential.user_id == self._user_id,
                    ByokCredential.slot == slot,
                )
            )
            if row is None:
                return None
            api_key = decrypt_secret(
                row.key_ciphertext,
                row.key_nonce,
                user_id=self._user_id,
                slot=row.slot,
                key_version=row.key_version,
            )
            return api_key, row.base_url, row.model_id

    async def load_config(self) -> ByokConfig | None:
        """Decrypt all stored slots into a ``ByokConfig`` for a chat turn.

        Mirrors the transit-time config the client used to send, but the source
        is the DB. Returns None when the user has no stored keys (so the chat
        route falls back entirely to the app's built-in singletons)."""
        async with session_scope() as session:
            rows = (
                await session.scalars(
                    select(ByokCredential).where(
                        ByokCredential.user_id == self._user_id
                    )
                )
            ).all()
            if not rows:
                return None

            judge: ByokJudge | None = None
            responders: list[ByokResponder] = []
            for row in rows:
                api_key = decrypt_secret(
                    row.key_ciphertext,
                    row.key_nonce,
                    user_id=self._user_id,
                    slot=row.slot,
                    key_version=row.key_version,
                )
                base_url = row.base_url or None
                if row.slot == JUDGE_BYOK_SLOT:
                    judge = ByokJudge(
                        base_url=base_url, api_key=api_key, model_id=row.model_id
                    )
                else:
                    responders.append(
                        ByokResponder(
                            slot=row.slot,
                            base_url=base_url,
                            api_key=api_key,
                            model_id=row.model_id,
                        )
                    )
            if judge is None and not responders:
                return None
            return ByokConfig(judge=judge, responders=responders)

    async def upsert(
        self,
        *,
        slot: str,
        model_id: str,
        api_key: str | None,
        base_url: str | None = None,
        custom: bool = False,
    ) -> dict[str, Any]:
        """Encrypt + store (or update) one slot. Returns its metadata.

        When ``api_key`` is omitted but the slot already exists, the stored
        ciphertext is reused (the user changed only model/base_url without
        re-entering the key). A new key is sealed with a fresh nonce."""
        async with session_scope() as session:
            row = await session.scalar(
                select(ByokCredential).where(
                    ByokCredential.user_id == self._user_id,
                    ByokCredential.slot == slot,
                )
            )
            if api_key and api_key.strip():
                ciphertext, nonce, version = encrypt_secret(
                    api_key.strip(), user_id=self._user_id, slot=slot
                )
                last4 = _last4(api_key)
            elif row is not None:
                # Reuse the stored key (only metadata changed).
                ciphertext, nonce, version = (
                    row.key_ciphertext,
                    row.key_nonce,
                    row.key_version,
                )
                last4 = row.key_last4
            else:
                raise ValueError(f"BYOK slot '{slot}' has no key to store")

            normalized_base = (base_url or "").strip() or None
            if row is None:
                row = ByokCredential(user_id=self._user_id, slot=slot)
                session.add(row)
            row.model_id = model_id.strip()
            row.base_url = normalized_base
            row.key_ciphertext = ciphertext
            row.key_nonce = nonce
            row.key_last4 = last4
            row.key_version = version
            row.custom = custom
            await session.flush()
            return _metadata(row)

    async def delete(self, slot: str) -> None:
        async with session_scope() as session:
            await session.execute(
                delete(ByokCredential).where(
                    ByokCredential.user_id == self._user_id,
                    ByokCredential.slot == slot,
                )
            )
