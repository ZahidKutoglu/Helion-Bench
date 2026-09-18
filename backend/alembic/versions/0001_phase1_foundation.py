"""Phase 1 has no domain tables.

This revision exists so Alembic has a head to upgrade to. Document and
chunk tables are added in Phase 2.
"""

from collections.abc import Sequence

revision: str = "0001_phase1_foundation"
down_revision: str | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
