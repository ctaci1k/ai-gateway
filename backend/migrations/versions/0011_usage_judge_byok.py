"""usage_events judge BYOK denorm: judge_model_name + judge_key_fingerprint (PH34, D-24, B9b)

Revision ID: 0011_usage_judge_byok
Revises: 0010_usage_model_name
Create Date: 2026-06-03

PH34 (D-24, B9b) makes the user's added (BYOK) judge visible in Usage Reports
even in Compare, where the judge is not the winning ledger row. Two nullable
columns are denormalized on ``usage_events`` at record time, following the
proven PH31/PH32 single-migration + denormalized-column pattern:

- ``judge_model_name`` String(128), nullable — the real judge model id, set only
  when a BYOK judge participated (selector enabled + a stored judge key); a
  built-in (app-key) judge leaves it NULL so it never clutters the stats.
- ``judge_key_fingerprint`` String(32), nullable — the display-only mask
  (``first4••••last4``) of the judge key; the plaintext key is NEVER stored.

Reports synthesize a DERIVED own-key judge row from these columns (the winning
row stays the canonical one-row-per-turn ledger entry; quotas/billable/the
one-row-per-turn invariant are unaffected). Backfill is implicit: existing rows
keep both NULL → no synthesized judge row for historical turns.
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0011_usage_judge_byok"
down_revision: str | None = "0010_usage_model_name"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # batch_alter_table issues a plain ALTER on Postgres and recreates the table
    # on SQLite; both columns are nullable so no backfill/default is required.
    with op.batch_alter_table("usage_events") as batch_op:
        batch_op.add_column(
            sa.Column("judge_model_name", sa.String(length=128), nullable=True)
        )
        batch_op.add_column(
            sa.Column("judge_key_fingerprint", sa.String(length=32), nullable=True)
        )


def downgrade() -> None:
    with op.batch_alter_table("usage_events") as batch_op:
        batch_op.drop_column("judge_key_fingerprint")
        batch_op.drop_column("judge_model_name")
