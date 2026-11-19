from typing import Any

from fastapi import APIRouter, File, Form, UploadFile, status

from app.dependencies import AdminDep, ContainerDep, csv_import_service
from app.schemas.common import ApiResponse, ok

router = APIRouter()


@router.post(
    "/csv",
    response_model=ApiResponse[dict[str, Any]],
    status_code=status.HTTP_201_CREATED,
)
def import_csv(
    _user: AdminDep,
    container: ContainerDep,
    file: UploadFile = File(...),
    dry_run: bool = Form(default=False),
) -> ApiResponse[dict[str, Any]]:
    """Stream-parse and upsert student records from CSV without buffering the full file in RAM."""
    file.file.seek(0)
    result = csv_import_service(container).ingest_stream(
        file.file,
        filename=file.filename or "students.csv",
        dry_run=dry_run,
    )
    return ok(result)
