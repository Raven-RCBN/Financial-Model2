from __future__ import annotations

import base64
import html
import json
import sys
from io import BytesIO
from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import inch
from reportlab.platypus import Image, PageBreak, Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle


PAGE_WIDTH, PAGE_HEIGHT = letter
BLUE = colors.HexColor("#24476c")
INK = colors.HexColor("#082038")
MUTED = colors.HexColor("#63788d")
LINE = colors.HexColor("#c8d2dc")
SOFT_BLUE = colors.HexColor("#eef5fb")
SOFT_GREEN = colors.HexColor("#dcecc6")
RED = colors.HexColor("#c54f5b")
AMBER = colors.HexColor("#9a6616")

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


def text(value):
    return str(value or "")


def date_label(value):
    if not value:
        return "-"
    parts = text(value).split("T")[0].split("-")
    if len(parts) != 3:
        return text(value)
    year, month, day = parts
    months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
    try:
        return f"{int(day):02d} {months[int(month) - 1]} {year}"
    except (ValueError, IndexError):
        return text(value)


def load_context(db_path: Path, project_id: str, payload):
    database = json.loads(db_path.read_text())
    project = next(item for item in database["projects"] if item["id"] == project_id)
    company = next(item for item in database["companies"] if item["id"] == project["companyId"])
    settings = dict(DEFAULTS)
    settings.update((project.get("settings") or {}).get("auditReport") or {})
    settings.update(payload.get("reportSettings") or {})
    return database, company, project, settings


def logo_path(db_path: Path, project, payload):
    value = payload.get("brandingLogoUrl") or (project.get("settings") or {}).get("brandingLogoUrl") or "./public/agrinexus-logo.jpeg"
    if text(value).startswith("data:image/"):
      return value
    clean = text(value).split("?", 1)[0]
    if clean.startswith("/"):
        clean = clean.lstrip("/")
    return db_path.parent.parent / clean


def image_flowable(source, width=0.72 * inch, height=0.72 * inch):
    try:
        if text(source).startswith("data:image/"):
            raw = text(source).split(",", 1)[1]
            handle = BytesIO(base64.b64decode(raw))
            return Image(handle, width=width, height=height)
        source = Path(source)
        if source.exists():
            return Image(str(source), width=width, height=height)
    except Exception:
        return None
    return None


def app_path(db_path: Path, value):
    clean = text(value).split("?", 1)[0]
    if clean.startswith("/"):
        clean = clean.lstrip("/")
    return db_path.parent.parent / clean


def photo_flowable(entry, db_path):
    source = entry.get("photoDataUrl") or entry.get("photoUrl")
    if not source:
        return None
    if not text(source).startswith("data:image/"):
        source = app_path(db_path, source)
    return image_flowable(source, width=1.45 * inch, height=1.05 * inch)


def priority_color(priority):
    value = text(priority).lower()
    if value in {"critical", "high"}:
        return RED
    if value == "medium":
        return AMBER
    return colors.HexColor("#27835d")


def build_styles():
    styles = getSampleStyleSheet()
    styles.add(ParagraphStyle(name="CoverTitle", parent=styles["Title"], fontName="Helvetica-Bold", fontSize=22, leading=26, textColor=INK, spaceAfter=12))
    styles.add(ParagraphStyle(name="CoverMeta", parent=styles["Normal"], fontName="Helvetica-Bold", fontSize=11, leading=15, textColor=MUTED))
    styles.add(ParagraphStyle(name="SectionTitle", parent=styles["Heading2"], fontName="Helvetica-Bold", fontSize=13, leading=16, textColor=INK, spaceBefore=8, spaceAfter=8))
    styles.add(ParagraphStyle(name="IssueTitle", parent=styles["Heading2"], fontName="Helvetica-Bold", fontSize=12, leading=15, textColor=INK, spaceAfter=5))
    styles.add(ParagraphStyle(name="Label", parent=styles["Normal"], fontName="Helvetica-Bold", fontSize=8.5, leading=10, textColor=INK))
    styles.add(ParagraphStyle(name="Body", parent=styles["Normal"], fontSize=8.7, leading=11, textColor=INK))
    styles.add(ParagraphStyle(name="Small", parent=styles["Normal"], fontSize=7.5, leading=9, textColor=MUTED))
    styles.add(ParagraphStyle(name="Footer", parent=styles["Normal"], fontSize=7, leading=8, textColor=MUTED, alignment=TA_CENTER))
    return styles


def para(value, style):
    return Paragraph(text(value).replace("\n", "<br/>"), style)


def map_link(geo):
    try:
        latitude = float(geo.get("latitude"))
        longitude = float(geo.get("longitude"))
    except (AttributeError, TypeError, ValueError):
        return ""
    return f"https://www.openstreetmap.org/?mlat={latitude:.6f}&mlon={longitude:.6f}#map=17/{latitude:.6f}/{longitude:.6f}"


