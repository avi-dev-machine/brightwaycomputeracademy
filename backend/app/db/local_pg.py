"""
Deprecated local PostgreSQL stub.
All local PostgreSQL subprocess management has been removed in favor of MongoDB Atlas cloud database.
"""


def ensure_local_postgres(db_url: str) -> str:
    """No-op stub. Never spawns any local subprocess."""
    return db_url


def ensure_local_postgres_running(port: int = 5432) -> str:
    """No-op stub. Never spawns any local subprocess."""
    return ""
