from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.lib.units import inch
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer, Image
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_CENTER, TA_RIGHT
from datetime import datetime
import os
import logging

logger = logging.getLogger(__name__)

class InvoiceGenerator:
    """PDF invoice generator using ReportLab"""
    
    def __init__(self, output_dir: str = "/app/backend/invoices"):
        self.output_dir = output_dir
        os.makedirs(output_dir, exist_ok=True)
    
    def generate_invoice(self, invoice_data: dict) -> str:
        """Generate PDF invoice and return file path"""
        try:
            invoice_number = invoice_data['invoice_number']
            filename = f"invoice_{invoice_number}.pdf"
            filepath = os.path.join(self.output_dir, filename)
            
            # Create PDF
            doc = SimpleDocTemplate(filepath, pagesize=letter)
            elements = []
            
            # Styles
            styles = getSampleStyleSheet()
            title_style = ParagraphStyle(
                'CustomTitle',
                parent=styles['Heading1'],
                fontSize=24,
                textColor=colors.HexColor('#2563eb'),
                spaceAfter=30,
                alignment=TA_CENTER
            )
            
            # Company header
            company_name = invoice_data.get('company_name', 'IPTV Billing')
            elements.append(Paragraph(company_name, title_style))
            elements.append(Spacer(1, 0.2*inch))
            
            # Invoice title
            elements.append(Paragraph(f"INVOICE #{invoice_number}", title_style))
            elements.append(Spacer(1, 0.3*inch))
            
            # Invoice details table
            details_data = [
                ['Invoice Date:', invoice_data.get('created_at', datetime.utcnow().strftime('%Y-%m-%d'))],
                ['Due Date:', invoice_data.get('due_date', '')],
                ['Order ID:', invoice_data.get('order_id', '')],
                ['Status:', invoice_data.get('status', 'Unpaid').upper()],
            ]
            
            details_table = Table(details_data, colWidths=[2*inch, 3*inch])
            details_table.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (0, -1), colors.HexColor('#f3f4f6')),
                ('TEXTCOLOR', (0, 0), (-1, -1), colors.black),
                ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
                ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
                ('FONTNAME', (1, 0), (1, -1), 'Helvetica'),
                ('FONTSIZE', (0, 0), (-1, -1), 10),
                ('BOTTOMPADDING', (0, 0), (-1, -1), 12),
                ('GRID', (0, 0), (-1, -1), 1, colors.HexColor('#e5e7eb'))
            ]))
            
            elements.append(details_table)
            elements.append(Spacer(1, 0.5*inch))
            
            # Bill to section
            elements.append(Paragraph("<b>Bill To:</b>", styles['Heading3']))
            elements.append(Spacer(1, 0.1*inch))
            
            customer_info = f"""
            {invoice_data.get('customer_name', 'N/A')}<br/>
            {invoice_data.get('customer_email', 'N/A')}
            """
            elements.append(Paragraph(customer_info, styles['Normal']))
            elements.append(Spacer(1, 0.3*inch))
            
            # Items table
            items_data = [['Description', 'Term', 'Amount']]
            
            for item in invoice_data.get('items', []):
                items_data.append([
                    item.get('product_name', 'N/A'),
                    f"{item.get('term_months', 0)} months",
                    f"${item.get('price', 0):.2f}"
                ])
            
            # Add total row
            items_data.append(['', 'TOTAL:', f"${invoice_data.get('total', 0):.2f}"])
            
            items_table = Table(items_data, colWidths=[3.5*inch, 1.5*inch, 1.5*inch])
            items_table.setStyle(TableStyle([
                # Header row
                ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#2563eb')),
                ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
                ('ALIGN', (0, 0), (-1, 0), 'CENTER'),
                ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
                ('FONTSIZE', (0, 0), (-1, 0), 12),
                ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
                
                # Data rows
                ('ALIGN', (1, 1), (-1, -1), 'RIGHT'),
                ('FONTNAME', (0, 1), (-1, -2), 'Helvetica'),
                ('FONTSIZE', (0, 1), (-1, -1), 10),
                ('BOTTOMPADDING', (0, 1), (-1, -1), 8),
                ('GRID', (0, 0), (-1, -2), 1, colors.HexColor('#e5e7eb')),
                
                # Total row
                ('BACKGROUND', (0, -1), (-1, -1), colors.HexColor('#f3f4f6')),
                ('FONTNAME', (0, -1), (-1, -1), 'Helvetica-Bold'),
                ('FONTSIZE', (0, -1), (-1, -1), 12),
                ('LINEABOVE', (0, -1), (-1, -1), 2, colors.HexColor('#2563eb')),
            ]))
            
            elements.append(items_table)
            elements.append(Spacer(1, 0.5*inch))
            
            # Payment instructions
            if invoice_data.get('status') == 'unpaid':
                payment_info = f"""
                <b>Payment Instructions:</b><br/>
                Please contact our support team to arrange payment.<br/>
                Email: {invoice_data.get('company_email', 'support@example.com')}
                """
                elements.append(Paragraph(payment_info, styles['Normal']))
            
            # Build PDF
            doc.build(elements)
            
            logger.info(f"Invoice PDF generated: {filepath}")
            return filepath
            
        except Exception as e:
            logger.error(f"Invoice generation failed: {str(e)}")
            raise

def get_invoice_generator() -> InvoiceGenerator:
    """Get invoice generator instance"""
    return InvoiceGenerator()