def department_rows(entries):
    groups = {}
    for entry in entries:
        key = entry.get("department") or "Unassigned"
        item = groups.setdefault(key, {"total": 0, "high": 0, "medium": 0, "low": 0, "open": 0})
        item["total"] += 1
        priority = text(entry.get("priority")).lower()
        if priority in {"critical", "high"}:
            item["high"] += 1
        elif priority == "medium":
            item["medium"] += 1
        else:
            item["low"] += 1
        if text(entry.get("status")).lower() != "closed":
            item["open"] += 1
    return sorted(groups.items(), key=lambda pair: (-pair[1]["high"], -pair[1]["total"], pair[0]))


def cover_page(styles, settings, logo):
    story = [Spacer(1, 0.45 * inch)]
    img = image_flowable(logo, width=1.05 * inch, height=1.05 * inch)
    if img:
        story.append(img)
        story.append(Spacer(1, 0.26 * inch))
    story.extend([
        para("OBAN PLANTATION", styles["CoverMeta"]),
        para(settings["auditConfidentiality"], styles["CoverMeta"]),
        Spacer(1, 0.24 * inch),
        para(settings["auditReportTitle"], styles["CoverTitle"]),
        para(settings["auditClientName"], styles["CoverMeta"]),
        para(settings["auditLocation"], styles["CoverMeta"]),
        Spacer(1, 0.35 * inch),
    ])
    meta = [
        ["Prepared by", settings["auditPreparedBy"]],
        ["Audit Period", f"{date_label(settings['auditPeriodStart'])} to {date_label(settings['auditPeriodEnd'])}"],
        ["Date of Issue", date_label(settings["auditIssueDate"])],
    ]
    table = Table(meta, colWidths=[1.55 * inch, 4.4 * inch])
    table.setStyle(TableStyle([
        ("BOX", (0, 0), (-1, -1), 0.6, LINE),
        ("INNERGRID", (0, 0), (-1, -1), 0.35, LINE),
        ("BACKGROUND", (0, 0), (0, -1), SOFT_BLUE),
        ("FONTNAME", (0, 0), (0, -1), "Helvetica-Bold"),
        ("TEXTCOLOR", (0, 0), (-1, -1), INK),
        ("FONTSIZE", (0, 0), (-1, -1), 9),
        ("LEADING", (0, 0), (-1, -1), 11),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("PADDING", (0, 0), (-1, -1), 8),
    ]))
    story.append(table)
    return story


def contents_page(styles, entries):
    rows = [["No.", "Department", "Priority", "Page"]]
    seen = []
    for entry in entries:
        department = entry.get("department") or "Unassigned"
        if department not in seen:
            seen.append(department)
    for index, department in enumerate(seen, start=1):
        priorities = [text(item.get("priority") or "Medium") for item in entries if (item.get("department") or "Unassigned") == department]
        priority = "High" if any(p.lower() in {"critical", "high"} for p in priorities) else priorities[0]
        rows.append([str(index), department, priority, str(index + 3)])
    table = Table(rows, colWidths=[0.42 * inch, 3.85 * inch, 1.05 * inch, 0.55 * inch])
    table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), BLUE),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTNAME", (0, 1), (-1, -1), "Helvetica"),
        ("FONTSIZE", (0, 0), (-1, -1), 8.3),
        ("GRID", (0, 0), (-1, -1), 0.35, LINE),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("PADDING", (0, 0), (-1, -1), 6),
    ]))
    return [para("Table of Contents", styles["SectionTitle"]), table]


def summary_page(styles, entries):
    rows = [["Department", "Issues", "High", "Medium", "Low", "Open"]]
    for department, counts in department_rows(entries):
        rows.append([department, counts["total"], counts["high"], counts["medium"], counts["low"], counts["open"]])
    table = Table(rows, colWidths=[3.05 * inch, 0.62 * inch, 0.62 * inch, 0.72 * inch, 0.55 * inch, 0.55 * inch])
    table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), BLUE),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTNAME", (0, 1), (-1, -1), "Helvetica"),
        ("BACKGROUND", (0, 1), (-1, -1), colors.white),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#fbfdff")]),
        ("FONTSIZE", (0, 0), (-1, -1), 8),
        ("GRID", (0, 0), (-1, -1), 0.35, LINE),
        ("ALIGN", (1, 1), (-1, -1), "CENTER"),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("PADDING", (0, 0), (-1, -1), 6),
    ]))
    return [para("Audit Findings by Departments", styles["SectionTitle"]), table]


