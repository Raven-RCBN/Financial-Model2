from __future__ import annotations

import json
import sys
from io import BytesIO
from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.pagesizes import A2, A3, landscape
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.platypus import PageBreak, Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle


def fmt(value):
    if value in (None, ""):
        return "-"
    if isinstance(value, (int, float)):
        if abs(value) < 0.005:
            return "-"
        if value < 0:
            return f"({abs(value):,.2f})"
        return f"{value:,.2f}"
    return str(value)


def load_table(db_path: Path, project_id: str, sheet_name: str):
    database = json.loads(db_path.read_text())
    project = next(item for item in database["projects"] if item["id"] == project_id)
    company = next(item for item in database["companies"] if item["id"] == project["companyId"])
    table = next(
        item
        for item in database.get("reportTables", [])
        if item["projectId"] == project_id and item["sheetName"] == sheet_name
    )
    return company, project, table


def project_setting(project, key, default=""):
    return (project.get("settings") or {}).get(key, default)


def format_hectares(value):
    try:
        return f"{float(value):,.0f}"
    except (TypeError, ValueError):
        return ""


def report_header(company, project, table):
    settings = project.get("settings") or {}
    hectares = format_hectares(project.get("hectares"))
    template = settings.get("reportHeaderTemplate") or "{company} - {project} - {hectares} Ha"
    title = (
        template
        .replace("{company}", company.get("name", ""))
        .replace("{project}", project.get("name", ""))
        .replace("{hectares}", hectares)
        .strip()
    )
    if title.endswith("- Ha"):
        title = title[:-4].strip()
    years = settings.get("projectionYears")
    subtitle_parts = [
        f"{years}-Year" if years else "",
        settings.get("crop") or "Plantation",
        settings.get("reportBasis") or "Financial Projections",
    ]
    standard = f"{settings.get('reportingStandard')} reporting" if settings.get("reportingStandard") else "Management reporting"
    currency = settings.get("reportingCurrency") or project.get("currency") or table.get("currency") or "USD"
    periods = len(table.get("periods") or [])
    meta = f"{table['sheetName']} - Figures in {currency} - {standard}"
    if periods:
        meta = f"{meta} - {periods} periods"
    return title, " ".join(part for part in subtitle_parts if part), meta


def title_story(styles, company, project, table, chunk_label=""):
    suffix = f" - {chunk_label}" if chunk_label else ""
    title, subtitle, meta = report_header(company, project, table)
    return [
        Paragraph(f"<b>{title}</b>", styles["Title"]),
        Paragraph(subtitle, styles["Normal"]),
        Paragraph(f"<b>{meta}</b>{suffix}", styles["Heading2"]),
        Spacer(1, 8),
    ]


def report_start_year(project):
    try:
        return int((project.get("settings") or {}).get("startYear", 2026))
    except (TypeError, ValueError):
        return 2026


def schedule_table(table, project):
    periods = table["periods"]
    start_year = report_start_year(project)
    header_1 = ["Line item", "%", "Total"] + [str(period["period"]) for period in periods]
    header_2 = ["", "", ""] + [str(start_year + index) for index, _period in enumerate(periods)]
    data = [header_1, header_2]
    row_styles = []
    for row_index, row in enumerate(table["rows"], start=2):
        values = [fmt(value) for value in row.get("values", [])]
        data.append([row["label"], fmt(row.get("percent")), fmt(row.get("total"))] + values)
        if row.get("style") == "section":
            row_styles.append(("BACKGROUND", (0, row_index), (-1, row_index), colors.HexColor("#dcecc6")))
            row_styles.append(("FONTNAME", (0, row_index), (-1, row_index), "Helvetica-Bold"))
        elif row.get("style") == "blue-total":
            row_styles.append(("BACKGROUND", (0, row_index), (-1, row_index), colors.HexColor("#002060")))
            row_styles.append(("TEXTCOLOR", (0, row_index), (-1, row_index), colors.white))
            row_styles.append(("FONTNAME", (0, row_index), (-1, row_index), "Helvetica-Bold"))
        elif row.get("style") in {"total", "subheader"}:
            row_styles.append(("FONTNAME", (0, row_index), (-1, row_index), "Helvetica-Bold"))

    report = Table(data, repeatRows=2, colWidths=[170, 36, 72] + [48] * len(periods))
    report.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 1), colors.HexColor("#24476c")),
                ("TEXTCOLOR", (0, 0), (-1, 1), colors.white),
                ("FONTNAME", (0, 0), (-1, 1), "Helvetica-Bold"),
                ("FONTSIZE", (0, 0), (-1, -1), 6.2),
                ("LEADING", (0, 0), (-1, -1), 7.2),
                ("GRID", (0, 0), (-1, -1), 0.25, colors.HexColor("#c8d2dc")),
                ("ALIGN", (1, 0), (-1, -1), "RIGHT"),
                ("ALIGN", (0, 0), (0, -1), "LEFT"),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("ROWBACKGROUNDS", (0, 2), (-1, -1), [colors.white, colors.HexColor("#fbfdff")]),
                *row_styles,
            ]
        )
    )
    return report


