from __future__ import annotations

import base64
import html
import json
import sys
from io import BytesIO
from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import inch
from reportlab.lib.utils import ImageReader
from reportlab.pdfgen import canvas
from reportlab.platypus import Paragraph, Table, TableStyle


PAGE_WIDTH, PAGE_HEIGHT = letter
LEFT = 0.95 * inch
RIGHT = 0.65 * inch
TOP = PAGE_HEIGHT - 0.95 * inch
BOTTOM = 0.62 * inch
CONTENT_WIDTH = PAGE_WIDTH - LEFT - RIGHT
APP_ROOT = Path(__file__).resolve().parents[1]

BLUE = colors.HexColor("#24476c")
INK = colors.HexColor("#0a2138")
MUTED = colors.HexColor("#5f7082")
GRID = colors.black
HEADER_GREY = colors.HexColor("#d9d9d9")
SUMMARY_GREEN = colors.HexColor("#dbe9c3")
PRIORITY_PEACH = colors.HexColor("#f5ded0")
PRIORITY_GREEN = colors.HexColor("#c8e3b7")
SOFT_GREEN = colors.HexColor("#eef6e6")
RED = colors.HexColor("#ff1f1f")
AMBER = colors.HexColor("#8d5d11")

DEFAULTS = {
    "auditReportTitle": "2025 Internal Audit Report",
    "auditClientName": "JB FARMS OBAN Plantation",
    "auditLocation": "Cross River State, Nigeria",
    "auditPreparedBy": "Agrinexus International",
    "auditPeriodStart": "2025-10-25",
    "auditPeriodEnd": "2025-11-06",
    "auditIssueDate": "2026-06-23",
    "auditConfidentiality": "Private & Confidential",
}

ORIGINAL_CONTENTS = [
    ("Mill Department", "8-14"),
    ("Plantation Department - Overall", "15-17"),
    ("Plantation Department - OP Division", "18-19"),
    ("Plantation Department - RO Division", "20-25"),
    ("Plantation Department - 2018 Division", "26-37"),
    ("Plantation Department - 2019 Division", "38-48"),
    ("Plantation Department - 2022 Division", "49-50"),
    ("Plantation Department - 2025 New Development", "51-57"),
    ("Accounts Department", "58-63"),
    ("Accounts Department - Main Store", "64-69"),
    ("Jobbing SOP", "70-71"),
    ("Fleet Department", "72-75"),
    ("Fleet Department / Civil Department - Road and Bridges", "76-78"),
    ("Procurement Department", "79-80"),
    ("Nursery Department", "81-85"),
    ("Security Department", "86-88"),
    ("HRA Department", "89-91"),
    ("HSE Department - Buildings Upkeep & Maintenance", "92-95"),
    ("HSE Department", "96-99"),
    ("HSE Department - CSR", "100-102"),
    ("IT Department", "103-105"),
    ("Audit Department", "106-107"),
]

MATRIX_POINTS = [
    ("Nursery", 1.85, 4.45, "red", 0.20),
    ("Fleet", 2.25, 4.15, "red", 0.24),
    ("Road, Bridges & Housing", 2.95, 3.95, "red", 0.34),
    ("HRA", 3.65, 3.60, "red", 0.28),
    ("IT", 4.25, 3.20, "red", 0.22),
    ("Security", 4.82, 2.88, "red", 0.22),
    ("Mill", 3.05, 2.05, "green", 0.26),
    ("OP Division", 3.85, 2.15, "green", 0.22),
    ("Accounts", 4.75, 2.08, "green", 0.25),
    ("Procurement", 5.35, 1.72, "green", 0.23),
]


def text(value):
    return str(value or "")


def clean_text(value):
    return html.escape(text(value)).replace("\n", "<br/>")


def date_parts(value):
    parts = text(value).split("T")[0].split("-")
    if len(parts) != 3:
        return None
    try:
        year, month, day = map(int, parts)
    except ValueError:
        return None
    return year, month, day


def ordinal(day):
    if 10 <= day % 100 <= 20:
        suffix = "th"
    else:
        suffix = {1: "st", 2: "nd", 3: "rd"}.get(day % 10, "th")
    return f"{day}{suffix}"


