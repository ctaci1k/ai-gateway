"""usage_events.model_name: true model name everywhere, BYOK-aware (PH32, D-22)

Revision ID: 0010_usage_model_name
Revises: 0009_usage_key_fingerprint
Create Date: 2026-06-03

PH32 (D-22) records the REAL model that answered/won a turn so reports, the
admin audit, the Compare winner banner and the replayed Compare cards show the
truth even when a user points their own key at a built-in slot (e.g. groq →
gpt-4o). One nullable column is added:

- ``model_name`` String(128), nullable — the true model id of the chosen/
  answering slot. ``selected_model`` stays the SLOT (stable grouper). Compare =
  the winning slot's ``all_responses[slot]["model"]``; Single = the streamed
  ``model_name``. The plaintext key is NEVER stored here.

Backfill is implicit: existing rows keep ``model_name=NULL`` → the FE falls back
to the slot label (truthful for built-in; legacy own-key rows show the slot).
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0010_usage_model_name"
down_revision: str | None = "0009_usage_key_fingerprint"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # batch_alter_table issues a plain ALTER on Postgres and recreates the table
    # on SQLite; the column is nullable so no backfill/default is required.
    with op.batch_alter_table("usage_events") as batch_op:
        batch_op.add_column(
            sa.Column("model_name", sa.String(length=128), nullable=True)
        )


def downgrade() -> None:
    with op.batch_alter_table("usage_events") as batch_op:
        batch_op.drop_column("model_name")