def grid_chunks(table, max_dynamic_cols=13):
    display = display_grid(table)
    columns = display["columns"]
    rows = display["rows"]
    if len(columns) <= max_dynamic_cols + 1:
        yield columns, rows, ""
        return
    fixed = columns[:1]
    rest = columns[1:]
    for start in range(0, len(rest), max_dynamic_cols):
        chunk = fixed + rest[start : start + max_dynamic_cols]
        yield chunk, rows, ""


def source_column_from_address(address):
    letters = "".join(ch for ch in str(address or "") if ch.isalpha())
    source_col = 0
    for ch in letters:
        source_col = source_col * 26 + (ord(ch.upper()) - 64)
    return source_col


def has_cell_value(cell):
    return str(cell.get("value", "")).strip() != ""


def column_fill_counts(table):
    counts = {}
    for row in table.get("rows", []):
        for cell in row.get("cells", []):
            if not has_cell_value(cell):
                continue
            source_col = source_column_from_address(cell.get("address"))
            counts[source_col] = counts.get(source_col, 0) + 1
    return counts


def display_start_column(table):
    columns = table.get("columns", [])
    if not columns:
        return 0
    first_col = columns[0].get("sourceColumn", 0)
    counts = column_fill_counts(table)
    first_fill = counts.get(first_col, 0)
    dense_threshold = max(5, int(len(table.get("rows", [])) * 0.2))
    first_dense = next(
        (
            column
            for column in columns
            if column.get("sourceColumn", 0) > first_col
            and counts.get(column.get("sourceColumn", 0), 0) >= dense_threshold
        ),
        None,
    )
    if first_col == 1 and first_fill <= 7 and first_dense:
        return first_dense.get("sourceColumn", first_col)
    return first_col


def display_grid(table):
    columns = table.get("columns", [])
    rows = table.get("rows", [])
    start_col = display_start_column(table)
    first_col = columns[0].get("sourceColumn", 0) if columns else 0
    if start_col <= first_col:
        return {"columns": columns, "rows": rows}

    output_rows = []
    for row in rows:
        if int(row.get("sourceRow") or 0) <= 4:
            continue
        cells = [
            cell
            for cell in row.get("cells", [])
            if source_column_from_address(cell.get("address")) >= start_col
        ]
        if any(has_cell_value(cell) for cell in cells):
            next_row = dict(row)
            next_row["cells"] = cells
            output_rows.append(next_row)
    filled_columns = {
        source_column_from_address(cell.get("address"))
        for row in output_rows
        for cell in row.get("cells", [])
        if has_cell_value(cell)
    }
    output_columns = [
        column
        for column in columns
        if column.get("sourceColumn", 0) >= start_col
        and column.get("sourceColumn", 0) in filled_columns
    ]
    keep_columns = {column.get("sourceColumn", 0) for column in output_columns}
    output_rows = [
        {
            **row,
            "cells": [
                cell
                for cell in row.get("cells", [])
                if source_column_from_address(cell.get("address")) in keep_columns
            ],
        }
        for row in output_rows
    ]
    return {
        "columns": output_columns,
        "rows": output_rows,
    }