def date_label(value, ordinal_day=False):
    parsed = date_parts(value)
    if not parsed:
        return text(value) or "-"
    year, month, day = parsed
    months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
    day_label = ordinal(day) if ordinal_day else f"{day:02d}"
    return f"{day_label} {months[month - 1]} {year}"


def report_year(settings):
    parsed = date_parts(settings.get("auditPeriodStart"))
    if parsed:
        return str(parsed[0])
    for token in text(settings.get("auditReportTitle")).split():
        if token.isdigit() and len(token) == 4:
            return token
    return "2025"


def load_context(db_path: Path, project_id: str, payload):
    database = json.loads(db_path.read_text())
    project = next(item for item in database["projects"] if item["id"] == project_id)
    company = next(item for item in database["companies"] if item["id"] == project["companyId"])
    settings = dict(DEFAULTS)
    settings.update((project.get("settings") or {}).get("auditReport") or {})
    settings.update(payload.get("reportSettings") or {})
    return database, company, project, settings


def app_path(db_path: Path, value):
    clean = text(value).split("?", 1)[0]
    if clean.startswith("/"):
        clean = clean.lstrip("/")
    return APP_ROOT / clean


def logo_path(db_path: Path, project, payload):
    value = payload.get("brandingLogoUrl") or (project.get("settings") or {}).get("brandingLogoUrl") or "./public/agrinexus-logo.jpeg"
    if text(value).startswith("data:image/"):
        return value
    return app_path(db_path, value)


def cover_image_path(db_path: Path):
    candidate = APP_ROOT / "audit/evidence/oban-cover-source-1-27.jpg"
    return candidate if candidate.exists() else None


def image_reader(source):
    try:
        if text(source).startswith("data:image/"):
            raw = text(source).split(",", 1)[1]
            return ImageReader(BytesIO(base64.b64decode(raw)))
        source = Path(source)
        if source.exists():
            return ImageReader(str(source))
    except Exception:
        return None
    return None


def photo_source(entry, db_path):
    source = entry.get("photoDataUrl") or entry.get("photoUrl")
    if not source:
        return None
    if text(source).startswith("data:image/"):
        return source
    return app_path(db_path, source)


def map_link(geo):
    try:
        latitude = float(geo.get("latitude"))
        longitude = float(geo.get("longitude"))
    except (AttributeError, TypeError, ValueError):
        return ""
    return f"https://www.openstreetmap.org/?mlat={latitude:.6f}&mlon={longitude:.6f}#map=17/{latitude:.6f}/{longitude:.6f}"


def draw_gradient(c, x, y, width, height, start, end, steps=90):
    for index in range(steps):
        ratio = index / max(steps - 1, 1)
        color = colors.Color(
            start.red + (end.red - start.red) * ratio,
            start.green + (end.green - start.green) * ratio,
            start.blue + (end.blue - start.blue) * ratio,
        )
        c.setFillColor(color)
        c.rect(x, y + height * index / steps, width, height / steps + 0.5, stroke=0, fill=1)


def draw_image_fit(c, source, x, y, width, height):
    reader = image_reader(source)
    if not reader:
        return False
    try:
        c.drawImage(reader, x, y, width=width, height=height, preserveAspectRatio=True, anchor="c", mask="auto")
    except Exception:
        return False
    return True


def styles():
    return {
        "normal": ParagraphStyle("normal", fontName="Helvetica", fontSize=10.5, leading=14, textColor=colors.black),
        "small": ParagraphStyle("small", fontName="Helvetica", fontSize=8, leading=10, textColor=colors.black),
        "bold": ParagraphStyle("bold", fontName="Helvetica-Bold", fontSize=10.5, leading=14, textColor=colors.black),
        "label": ParagraphStyle("label", fontName="Helvetica", fontSize=10.5, leading=15, textColor=colors.black),
        "finding": ParagraphStyle("finding", fontName="Helvetica", fontSize=10.5, leading=14.8, textColor=colors.black),
    }


def paragraph(value, style):
    return Paragraph(clean_text(value), style)


