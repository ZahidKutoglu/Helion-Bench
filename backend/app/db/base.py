"""SQLAlchemy declarative base.

Models in later phases will inherit from Base. Alembic reads Base.metadata
to generate migrations. Phase 1 has no domain tables yet.
"""

from sqlalchemy.orm import DeclarativeBase


class Base(DeclarativeBase):
    pass
