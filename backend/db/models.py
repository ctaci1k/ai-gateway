# backend/db/models.py
"""SQLAlchemy ORM models.

Scope:
- PH4: persisted personalization ``preferences`` and the rolling
  ``interactions`` history (replacing the former in-memory ChatBuffer).
- PH8: per-user accounts (``users.password_hash`` + ``sessions``).
- PH9: saved Compare chats (``chats`` + ``chat_messages``), limited to a few
  per user; Single mode stays ephemeral (D-3).
- PH10: uploaded RAG ``documents`` metadata (chunks/embeddings live in the
  ChromaDB vector store, isolated per user).
"""

from datetime import UTC, datetime

from sqlalchemy import (
    JSON,
    Boolean,
    DateTime,
    ForeignKey,
    Integer,
    LargeBinary,
    String,
    UniqueConstraint,
    false,
    true,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from core.db import Base

# Single-user mode (D-2): all state belongs to this user until accounts (PH8).
DEFAULT_USERNAME = "local"


def _utcnow() -> datetime:
    # Naive UTC: the timestamp columns are TIMESTAMP WITHOUT TIME ZONE, and
    # asyncpg (Postgres) rejects tz-aware values for them ("can't subtract
    # offset-naive and offset-aware datetimes"). SQLite (tests) tolerates aware
    # values, which hid this; storing naive UTC is consistent on both backends.
    return datetime.now(UTC).replace(tzinfo=None)


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    username: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(255), default="")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_utcnow)

    # Quotas / admin (PH15, D-10). Admins have full access to the admin panel and
    # are unlimited. Limits are request counts; NULL means unlimited (admins) and
    # disables both enforcement and the FE "limited account" banner.
    # NOTE: nullable columns use a non-optional Mapped[...] annotation + explicit
    # nullable=True. SQLAlchemy's `Mapped[int | None]` resolution crashes on
    # Python 3.14 (de_optionalize_union_types), and the value may still be None.
    is_admin: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    max_requests_per_minute: Mapped[int] = mapped_column(Integer, nullable=True)
    max_requests_per_day: Mapped[int] = mapped_column(Integer, nullable=True)

    preference: Mapped["Preference"] = relationship(
        back_populates="user",
        uselist=False,
        cascade="all, delete-orphan",
    )
    interactions: Mapped[list["Interaction"]] = relationship(
        back_populates="user",
        cascade="all, delete-orphan",
    )
    sessions: Mapped[list["Session"]] = relationship(
        back_populates="user",
        cascade="all, delete-orphan",
    )
    chats: Mapped[list["Chat"]] = relationship(
        back_populates="user",
        cascade="all, delete-orphan",
    )
    documents: Mapped[list["Document"]] = relationship(
        back_populates="user",
        cascade="all, delete-orphan",
    )
    usage_events: Mapped[list["UsageEvent"]] = relationship(
        back_populates="user",
        cascade="all, delete-orphan",
    )
    byok_credentials: Mapped[list["ByokCredential"]] = relationship(
        back_populates="user",
        cascade="all, delete-orphan",
    )