def draw_table(c, table, x, top_y):
    _width, height = table.wrapOn(c, CONTENT_WIDTH, PAGE_HEIGHT)
    table.drawOn(c, x, top_y - height)
    return top_y - height


def draw_header_footer(c, settings, logo, page_number):
    c.setFillColor(colors.black)
    c.setFont("Helvetica-Oblique", 12)
    c.drawString(LEFT, PAGE_HEIGHT - 0.58 * inch, "OBAN PLANTATION")
    c.setFont("Helvetica-Oblique", 12)
    c.drawRightString(PAGE_WIDTH - RIGHT, PAGE_HEIGHT - 0.58 * inch, settings["auditConfidentiality"])
    draw_image_fit(c, logo, PAGE_WIDTH - RIGHT - 0.33 * inch, PAGE_HEIGHT - 0.42 * inch, 0.34 * inch, 0.34 * inch)
    c.setLineWidth(1.5)
    c.line(LEFT, PAGE_HEIGHT - 0.65 * inch, PAGE_WIDTH - RIGHT, PAGE_HEIGHT - 0.65 * inch)
    c.setFont("Helvetica", 9)
    c.drawCentredString(PAGE_WIDTH / 2, 0.36 * inch, str(page_number))


def priority_display(priority):
    value = text(priority).strip() or "Medium"
    if value.lower() == "critical":
        return "High"
    return value[:1].upper() + value[1:].lower()


def priority_fill(priority):
    normalized = text(priority).lower()
    if normalized in {"critical", "high"}:
        return PRIORITY_PEACH
    if normalized == "medium":
        return PRIORITY_GREEN
    return SOFT_GREEN


def department_rows(entries):
    groups = {}
    for entry in entries:
        key = entry.get("department") or "Unassigned"
        item = groups.setdefault(key, {"issues": [], "high": 0, "medium": 0, "low": 0, "open": 0})
        item["issues"].append(text(entry.get("finding") or entry.get("auditArea") or "Audit finding"))
        priority = text(entry.get("priority")).lower()
        if priority in {"critical", "high"}:
            item["high"] += 1
        elif priority == "medium":
            item["medium"] += 1
        else:
            item["low"] += 1
        if text(entry.get("status")).lower() != "closed":
            item["open"] += 1
    return sorted(groups.items(), key=lambda pair: (-pair[1]["high"], -len(pair[1]["issues"]), pair[0]))


def report_department_order(entry):
    department = text(entry.get("department")).lower()
    order = [
        ("mill", 1),
        ("plantation - overall", 2),
        ("plantation department - overall", 2),
        ("op division", 3),
        ("ro division", 4),
        ("2018", 5),
        ("2019", 6),
        ("2022", 7),
        ("2025 new", 8),
        ("accounts", 9),
        ("jobbing", 11),
        ("fleet", 12),
        ("road", 13),
        ("bridge", 13),
        ("procurement", 14),
        ("nursery", 15),
        ("security", 16),
        ("hra", 17),
        ("hse", 18),
        ("it", 21),
        ("audit", 22),
    ]
    for needle, rank in order:
        if needle in department:
            return rank
    return 99


def sort_entries_for_report(entries):
    return sorted(entries, key=lambda entry: (report_department_order(entry), text(entry.get("capturedAt")), text(entry.get("id"))))


def dominant_priority(counts):
    if counts["high"]:
        return "High"
    if counts["medium"]:
        return "Medium"
    return "Low"


