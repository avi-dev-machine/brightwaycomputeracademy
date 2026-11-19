"""Dedicated local PostgreSQL runner using fixed port 5432."""
import sys
import time
from pathlib import Path

# Add backend directory to sys.path
BACKEND_DIR = Path(__file__).resolve().parent.parent
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from app.db.local_pg import ensure_local_postgres, BRIGHTWAY_URL

print("Starting local PostgreSQL on port 5432...")
success = ensure_local_postgres()
if not success:
    print("Failed to start PostgreSQL.", file=sys.stderr)
    sys.exit(1)

print(f"PostgreSQL running at: {BRIGHTWAY_URL}")
print("Postgres daemon is running. Press Ctrl+C to stop.", flush=True)

try:
    while True:
        time.sleep(1)
except KeyboardInterrupt:
    print("Shutting down...")
    sys.exit(0)
