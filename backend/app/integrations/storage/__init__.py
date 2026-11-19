"""Local secure storage provider for student photographs and ID card assets."""

from pathlib import Path

from app.config import BACKEND_DIR, Settings
from app.core.errors import NotFoundError


class StorageProvider:
    def __init__(self, base_dir: Path) -> None:
        self._base_dir = base_dir
        self._base_dir.mkdir(parents=True, exist_ok=True)

    def _resolve_path(self, bucket: str, key: str) -> Path:
        safe_bucket = "".join(c for c in bucket if c.isalnum() or c in "-_")
        safe_key = Path(key).name
        bucket_dir = (self._base_dir / safe_bucket).resolve()
        bucket_dir.mkdir(parents=True, exist_ok=True)
        target = (bucket_dir / safe_key).resolve()
        if not str(target).startswith(str(bucket_dir)):
            raise ValueError("Invalid storage key path.")
        return target

    def put(
        self, *, bucket: str, key: str, data: bytes, content_type: str = "image/jpeg"
    ) -> str:
        target = self._resolve_path(bucket, key)
        target.write_bytes(data)
        return f"/{bucket}/{target.name}"

    def get(self, *, bucket: str, key: str) -> bytes:
        target = self._resolve_path(bucket, key)
        if not target.exists():
            raise NotFoundError("storage_object", f"{bucket}/{key}")
        return target.read_bytes()


def build_storage_provider(settings: Settings) -> StorageProvider:
    raw_dir = Path(settings.local_storage_dir)
    base_dir = raw_dir if raw_dir.is_absolute() else (BACKEND_DIR / raw_dir)
    return StorageProvider(base_dir)

