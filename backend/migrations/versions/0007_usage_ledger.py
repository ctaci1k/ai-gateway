"""usage_events ledger: chat_id + billable + token_estimated (PH27, D-18)

Revision ID: 0007_usage_ledger
Revises: 0006_chat_mode_model
Create Date: 2026-06-02

PH27 (D-18) turns ``usage_events`` into the canonical per-turn ledger behind the
Usage Reports dashboard. Three columns are added:

- ``chat_id``       FK -> chats.id, ondelete SET NULL (audit survives chat
                    deletion; the turn is then grouped as deleted/ad-hoc),
                    nullable + indexed.
- ``billable``      bool NOT NULL, server_default true — whether the turn
                    consumed the account quota. Quota windows count only
                    billable rows, so recording BYOK turns leaves limits intact.
- ``token_estimated`` bool NOT NULL, server_default false — whether
                    ``total_tokens`` is an estimate (no provider usage reported).

Backfill is implicit via the server defaults: existing rows become
``billable=true``, ``token_estimated=false``, ``chat_id=NULL``.
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0007_usage_ledger"
down_revision: str | None = "0006_chat_mode_model"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # batch_alter_table issues plain ALTERs on Postgres and recreates the table
    # on SQLite, so the FK (with ondelete SET NULL) lands correctly on both.
    with op.batch_alter_table("usage_events") as batch_op:
        batch_op.add_column(sa.Column("chat_id", sa.Integer(), nullable=True))
        batch_op.add_column(
            sa.Column(
                "billable",
                sa.Boolean(),
                nullable=False,
                server_default=sa.true(),
            )
        )
        batch_op.add_column(
            sa.Column(
                "token_estimated",
                sa.Boolean(),
                nullable=False,
                server_default=sa.false(),
            )
        )
        batch_op.create_foreign_key(
            "fk_usage_events_chat_id_chats",
            "chats",
            ["chat_id"],
            ["id"],
            ondelete="SET NULL",
        )
        batch_op.create_index("ix_usage_events_chat_id", ["chat_id"], unique=False)


def downgrade() -> None:
    with op.batch_alter_table("usage_events") as batch_op:
        batch_op.drop_index("ix_usage_events_chat_id")
        batch_op.drop_constraint("fk_usage_events_chat_id_chats", type_="foreignkey")
        batch_op.drop_column("token_estimated")
        batch_op.drop_column("billable")
        batch_op.drop_column("chat_id")
