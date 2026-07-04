"""Branded quotation PDF (fpdf2, pure-Python — no system libraries needed).

Industrial U-SAFE styling: hard rectangles, royal blue + signal green + ink,
mono-ish SKU column. Returns PDF bytes for upload to object storage.
"""
from __future__ import annotations

from datetime import datetime, timedelta

from fpdf import FPDF

INK = (11, 11, 12)
ROYAL = (18, 63, 181)
SIGNAL = (0, 200, 0)
GREY = (102, 106, 112)
LIGHT = (236, 238, 240)


def _kes(n: float | None) -> str:
    if n is None:
        return "—"
    return f"KES {n:,.0f}"


class QuotePDF(FPDF):
    def header(self) -> None:  # noqa: D401
        # Black brand bar
        self.set_fill_color(*INK)
        self.rect(0, 0, 210, 26, style="F")
        self.set_xy(12, 7)
        self.set_font("Helvetica", "B", 20)
        self.set_text_color(255, 255, 255)
        self.cell(45, 10, "U-SAFE", ln=0)
        self.set_text_color(*SIGNAL)
        self.cell(6, 10, ".", ln=0)
        self.set_text_color(255, 255, 255)
        self.set_font("Helvetica", "B", 10)
        self.set_xy(12, 16)
        self.set_text_color(*SIGNAL)
        self.cell(60, 5, "ENSURING YOU ARE SAFE", ln=0)
        # Signal stripe under the bar
        self.set_fill_color(*SIGNAL)
        self.rect(0, 26, 210, 2, style="F")

    def footer(self) -> None:
        self.set_y(-18)
        self.set_draw_color(*INK)
        self.set_line_width(0.4)
        self.line(12, self.get_y(), 198, self.get_y())
        self.set_y(-15)
        self.set_font("Helvetica", "", 8)
        self.set_text_color(*GREY)
        self.multi_cell(
            0,
            4,
            "U-SAFE KE  ·  Ashray Industrial Park, P.O. Box 59553-00200, Nairobi  ·  "
            "info@usafeke.com  ·  +254 748 846635\n"
            "Prices in KES, valid 14 days from issue, exclusive of VAT unless stated.",
            align="C",
        )


def build_quote_pdf(quote, lines: list[dict]) -> bytes:
    pdf = QuotePDF(unit="mm", format="A4")
    pdf.set_auto_page_break(auto=True, margin=22)
    pdf.add_page()

    # Title block
    pdf.set_xy(120, 34)
    pdf.set_font("Helvetica", "B", 26)
    pdf.set_text_color(*INK)
    pdf.cell(78, 12, "QUOTATION", align="R", ln=1)
    pdf.set_x(120)
    pdf.set_font("Helvetica", "", 10)
    pdf.set_text_color(*GREY)
    pdf.cell(78, 5, f"No. {quote.number}", align="R", ln=1)
    pdf.set_x(120)
    pdf.cell(78, 5, datetime.utcnow().strftime("Issued %d %b %Y"), align="R", ln=1)
    pdf.set_x(120)
    valid = (datetime.utcnow() + timedelta(days=14)).strftime("Valid until %d %b %Y")
    pdf.cell(78, 5, valid, align="R", ln=1)

    # Bill to
    pdf.set_xy(12, 34)
    pdf.set_font("Helvetica", "B", 9)
    pdf.set_text_color(*ROYAL)
    pdf.cell(80, 5, "PREPARED FOR", ln=1)
    pdf.set_x(12)
    pdf.set_font("Helvetica", "B", 12)
    pdf.set_text_color(*INK)
    pdf.cell(90, 6, quote.company_name or quote.contact_name or "—", ln=1)
    pdf.set_x(12)
    pdf.set_font("Helvetica", "", 10)
    pdf.set_text_color(*GREY)
    if quote.company_name and quote.contact_name:
        pdf.cell(90, 5, quote.contact_name, ln=1)
        pdf.set_x(12)
    if quote.contact_email:
        pdf.cell(90, 5, quote.contact_email, ln=1)
        pdf.set_x(12)
    if quote.contact_phone:
        pdf.cell(90, 5, quote.contact_phone, ln=1)

    # Items table
    y = 76
    pdf.set_xy(12, y)
    pdf.set_fill_color(*ROYAL)
    pdf.set_text_color(255, 255, 255)
    pdf.set_font("Helvetica", "B", 9)
    cols = [(10, "#"), (78, "DESCRIPTION"), (30, "SKU"), (16, "QTY"), (26, "UNIT"), (26, "TOTAL")]
    for w, label in cols:
        align = "L" if label in ("#", "DESCRIPTION", "SKU") else "R"
        pdf.cell(w, 8, f" {label}", border=0, align=align, fill=True)
    pdf.ln(8)

    pdf.set_text_color(*INK)
    pdf.set_font("Helvetica", "", 9)
    for i, ln_ in enumerate(lines):
        fill = i % 2 == 1
        if fill:
            pdf.set_fill_color(*LIGHT)
        pdf.cell(10, 7, f" {i + 1}", border=0, align="L", fill=fill)
        pdf.cell(78, 7, f" {ln_['description'][:52]}", border=0, align="L", fill=fill)
        pdf.cell(30, 7, f" {ln_.get('sku') or '-'}", border=0, align="L", fill=fill)
        pdf.cell(16, 7, str(ln_["quantity"]), border=0, align="R", fill=fill)
        pdf.cell(26, 7, _kes(ln_.get("unit_price_kes")), border=0, align="R", fill=fill)
        pdf.cell(26, 7, _kes(ln_.get("line_total_kes")) + " ", border=0, align="R", fill=fill)
        pdf.ln(7)

    # Total
    pdf.ln(2)
    pdf.set_x(114)
    pdf.set_fill_color(*INK)
    pdf.set_text_color(255, 255, 255)
    pdf.set_font("Helvetica", "B", 11)
    pdf.cell(42, 10, " TOTAL", border=0, align="L", fill=True)
    total = float(quote.total_kes) if quote.total_kes is not None else None
    pdf.set_fill_color(*SIGNAL)
    pdf.set_text_color(*INK)
    pdf.cell(42, 10, _kes(total) + " ", border=0, align="R", fill=True)
    pdf.ln(14)

    if quote.message:
        pdf.set_x(12)
        pdf.set_font("Helvetica", "B", 9)
        pdf.set_text_color(*ROYAL)
        pdf.cell(0, 5, "NOTES", ln=1)
        pdf.set_x(12)
        pdf.set_font("Helvetica", "", 9)
        pdf.set_text_color(*GREY)
        pdf.multi_cell(186, 5, quote.message)

    out = pdf.output()
    return bytes(out)
