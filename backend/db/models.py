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

from sqlalchemy import JSON, Boolean, DateTime, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from core.db import Base

# Single-user mode (D-2): all state belongs to this user until accounts (PH8).
DEFAULT_USERNAME = "local"


def _utcnow() -> datetime:
    return datetime.now(UTC)


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


class UsageEvent(Base):
    """Append-only audit of each chat request (PH15, D-10).

    Unlike the rolling ``interactions`` history (trimmed per user), this table is
    never trimmed: it is the source of truth for quota enforcement (counts per
    minute / day) and the admin usage view, and records spent tokens.
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
    # Total tokens spent on the turn; NULL when a provider didn't report usage.
    total_tokens: Mapped[int] = mapped_column(Integer, nullable=True)
    success: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

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
    """A saved Compare chat (PH9). Holds an ordered list of compare turns."""

    __tablename__ = "chats"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    title: Mapped[str] = mapped_column(String(255))
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
