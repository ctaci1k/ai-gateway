"""usage_events.key_fingerprint: BYOK key attribution in reports (PH31, D-21)

Revision ID: 0009_usage_key_fingerprint
Revises: 0008_byok_credentials
Create Date: 2026-06-03

PH31 (D-21) attributes a turn's winning model to its KEY SOURCE in Usage
Reports. One nullable column is added:

- ``key_fingerprint`` String(32), nullable — display-only mask of the BYOK key
  used for the winning model (``first4••••last4``, e.g. ``gsk_••••OTzu``).
  NULL = the turn ran on the app's built-in (app-key) model. Denormalized from
  the decrypted ByokConfig at record time; the plaintext key is NEVER stored.

Backfill is implicit: existing rows keep ``key_fingerprint=NULL`` (built-in).
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0009_usage_key_fingerprint"
down_revision: str | None = "0008_byok_credentials"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # batch_alter_table issues a plain ALTER on Postgres and recreates the table
    # on SQLite; the column is nullable so no backfill/default is required.
    with op.batch_alter_table("usage_events") as batch_op:
        batch_op.add_column(
            sa.Column("key_fingerprint", sa.String(length=32), nullable=True)
        )


def downgrade() -> None:
    with op.batch_alter_table("usage_events") as batch_op:
        batch_op.drop_column("key_fingerprint")
