from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.lib.units import inch
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer, Image
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_CENTER, TA_RIGHT, TA_LEFT
from datetime import datetime
import os
import logging

logger = logging.getLogger(__name__)

class InvoiceGenerator:
    """PDF invoice generator using ReportLab with customizable settings"""
    
    def __init__(self, output_dir: str = "/app/backend/invoices"):
        self.output_dir = output_dir
        os.makedirs(output_dir, exist_ok=True)
    
    def generate_invoice(self, invoice_data: dict, invoice_settings: dict = None) -> str:
        """Generate PDF invoice and return file path"""
        try:
            s = invoice_settings or {}
            invoice_number = invoice_data['invoice_number']
            filename = f"invoice_{invoice_number}.pdf"
            filepath = os.path.join(self.output_dir, filename)
            
            primary_color = colors.HexColor(s.get('primary_color', '#2563eb'))
            accent_color = colors.HexColor(s.get('accent_color', '#f3f4f6'))
            
            doc = SimpleDocTemplate(filepath, pagesize=letter,
                                    leftMargin=0.75*inch, rightMargin=0.75*inch,
                                    topMargin=0.5*inch, bottomMargin=0.5*inch)
            elements = []
            styles = getSampleStyleSheet()
            
            company_name = s.get('company_name') or invoice_data.get('company_name', 'IPTV Billing')
            
            # ---- HEADER ----
            header_style = ParagraphStyle('Header', parent=styles['Heading1'],
                                          fontSize=22, textColor=primary_color, spaceAfter=4)
            sub_style = ParagraphStyle('Sub', parent=styles['Normal'],
                                       fontSize=9, textColor=colors.HexColor('#6b7280'), leading=13)
            
            # Build company info block
            company_lines = [f"<b>{company_name}</b>"]
            if s.get('company_address'):
                company_lines.append(s['company_address'])
            contact_parts = []
            if s.get('company_phone'):
                contact_parts.append(s['company_phone'])
            if s.get('company_email'):
                contact_parts.append(s['company_email'])
            if contact_parts:
                company_lines.append(' | '.join(contact_parts))
            if s.get('company_website'):
                company_lines.append(s['company_website'])
            
            company_text = '<br/>'.join(company_lines)
            
            # Try to load logo
            logo_element = None
            logo_url = s.get('logo_url', '')
            if logo_url:
                # Convert URL to local path
                logo_path = None
                if '/api/uploads/logos/' in logo_url:
                    logo_filename = logo_url.split('/api/uploads/logos/')[-1]
                    potential_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'uploads', 'logos', logo_filename)
                    if os.path.exists(potential_path):
                        logo_path = potential_path
                if logo_path:
                    try:
                        logo_element = Image(logo_path, width=1.2*inch, height=1.2*inch)
                        logo_element.hAlign = 'LEFT'
                    except Exception as e:
                        logger.warning(f"Could not load logo: {e}")
            
            # Invoice title on right
            inv_title_style = ParagraphStyle('InvTitle', parent=styles['Heading1'],
                                             fontSize=28, textColor=primary_color, alignment=TA_RIGHT)
            inv_num_style = ParagraphStyle('InvNum', parent=styles['Normal'],
                                           fontSize=10, textColor=colors.HexColor('#6b7280'), alignment=TA_RIGHT)
            
            # Build header with or without logo
            if logo_element:
                left_cell = Table([[logo_element], [Paragraph(company_text, sub_style)]])
                left_cell.setStyle(TableStyle([('BOTTOMPADDING', (0, 0), (-1, -1), 4)]))
            else:
                left_cell = Paragraph(company_text, sub_style)
            
            header_table_data = [
                [left_cell, Paragraph("INVOICE", inv_title_style)],
                ['', Paragraph(f"#{invoice_number}", inv_num_style)]
            ]
            header_table = Table(header_table_data, colWidths=[3.5*inch, 3.5*inch])
            header_table.setStyle(TableStyle([
                ('VALIGN', (0, 0), (-1, -1), 'TOP'),
                ('BOTTOMPADDING', (0, 0), (-1, -1), 2),
            ]))
            elements.append(header_table)
            
            # Divider line
            elements.append(Spacer(1, 0.15*inch))
            divider_data = [['', '']]
            divider = Table(divider_data, colWidths=[7*inch, 0])
            divider.setStyle(TableStyle([
                ('LINEBELOW', (0, 0), (0, 0), 2, primary_color),
            ]))
            elements.append(divider)
            elements.append(Spacer(1, 0.25*inch))
            
            # ---- DETAILS + BILL TO ----
            detail_label = ParagraphStyle('DLabel', parent=styles['Normal'],
                                          fontSize=9, textColor=colors.HexColor('#9ca3af'))
            detail_value = ParagraphStyle('DValue', parent=styles['Normal'],
                                          fontSize=10, textColor=colors.black, fontName='Helvetica-Bold')
            
            status = invoice_data.get('status', 'unpaid').upper()
            status_color = colors.HexColor('#16a34a') if status == 'PAID' else colors.HexColor('#dc2626')
            status_style = ParagraphStyle('Status', parent=detail_value, textColor=status_color)
            
            left_details = [
                [Paragraph("Invoice Date", detail_label)],
                [Paragraph(invoice_data.get('created_at', datetime.utcnow().strftime('%Y-%m-%d')), detail_value)],
                [Spacer(1, 6)],
                [Paragraph("Due Date", detail_label)],
                [Paragraph(invoice_data.get('due_date', ''), detail_value)],
                [Spacer(1, 6)],
                [Paragraph("Status", detail_label)],
                [Paragraph(status, status_style)],
            ]
            
            right_details = [
                [Paragraph("<b>Bill To:</b>", ParagraphStyle('BT', parent=styles['Normal'], fontSize=10))],
                [Paragraph(invoice_data.get('customer_name', 'N/A'), detail_value)],
                [Paragraph(invoice_data.get('customer_email', ''), sub_style)],
                [Spacer(1, 10)],
                [Paragraph(f"Order: {invoice_data.get('order_id', '')[:12]}", sub_style)],
            ]
            
            left_t = Table(left_details)
            right_t = Table(right_details)
            info_table = Table([[left_t, right_t]], colWidths=[3.5*inch, 3.5*inch])
            info_table.setStyle(TableStyle([('VALIGN', (0, 0), (-1, -1), 'TOP')]))
            elements.append(info_table)
            elements.append(Spacer(1, 0.35*inch))
            
            # ---- ITEMS TABLE ----
            items_header = ['Description', 'Term', 'Amount']
            items_data = [items_header]
            for item in invoice_data.get('items', []):
                items_data.append([
                    item.get('product_name', 'N/A'),
                    f"{item.get('term_months', 0)} month(s)",
                    f"${item.get('price', 0):.2f}"
                ])
            
            # Subtotal / discount / credits / total
            subtotal = invoice_data.get('subtotal', invoice_data.get('total', 0))
            discount = invoice_data.get('discount_amount', 0)
            credits_used = invoice_data.get('credits_used', 0)
            total = invoice_data.get('total', 0)
            
            items_data.append(['', 'Subtotal:', f"${subtotal:.2f}"])
            if discount > 0:
                items_data.append(['', 'Discount:', f"-${discount:.2f}"])
            if credits_used > 0:
                items_data.append(['', 'Credits Used:', f"-${credits_used:.2f}"])
            items_data.append(['', 'TOTAL:', f"${total:.2f}"])
            
            num_items = len(invoice_data.get('items', [])) + 1  # +1 for header
            
            items_table = Table(items_data, colWidths=[3.8*inch, 1.6*inch, 1.6*inch])
            style_cmds = [
                ('BACKGROUND', (0, 0), (-1, 0), primary_color),
                ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
                ('ALIGN', (0, 0), (-1, 0), 'CENTER'),
                ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
                ('FONTSIZE', (0, 0), (-1, 0), 11),
                ('BOTTOMPADDING', (0, 0), (-1, 0), 10),
                ('TOPPADDING', (0, 0), (-1, 0), 10),
                ('ALIGN', (1, 1), (-1, -1), 'RIGHT'),
                ('FONTNAME', (0, 1), (-1, -1), 'Helvetica'),
                ('FONTSIZE', (0, 1), (-1, -1), 10),
                ('BOTTOMPADDING', (0, 1), (-1, -1), 8),
                ('TOPPADDING', (0, 1), (-1, -1), 8),
                ('GRID', (0, 0), (-1, num_items - 1), 0.5, colors.HexColor('#e5e7eb')),
                ('BACKGROUND', (0, -1), (-1, -1), accent_color),
                ('FONTNAME', (0, -1), (-1, -1), 'Helvetica-Bold'),
                ('FONTSIZE', (0, -1), (-1, -1), 12),
                ('LINEABOVE', (0, -1), (-1, -1), 2, primary_color),
                ('ROWBACKGROUNDS', (0, 1), (-1, num_items - 1), [colors.white, colors.HexColor('#fafafa')]),
            ]
            items_table.setStyle(TableStyle(style_cmds))
            elements.append(items_table)
            elements.append(Spacer(1, 0.4*inch))
            
            # ---- PAYMENT INSTRUCTIONS ----
            if s.get('payment_instructions') and invoice_data.get('status') != 'paid':
                pi_style = ParagraphStyle('PI', parent=styles['Normal'], fontSize=9,
                                           textColor=colors.HexColor('#374151'), leading=13)
                elements.append(Paragraph(f"<b>Payment Instructions:</b><br/>{s['payment_instructions']}", pi_style))
                elements.append(Spacer(1, 0.2*inch))
            
            # ---- NOTES ----
            if s.get('notes'):
                note_style = ParagraphStyle('Note', parent=styles['Normal'], fontSize=9,
                                             textColor=colors.HexColor('#6b7280'), leading=13)
                elements.append(Paragraph(f"<b>Notes:</b><br/>{s['notes']}", note_style))
                elements.append(Spacer(1, 0.15*inch))
            
            # ---- TERMS ----
            if s.get('terms'):
                terms_style = ParagraphStyle('Terms', parent=styles['Normal'], fontSize=8,
                                              textColor=colors.HexColor('#9ca3af'), leading=11)
                elements.append(Paragraph(f"<b>Terms &amp; Conditions:</b><br/>{s['terms']}", terms_style))
            
            # ---- FOOTER ----
            elements.append(Spacer(1, 0.3*inch))
            footer_style = ParagraphStyle('Footer', parent=styles['Normal'], fontSize=8,
                                           textColor=colors.HexColor('#9ca3af'), alignment=TA_CENTER)
            elements.append(Paragraph(f"Thank you for your business! | {company_name}", footer_style))
            
            doc.build(elements)
            logger.info(f"Invoice PDF generated: {filepath}")
            return filepath
            
        except Exception as e:
            logger.error(f"Invoice generation failed: {str(e)}")
            raise

def get_invoice_generator() -> InvoiceGenerator:
    """Get invoice generator instance"""
    return InvoiceGenerator()
