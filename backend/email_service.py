import aiosmtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from typing import Optional, Dict, List
import logging
import asyncio
import os

logger = logging.getLogger(__name__)

class EmailService:
    """Email notification service with logging and unsubscribe management"""
    
    def __init__(self, smtp_host: str, smtp_port: int, smtp_username: str, 
                 smtp_password: str, from_email: str, from_name: str = "Digital Services",
                 email_logger=None, unsubscribe_manager=None, db=None):
        self.smtp_host = smtp_host
        self.smtp_port = smtp_port
        self.smtp_username = smtp_username
        self.smtp_password = smtp_password
        self.from_email = from_email
        self.from_name = from_name
        self.enabled = bool(smtp_host and smtp_username and smtp_password)
        
        # Integration with logging and unsubscribe
        self.email_logger = email_logger
        self.unsubscribe_manager = unsubscribe_manager
        self.db = db
        
        # Get backend public URL for unsubscribe links
        self.backend_url = os.getenv("BACKEND_PUBLIC_URL", "http://localhost:8001")
    
    def _get_email_header(self, title: str) -> str:
        """Common email header"""
        return f"""
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center;">
            <h1 style="color: white; margin: 0; font-size: 28px;">{title}</h1>
        </div>
        """
    
    def _get_email_footer(self, company_name: str = "Digital Services", recipient_email: str = "", email_type: str = "transactional") -> str:
        """Common email footer with unsubscribe link"""
        footer = f"""
        <div style="background-color: #f8f9fa; padding: 20px; text-align: center; border-top: 1px solid #e9ecef;">
            <p style="color: #6c757d; margin: 0; font-size: 14px;">
                © 2024 {company_name}. All rights reserved.
            </p>
            <p style="color: #6c757d; margin: 10px 0 0 0; font-size: 12px;">
                This is an automated message. Please do not reply directly to this email.
            </p>
        """
        
        # Add unsubscribe link for marketing emails
        if email_type == "marketing" and recipient_email:
            unsubscribe_url = f"{self.backend_url}/api/unsubscribe?email={recipient_email}"
            footer += f"""
            <p style="margin-top: 15px; font-size: 11px;">
                <a href="{unsubscribe_url}" style="color: #6c757d; text-decoration: underline;">
                    Unsubscribe from marketing emails
                </a>
            </p>
            """
        
        footer += "</div>"
        return footer
    
    def _wrap_email(self, content: str, title: str = "", recipient_email: str = "", email_type: str = "transactional") -> str:
        """Wrap email content with consistent styling"""
        return f"""
        <html>
        <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f4f4f4;">
            <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
                {self._get_email_header(title)}
                <div style="padding: 30px;">
                    {content}
                </div>
                {self._get_email_footer(self.from_name, recipient_email, email_type)}
            </div>
        </body>
        </html>
        """
    
    async def send_email(
        self, 
        to_email: str, 
        subject: str, 
        html_content: str, 
        text_content: Optional[str] = None,
        email_type: str = "transactional",
        template_type: Optional[str] = None,
        customer_id: Optional[str] = None,
        order_id: Optional[str] = None,
        sent_by: Optional[str] = None,
        recipient_name: str = "",
        attachments: List[str] = []
    ) -> bool:
        """Send email via SMTP with logging and unsubscribe checks"""
        
        if not self.enabled:
            logger.warning(f"Email not sent (SMTP not configured): {subject} to {to_email}")
            return False
        
        # Check if user is unsubscribed
        if self.unsubscribe_manager:
            if email_type == "marketing":
                can_send = await self.unsubscribe_manager.can_send_marketing(to_email)
                if not can_send:
                    logger.info(f"Email not sent to {to_email} - unsubscribed from marketing")
                    return False
            elif email_type == "transactional":
                can_send = await self.unsubscribe_manager.can_send_transactional(to_email)
                if not can_send:
                    logger.info(f"Email not sent to {to_email} - unsubscribed from all emails")
                    return False
        
        # Log email before sending
        log_id = None
        if self.email_logger:
            try:
                log_id = await self.email_logger.log_email(
                    recipient_email=to_email,
                    subject=subject,
                    html_content=html_content,
                    email_type=email_type,
                    template_type=template_type,
                    customer_id=customer_id,
                    order_id=order_id,
                    sent_by=sent_by,
                    recipient_name=recipient_name,
                    text_content=text_content or ""
                )
            except Exception as e:
                logger.error(f"Failed to log email: {str(e)}")
        
        try:
            message = MIMEMultipart('mixed')
            message['Subject'] = subject
            message['From'] = f"{self.from_name} <{self.from_email}>"
            message['To'] = to_email
            
            # Create alternative part for text and HTML
            msg_alternative = MIMEMultipart('alternative')
            
            # Add text and HTML parts
            if text_content:
                part1 = MIMEText(text_content, 'plain')
                msg_alternative.attach(part1)
            
            part2 = MIMEText(html_content, 'html')
            msg_alternative.attach(part2)
            
            message.attach(msg_alternative)
            
            # Add attachments if any
            if attachments:
                from email.mime.base import MIMEBase
                from email import encoders
                import os
                
                for file_path in attachments:
                    if os.path.exists(file_path):
                        try:
                            with open(file_path, 'rb') as f:
                                part = MIMEBase('application', 'octet-stream')
                                part.set_payload(f.read())
                                encoders.encode_base64(part)
                                filename = os.path.basename(file_path)
                                part.add_header('Content-Disposition', f'attachment; filename="{filename}"')
                                message.attach(part)
                        except Exception as e:
                            logger.error(f"Failed to attach file {file_path}: {str(e)}")
            
            # Determine SSL/TLS settings based on port
            logger.info(f"Attempting to send email via {self.smtp_host}:{self.smtp_port}")
            
            if self.smtp_port == 465:
                # Use SSL/TLS (implicit encryption)
                await aiosmtplib.send(
                    message,
                    hostname=self.smtp_host,
                    port=self.smtp_port,
                    username=self.smtp_username,
                    password=self.smtp_password,
                    use_tls=True,
                    start_tls=False
                )
            else:
                # Use STARTTLS for port 587 and others
                await aiosmtplib.send(
                    message,
                    hostname=self.smtp_host,
                    port=self.smtp_port,
                    username=self.smtp_username,
                    password=self.smtp_password,
                    start_tls=True,
                    use_tls=False
                )
            
            logger.info(f"Email sent successfully to {to_email}: {subject}")
            
            # Mark as sent in log
            if self.email_logger and log_id:
                try:
                    await self.email_logger.mark_sent(log_id)
                except Exception as e:
                    logger.error(f"Failed to mark email as sent: {str(e)}")
            
            return True
            
        except Exception as e:
            logger.error(f"Email sending failed to {to_email}: {str(e)}")
            logger.error(f"SMTP config: host={self.smtp_host}, port={self.smtp_port}, user={self.smtp_username}")
            
            # Mark as failed in log
            if self.email_logger and log_id:
                try:
                    await self.email_logger.mark_failed(log_id, str(e))
                except Exception as log_error:
                    logger.error(f"Failed to mark email as failed: {str(log_error)}")
            
            return False
    
    async def send_bulk_email(
        self, 
        recipients: List[Dict[str, str]], 
        subject: str, 
        html_content: str,
        email_type: str = "marketing",
        sent_by: str = None
    ) -> Dict[str, int]:
        """Send email to multiple recipients with rate limiting and personalization"""
        sent = 0
        failed = 0
        errors = []
        
        for recipient in recipients:
            email = recipient.get("email")
            name = recipient.get("name", "")
            customer_id = recipient.get("customer_id")
            
            # Personalize content FIRST
            personalized_content = html_content.replace("{{name}}", name)
            personalized_content = personalized_content.replace("{{customer_name}}", name)
            personalized_content = personalized_content.replace("{{email}}", email)
            
            personalized_subject = subject.replace("{{name}}", name)
            personalized_subject = personalized_subject.replace("{{customer_name}}", name)
            personalized_subject = personalized_subject.replace("{{email}}", email)
            
            # THEN wrap with email template (includes unsubscribe link per recipient)
            wrapped_content = self._wrap_email(
                personalized_content,
                personalized_subject,
                recipient_email=email,
                email_type=email_type
            )
            
            success = await self.send_email(
                to_email=email,
                subject=personalized_subject,
                html_content=wrapped_content,
                email_type=email_type,
                customer_id=customer_id,
                recipient_name=name,
                sent_by=sent_by
            )
            
            if success:
                sent += 1
            else:
                failed += 1
                errors.append({"email": email, "error": "Send failed"})
            
            # Rate limiting - small delay between emails
            await asyncio.sleep(0.1)
        
        return {
            "sent": sent,
            "failed": failed,
            "errors": errors
        }

    # Template-specific email methods
    
    async def send_order_confirmation(
        self,
        customer_email: str,
        customer_name: str,
        order_id: str,
        amount: float,
        product_name: str,
        duration: int,
        customer_id: str = None
    ):
        """Send order confirmation email using template"""
        if not self.db:
            logger.error("Database not configured for template emails")
            return False
        
        # Get template
        template = await self.db.email_templates.find_one({
            "template_type": "order_confirmation",
            "is_active": True
        })
        
        if not template:
            logger.error("Order confirmation template not found")
            return False
        
        # Replace variables
        variables = {
            "customer_name": customer_name,
            "order_id": order_id,
            "amount": f"{amount:.2f}",
            "product_name": product_name,
            "duration": str(duration)
        }
        
        subject = template["subject"]
        content = template["html_content"]
        
        for key, value in variables.items():
            subject = subject.replace(f"{{{{{key}}}}}", value)
            content = content.replace(f"{{{{{key}}}}}", value)
        
        wrapped_content = self._wrap_email(content, template["name"], customer_email, "transactional")
        
        return await self.send_email(
            to_email=customer_email,
            subject=subject,
            html_content=wrapped_content,
            email_type="transactional",
            template_type="order_confirmation",
            customer_id=customer_id,
            order_id=order_id,
            recipient_name=customer_name
        )
    
    async def send_service_activated(
        self,
        customer_email: str,
        customer_name: str,
        service_name: str,
        username: str,
        password: str,
        streaming_url: str,
        max_connections: int,
        expiry_date: str,
        customer_id: str = None
    ):
        """Send service activated email with credentials"""
        if not self.db:
            return False
        
        template = await self.db.email_templates.find_one({
            "template_type": "service_activated",
            "is_active": True
        })
        
        if not template:
            return False
        
        variables = {
            "customer_name": customer_name,
            "service_name": service_name,
            "username": username,
            "password": password,
            "streaming_url": streaming_url,
            "max_connections": str(max_connections),
            "expiry_date": expiry_date,
            "dashboard_link": f"{self.backend_url}/dashboard"
        }
        
        subject = template["subject"]
        content = template["html_content"]
        
        for key, value in variables.items():
            subject = subject.replace(f"{{{{{key}}}}}", value)
            content = content.replace(f"{{{{{key}}}}}", value)
        
        wrapped_content = self._wrap_email(content, template["name"], customer_email, "transactional")
        
        return await self.send_email(
            to_email=customer_email,
            subject=subject,
            html_content=wrapped_content,
            email_type="transactional",
            template_type="service_activated",
            customer_id=customer_id,
            recipient_name=customer_name
        )


# Global email service instance
_email_service = None

def get_email_service(smtp_settings: dict, email_logger=None, unsubscribe_manager=None, db=None):
    """Get or create email service instance"""
    global _email_service
    
    if not smtp_settings.get("host"):
        return None
    
    _email_service = EmailService(
        smtp_host=smtp_settings.get("host", ""),
        smtp_port=smtp_settings.get("port", 587),
        smtp_username=smtp_settings.get("username", ""),
        smtp_password=smtp_settings.get("password", ""),
        from_email=smtp_settings.get("from_email", ""),
        from_name=smtp_settings.get("from_name", "Digital Services"),
        email_logger=email_logger,
        unsubscribe_manager=unsubscribe_manager,
        db=db
    )
    
    return _email_service
