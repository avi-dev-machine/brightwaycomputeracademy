"""In-process, zero-subprocess MongoDB-compatible document store backed by a JSON file.

Used automatically whenever MongoDB Atlas rejects TLS handshakes due to dynamic ISP IP changes
(TLSV1_ALERT_INTERNAL_ERROR), ensuring zero downtime and zero external subprocesses.
"""

import json
import re
import threading
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Any

from pymongo import ASCENDING, ReturnDocument, UpdateOne

_LOCK = threading.RLock()


@dataclass
class BulkWriteResult:
    upserted_count: int = 0
    modified_count: int = 0
    matched_count: int = 0


@dataclass
class UpdateResult:
    matched_count: int = 0
    modified_count: int = 0


def _serialize_default(obj: Any) -> Any:
    if isinstance(obj, datetime):
        return obj.isoformat()
    return str(obj)


def _matches(doc: dict[str, Any], filt: dict[str, Any] | None) -> bool:
    if not filt:
        return True
    for k, v in filt.items():
        if k == "$or":
            if not any(_matches(doc, sub) for sub in v):
                return False
            continue
        if k == "$and":
            if not all(_matches(doc, sub) for sub in v):
                return False
            continue

        doc_val = doc.get(k)
        if isinstance(v, dict):
            if "$regex" in v:
                pattern = str(v["$regex"])
                flags = re.IGNORECASE if "i" in str(v.get("$options", "")).lower() else 0
                if not re.search(pattern, str(doc_val or ""), flags):
                    return False
            if "$in" in v and doc_val not in v["$in"]:
                return False
            if "$nin" in v and doc_val in v["$nin"]:
                return False
            if "$ne" in v and doc_val == v["$ne"]:
                return False
            if "$gt" in v and not (
                doc_val is not None and str(doc_val) > str(v["$gt"])
            ):
                return False
        else:
            if doc_val != v:
                return False
    return True


def _apply_projection(
    doc: dict[str, Any], projection: dict[str, int] | None
) -> dict[str, Any]:
    if not projection:
        return dict(doc)
    include_keys = [k for k, v in projection.items() if v and k != "_id"]
    if include_keys:
        return {k: doc.get(k) for k in include_keys if k in doc}
    return {k: v for k, v in doc.items() if projection.get(k, 1) != 0}


class InProcessCursor:
    def __init__(self, docs: list[dict[str, Any]]) -> None:
        self._docs = docs

    def sort(self, key_or_list: Any, direction: int = ASCENDING) -> "InProcessCursor":
        if isinstance(key_or_list, str):
            pairs = [(key_or_list, direction)]
        else:
            pairs = list(key_or_list)
        for field, dir_val in reversed(pairs):
            rev = dir_val < 0
            self._docs.sort(
                key=lambda d, f=field: str(d.get(f) or "").lower(), reverse=rev
            )
        return self

    def skip(self, count: int) -> "InProcessCursor":
        self._docs = self._docs[max(0, count) :]
        return self

    def limit(self, count: int) -> "InProcessCursor":
        if count > 0:
            self._docs = self._docs[:count]
        return self

    def __iter__(self):
        return iter(self._docs)


