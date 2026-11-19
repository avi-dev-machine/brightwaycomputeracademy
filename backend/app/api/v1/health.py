from typing import Any

from fastapi import APIRouter

from app.dependencies import ContainerDep
from app.schemas.common import ApiResponse, ok

router = APIRouter()


@router.api_route("/health", methods=["GET", "HEAD"], response_model=ApiResponse[dict[str, Any]])
def health_check(container: ContainerDep) -> ApiResponse[dict[str, Any]]:
    collections = sorted(container.conn.list_collection_names())
    return ok(
        {
            "status": "ok",
            "database": "mongodb_atlas_connected",
            "tables": collections,
            "collections": collections,
        }
    )
