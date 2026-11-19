from typing import Any

from fastapi import APIRouter, File, Response, UploadFile, status
from pydantic import BaseModel, Field

from app.core.constants import get_active_month
from app.dependencies import (
    AdminDep,
    ContainerDep,
    CurrentUserDep,
    id_card_service,
    student_service,
)
from app.schemas.common import ApiResponse, ok
from app.utils.pagination import Page, PageDep

router = APIRouter()


class StudentWritePayload(BaseModel):
    student_id: str | None = Field(default=None, max_length=64)
    enrollment_number: str | None = Field(default=None, max_length=64)
    name: str | None = Field(default=None, max_length=200)
    full_name: str | None = Field(default=None, max_length=200)
    password: str | None = Field(default=None, max_length=128)
    contact_number: str | None = Field(default=None, max_length=32)
    phone: str | None = Field(default=None, max_length=32)
    course: str | None = Field(default=None, max_length=120)
    batch: str | None = Field(default=None, max_length=120)
    monthly_fee: float | None = Field(default=None, ge=0)
    fee_status: str | None = Field(default=None, max_length=32)
    month: str | None = Field(default=None, max_length=32)


@router.get("", response_model=ApiResponse[Page[dict[str, Any]]])
def list_students(
    page: PageDep,
    _user: AdminDep,
    container: ContainerDep,
    search: str | None = None,
    batch: str | None = None,
    course: str | None = None,
    fee_status: str | None = None,
    id_status: str | None = None,
    month_year: str | None = None,
    month: str | None = None,
) -> ApiResponse[Page[dict[str, Any]]]:
    resolved_month = get_active_month(month or month_year)
    return ok(
        student_service(container).list(
            page,
            search=search,
            batch=batch,
            course=course,
            fee_status=fee_status,
            id_status=id_status,
            month_year=resolved_month,
        )
    )


@router.post(
    "", response_model=ApiResponse[dict[str, Any]], status_code=status.HTTP_201_CREATED
)
def create_student(
    payload: StudentWritePayload, _user: AdminDep, container: ContainerDep
) -> ApiResponse[dict[str, Any]]:
    return ok(student_service(container).create(payload.model_dump(exclude_none=True)))


@router.get("/me", response_model=ApiResponse[dict[str, Any]])
def get_my_student_profile(
    user: CurrentUserDep, container: ContainerDep
) -> ApiResponse[dict[str, Any]]:
    return ok(student_service(container).get_me(user))


@router.post("/me/photo", response_model=ApiResponse[dict[str, Any]])
@router.put("/me/photo", response_model=ApiResponse[dict[str, Any]])
async def upload_my_photo(
    user: CurrentUserDep,
    container: ContainerDep,
    file: UploadFile = File(...),
) -> ApiResponse[dict[str, Any]]:
    data = await file.read()
    target_id = user.student_id or str(user.id)
    return ok(
        student_service(container).upload_photo(
            user,
            target_id,
            filename=file.filename or "photo.jpg",
            content_type=file.content_type,
            data=data,
        )
    )


@router.get("/me/id-card.pdf")
def download_my_id_card_pdf(
    user: CurrentUserDep, container: ContainerDep
) -> Response:
    target_id = user.student_id or str(user.id)
    pdf_bytes, filename = id_card_service(container).render_pdf(user, target_id)
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/me/id-card.png")
def download_my_id_card_png(
    user: CurrentUserDep, container: ContainerDep
) -> Response:
    target_id = user.student_id or str(user.id)
    png_bytes, filename = id_card_service(container).render_png(user, target_id)
    return Response(
        content=png_bytes,
        media_type="image/png",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/{student_id}", response_model=ApiResponse[dict[str, Any]])
def get_student(
    student_id: str, user: CurrentUserDep, container: ContainerDep
) -> ApiResponse[dict[str, Any]]:
    return ok(student_service(container).get(user, student_id))


@router.put("/{student_id}", response_model=ApiResponse[dict[str, Any]])
@router.patch("/{student_id}", response_model=ApiResponse[dict[str, Any]])
def update_student(
    student_id: str,
    payload: StudentWritePayload,
    _user: AdminDep,
    container: ContainerDep,
) -> ApiResponse[dict[str, Any]]:
    return ok(
        student_service(container).update(
            student_id, payload.model_dump(exclude_unset=True)
        )
    )


@router.delete("/{student_id}", response_model=ApiResponse[dict[str, Any]])
def delete_student(
    student_id: str, _user: AdminDep, container: ContainerDep
) -> ApiResponse[dict[str, Any]]:
    return ok(student_service(container).delete(student_id))


@router.put("/{student_id}/photo", response_model=ApiResponse[dict[str, Any]])
@router.post("/{student_id}/photo", response_model=ApiResponse[dict[str, Any]])
async def upload_student_photo(
    student_id: str,
    user: CurrentUserDep,
    container: ContainerDep,
    file: UploadFile = File(...),
) -> ApiResponse[dict[str, Any]]:
    data = await file.read()
    return ok(
        student_service(container).upload_photo(
            user,
            student_id,
            filename=file.filename or "photo.jpg",
            content_type=file.content_type,
            data=data,
        )
    )


@router.get("/{student_id}/photo")
def get_student_photo(student_id: str, container: ContainerDep) -> Response:
    raw_bytes, media_type = student_service(container).get_photo_bytes(student_id)
    return Response(
        content=raw_bytes,
        media_type=media_type,
        headers={"Cache-Control": "public, max-age=60"},
    )


@router.get("/{student_id}/id-card.pdf")
def download_student_id_card_pdf(
    student_id: str, user: CurrentUserDep, container: ContainerDep
) -> Response:
    pdf_bytes, filename = id_card_service(container).render_pdf(user, student_id)
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/{student_id}/id-card.png")
def download_student_id_card_png(
    student_id: str, user: CurrentUserDep, container: ContainerDep
) -> Response:
    png_bytes, filename = id_card_service(container).render_png(user, student_id)
    return Response(
        content=png_bytes,
        media_type="image/png",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
