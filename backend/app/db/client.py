"""MongoDB Atlas connection management with automatic in-process fallback (zero subprocesses).

Strictly maintains only the 3 specified collections:
1. `students`
2. `admins`
3. `fee_payments`
"""

import logging
from collections.abc import Generator
from typing import Annotated, Any

import certifi
from fastapi import Depends
from pymongo import ASCENDING, MongoClient

from app.config import BACKEND_DIR, DEFAULT_MONGODB_URI, Settings, get_settings
from app.db.mongo_fallback import InProcessMongoDatabase

logger = logging.getLogger(__name__)

DbConnection = Any
_mongo_client: MongoClient[dict[str, Any]] | None = None
_active_db: Any = None
_db_name: str = "brightway"


def get_mongo_client(settings: Settings | None = None) -> MongoClient[dict[str, Any]]:
    global _mongo_client, _db_name
    if _mongo_client is None:
        resolved = settings or get_settings()
        uri = resolved.mongodb_uri.get_secret_value() or DEFAULT_MONGODB_URI
        _db_name = resolved.mongodb_db_name or "brightway"
        _mongo_client = MongoClient(
            uri,
            tlsCAFile=certifi.where(),
            serverSelectionTimeoutMS=4000,
            connectTimeoutMS=4000,
            socketTimeoutMS=4000,
            retryWrites=True,
        )
    return _mongo_client


def ensure_indexes(db: Any) -> None:
    """Create strict unique and lookup indexes on `students`, `admins`, and `fee_payments`."""
    db["students"].create_index([("id", ASCENDING)], unique=True, name="idx_students_id")
    try:
        idx_info = db["students"].index_information()
        if (
            "idx_students_student_id" in idx_info
            and "partialFilterExpression" not in idx_info["idx_students_student_id"]
        ):
            db["students"].drop_index("idx_students_student_id")
    except Exception:
        pass

    db["students"].create_index(
        [("student_id", ASCENDING)],
        unique=True,
        name="idx_students_student_id",
        partialFilterExpression={"student_id": {"$type": "string", "$gt": ""}},
    )
    db["students"].create_index([("course", ASCENDING)], name="idx_students_course")
    db["students"].create_index([("batch", ASCENDING)], name="idx_students_batch")

    db["admins"].create_index([("id", ASCENDING)], unique=True, name="idx_admins_id")
    db["admins"].create_index(
        [("username", ASCENDING)], unique=True, name="idx_admins_username"
    )

    db["fee_payments"].create_index(
        [("id", ASCENDING)], unique=True, name="idx_fee_payments_id"
    )
    db["fee_payments"].create_index(
        [("student_key", ASCENDING), ("month_year", ASCENDING)],
        unique=True,
        name="idx_fee_payments_student_key_month",
        partialFilterExpression={"student_key": {"$type": "string", "$gt": ""}},
    )
    db["fee_payments"].create_index(
        [("student_id", ASCENDING), ("month_year", ASCENDING)],
        name="idx_fee_payments_student_month_lookup",
    )
    db["fee_payments"].create_index(
        [("month_year", ASCENDING), ("status", ASCENDING)],
        name="idx_fee_payments_month_status",
    )
    db["fee_payments"].create_index(
        [("razorpay_order_id", ASCENDING)],
        name="idx_fee_payments_order_id",
    )


def get_active_database(settings: Settings | None = None) -> Any:
    """Return the connected MongoDB Atlas database, or the in-process JSON document store
    if MongoDB Atlas TLS handshake is blocked by dynamic IP changes.
    """
    global _active_db
    if _active_db is not None:
        return _active_db

    resolved = settings or get_settings()
    db_name = resolved.mongodb_db_name or "brightway"
    try:
        client = get_mongo_client(resolved)
        atlas_db = client[db_name]
        ensure_indexes(atlas_db)
        _active_db = atlas_db
        logger.info("Connected to MongoDB Atlas database '%s'.", db_name)
        return _active_db
    except Exception as exc:
        fallback_path = BACKEND_DIR / ".storage" / "brightway_db.json"
        logger.warning(
            "MongoDB Atlas unreachable (%s). Using zero-subprocess in-process document store at %s.",
            exc.__class__.__name__,
            fallback_path,
        )
        _active_db = InProcessMongoDatabase(fallback_path, name=db_name)
        return _active_db


def init_pool(settings: Settings | None = None) -> Any:
    db = get_active_database(settings)
    # Auto-seed if empty and ensure both SUPER_ADMIN (BWADMIN) and restricted ADMIN (FEESADMIN) exist
    try:
        if (
            db["students"].count_documents({}) == 0
            or db["admins"].count_documents({}) == 0
            or db["fee_payments"].count_documents({}) == 0
        ):
            from scripts.populate_database import seed_database

            seed_database(db)
        else:
            from datetime import UTC, datetime
            from uuid import uuid4
            from app.core.passwords import hash_password

            if not db["admins"].find_one({"username": "FEESADMIN"}):
                db["admins"].insert_one(
                    {
                        "id": str(uuid4()),
                        "username": "FEESADMIN",
                        "password_hash": hash_password("Brightway@Fees2026!"),
                        "role": "ADMIN",
                        "display_name": "Fees Management Admin",
                        "created_at": datetime.now(tz=UTC),
                    }
                )
    except Exception as exc:
        logger.warning("Auto-seed check warning: %s", exc)
    return db


def close_pool() -> None:
    global _mongo_client, _active_db
    if _mongo_client is not None:
        _mongo_client.close()
        _mongo_client = None
    _active_db = None


def get_db_conn(
    settings: Annotated[Settings, Depends(get_settings)],
) -> Generator[Any, None, None]:
    yield get_active_database(settings)


DbConn = Annotated[Any, Depends(get_db_conn)]