def cover_page(c, settings, logo, db_path):
    draw_gradient(c, 0, 0, PAGE_WIDTH, PAGE_HEIGHT, colors.HexColor("#7d7d7d"), colors.HexColor("#4f4f4f"))
    draw_gradient(c, 0, 0, 2.35 * inch, PAGE_HEIGHT, colors.HexColor("#cfcfcf"), colors.HexColor("#7c7c7c"), 110)
    c.setStrokeColor(colors.HexColor("#e9e9e9"))
    c.setLineWidth(2)
    c.line(2.35 * inch, 0, 2.35 * inch, PAGE_HEIGHT)

    tile_x = 2.58 * inch
    tile_y = PAGE_HEIGHT - 1.72 * inch
    c.setFillColor(colors.HexColor("#c94d4a"))
    c.rect(tile_x, tile_y, 0.98 * inch, 1.3 * inch, stroke=0, fill=1)
    c.setFillColor(colors.white)
    c.setFont("Helvetica-Bold", 25)
    c.drawCentredString(tile_x + 0.49 * inch, tile_y + 0.73 * inch, report_year(settings))

    x_title = 3.05 * inch
    y_title = PAGE_HEIGHT - 1.45 * inch
    c.setFillColor(colors.white)
    c.setFont("Helvetica", 24)
    c.drawString(x_title, y_title, "Internal Audit Report")
    c.setFont("Helvetica", 21)
    c.drawString(x_title, y_title - 0.43 * inch, settings["auditClientName"])
    c.drawString(x_title, y_title - 0.82 * inch, settings["auditLocation"])
    c.setFont("Helvetica-Bold", 9)
    c.drawRightString(PAGE_WIDTH - 0.66 * inch, PAGE_HEIGHT - 0.5 * inch, settings["auditConfidentiality"])
    draw_image_fit(c, logo, PAGE_WIDTH - 0.55 * inch, PAGE_HEIGHT - 0.97 * inch, 0.35 * inch, 0.35 * inch)

    cover = cover_image_path(db_path)
    if cover:
        draw_image_fit(c, cover, 3.35 * inch, 2.55 * inch, 3.85 * inch, 4.55 * inch)

    box_x = 3.02 * inch
    box_y = 1.53 * inch
    box_w = 4.55 * inch
    box_h = 0.95 * inch
    c.setFillColor(colors.white)
    c.setStrokeColor(colors.black)
    c.setLineWidth(1)
    c.rect(box_x, box_y, box_w, box_h, stroke=1, fill=1)
    c.setFillColor(colors.black)
    c.setFont("Helvetica", 8.5)
    c.drawCentredString(box_x + box_w / 2, box_y + 0.64 * inch, f"Prepared by: {settings['auditPreparedBy']}")
    period = f"{date_label(settings['auditPeriodStart'], True)} to {date_label(settings['auditPeriodEnd'], True)}"
    c.drawCentredString(box_x + box_w / 2, box_y + 0.40 * inch, f"Audit Period: {period}")
    c.drawCentredString(box_x + box_w / 2, box_y + 0.17 * inch, f"Date of Issue: {date_label(settings['auditIssueDate'], True)}")

    for index, color in enumerate(["#c94d4a", "#8a8a8a", "#e2e2e2", "#c94d4a", "#8a8a8a"]):
        c.setFillColor(colors.HexColor(color))
        c.rect(PAGE_WIDTH - (1.15 - index * 0.13) * inch, 0.72 * inch, 0.11 * inch, 0.32 * inch, stroke=0, fill=1)


def contents_page(c, settings, logo, page_number, entries):
    draw_header_footer(c, settings, logo, page_number)
    c.setFillColor(colors.black)
    c.setFont("Helvetica-Bold", 18)
    c.drawString(LEFT, TOP - 0.28 * inch, "Table of Contents")

    toc = ORIGINAL_CONTENTS
    if entries and report_year(settings) != "2025":
        departments = []
        for entry in entries:
            department = entry.get("department") or "Unassigned"
            if department not in departments:
                departments.append(department)
        toc = [(department, str(index + 5)) for index, department in enumerate(departments, start=1)]

    y = TOP - 0.88 * inch
    c.setFont("Helvetica", 11)
    for index, (label, pages) in enumerate(toc, start=1):
        if y < 0.85 * inch:
            c.showPage()
            page_number += 1
            draw_header_footer(c, settings, logo, page_number)
            y = TOP - 0.2 * inch
        c.setFillColor(colors.black)
        c.drawRightString(LEFT + 0.24 * inch, y, str(index))
        c.drawString(LEFT + 0.52 * inch, y, label)
        c.drawRightString(PAGE_WIDTH - RIGHT - 0.15 * inch, y, pages)
        dot_start = LEFT + 0.52 * inch + c.stringWidth(label, "Helvetica", 11) + 8
        dot_end = PAGE_WIDTH - RIGHT - 0.54 * inch
        c.setStrokeColor(colors.HexColor("#bcbcbc"))
        c.setDash(1, 3)
        c.line(dot_start, y + 2, dot_end, y + 2)
        c.setDash()
        c.setStrokeColor(colors.black)
        y -= 0.29 * inch
    return page_number


