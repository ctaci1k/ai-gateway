"""quotas + usage audit: users admin/limit columns + usage_events table (PH15)

Revision ID: 0005_quotas_usage
Revises: 0004_documents
Create Date: 2026-05-29

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0005_quotas_usage"
down_revision: str | None = "0004_documents"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # New User columns (D-10). is_admin defaults false; limit columns are NULL
    # (unlimited) for existing rows — admins stay unlimited, others get explicit
    # defaults assigned at registration / by the admin panel.
    op.add_column(
        "users",
        sa.Column("is_admin", sa.Boolean(), nullable=False, server_default=sa.false()),
    )
    op.add_column(
        "users",
        sa.Column("max_requests_per_minute", sa.Integer(), nullable=True),
    )
    op.add_column(
        "users",
        sa.Column("max_requests_per_day", sa.Integer(), nullable=True),
    )

    op.create_table(
        "usage_events",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("mode", sa.String(length=16), nullable=False),
        sa.Column("message", sa.String(), nullable=False, server_default=""),
        sa.Column("selected_model", sa.String(length=64), nullable=True),
        sa.Column("total_tokens", sa.Integer(), nullable=True),
        sa.Column("success", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_usage_events_user_id", "usage_events", ["user_id"], unique=False
    )
    op.create_index(
        "ix_usage_events_created_at", "usage_events", ["created_at"], unique=False
    )


def downgrade() -> None:
    op.drop_index("ix_usage_events_created_at", table_name="usage_events")
    op.drop_index("ix_usage_events_user_id", table_name="usage_events")
    op.drop_table("usage_events")
    op.drop_column("users", "max_requests_per_day")
    op.drop_column("users", "max_requests_per_minute")
    op.drop_column("users", "is_admin")
