from fastapi import APIRouter

from app.api.v1 import (
    admin,
    auth,
    fees,
    health,
    id_cards,
    imports,
    notifications,
    payments,
    reports,
    students,
)

api_router = APIRouter()
api_router.include_router(health.router, tags=["health"])
api_router.include_router(auth.router, prefix="/auth", tags=["auth"])
api_router.include_router(admin.router, prefix="/admin", tags=["admin"])
api_router.include_router(admin.public_router, tags=["public-admissions-albums"])
api_router.include_router(students.router, prefix="/student", tags=["student"])
api_router.include_router(students.router, prefix="/students", tags=["students"])
api_router.include_router(fees.router, prefix="/fees", tags=["fees"])
api_router.include_router(payments.router, prefix="/payments", tags=["payments"])
api_router.include_router(payments.router, prefix="/payment", tags=["payment"])
api_router.include_router(id_cards.router, prefix="/id-cards", tags=["id-cards"])
api_router.include_router(
    notifications.router, prefix="/notifications", tags=["notifications"]
)
api_router.include_router(imports.router, prefix="/imports", tags=["imports"])
api_router.include_router(reports.router, prefix="/reports", tags=["reports"])