def issue_page(styles, entry, index, db_path):
    priority = text(entry.get("priority") or "Medium")
    heading = Table(
        [[para(f"{index}. Audit Issue: {entry.get('department') or 'Unassigned'}", styles["IssueTitle"]), para(f"Priority: {priority}", styles["Label"])]],
        colWidths=[4.9 * inch, 1.35 * inch],
    )
    heading.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), SOFT_BLUE),
        ("BOX", (0, 0), (-1, -1), 0.5, LINE),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("TEXTCOLOR", (1, 0), (1, 0), priority_color(priority)),
        ("PADDING", (0, 0), (-1, -1), 8),
    ]))
    response = Table(
        [
            ["OBAN Management", "Department in-charge:", text(entry.get("owner") or "-"), "Timeline for completion:", date_label(entry.get("dueDate"))],
            ["Status", text(entry.get("status") or "Open"), "Location", text(entry.get("location") or "-"), ""],
        ],
        colWidths=[1.1 * inch, 1.1 * inch, 1.35 * inch, 1.35 * inch, 1.2 * inch],
    )
    response.setStyle(TableStyle([
        ("BOX", (0, 0), (-1, -1), 0.45, LINE),
        ("INNERGRID", (0, 0), (-1, -1), 0.25, LINE),
        ("BACKGROUND", (0, 0), (0, -1), SOFT_GREEN),
        ("FONTNAME", (0, 0), (-1, -1), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, -1), 7.5),
        ("PADDING", (0, 0), (-1, -1), 5),
    ]))
    geo = entry.get("geo") or {}
    link = map_link(geo)
    map_proof = para(
        f'<link href="{html.escape(link)}">Open map location</link><br/><font color="#63788d">GPS accuracy approx {text(geo.get("accuracy") or "-")}m</font>'
        if link
        else "Map location pending",
        styles["Body"],
    )
    evidence = [
        ["Photo evidence", text(entry.get("photoName") or ("Captured photo" if entry.get("photoDataUrl") or entry.get("photoUrl") else "Evidence pending"))],
        ["Map proof", map_proof],
        ["Reference", text(entry.get("reference") or entry.get("source") or "Field entry")],
    ]
    evidence_table = Table(evidence, colWidths=[1.25 * inch, 4.85 * inch])
    evidence_table.setStyle(TableStyle([
        ("BOX", (0, 0), (-1, -1), 0.45, LINE),
        ("INNERGRID", (0, 0), (-1, -1), 0.25, LINE),
        ("BACKGROUND", (0, 0), (0, -1), SOFT_BLUE),
        ("FONTNAME", (0, 0), (0, -1), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, -1), 7.5),
        ("PADDING", (0, 0), (-1, -1), 5),
    ]))

    story = [
        heading,
        Spacer(1, 8),
        para("Observations / Findings", styles["Label"]),
        para(entry.get("finding"), styles["Body"]),
        Spacer(1, 7),
        para("Impact", styles["Label"]),
        para(entry.get("impact"), styles["Body"]),
        Spacer(1, 7),
        para("Recommendation", styles["Label"]),
        para(entry.get("recommendation"), styles["Body"]),
        Spacer(1, 10),
        response,
        Spacer(1, 10),
        evidence_table,
    ]
    photo = photo_flowable(entry, db_path)
    if photo:
        story.extend([Spacer(1, 10), para("Attached image", styles["Label"]), photo])
    return story


def header_footer(canvas, doc, settings, logo):
    canvas.saveState()
    canvas.setFont("Helvetica-Bold", 8)
    canvas.setFillColor(BLUE)
    canvas.drawString(doc.leftMargin, PAGE_HEIGHT - 0.45 * inch, "OBAN PLANTATION")
    canvas.setFillColor(MUTED)
    canvas.drawRightString(PAGE_WIDTH - doc.rightMargin, PAGE_HEIGHT - 0.45 * inch, settings["auditConfidentiality"])
    canvas.setStrokeColor(LINE)
    canvas.line(doc.leftMargin, PAGE_HEIGHT - 0.53 * inch, PAGE_WIDTH - doc.rightMargin, PAGE_HEIGHT - 0.53 * inch)
    canvas.setFont("Helvetica", 7)
    canvas.drawCentredString(PAGE_WIDTH / 2, 0.35 * inch, f"Produced by {settings['auditPreparedBy']} - Management review draft - Page {doc.page}")
    canvas.restoreState()


def build_pdf(db_path: Path, project_id: str, payload) -> bytes:
    _database, _company, project, settings = load_context(db_path, project_id, payload)
    entries = payload.get("entries") or []
    logo = logo_path(db_path, project, payload)
    buffer = BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=letter,
        leftMargin=0.62 * inch,
        rightMargin=0.62 * inch,
        topMargin=0.78 * inch,
        bottomMargin=0.56 * inch,
        title=settings["auditReportTitle"],
    )
    styles = build_styles()
    story = []
    story.extend(cover_page(styles, settings, logo))
    story.append(PageBreak())
    story.extend(contents_page(styles, entries))
    story.append(PageBreak())
    story.extend(summary_page(styles, entries))
    for index, entry in enumerate(entries, start=1):
        story.append(PageBreak())
        story.extend(issue_page(styles, entry, index, db_path))
    doc.build(story, onFirstPage=lambda c, d: header_footer(c, d, settings, logo), onLaterPages=lambda c, d: header_footer(c, d, settings, logo))
    return buffer.getvalue()


def main():
    if len(sys.argv) != 3:
        raise SystemExit("Usage: render_audit_pdf.py <db_path> <project_id>")
    payload = json.loads(sys.stdin.read() or "{}")
    sys.stdout.buffer.write(build_pdf(Path(sys.argv[1]), sys.argv[2], payload))


if __name__ == "__main__":
    main()
