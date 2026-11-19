"""Dynamic Digital ID Card Generator (PNG & PDF) for the strict 3-collection MongoDB Atlas schema."""

import io
import re
from datetime import UTC, datetime
from typing import Any
from uuid import UUID

from fpdf import FPDF
from PIL import Image, ImageDraw, ImageOps
from pymongo.database import Database as MongoDatabase

from app.core.errors import NotFoundError
from app.core.permissions import assert_student_self_or_staff
from app.core.security import CurrentUser
from app.integrations.storage import StorageProvider


def _latin1(value: str | None) -> str:
    if not value:
        return "-"
    return value.encode("latin-1", errors="replace").decode("latin-1")


class IdCardService:
    def __init__(
        self,
        conn: MongoDatabase[dict[str, Any]],
        storage: StorageProvider | None = None,
    ) -> None:
        self._db = conn
        self._storage = storage

    def _get_student_row(self, identifier: str | UUID) -> dict[str, Any]:
        try:
            uid = UUID(str(identifier))
            row = self._db["students"].find_one({"id": str(uid)})
            if row:
                return dict(row)
        except ValueError:
            pass

        code = str(identifier).strip()
        row = self._db["students"].find_one(
            {"student_id": code.upper()}
        ) or self._db["students"].find_one(
            {"student_id": {"$regex": f"^{re.escape(code)}$", "$options": "i"}}
        )
        if not row:
            raise NotFoundError("student", identifier)
        return dict(row)

    def _load_photo_bytes(self, student_code: str) -> bytes | None:
        if self._storage is None:
            return None
        safe_code = re.sub(r"[^A-Za-z0-9_-]", "_", student_code)
        try:
            return self._storage.get(bucket="student-photos", key=f"{safe_code}.jpg")
        except Exception:
            return None

    def get_card_metadata(
        self, actor: CurrentUser, identifier: str | UUID
    ) -> dict[str, Any]:
        row = self._get_student_row(identifier)
        assert_student_self_or_staff(
            actor,
            student_uuid=UUID(str(row["id"])),
            student_id_code=row["student_id"],
        )
        code = row["student_id"]
        return {
            "id": str(row["id"]),
            "student_id": str(row["id"]),
            "student_code": code,
            "card_number": f"BW-ID-{code}",
            "name": row["name"],
            "contact_number": row["contact_number"],
            "batch": row["batch"],
            "photo_url": row.get("photo_url") or f"/api/v1/students/{code}/photo",
            "pdf_url": f"/api/v1/students/{code}/id-card.pdf",
            "png_url": f"/api/v1/students/{code}/id-card.png",
            "status": "ACTIVE",
            "issued_at": datetime.now(tz=UTC).isoformat(),
        }

    def render_pdf(
        self, actor: CurrentUser, identifier: str | UUID
    ) -> tuple[bytes, str]:
        row = self._get_student_row(identifier)
        assert_student_self_or_staff(
            actor,
            student_uuid=UUID(str(row["id"])),
            student_id_code=row["student_id"],
        )
        code = row["student_id"]
        photo_bytes = self._load_photo_bytes(code)

        # CR80 Landscape: 85.6mm x 54.0mm
        pdf = FPDF(orientation="L", unit="mm", format=(54.0, 85.6))
        pdf.set_auto_page_break(False)
        pdf.set_margins(0, 0, 0)
        pdf.add_page()

        # White card base
        pdf.set_fill_color(255, 255, 255)
        pdf.rect(0, 0, 85.6, 54.0, style="F")

        # Deep Trust Blue header (#1E3A8A)
        pdf.set_fill_color(30, 58, 138)
        pdf.rect(0, 0, 85.6, 13.5, style="F")

        # Gold accent bar (#F59E0B)
        pdf.set_fill_color(245, 158, 11)
        pdf.rect(0, 13.5, 85.6, 1.4, style="F")

        # Academy Header Text
        pdf.set_text_color(255, 255, 255)
        pdf.set_font("Helvetica", "B", 8.5)
        pdf.set_xy(4.0, 2.5)
        pdf.cell(77.6, 4.2, _latin1("BRIGHTWAY COMPUTER EDUCATION"), align="L")
        pdf.set_font("Helvetica", "", 5.5)
        pdf.set_text_color(251, 191, 36)
        pdf.set_xy(4.0, 7.2)
        pdf.cell(
            77.6,
            3.5,
            _latin1("AFFILIATED TO RGYCSM (rgycsm.org)  |  STUDENT IDENTITY CARD"),
            align="L",
        )

        # Photo Frame (Left)
        photo_x, photo_y, photo_w, photo_h = 4.5, 17.5, 21.0, 25.5
        pdf.set_draw_color(37, 99, 235)
        pdf.set_line_width(0.4)
        pdf.rect(photo_x - 0.4, photo_y - 0.4, photo_w + 0.8, photo_h + 0.8, style="D")

        placed = False
        if photo_bytes:
            try:
                with Image.open(io.BytesIO(photo_bytes)) as im:
                    rgb = ImageOps.exif_transpose(im).convert("RGB")
                    fitted = ImageOps.fit(rgb, (300, 360))
                    buf = io.BytesIO()
                    fitted.save(buf, format="JPEG", quality=92)
                    buf.seek(0)
                    pdf.image(buf, x=photo_x, y=photo_y, w=photo_w, h=photo_h)
                    placed = True
            except Exception:
                placed = False

        if not placed:
            pdf.set_fill_color(239, 246, 255)
            pdf.rect(photo_x, photo_y, photo_w, photo_h, style="F")
            initials = (
                "".join(p[0] for p in row["name"].split()[:2] if p).upper() or "BW"
            )
            pdf.set_text_color(30, 58, 138)
            pdf.set_font("Helvetica", "B", 13)
            pdf.set_xy(photo_x, photo_y + 8.5)
            pdf.cell(photo_w, 8, _latin1(initials), align="C")

        # Student Details (Right)
        info_x = 28.5
        pdf.set_xy(info_x, 17.0)
        pdf.set_text_color(15, 23, 42)
        pdf.set_font("Helvetica", "B", 8.5)
        pdf.cell(54.0, 4.5, _latin1(row["name"].upper()[:28]))

        fields = [
            ("STUDENT ID", code),
            ("BATCH", str(row["batch"])[:30]),
            ("CONTACT", str(row["contact_number"])),
            ("VALIDITY", "ACADEMIC SESSION 2026-2027"),
        ]
        y = 22.8
        for label, val in fields:
            pdf.set_xy(info_x, y)
            pdf.set_font("Helvetica", "B", 5.2)
            pdf.set_text_color(100, 116, 139)
            pdf.cell(16.0, 3.6, _latin1(label))
            pdf.set_font("Helvetica", "B", 6.3)
            pdf.set_text_color(30, 58, 138 if label == "STUDENT ID" else 15)
            pdf.cell(38.0, 3.6, _latin1(val))
            y += 4.8

        # Footer Bar
        pdf.set_fill_color(30, 58, 138)
        pdf.rect(0, 47.5, 85.6, 6.5, style="F")
        pdf.set_text_color(255, 255, 255)
        pdf.set_font("Helvetica", "B", 5.2)
        pdf.set_xy(4.5, 49.0)
        pdf.cell(45.0, 3.5, _latin1(f"ID NO: {code}"), align="L")
        pdf.set_text_color(251, 191, 36)
        pdf.set_xy(45.0, 49.0)
        pdf.cell(36.5, 3.5, _latin1("AUTHORIZED SIGNATORY"), align="R")

        return bytes(pdf.output()), f"Brightway-ID-{code}.pdf"

    def render_png(
        self, actor: CurrentUser, identifier: str | UUID
    ) -> tuple[bytes, str]:
        row = self._get_student_row(identifier)
        assert_student_self_or_staff(
            actor,
            student_uuid=UUID(str(row["id"])),
            student_id_code=row["student_id"],
        )
        code = row["student_id"]
        photo_bytes = self._load_photo_bytes(code)

        # Render 1012 x 638 CR80 300-DPI PNG ID Card
        w, h = 1012, 638
        card = Image.new("RGB", (w, h), (255, 255, 255))
        draw = ImageDraw.Draw(card)

        # Header (#1E3A8A) + Gold bar (#F59E0B)
        draw.rectangle((0, 0, w, 155), fill=(30, 58, 138))
        draw.rectangle((0, 155, w, 170), fill=(245, 158, 11))

        draw.text((48, 38), "BRIGHTWAY COMPUTER EDUCATION", fill=(255, 255, 255))
        draw.text(
            (48, 88), "AFFILIATED TO RGYCSM (rgycsm.org)  |  STUDENT ID CARD", fill=(251, 191, 36)
        )

        # Photo region
        px, py, pw, ph = 52, 205, 240, 290
        draw.rectangle(
            (px - 4, py - 4, px + pw + 4, py + ph + 4),
            outline=(37, 99, 235),
            width=4,
        )
        placed = False
        if photo_bytes:
            try:
                with Image.open(io.BytesIO(photo_bytes)) as im:
                    rgb = ImageOps.exif_transpose(im).convert("RGB")
                    fitted = ImageOps.fit(rgb, (pw, ph))
                    card.paste(fitted, (px, py))
                    placed = True
            except Exception:
                placed = False
        if not placed:
            draw.rectangle((px, py, px + pw, py + ph), fill=(239, 246, 255))
            initials = (
                "".join(p[0] for p in row["name"].split()[:2] if p).upper() or "BW"
            )
            draw.text((px + 95, py + 130), initials, fill=(30, 58, 138))

        # Student Details
        ix = 330
        draw.text((ix, 210), f"NAME: {row['name'].upper()}", fill=(15, 23, 42))
        draw.text((ix, 270), f"STUDENT ID: {code}", fill=(37, 99, 235))
        draw.text((ix, 330), f"BATCH: {row['batch']}", fill=(51, 65, 85))
        draw.text((ix, 390), f"CONTACT: {row['contact_number']}", fill=(51, 65, 85))
        draw.text(
            (ix, 450),
            f"MONTHLY FEE: INR {float(row['monthly_fee']):.2f}",
            fill=(51, 65, 85),
        )

        # Footer
        draw.rectangle((0, 560, w, h), fill=(30, 58, 138))
        draw.text(
            (48, 590),
            f"BRIGHTWAY PORTAL VERIFIED  |  ID: {code}",
            fill=(255, 255, 255),
        )

        buf = io.BytesIO()
        card.save(buf, format="PNG")
        return buf.getvalue(), f"Brightway-ID-{code}.png"
