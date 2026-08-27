from __future__ import annotations

import json
import sys
from io import BytesIO
from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.pdfgen import canvas


PAGE_WIDTH, PAGE_HEIGHT = A4
MARGIN = 28
INK = colors.HexColor("#082038")
MUTED = colors.HexColor("#63788d")
BLUE = colors.HexColor("#24476c")
LINE = colors.HexColor("#d9e3ec")
GREEN = colors.HexColor("#27835d")
RED = colors.HexColor("#c54f5b")
SOFT_GREEN = colors.HexColor("#e5f3eb")
SOFT_BLUE = colors.HexColor("#f4f7fa")


def text(value):
    return str(value or "")


def tone_color(tone):
    if tone == "down":
        return RED
    if tone == "up":
        return GREEN
    return MUTED


def draw_text(c, value, x, y, size=9, color=INK, bold=False, align="left"):
    c.setFillColor(color)
    c.setFont("Helvetica-Bold" if bold else "Helvetica", size)
    if align == "right":
        c.drawRightString(x, y, text(value))
    elif align == "center":
        c.drawCentredString(x, y, text(value))
    else:
        c.drawString(x, y, text(value))


def draw_wrapped(c, value, x, y, width, size=8, color=MUTED, bold=False, leading=10):
    words = text(value).split()
    line = ""
    for word in words:
        candidate = f"{line} {word}".strip()
        font = "Helvetica-Bold" if bold else "Helvetica"
        if c.stringWidth(candidate, font, size) <= width or not line:
            line = candidate
            continue
        draw_text(c, line, x, y, size, color, bold)
        y -= leading
        line = word
    if line:
        draw_text(c, line, x, y, size, color, bold)
        y -= leading
    return y


def rounded_box(c, x, y, width, height, stroke=LINE, fill=colors.white, radius=7):
    c.setStrokeColor(stroke)
    c.setFillColor(fill)
    c.roundRect(x, y, width, height, radius, stroke=1, fill=1)


def draw_card(c, card, x, y, width, height):
    rounded_box(c, x, y, width, height)
    draw_text(c, card.get("label"), x + 10, y + height - 18, 8.5, INK, True)
    draw_text(c, card.get("primary"), x + 10, y + height - 42, 16, INK, True)
    if card.get("primaryDelta"):
        draw_text(c, card.get("primaryDelta"), x + 10, y + height - 57, 8.5, tone_color(card.get("primaryTone")), True)
    if card.get("secondary"):
        draw_text(c, card.get("secondary"), x + 10, y + 42, 15, INK, True)
    if card.get("secondaryDelta"):
        draw_text(c, card.get("secondaryDelta"), x + 10, y + 29, 8, tone_color(card.get("secondaryTone")), True)
    footnote = card.get("footnote") or ""
    if card.get("negative"):
        footnote = f"{footnote} {card.get('negative')}".strip()
    draw_wrapped(c, footnote, x + 10, y + 9, width - 20, 7.4, MUTED, True, 8.5)


def draw_chart(c, curve, x, y, width, height):
    prices = [float(value) for value in curve.get("prices", []) if isinstance(value, (int, float))]
    labels = curve.get("labels", [])
    volumes = curve.get("volume", [])
    if not prices:
        return

    rounded_box(c, x, y, width, height, fill=colors.white)
    title_y = y + height - 18
    draw_text(c, curve.get("title", "CPO settlement trend"), x + 12, title_y, 10.5, INK, True)
    draw_wrapped(c, curve.get("subtitle", ""), x + 12, title_y - 13, width - 24, 8, MUTED, True, 9)

    chart_left = x + 74
    chart_right = x + width - 22
    chart_bottom = y + 32
    chart_top = y + height - 52
    chart_width = chart_right - chart_left
    chart_height = chart_top - chart_bottom
    min_value = min(min(prices), 4400)
    max_value = max(max(prices), 5200)
    span = max_value - min_value or 1
    max_volume = max([float(v or 0) for v in volumes] or [1])

    def x_pos(index):
        return chart_left + (chart_width * index) / max(len(prices) - 1, 1)

    def y_pos(value):
        return chart_bottom + ((value - min_value) / span) * chart_height

    ticks = [4400, 4600, 4800, 5000, 5200]
    c.setStrokeColor(colors.HexColor("#e4ebf2"))
    c.setLineWidth(0.7)
    for tick in ticks:
        yy = y_pos(tick)
        c.line(chart_left, yy, chart_right, yy)
        draw_text(c, f"RM{tick:,.0f}", chart_left - 10, yy - 3, 7.5, MUTED, True, "right")

    c.setFillColor(SOFT_GREEN)
    points = [(x_pos(i), y_pos(value)) for i, value in enumerate(prices)]
    area_points = [(chart_left, chart_bottom), *points, (chart_right, chart_bottom)]
    c.setStrokeColor(SOFT_GREEN)
    c.setFillColor(SOFT_GREEN)
    path = c.beginPath()
    path.moveTo(*area_points[0])
    for px, py in area_points[1:]:
        path.lineTo(px, py)
    path.close()
    c.drawPath(path, stroke=0, fill=1)

    c.setFillColor(colors.HexColor("#dbe7f2"))
    for index, volume in enumerate(volumes):
        try:
            bar_height = max(3, (float(volume or 0) / max_volume) * 42)
        except (TypeError, ValueError):
            bar_height = 3
        c.roundRect(x_pos(index) - 4, chart_bottom, 8, bar_height, 2, stroke=0, fill=1)

    c.setStrokeColor(colors.HexColor("#2b987f"))
    c.setLineWidth(2.0)
    for first, second in zip(points, points[1:]):
        c.line(first[0], first[1], second[0], second[1])
    c.setFillColor(colors.HexColor("#2b987f"))
    for px, py in points:
        c.circle(px, py, 2.5, stroke=0, fill=1)

    for index, label in enumerate(labels):
        if index % 2 == 0:
            draw_text(c, label, x_pos(index), y + 15, 8, MUTED, True, "center")