class InProcessCollection:
    def __init__(self, db: "InProcessMongoDatabase", name: str) -> None:
        self._db = db
        self.name = name

    def _rows(self) -> list[dict[str, Any]]:
        return self._db._data.setdefault(self.name, [])

    def create_index(self, *args: Any, **kwargs: Any) -> str:
        return kwargs.get("name", "idx")

    def index_information(self) -> dict[str, Any]:
        return {}

    def drop_index(self, *args: Any, **kwargs: Any) -> None:
        pass

    def drop(self) -> None:
        with _LOCK:
            self._db._data[self.name] = []
            self._db._flush()

    def count_documents(self, filt: dict[str, Any] | None = None) -> int:
        with _LOCK:
            return sum(1 for d in self._rows() if _matches(d, filt))

    def find(
        self,
        filt: dict[str, Any] | None = None,
        projection: dict[str, int] | None = None,
    ) -> InProcessCursor:
        with _LOCK:
            matched = [
                _apply_projection(d, projection)
                for d in self._rows()
                if _matches(d, filt)
            ]
            return InProcessCursor(matched)

    def find_one(
        self,
        filt: dict[str, Any] | None = None,
        projection: dict[str, int] | None = None,
    ) -> dict[str, Any] | None:
        with _LOCK:
            for d in self._rows():
                if _matches(d, filt):
                    return _apply_projection(d, projection)
            return None

    def insert_one(self, doc: dict[str, Any]) -> None:
        with _LOCK:
            self._rows().append(dict(doc))
            self._db._flush()

    def _apply_update_doc(
        self, target: dict[str, Any], update: dict[str, Any], *, is_insert: bool
    ) -> None:
        if "$set" in update:
            target.update(update["$set"])
        if is_insert and "$setOnInsert" in update:
            for k, v in update["$setOnInsert"].items():
                target.setdefault(k, v)

    def update_one(
        self, filt: dict[str, Any], update: dict[str, Any], *, upsert: bool = False
    ) -> UpdateResult:
        with _LOCK:
            for d in self._rows():
                if _matches(d, filt):
                    self._apply_update_doc(d, update, is_insert=False)
                    self._db._flush()
                    return UpdateResult(matched_count=1, modified_count=1)
            if upsert:
                new_doc: dict[str, Any] = {}
                for k, v in filt.items():
                    if not k.startswith("$") and not isinstance(v, dict):
                        new_doc[k] = v
                self._apply_update_doc(new_doc, update, is_insert=True)
                self._rows().append(new_doc)
                self._db._flush()
                return UpdateResult(matched_count=0, modified_count=1)
            return UpdateResult(matched_count=0, modified_count=0)

    def update_many(
        self, filt: dict[str, Any], update: dict[str, Any]
    ) -> UpdateResult:
        with _LOCK:
            cnt = 0
            for d in self._rows():
                if _matches(d, filt):
                    self._apply_update_doc(d, update, is_insert=False)
                    cnt += 1
            if cnt:
                self._db._flush()
            return UpdateResult(matched_count=cnt, modified_count=cnt)

    def find_one_and_update(
        self,
        filt: dict[str, Any],
        update: dict[str, Any],
        *,
        upsert: bool = False,
        return_document: Any = ReturnDocument.AFTER,
    ) -> dict[str, Any] | None:
        with _LOCK:
            for d in self._rows():
                if _matches(d, filt):
                    self._apply_update_doc(d, update, is_insert=False)
                    self._db._flush()
                    return dict(d)
            if upsert:
                new_doc: dict[str, Any] = {}
                for k, v in filt.items():
                    if not k.startswith("$") and not isinstance(v, dict):
                        new_doc[k] = v
                self._apply_update_doc(new_doc, update, is_insert=True)
                self._rows().append(new_doc)
                self._db._flush()
                return dict(new_doc)
            return None

    def delete_one(self, filt: dict[str, Any]) -> None:
        with _LOCK:
            rows = self._rows()
            for idx, d in enumerate(rows):
                if _matches(d, filt):
                    del rows[idx]
                    self._db._flush()
                    return

    def delete_many(self, filt: dict[str, Any]) -> None:
        with _LOCK:
            if not filt:
                self._db._data[self.name] = []
            else:
                self._db._data[self.name] = [
                    d for d in self._rows() if not _matches(d, filt)
                ]
            self._db._flush()

    def bulk_write(
        self, ops: list[UpdateOne], *, ordered: bool = False
    ) -> BulkWriteResult:
        with _LOCK:
            upserted = 0
            modified = 0
            matched = 0
            rows = self._rows()
            # Build fast index by student_id for O(1) bulk upserts
            by_student_id: dict[str, dict[str, Any]] = {
                d["student_id"]: d for d in rows if d.get("student_id")
            }

            for op in ops:
                filt = op._filter
                update = op._doc
                upsert = op._upsert
                target = None

                if (
                    len(filt) == 1
                    and "student_id" in filt
                    and filt["student_id"]
                    and isinstance(filt["student_id"], str)
                ):
                    target = by_student_id.get(filt["student_id"])
                else:
                    for d in rows:
                        if _matches(d, filt):
                            target = d
                            break

                if target is not None:
                    matched += 1
                    modified += 1
                    self._apply_update_doc(target, update, is_insert=False)
                    if target.get("student_id"):
                        by_student_id[target["student_id"]] = target
                elif upsert:
                    upserted += 1
                    new_doc: dict[str, Any] = {}
                    for k, v in filt.items():
                        if not k.startswith("$") and not isinstance(v, dict):
                            new_doc[k] = v
                    self._apply_update_doc(new_doc, update, is_insert=True)
                    rows.append(new_doc)
                    if new_doc.get("student_id"):
                        by_student_id[new_doc["student_id"]] = new_doc

            self._db._flush()
            return BulkWriteResult(
                upserted_count=upserted,
                modified_count=modified,
                matched_count=matched,
            )

    def aggregate(self, pipeline: list[dict[str, Any]]) -> list[dict[str, Any]]:
        with _LOCK:
            docs = [dict(d) for d in self._rows()]
            for stage in pipeline:
                if "$match" in stage:
                    docs = [d for d in docs if _matches(d, stage["$match"])]
                elif "$group" in stage:
                    grp = stage["$group"]
                    id_expr = grp["_id"]
                    groups: dict[Any, dict[str, Any]] = {}
                    for d in docs:
                        g_key = (
                            d.get(id_expr[1:])
                            if isinstance(id_expr, str) and id_expr.startswith("$")
                            else id_expr
                        )
                        entry = groups.setdefault(
                            g_key,
                            {"_id": g_key, "paid_count": 0, "collected_amount": 0.0},
                        )
                        entry["paid_count"] += 1
                        entry["collected_amount"] += float(d.get("amount", 0) or 0)
                    docs = list(groups.values())
                elif "$sort" in stage:
                    for k, dir_v in reversed(list(stage["$sort"].items())):
                        docs.sort(
                            key=lambda x, f=k: str(x.get(f) or ""),
                            reverse=(dir_v < 0),
                        )
            return docs


