"""Invoice PDF Generator"""
from fpdf import FPDF
from datetime import datetime
import os


def generate_invoice_pdf(invoice: dict, user: dict, items: list = None, settings: dict = None) -> bytes:
    """Generate a professional invoice PDF and return as bytes"""
    
    branding = (settings or {}).get("branding", {})
    site_name = branding.get("site_name", "Billing System")
    currency_symbol = "$"
    
    pdf = FPDF()
    pdf.set_auto_page_break(auto=True, margin=20)
    pdf.add_page()
    
    # Header
    pdf.set_font("Helvetica", "B", 22)
    pdf.set_text_color(30, 64, 175)
    pdf.cell(95, 12, site_name)
    pdf.set_font("Helvetica", "B", 28)
    pdf.set_text_color(100, 100, 100)
    pdf.cell(95, 12, "INVOICE", align="R")
    pdf.ln(16)
    
    # Line
    pdf.set_draw_color(30, 64, 175)
    pdf.set_line_width(0.5)
    pdf.line(10, pdf.get_y(), 200, pdf.get_y())
    pdf.ln(8)
    
    # Invoice details (left) and Bill To (right)
    y_start = pdf.get_y()
    
    pdf.set_font("Helvetica", "B", 9)
    pdf.set_text_color(100, 100, 100)
    pdf.cell(95, 5, "INVOICE DETAILS")
    pdf.cell(95, 5, "BILL TO")
    pdf.ln(6)
    
    pdf.set_font("Helvetica", "", 10)
    pdf.set_text_color(50, 50, 50)
    
    inv_number = invoice.get("invoice_number", "N/A")
    created = invoice.get("created_at")
    created_str = created.strftime("%B %d, %Y") if isinstance(created, datetime) else str(created)[:10] if created else "N/A"
    due = invoice.get("due_date")
    due_str = due.strftime("%B %d, %Y") if isinstance(due, datetime) else str(due)[:10] if due else "N/A"
    status = invoice.get("status", "pending").upper()
    
    customer_name = user.get("name", "N/A") if user else "N/A"
    customer_email = user.get("email", "") if user else ""
    
    # Left column
    details = [
        ("Invoice #:", inv_number),
        ("Date:", created_str),
        ("Due Date:", due_str),
        ("Status:", status),
    ]
    
    for label, value in details:
        x = pdf.get_x()
        pdf.set_font("Helvetica", "B", 9)
        pdf.cell(25, 5, label)
        pdf.set_font("Helvetica", "", 10)
        pdf.cell(70, 5, str(value))
        # Right column - customer info
        pdf.set_font("Helvetica", "", 10)
        if label == "Invoice #:":
            pdf.cell(95, 5, customer_name)
        elif label == "Date:":
            pdf.cell(95, 5, customer_email)
        else:
            pdf.cell(95, 5, "")
        pdf.ln(6)
    
    pdf.ln(10)
    
    # Items table header
    pdf.set_fill_color(30, 64, 175)
    pdf.set_text_color(255, 255, 255)
    pdf.set_font("Helvetica", "B", 9)
    pdf.cell(100, 8, "  Description", 0, 0, "L", True)
    pdf.cell(30, 8, "Qty", 0, 0, "C", True)
    pdf.cell(30, 8, "Price", 0, 0, "R", True)
    pdf.cell(30, 8, "Total  ", 0, 0, "R", True)
    pdf.ln()
    
    # Items
    pdf.set_text_color(50, 50, 50)
    total = 0
    
    if items:
        for i, item in enumerate(items):
            bg = i % 2 == 0
            if bg:
                pdf.set_fill_color(248, 249, 250)
            else:
                pdf.set_fill_color(255, 255, 255)
            
            name = item.get("product_name", "Service")
            qty = 1
            price = item.get("price", 0)
            line_total = price * qty
            total += line_total
            
            pdf.set_font("Helvetica", "", 10)
            pdf.cell(100, 7, f"  {name}", 0, 0, "L", bg)
            pdf.cell(30, 7, str(qty), 0, 0, "C", bg)
            pdf.cell(30, 7, f"{currency_symbol}{price:.2f}", 0, 0, "R", bg)
            pdf.cell(30, 7, f"{currency_symbol}{line_total:.2f}  ", 0, 0, "R", bg)
            pdf.ln()
    else:
        desc = invoice.get("description", "Service charge")
        pdf.set_fill_color(248, 249, 250)
        pdf.set_font("Helvetica", "", 10)
        pdf.cell(100, 7, f"  {desc}", 0, 0, "L", True)
        pdf.cell(30, 7, "1", 0, 0, "C", True)
        pdf.cell(30, 7, f"{currency_symbol}{invoice.get('total', 0):.2f}", 0, 0, "R", True)
        pdf.cell(30, 7, f"{currency_symbol}{invoice.get('total', 0):.2f}  ", 0, 0, "R", True)
        pdf.ln()
        total = invoice.get("total", 0)
    
    # Totals
    pdf.ln(4)
    pdf.set_draw_color(200, 200, 200)
    pdf.line(130, pdf.get_y(), 200, pdf.get_y())
    pdf.ln(4)
    
    pdf.set_font("Helvetica", "B", 11)
    pdf.set_text_color(50, 50, 50)
    pdf.cell(130, 7, "")
    pdf.cell(30, 7, "Total:", 0, 0, "R")
    pdf.set_font("Helvetica", "B", 13)
    pdf.set_text_color(30, 64, 175)
    pdf.cell(30, 7, f"{currency_symbol}{invoice.get('total', total):.2f}  ", 0, 0, "R")
    pdf.ln(10)
    
    # Status badge
    if status == "PAID":
        pdf.set_font("Helvetica", "B", 14)
        pdf.set_text_color(22, 163, 74)
        pdf.cell(0, 10, "PAID", align="R")
    elif status == "PENDING":
        pdf.set_font("Helvetica", "B", 14)
        pdf.set_text_color(202, 138, 4)
        pdf.cell(0, 10, "PENDING", align="R")
    
    pdf.ln(20)
    
    # Footer
    pdf.set_draw_color(200, 200, 200)
    pdf.line(10, pdf.get_y(), 200, pdf.get_y())
    pdf.ln(6)
    pdf.set_font("Helvetica", "", 8)
    pdf.set_text_color(150, 150, 150)
    pdf.cell(0, 5, f"Generated by {site_name} on {datetime.utcnow().strftime('%B %d, %Y')}", align="C")
    
    return pdf.output()