def draw_list(c, title, rows, x, y, width, height):
    rounded_box(c, x, y, width, height)
    draw_text(c, title, x + 10, y + height - 18, 10, INK, True)
    row_y = y + height - 34
    for label, value, tone in rows:
        c.setStrokeColor(colors.HexColor("#edf1f5"))
        c.line(x + 10, row_y - 4, x + width - 10, row_y - 4)
        draw_text(c, label, x + 10, row_y, 8.3, INK)
        draw_text(c, value, x + width - 10, row_y, 8.3, tone_color(tone), True, "right")
        row_y -= 14


def render(report):
    buffer = BytesIO()
    c = canvas.Canvas(buffer, pagesize=A4)
    c.setTitle("CPO Report")

    c.setFillColor(SOFT_BLUE)
    c.rect(0, 0, PAGE_WIDTH, PAGE_HEIGHT, stroke=0, fill=1)
    rounded_box(c, MARGIN, MARGIN, PAGE_WIDTH - 2 * MARGIN, PAGE_HEIGHT - 2 * MARGIN, fill=colors.white)

    x = MARGIN + 14
    top = PAGE_HEIGHT - MARGIN - 18
    draw_text(c, "MARKET DESK · POWERED BY AGINTEL", x, top, 9, colors.HexColor("#0870c0"), True)
    draw_text(c, "CPO report", x, top - 18, 18, INK, True)
    draw_text(c, report.get("refreshedAt"), x, top - 32, 10, MUTED, True)
    draw_text(c, "Source: Bursa Malaysia Derivatives", PAGE_WIDTH - MARGIN - 14, top, 9, MUTED, True, "right")
    draw_text(c, f"Prev close: {report.get('previousClose', '')}", PAGE_WIDTH - MARGIN - 14, top - 16, 9, MUTED, True, "right")
    stamp = report.get("sourceUpdatedAt") or report.get("cacheUpdatedAt") or ""
    draw_text(c, f"Updated from public source {stamp}".strip(), PAGE_WIDTH - MARGIN - 14, top - 36, 7.5, MUTED, True, "right")

    cards = report.get("cards", [])[:4]
    card_gap = 8
    content_width = PAGE_WIDTH - 2 * MARGIN - 28
    card_width = (content_width - card_gap) / 2
    card_height = 112
    first_card_y = top - 158
    second_card_y = first_card_y - card_height - 8
    for index, card in enumerate(cards):
        col = index % 2
        row_y = first_card_y if index < 2 else second_card_y
        draw_card(c, card, x + col * (card_width + card_gap), row_y, card_width, card_height)

    draw_chart(c, report.get("curve", {}), x, 300, content_width, 202)

    draw_list(c, "Where today sits", report.get("today", []), x, 168, content_width, 112)
    draw_list(c, "Adjacent markets", report.get("adjacent", []), x, 46, content_width, 116)
    draw_text(
        c,
        "Produced by Agrinexus Intelligence · Public-source data, for information only",
        PAGE_WIDTH / 2,
        34,
        7.4,
        MUTED,
        True,
        "center",
    )

    c.showPage()
    c.save()
    return buffer.getvalue()


def main():
    if len(sys.argv) != 2:
        raise SystemExit("Usage: render_cpo_pdf.py <public-cpo-data.json>")
    report = json.loads(Path(sys.argv[1]).read_text())
    sys.stdout.buffer.write(render(report))


if __name__ == "__main__":
    main()