def grid_table(columns, rows):
    col_indexes = [column["sourceColumn"] for column in columns]
    col_index_set = set(col_indexes)
    first_col = col_indexes[0] if col_indexes else None
    data = []
    row_styles = []
    for output_row_index, row in enumerate(rows):
        by_source = {}
        for cell in row.get("cells", []):
            col_letters = "".join(ch for ch in cell["address"] if ch.isalpha())
            source_col = 0
            for ch in col_letters:
                source_col = source_col * 26 + (ord(ch.upper()) - 64)
            if source_col in col_index_set:
                by_source[source_col] = cell
        cells = [by_source.get(col, {"value": ""}) for col in col_indexes]
        data.append([fmt(cell.get("value")) for cell in cells])
        style = row.get("style", "")
        if style == "dark":
            row_styles.append(("BACKGROUND", (0, output_row_index), (-1, output_row_index), colors.HexColor("#24476c")))
            row_styles.append(("TEXTCOLOR", (0, output_row_index), (-1, output_row_index), colors.white))
            row_styles.append(("FONTNAME", (0, output_row_index), (-1, output_row_index), "Helvetica-Bold"))
        elif style == "section":
            row_styles.append(("BACKGROUND", (0, output_row_index), (-1, output_row_index), colors.HexColor("#dcecc6")))
            row_styles.append(("FONTNAME", (0, output_row_index), (-1, output_row_index), "Helvetica-Bold"))
        elif style in {"yellow", "subheader"}:
            row_styles.append(("FONTNAME", (0, output_row_index), (-1, output_row_index), "Helvetica-Bold"))
            if style == "yellow":
                row_styles.append(("BACKGROUND", (0, output_row_index), (-1, output_row_index), colors.HexColor("#fffbe8")))

    widths = [150 if column["sourceColumn"] == first_col else 68 for column in columns]
    report = Table(data, repeatRows=0, colWidths=widths)
    report.setStyle(
        TableStyle(
            [
                ("FONTSIZE", (0, 0), (-1, -1), 6.4),
                ("LEADING", (0, 0), (-1, -1), 7.4),
                ("GRID", (0, 0), (-1, -1), 0.25, colors.HexColor("#c8d2dc")),
                ("ALIGN", (1, 0), (-1, -1), "RIGHT"),
                ("ALIGN", (0, 0), (0, -1), "LEFT"),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("ROWBACKGROUNDS", (0, 0), (-1, -1), [colors.white, colors.HexColor("#fbfdff")]),
                *row_styles,
            ]
        )
    )
    return report


def build_pdf(db_path: Path, project_id: str, sheet_name: str) -> bytes:
    company, project, table = load_table(db_path, project_id, sheet_name)
    buffer = BytesIO()
    page_size = landscape(A2 if table.get("kind") == "projection-schedule" else A3)
    doc = SimpleDocTemplate(
        buffer,
        pagesize=page_size,
        leftMargin=24,
        rightMargin=24,
        topMargin=22,
        bottomMargin=22,
        title=f"{project['name']} - {sheet_name}",
    )
    styles = getSampleStyleSheet()
    story = []
    if table.get("kind") == "projection-schedule":
        story.extend(title_story(styles, company, project, table))
        story.append(schedule_table(table, project))
    else:
        first = True
        for columns, rows, label in grid_chunks(table):
            if not first:
                story.append(PageBreak())
            story.extend(title_story(styles, company, project, table, label))
            story.append(grid_table(columns, rows))
            first = False
    doc.build(story)
    return buffer.getvalue()


def main():
    if len(sys.argv) != 4:
        raise SystemExit("Usage: render_report_pdf.py <db_path> <project_id> <sheet_name>")
    sys.stdout.buffer.write(build_pdf(Path(sys.argv[1]), sys.argv[2], sys.argv[3]))


if __name__ == "__main__":
    main()