def draw_summary_table(c, settings, logo, page_number, entries):
    draw_header_footer(c, settings, logo, page_number)
    s = styles()
    c.setFont("Helvetica-Bold", 18)
    c.drawString(LEFT, TOP - 0.25 * inch, "Audit Findings by Departments:")
    rows = [["Department", "Issues", "Priority"]]
    row_styles = [
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#d8e0ef")),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("ALIGN", (2, 0), (2, -1), "CENTER"),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("GRID", (0, 0), (-1, -1), 0.5, GRID),
        ("FONTSIZE", (0, 0), (-1, -1), 10.5),
        ("LEADING", (0, 0), (-1, -1), 14),
        ("LEFTPADDING", (0, 0), (-1, -1), 6),
        ("RIGHTPADDING", (0, 0), (-1, -1), 6),
        ("TOPPADDING", (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
    ]
    for row_index, (department, counts) in enumerate(department_rows(entries), start=1):
        issues = "<br/>".join(f"{idx}.&nbsp;&nbsp;{clean_text(issue)}" for idx, issue in enumerate(counts["issues"], start=1))
        priority = dominant_priority(counts)
        rows.append([paragraph(department, s["bold"]), Paragraph(issues, s["normal"]), priority])
        row_styles.append(("BACKGROUND", (2, row_index), (2, row_index), priority_fill(priority)))

    table = Table(rows, colWidths=[1.2 * inch, 4.7 * inch, 1.15 * inch], repeatRows=1)
    table.setStyle(TableStyle(row_styles))
    draw_table(c, table, LEFT, TOP - 0.6 * inch)


def draw_matrix_page(c, settings, logo, page_number, entries):
    draw_header_footer(c, settings, logo, page_number)
    c.setFillColor(BLUE)
    c.rect(LEFT, TOP - 0.55 * inch, CONTENT_WIDTH, 0.33 * inch, stroke=0, fill=1)
    c.setFillColor(colors.white)
    c.setFont("Helvetica-Bold", 12)
    c.drawCentredString(PAGE_WIDTH / 2, TOP - 0.43 * inch, "Overall Audit Findings - By Department (OBAN Plantation)")

    chart_x = LEFT + 0.45 * inch
    chart_y = 1.58 * inch
    chart_w = CONTENT_WIDTH - 0.9 * inch
    chart_h = 5.65 * inch
    c.setStrokeColor(colors.HexColor("#bdbdbd"))
    c.setLineWidth(0.8)
    c.rect(chart_x, chart_y, chart_w, chart_h, stroke=1, fill=0)
    for idx in range(1, 5):
        x = chart_x + chart_w * idx / 5
        y = chart_y + chart_h * idx / 5
        c.setDash(2, 3)
        c.line(x, chart_y, x, chart_y + chart_h)
        c.line(chart_x, y, chart_x + chart_w, y)
    c.setDash()

    c.setFillColor(colors.black)
    c.setFont("Helvetica-Bold", 10)
    c.drawCentredString(chart_x + chart_w / 2, chart_y - 0.35 * inch, "Impact / Financial Exposure")
    c.saveState()
    c.translate(chart_x - 0.35 * inch, chart_y + chart_h / 2)
    c.rotate(90)
    c.drawCentredString(0, 0, "Likelihood / Control Weakness")
    c.restoreState()

    for label, mx, my, family, radius in MATRIX_POINTS:
        cx = chart_x + chart_w * (mx / 6.0)
        cy = chart_y + chart_h * (my / 5.0)
        base = colors.HexColor("#d8524f") if family == "red" else colors.HexColor("#5e9244")
        light = colors.HexColor("#efb4a0") if family == "red" else colors.HexColor("#c5dfa8")
        c.setFillColor(base)
        c.circle(cx, cy, radius * inch, stroke=0, fill=1)
        c.setFillColor(light)
        c.circle(cx - radius * inch * 0.28, cy + radius * inch * 0.28, radius * inch * 0.42, stroke=0, fill=1)
        c.setFillColor(colors.black)
        c.setFont("Helvetica", 7.2)
        c.drawCentredString(cx, cy - radius * inch - 10, label)

    c.setFillColor(colors.black)
    c.setFont("Helvetica-Bold", 9)
    c.drawString(LEFT, 0.93 * inch, "Priority interpretation")
    c.setFont("Helvetica", 8)
    c.drawString(LEFT, 0.74 * inch, "Red bubbles indicate high-priority findings. Green bubbles indicate medium-priority findings requiring management follow-up.")


def draw_department_issue(c, settings, logo, page_number, entry, index, db_path):
    draw_header_footer(c, settings, logo, page_number)
    s = styles()
    priority = priority_display(entry.get("priority"))
    top_y = TOP - 0.15 * inch

    header = Table(
        [[f"{index}.", f"Audit Issue: {entry.get('department') or 'Unassigned'}", f"Priority:\n{priority}"]],
        colWidths=[0.32 * inch, 5.08 * inch, 1.65 * inch],
        rowHeights=[0.43 * inch],
    )
    header.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (1, 0), HEADER_GREY),
        ("BACKGROUND", (2, 0), (2, 0), priority_fill(priority)),
        ("GRID", (0, 0), (-1, -1), 0.6, GRID),
        ("FONTNAME", (0, 0), (-1, -1), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, -1), 10.5),
        ("ALIGN", (2, 0), (2, 0), "CENTER"),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("LEFTPADDING", (0, 0), (-1, -1), 5),
        ("RIGHTPADDING", (0, 0), (-1, -1), 5),
    ]))
    y = draw_table(c, header, LEFT + 0.08 * inch, top_y)

    issue_body = Table(
        [
            [Paragraph("Observations /<br/>Findings", s["label"]), Paragraph(f"1.&nbsp;&nbsp;{clean_text(entry.get('finding') or 'Audit finding')}", s["finding"])],
            [paragraph("Impact", s["label"]), paragraph(entry.get("impact") or "-", s["finding"])],
            [paragraph("Recommendation", s["label"]), paragraph(entry.get("recommendation") or "-", s["finding"])],
        ],
        colWidths=[1.62 * inch, 5.43 * inch],
    )
    issue_body.setStyle(TableStyle([
        ("GRID", (0, 0), (-1, -1), 0.5, GRID),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 6),
        ("RIGHTPADDING", (0, 0), (-1, -1), 6),
        ("TOPPADDING", (0, 0), (-1, -1), 8),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
    ]))
    y = draw_table(c, issue_body, LEFT + 0.08 * inch, y)

    if y < 2.45 * inch:
        c.showPage()
        page_number += 1
        draw_header_footer(c, settings, logo, page_number)
        y = TOP - 0.15 * inch

    geo = entry.get("geo") or {}
    link = map_link(geo)
    map_value = "Map location pending"
    if link:
        accuracy = text(geo.get("accuracy") or "-")
        map_value = f'<link href="{html.escape(link)}"><font color="#005eb8">Open map location</font></link><br/><font size="8">Captured with approx {html.escape(accuracy)}m accuracy</font>'
    response = Table(
        [
            ["OBAN Management", "Department in-charge:", text(entry.get("owner") or "-"), "Timeline for completion:", date_label(entry.get("dueDate"))],
            ["Status", text(entry.get("status") or "Open"), "Reference", text(entry.get("reference") or entry.get("source") or "Field entry"), ""],
            ["Map proof", Paragraph(map_value, s["small"]), "Photo evidence", text(entry.get("photoName") or "Captured field image"), ""],
        ],
        colWidths=[1.23 * inch, 1.23 * inch, 1.55 * inch, 1.55 * inch, 1.49 * inch],
    )
    response.setStyle(TableStyle([
        ("GRID", (0, 0), (-1, -1), 0.5, GRID),
        ("BACKGROUND", (0, 0), (0, -1), SUMMARY_GREEN),
        ("FONTNAME", (0, 0), (-1, -1), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, -1), 8),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("SPAN", (1, 2), (2, 2)),
        ("SPAN", (3, 2), (4, 2)),
        ("LEFTPADDING", (0, 0), (-1, -1), 5),
        ("RIGHTPADDING", (0, 0), (-1, -1), 5),
        ("TOPPADDING", (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
    ]))
    y = draw_table(c, response, LEFT + 0.08 * inch, y - 0.12 * inch)

    photo = photo_source(entry, db_path)
    if photo:
        frame_w = 3.0 * inch
        frame_h = min(2.6 * inch, max(1.8 * inch, y - BOTTOM - 0.24 * inch))
        frame_x = LEFT + (CONTENT_WIDTH - frame_w) / 2
        frame_y = max(BOTTOM + 0.22 * inch, y - frame_h - 0.28 * inch)
        c.setStrokeColor(GRID)
        c.setLineWidth(0.5)
        c.rect(frame_x, frame_y, frame_w, frame_h, stroke=1, fill=0)
        draw_image_fit(c, photo, frame_x + 0.06 * inch, frame_y + 0.06 * inch, frame_w - 0.12 * inch, frame_h - 0.12 * inch)

    return page_number


def draw_appendix_page(c, settings, logo, page_number, entries):
    draw_header_footer(c, settings, logo, page_number)
    c.setFont("Helvetica-Bold", 16)
    c.drawString(LEFT, TOP - 0.25 * inch, "Field Evidence Register")
    s = styles()
    rows = [["Department", "Location", "Status", "Map proof"]]
    for entry in entries:
        geo = entry.get("geo") or {}
        link = map_link(geo)
        map_cell = Paragraph(f'<link href="{html.escape(link)}"><font color="#005eb8">Open map location</font></link>' if link else "Pending", s["small"])
        rows.append([text(entry.get("department") or "-"), text(entry.get("location") or "-"), text(entry.get("status") or "Open"), map_cell])
    table = Table(rows, colWidths=[1.6 * inch, 2.2 * inch, 1.0 * inch, 2.25 * inch], repeatRows=1)
    table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#d8e0ef")),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("GRID", (0, 0), (-1, -1), 0.5, GRID),
        ("FONTSIZE", (0, 0), (-1, -1), 8.5),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("LEFTPADDING", (0, 0), (-1, -1), 5),
        ("RIGHTPADDING", (0, 0), (-1, -1), 5),
        ("TOPPADDING", (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
    ]))
    draw_table(c, table, LEFT, TOP - 0.65 * inch)