class InProcessMongoDatabase:
    """Zero-subprocess in-process document database persisted to JSON on disk."""

    def __init__(self, storage_path: Path, name: str = "brightway") -> None:
        self.name = name
        self._path = storage_path
        self._data: dict[str, list[dict[str, Any]]] = {
            "students": [],
            "admins": [],
            "fee_payments": [],
        }
        self._load()

    def _load(self) -> None:
        with _LOCK:
            source_path = self._path
            if not source_path.exists():
                bundled_seed = Path(__file__).resolve().parent / "seed_data.json"
                if bundled_seed.exists():
                    source_path = bundled_seed
            if source_path.exists():
                try:
                    raw = json.loads(source_path.read_text(encoding="utf-8"))
                    if isinstance(raw, dict):
                        for k, v in raw.items():
                            if isinstance(v, list):
                                self._data[k] = v
                    if source_path != self._path:
                        self._flush()
                except Exception:
                    pass

    def _flush(self) -> None:
        with _LOCK:
            self._path.parent.mkdir(parents=True, exist_ok=True)
            tmp = self._path.with_suffix(".tmp")
            tmp.write_text(
                json.dumps(self._data, default=_serialize_default),
                encoding="utf-8",
            )
            tmp.replace(self._path)

    def __getitem__(self, collection_name: str) -> InProcessCollection:
        self._load()
        return InProcessCollection(self, collection_name)

    def list_collection_names(self) -> list[str]:
        self._load()
        return [k for k in self._data.keys()]

    def drop_collection(self, name: str) -> None:
        with _LOCK:
            self._data.pop(name, None)
            self._flush()
