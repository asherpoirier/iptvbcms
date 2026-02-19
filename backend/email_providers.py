"""
Email Provider Abstraction Layer
Supports: Custom SMTP, Resend, Postmark, Mailgun, Mandrill (Mailchimp Transactional)
"""
import logging
import httpx
from typing import Optional

logger = logging.getLogger(__name__)


async def send_via_resend(api_key: str, from_email: str, from_name: str,
                          to_email: str, subject: str, html: str, text: str) -> bool:
    """Send email via Resend API"""
    try:
        async with httpx.AsyncClient() as client:
            resp = await client.post(
                "https://api.resend.com/emails",
                headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
                json={
                    "from": f"{from_name} <{from_email}>",
                    "to": [to_email],
                    "subject": subject,
                    "html": html,
                    "text": text
                },
                timeout=15.0
            )
            if resp.status_code in (200, 201):
                logger.info(f"Resend: email sent to {to_email}")
                return True
            else:
                logger.error(f"Resend error: {resp.status_code} {resp.text}")
                return False
    except Exception as e:
        logger.error(f"Resend exception: {e}")
        return False


async def send_via_postmark(server_token: str, from_email: str, from_name: str,
                            to_email: str, subject: str, html: str, text: str) -> bool:
    """Send email via Postmark API"""
    try:
        async with httpx.AsyncClient() as client:
            resp = await client.post(
                "https://api.postmarkapp.com/email",
                headers={
                    "Accept": "application/json",
                    "Content-Type": "application/json",
                    "X-Postmark-Server-Token": server_token
                },
                json={
                    "From": f"{from_name} <{from_email}>",
                    "To": to_email,
                    "Subject": subject,
                    "HtmlBody": html,
                    "TextBody": text,
                    "MessageStream": "outbound"
                },
                timeout=15.0
            )
            if resp.status_code == 200:
                data = resp.json()
                if data.get("ErrorCode", 0) == 0:
                    logger.info(f"Postmark: email sent to {to_email}, MessageID: {data.get('MessageID')}")
                    return True
                else:
                    logger.error(f"Postmark error: {data.get('Message')}")
                    return False
            else:
                logger.error(f"Postmark HTTP error: {resp.status_code} {resp.text}")
                return False
    except Exception as e:
        logger.error(f"Postmark exception: {e}")
        return False


async def send_via_mailgun(api_key: str, domain: str, from_email: str, from_name: str,
                           to_email: str, subject: str, html: str, text: str,
                           region: str = "us") -> bool:
    """Send email via Mailgun API"""
    try:
        base_url = "https://api.eu.mailgun.net" if region == "eu" else "https://api.mailgun.net"
        async with httpx.AsyncClient() as client:
            resp = await client.post(
                f"{base_url}/v3/{domain}/messages",
                auth=("api", api_key),
                data={
                    "from": f"{from_name} <{from_email}>",
                    "to": to_email,
                    "subject": subject,
                    "html": html,
                    "text": text
                },
                timeout=15.0
            )
            if resp.status_code == 200:
                logger.info(f"Mailgun: email sent to {to_email}")
                return True
            else:
                logger.error(f"Mailgun error: {resp.status_code} {resp.text}")
                return False
    except Exception as e:
        logger.error(f"Mailgun exception: {e}")
        return False


async def send_via_mandrill(api_key: str, from_email: str, from_name: str,
                            to_email: str, subject: str, html: str, text: str) -> bool:
    """Send email via Mandrill (Mailchimp Transactional) API"""
    try:
        async with httpx.AsyncClient() as client:
            resp = await client.post(
                "https://mandrillapp.com/api/1.0/messages/send.json",
                json={
                    "key": api_key,
                    "message": {
                        "from_email": from_email,
                        "from_name": from_name,
                        "to": [{"email": to_email, "type": "to"}],
                        "subject": subject,
                        "html": html,
                        "text": text
                    }
                },
                timeout=15.0
            )
            if resp.status_code == 200:
                results = resp.json()
                if results and results[0].get("status") in ("sent", "queued"):
                    logger.info(f"Mandrill: email sent to {to_email}, status={results[0]['status']}")
                    return True
                else:
                    status = results[0].get("status", "unknown") if results else "empty"
                    reason = results[0].get("reject_reason", "") if results else ""
                    logger.error(f"Mandrill rejected: status={status}, reason={reason}")
                    return False
            else:
                logger.error(f"Mandrill HTTP error: {resp.status_code} {resp.text}")
                return False
    except Exception as e:
        logger.error(f"Mandrill exception: {e}")
        return False


async def send_via_provider(provider: str, config: dict,
                            from_email: str, from_name: str,
                            to_email: str, subject: str,
                            html: str, text: str) -> bool:
    """Route email through the configured provider"""
    if provider == "resend":
        return await send_via_resend(
            api_key=config.get("resend_api_key", ""),
            from_email=from_email, from_name=from_name,
            to_email=to_email, subject=subject, html=html, text=text
        )
    elif provider == "postmark":
        return await send_via_postmark(
            server_token=config.get("postmark_server_token", ""),
            from_email=from_email, from_name=from_name,
            to_email=to_email, subject=subject, html=html, text=text
        )
    elif provider == "mailgun":
        return await send_via_mailgun(
            api_key=config.get("mailgun_api_key", ""),
            domain=config.get("mailgun_domain", ""),
            from_email=from_email, from_name=from_name,
            to_email=to_email, subject=subject, html=html, text=text,
            region=config.get("mailgun_region", "us")
        )
    elif provider == "mandrill":
        return await send_via_mandrill(
            api_key=config.get("mandrill_api_key", ""),
            from_email=from_email, from_name=from_name,
            to_email=to_email, subject=subject, html=html, text=text
        )
    else:
        logger.error(f"Unknown email provider: {provider}")
        return False