def build_pdf(db_path: Path, project_id: str, payload) -> bytes:
    _database, _company, project, settings = load_context(db_path, project_id, payload)
    entries = sort_entries_for_report(payload.get("entries") or [])
    logo = logo_path(db_path, project, payload)
    buffer = BytesIO()
    c = canvas.Canvas(buffer, pagesize=letter)
    c.setTitle(settings["auditReportTitle"])

    cover_page(c, settings, logo, db_path)
    c.showPage()

    page_number = 2
    page_number = contents_page(c, settings, logo, page_number, entries)
    c.showPage()
    page_number += 1

    draw_matrix_page(c, settings, logo, page_number, entries)
    c.showPage()
    page_number += 1

    draw_summary_table(c, settings, logo, page_number, entries)
    c.showPage()
    page_number += 1

    for index, entry in enumerate(entries, start=1):
        page_number = draw_department_issue(c, settings, logo, page_number, entry, index, db_path)
        c.showPage()
        page_number += 1

    draw_appendix_page(c, settings, logo, page_number, entries)
    c.save()
    return buffer.getvalue()


def main():
    if len(sys.argv) != 3:
        raise SystemExit("Usage: render_audit_pdf.py <db_path> <project_id>")
    payload = json.loads(sys.stdin.read() or "{}")
    sys.stdout.buffer.write(build_pdf(Path(sys.argv[1]), sys.argv[2], payload))


if __name__ == "__main__":
    main()
