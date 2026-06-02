"""chats: add mode + model columns for Single persistence (PH24, D-17)

Revision ID: 0006_chat_mode_model
Revises: 0005_quotas_usage
Create Date: 2026-06-02

Single chats become first-class saved chats (D-17, rewriting D-3). ``mode``
defaults to "compare" so existing rows stay Compare chats; ``model`` is the
responder slot a Single chat is bound to (NULL for Compare).
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0006_chat_mode_model"
down_revision: str | None = "0005_quotas_usage"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "chats",
        sa.Column(
            "mode",
            sa.String(length=16),
            nullable=False,
            server_default="compare",
        ),
    )
    op.add_column(
        "chats",
        sa.Column("model", sa.String(length=64), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("chats", "model")
    op.drop_column("chats", "mode")
