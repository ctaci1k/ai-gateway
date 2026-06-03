"""byok_credentials: server-side encrypted BYOK keys (PH30, D-20)

Revision ID: 0008_byok_credentials
Revises: 0007_usage_ledger
Create Date: 2026-06-03

PH30 (D-20) reverses D-12 ("keys never in the DB"): BYOK keys are now persisted
per-account, ENCRYPTED at rest with an AES-256-GCM envelope (core/secret_box.py).
Only the ciphertext + nonce + non-secret last4 are stored — never the plaintext.

One row per (user, slot); UNIQUE(user_id, slot). FK to users with ondelete
CASCADE (a deleted account drops its stored keys).
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0008_byok_credentials"
down_revision: str | None = "0007_usage_ledger"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "byok_credentials",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("slot", sa.String(length=64), nullable=False),
        sa.Column("base_url", sa.String(), nullable=True),
        sa.Column("model_id", sa.String(length=256), nullable=False),
        sa.Column("key_ciphertext", sa.LargeBinary(), nullable=False),
        sa.Column("key_nonce", sa.LargeBinary(), nullable=False),
        sa.Column("key_last4", sa.String(length=8), nullable=True),
        sa.Column(
            "key_version",
            sa.Integer(),
            nullable=False,
            server_default="1",
        ),
        sa.Column(
            "custom",
            sa.Boolean(),
            nullable=False,
            server_default=sa.false(),
        ),
        sa.Column("created_at", sa.DateTime(), nullable=True),
        sa.Column("updated_at", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id", "slot", name="uq_byok_user_slot"),
    )
    op.create_index(
        "ix_byok_credentials_user_id", "byok_credentials", ["user_id"], unique=False
    )


def downgrade() -> None:
    op.drop_index("ix_byok_credentials_user_id", table_name="byok_credentials")
    op.drop_table("byok_credentials")
