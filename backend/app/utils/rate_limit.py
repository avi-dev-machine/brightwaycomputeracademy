"""In-process sliding-window rate limiter."""

import threading
import time
from collections import deque

from fastapi import Request

from app.exceptions import RateLimitError

_MAX_TRACKED_KEYS = 10_000


class SlidingWindowLimiter:
    def __init__(self, max_requests: int = 60, window_seconds: float = 60.0) -> None:
        self.limit = max_requests
        self.window = window_seconds
        self._hits: dict[str, deque[float]] = {}
        self._lock = threading.Lock()

    def hit(self, key: str) -> None:
        if self.limit <= 0:
            return
        now = time.monotonic()
        with self._lock:
            hits = self._hits.setdefault(key, deque())
            while hits and now - hits[0] >= self.window:
                hits.popleft()
            if len(hits) >= self.limit:
                retry_after = max(1, int(self.window - (now - hits[0])) + 1)
                raise RateLimitError(retry_after_seconds=retry_after)
            hits.append(now)
            if len(self._hits) > _MAX_TRACKED_KEYS:
                stale = [
                    k
                    for k, v in self._hits.items()
                    if not v or now - v[-1] >= self.window
                ]
                for k in stale:
                    del self._hits[k]

    def reset(self) -> None:
        with self._lock:
            self._hits.clear()


RateLimiter = SlidingWindowLimiter


def client_ip(request: Request) -> str:
    return request.client.host if request.client else "unknown"
