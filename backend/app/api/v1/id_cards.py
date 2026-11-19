from typing import Any

from fastapi import APIRouter, Response
from pydantic import BaseModel

from app.dependencies import ContainerDep, CurrentUserDep, id_card_service
from app.schemas.common import ApiResponse, ok

router = APIRouter()


class GenerateIdCardPayload(BaseModel):
    student_id: str | None = None


@router.get("/me", response_model=ApiResponse[dict[str, Any]])
def get_my_id_card(
    user: CurrentUserDep, container: ContainerDep
) -> ApiResponse[dict[str, Any]]:
    target = user.student_id or str(user.id)
    return ok(id_card_service(container).get_card_metadata(user, target))


@router.get("/me.pdf")
def download_my_id_card_pdf(
    user: CurrentUserDep, container: ContainerDep
) -> Response:
    target = user.student_id or str(user.id)
    pdf_bytes, filename = id_card_service(container).render_pdf(user, target)
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/me.png")
def download_my_id_card_png(
    user: CurrentUserDep, container: ContainerDep
) -> Response:
    target = user.student_id or str(user.id)
    png_bytes, filename = id_card_service(container).render_png(user, target)
    return Response(
        content=png_bytes,
        media_type="image/png",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.post("/generate", response_model=ApiResponse[dict[str, Any]])
def generate_id_card(
    payload: GenerateIdCardPayload, user: CurrentUserDep, container: ContainerDep
) -> ApiResponse[dict[str, Any]]:
    target = payload.student_id or user.student_id or str(user.id)
    return ok(id_card_service(container).get_card_metadata(user, target))


@router.get("/student/{student_id}", response_model=ApiResponse[dict[str, Any]])
def get_student_id_card(
    student_id: str, user: CurrentUserDep, container: ContainerDep
) -> ApiResponse[dict[str, Any]]:
    return ok(id_card_service(container).get_card_metadata(user, student_id))


@router.get("/{student_id}/card.pdf")
def download_card_pdf(
    student_id: str, user: CurrentUserDep, container: ContainerDep
) -> Response:
    pdf_bytes, filename = id_card_service(container).render_pdf(user, student_id)
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/{student_id}/card.png")
def download_card_png(
    student_id: str, user: CurrentUserDep, container: ContainerDep
) -> Response:
    png_bytes, filename = id_card_service(container).render_png(user, student_id)
    return Response(
        content=png_bytes,
        media_type="image/png",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
