"""Pure-Python OpenXML (.xlsx) and CSV reader and writer using standard library `zipfile` and `xml.etree`.

Allows uploading and downloading genuine Microsoft Excel (.xlsx) files as well as (.csv) files
without requiring external native dependencies on Render.
"""

import csv
import io
import zipfile
from typing import Any
from xml.etree import ElementTree as ET
from xml.sax.saxutils import escape


def _col_letter(col_idx: int) -> str:
    """Convert 0-based column index to Excel column letter (0 -> A, 25 -> Z, 26 -> AA)."""
    result = ""
    n = col_idx + 1
    while n > 0:
        n, rem = divmod(n - 1, 26)
        result = chr(65 + rem) + result
    return result


def build_xlsx_bytes(
    headers: list[str],
    rows: list[list[Any]],
    *,
    sheet_name: str = "Brightway Data",
) -> bytes:
    """Generate a valid Microsoft Excel (.xlsx) workbook in memory."""
    buf = io.BytesIO()

    all_rows: list[list[Any]] = [headers, *rows]
    sheet_rows_xml: list[str] = []

    for r_idx, row_vals in enumerate(all_rows, start=1):
        cells_xml: list[str] = []
        for c_idx, val in enumerate(row_vals):
            cell_ref = f"{_col_letter(c_idx)}{r_idx}"
            if val is None:
                val_str = ""
            else:
                val_str = str(val)

            if r_idx > 1 and isinstance(val, int | float) and not isinstance(val, bool):
                cells_xml.append(f'<c r="{cell_ref}"><v>{val}</v></c>')
            else:
                escaped = escape(val_str)
                cells_xml.append(
                    f'<c r="{cell_ref}" t="inlineStr"><is><t>{escaped}</t></is></c>'
                )
        sheet_rows_xml.append(f'<row r="{r_idx}">{"".join(cells_xml)}</row>')

    worksheet_xml = (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'
        f"<sheetData>{''.join(sheet_rows_xml)}</sheetData>"
        "</worksheet>"
    )

    safe_sheet_name = escape(sheet_name[:31] or "Sheet1")
    workbook_xml = (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" '
        'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">'
        f'<sheets><sheet name="{safe_sheet_name}" sheetId="1" r:id="rId1"/></sheets>'
        "</workbook>"
    )

    workbook_rels_xml = (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
        '<Relationship Id="rId1" '
        'Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" '
        'Target="worksheets/sheet1.xml"/>'
        "</Relationships>"
    )

    root_rels_xml = (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
        '<Relationship Id="rId1" '
        'Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" '
        'Target="xl/workbook.xml"/>'
        "</Relationships>"
    )

    content_types_xml = (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
        '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
        '<Default Extension="xml" ContentType="application/xml"/>'
        '<Override PartName="/xl/workbook.xml" '
        'ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>'
        '<Override PartName="/xl/worksheets/sheet1.xml" '
        'ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>'
        "</Types>"
    )

    with zipfile.ZipFile(buf, mode="w", compression=zipfile.ZIP_DEFLATED) as zf:
        zf.writestr("[Content_Types].xml", content_types_xml)
        zf.writestr("_rels/.rels", root_rels_xml)
        zf.writestr("xl/workbook.xml", workbook_xml)
        zf.writestr("xl/_rels/workbook.xml.rels", workbook_rels_xml)
        zf.writestr("xl/worksheets/sheet1.xml", worksheet_xml)

    return buf.getvalue()


def build_csv_bytes(headers: list[str], rows: list[list[Any]]) -> bytes:
    """Generate a UTF-8 with BOM CSV file so Excel opens it cleanly."""
    out = io.StringIO()
    writer = csv.writer(out)
    writer.writerow(headers)
    for r in rows:
        writer.writerow(["" if v is None else str(v) for v in r])
    return ("\ufeff" + out.getvalue()).encode("utf-8")


def _col_ref_to_index(cell_ref: str) -> int:
    letters = "".join(ch for ch in cell_ref if ch.isalpha()).upper()
    idx = 0
    for ch in letters:
        idx = idx * 26 + (ord(ch) - 64)
    return max(0, idx - 1)


def xlsx_bytes_to_csv_bytes(raw_bytes: bytes) -> bytes:
    """Convert an uploaded .xlsx Excel workbook into UTF-8 CSV bytes for the streaming parser."""
    with zipfile.ZipFile(io.BytesIO(raw_bytes), mode="r") as zf:
        shared_strings: list[str] = []
        if "xl/sharedStrings.xml" in zf.namelist():
            ss_root = ET.fromstring(zf.read("xl/sharedStrings.xml"))  # noqa: S314
            for si in ss_root.iter():
                if si.tag.endswith("}si") or si.tag == "si":
                    texts = [
                        t.text or ""
                        for t in si.iter()
                        if t.tag.endswith("}t") or t.tag == "t"
                    ]
                    shared_strings.append("".join(texts))

        sheet_files = sorted(
            name
            for name in zf.namelist()
            if name.startswith("xl/worksheets/sheet") and name.endswith(".xml")
        )
        if not sheet_files:
            raise ValueError("No worksheet found in uploaded Excel (.xlsx) file.")

        ws_root = ET.fromstring(zf.read(sheet_files[0]))  # noqa: S314
        parsed_rows: list[list[str]] = []

        for row_el in ws_root.iter():
            if not (row_el.tag.endswith("}row") or row_el.tag == "row"):
                continue
            row_cells: dict[int, str] = {}
            max_col = -1
            for c_el in row_el:
                if not (c_el.tag.endswith("}c") or c_el.tag == "c"):
                    continue
                ref = c_el.attrib.get("r", "")
                c_type = c_el.attrib.get("t", "")
                col_idx = _col_ref_to_index(ref) if ref else (max_col + 1)
                max_col = max(max_col, col_idx)

                val_str = ""
                if c_type == "inlineStr":
                    texts = [
                        t.text or ""
                        for t in c_el.iter()
                        if t.tag.endswith("}t") or t.tag == "t"
                    ]
                    val_str = "".join(texts)
                else:
                    v_el = next(
                        (
                            ch
                            for ch in c_el
                            if ch.tag.endswith("}v") or ch.tag == "v"
                        ),
                        None,
                    )
                    raw_v = (v_el.text or "") if v_el is not None else ""
                    if c_type == "s" and raw_v.isdigit():
                        s_idx = int(raw_v)
                        if 0 <= s_idx < len(shared_strings):
                            val_str = shared_strings[s_idx]
                    else:
                        val_str = raw_v
                row_cells[col_idx] = val_str

            if max_col >= 0:
                parsed_rows.append(
                    [row_cells.get(i, "") for i in range(max_col + 1)]
                )

    out = io.StringIO()
    writer = csv.writer(out)
    for r in parsed_rows:
        writer.writerow(r)
    return out.getvalue().encode("utf-8")