class ByokCredential(Base):
    """A user's BYOK key for one slot, stored ENCRYPTED at rest (PH30, D-20).

    Reverses the D-12 "keys never touch the DB" stance: keys are now persisted
    per-account so they survive across devices and sessions. The plaintext key
    is NEVER stored — only the AES-256-GCM ciphertext + nonce (envelope in
    core/secret_box.py; AAD binds the record to user_id+slot). ``key_last4`` is
    the non-secret last 4 chars shown in the write-only UI mask; ``key_version``
    records the envelope version for future KEK rotation.

    One row per (user, slot): ``slot`` is a built-in responder ("groq"/...),
    "byok-judge", or a custom slot id. Per-user isolation via the user_id FK.
    """

    __tablename__ = "byok_credentials"
    __table_args__ = (UniqueConstraint("user_id", "slot", name="uq_byok_user_slot"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    # Built-in responder slot, "byok-judge", or a custom slot id.
    slot: Mapped[str] = mapped_column(String(64))
    # Optional OpenAI-compatible endpoint override (NULL = built-in default).
    base_url: Mapped[str] = mapped_column(String, nullable=True)
    model_id: Mapped[str] = mapped_column(String(256))
    # AES-256-GCM ciphertext + per-record nonce (the key plaintext is never here).
    key_ciphertext: Mapped[bytes] = mapped_column(LargeBinary)
    key_nonce: Mapped[bytes] = mapped_column(LargeBinary)
    # Non-secret last 4 chars of the key, for the masked write-only UI.
    key_last4: Mapped[str] = mapped_column(String(8), default="")
    # Envelope version (prepares KEK rotation, D-20).
    key_version: Mapped[int] = mapped_column(
        Integer, default=1, server_default="1", nullable=False
    )
    # Whether this is a user-added custom slot (vs a built-in override).
    custom: Mapped[bool] = mapped_column(
        Boolean, default=False, server_default=false(), nullable=False
    )
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=_utcnow, onupdate=_utcnow
    )

    user: Mapped[User] = relationship(back_populates="byok_credentials")


class UsageEvent(Base):
    """Append-only per-turn ledger of each chat request (PH15, D-10; PH27, D-18).

    Unlike the rolling ``interactions`` history (trimmed per user), this table is
    never trimmed: it is the canonical source of truth for quota enforcement
    (counts per minute / day), the admin usage view, and the per-user Usage
    Reports (PH27). One row = one turn (a Compare turn is a single event).

    PH27 (D-18) made it the canonical ledger for reports: ALL turns are recorded
    (including BYOK), with ``billable`` marking whether the turn consumed the
    account quota (``false`` = ran on the user's own key). Quota windows count
    only ``billable`` rows, so recording BYOK turns does not change limits.
    """

    __tablename__ = "usage_events"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_utcnow, index=True)
    # "compare" or "single". A Compare request counts as one event (D-10).
    mode: Mapped[str] = mapped_column(String(16))
    # The user prompt (for the admin audit view).
    message: Mapped[str] = mapped_column(String, default="")
    # The winning/answering model, when known (nullable — see User note above).
    selected_model: Mapped[str] = mapped_column(String(64), nullable=True)
    # Total tokens spent on the turn; NULL when neither a provider nor the
    # estimate could supply one (rare). Real usage when available, else an
    # estimate flagged by ``token_estimated`` (PH27/B, D-18).
    total_tokens: Mapped[int] = mapped_column(Integer, nullable=True)
    success: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    # PH27 (D-18): the saved chat this turn belongs to, when one was active.
    # ondelete SET NULL keeps the audit row after a chat is deleted (the turn
    # is then grouped as "deleted / ad-hoc" in reports). Nullable + indexed.
    chat_id: Mapped[int] = mapped_column(
        ForeignKey("chats.id", ondelete="SET NULL"), nullable=True, index=True
    )
    # PH27 (D-18): whether the turn consumed the account quota. ``true`` = charged
    # against app limits; ``false`` = ran entirely on the user's own BYOK key.
    # Quota windows count only ``billable`` rows (A4), so the ledger stays
    # complete without changing limit behavior.
    billable: Mapped[bool] = mapped_column(
        Boolean, default=True, server_default=true(), nullable=False
    )
    # PH27 (D-18): ``true`` when ``total_tokens`` is an estimate (no provider
    # usage was reported), so the UI can mark it ("~", "estimate" badge).
    token_estimated: Mapped[bool] = mapped_column(
        Boolean, default=False, server_default=false(), nullable=False
    )

    user: Mapped[User] = relationship(back_populates="usage_events")


class Session(Base):
    __tablename__ = "sessions"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_utcnow)
    expires_at: Mapped[datetime] = mapped_column(DateTime, index=True)

    user: Mapped[User] = relationship(back_populates="sessions")


class Preference(Base):
    __tablename__ = "preferences"

    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), primary_key=True
    )
    # Full personalization profile payload (see memory/preferences_logic.py).
    data: Mapped[dict] = mapped_column(JSON, default=dict)

    user: Mapped[User] = relationship(back_populates="preference")


class Interaction(Base):
    __tablename__ = "interactions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_utcnow, index=True)
    # The rich compare/interaction record (all_responses, selector_metadata, ...).
    payload: Mapped[dict] = mapped_column(JSON)

    user: Mapped[User] = relationship(back_populates="interactions")


class Chat(Base):
    """A saved chat (PH9 / PH24). Holds an ordered list of turns.

    ``mode`` distinguishes a Single chat (one model, streamed turns) from a
    Compare chat (multi-model + judge). Single chats became first-class saved
    chats in PH24 (D-17, rewriting D-3). ``model`` is the responder slot a Single
    chat is bound to (fixed at creation); NULL for Compare chats.
    """

    __tablename__ = "chats"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    title: Mapped[str] = mapped_column(String(255))
    # "compare" (legacy default) or "single". A Single chat is bound to one model.
    mode: Mapped[str] = mapped_column(
        String(16), default="compare", server_default="compare", nullable=False
    )
    # The responder slot for a Single chat (e.g. "groq"); NULL for Compare.
    model: Mapped[str] = mapped_column(String(64), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=_utcnow, onupdate=_utcnow
    )

    user: Mapped[User] = relationship(back_populates="chats")
    messages: Mapped[list["ChatMessage"]] = relationship(
        back_populates="chat",
        cascade="all, delete-orphan",
        order_by="ChatMessage.created_at, ChatMessage.id",
    )


class ChatMessage(Base):
    """One persisted Compare turn inside a saved chat (PH9)."""

    __tablename__ = "chat_messages"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    chat_id: Mapped[int] = mapped_column(
        ForeignKey("chats.id", ondelete="CASCADE"), index=True
    )
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_utcnow, index=True)
    # Same interaction record shape as Interaction.payload (see preferences_logic).
    payload: Mapped[dict] = mapped_column(JSON)

    chat: Mapped[Chat] = relationship(back_populates="messages")


class Document(Base):
    """Metadata for an uploaded RAG document (PH10).

    The text chunks and their embeddings live in the ChromaDB vector store,
    tagged with this row's id + the owning user_id for per-user isolation.
    """

    __tablename__ = "documents"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    filename: Mapped[str] = mapped_column(String(512))
    content_type: Mapped[str] = mapped_column(String(128))
    chunk_count: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_utcnow)

    user: Mapped[User] = relationship(back_populates="documents")
