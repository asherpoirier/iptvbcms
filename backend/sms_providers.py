"""
SMS Provider Abstraction Layer
Supports: Twilio, Vonage (Nexmo), Plivo, AWS SNS
All use REST APIs via httpx (except AWS SNS which uses boto3)
"""
import logging
import httpx
import base64
from typing import Optional

logger = logging.getLogger(__name__)


async def send_via_twilio(account_sid: str, auth_token: str, from_number: str,
                          to_number: str, message: str) -> bool:
    try:
        creds = base64.b64encode(f"{account_sid}:{auth_token}".encode()).decode()
        async with httpx.AsyncClient() as client:
            resp = await client.post(
                f"https://api.twilio.com/2010-04-01/Accounts/{account_sid}/Messages.json",
                headers={"Authorization": f"Basic {creds}"},
                data={"From": from_number, "To": to_number, "Body": message},
                timeout=15.0
            )
            if resp.status_code in (200, 201):
                data = resp.json()
                logger.info(f"Twilio SMS sent to {to_number}, SID: {data.get('sid')}")
                return True
            else:
                logger.error(f"Twilio error: {resp.status_code} {resp.text}")
                return False
    except Exception as e:
        logger.error(f"Twilio exception: {e}")
        return False


async def send_via_vonage(api_key: str, api_secret: str, from_name: str,
                          to_number: str, message: str) -> bool:
    try:
        async with httpx.AsyncClient() as client:
            resp = await client.post(
                "https://rest.nexmo.com/sms/json",
                data={
                    "from": from_name,
                    "to": to_number.replace("+", ""),
                    "text": message,
                    "api_key": api_key,
                    "api_secret": api_secret
                },
                timeout=15.0
            )
            if resp.status_code == 200:
                data = resp.json()
                msgs = data.get("messages", [])
                if msgs and msgs[0].get("status") == "0":
                    logger.info(f"Vonage SMS sent to {to_number}, ID: {msgs[0].get('message-id')}")
                    return True
                else:
                    err = msgs[0].get("error-text", "Unknown") if msgs else "Empty response"
                    logger.error(f"Vonage error: {err}")
                    return False
            else:
                logger.error(f"Vonage HTTP error: {resp.status_code}")
                return False
    except Exception as e:
        logger.error(f"Vonage exception: {e}")
        return False


async def send_via_plivo(auth_id: str, auth_token: str, from_number: str,
                         to_number: str, message: str) -> bool:
    try:
        creds = base64.b64encode(f"{auth_id}:{auth_token}".encode()).decode()
        async with httpx.AsyncClient() as client:
            resp = await client.post(
                f"https://api.plivo.com/v1/Account/{auth_id}/Message/",
                headers={"Authorization": f"Basic {creds}", "Content-Type": "application/json"},
                json={"src": from_number, "dst": to_number.replace("+", ""), "text": message},
                timeout=15.0
            )
            if resp.status_code in (200, 201, 202):
                logger.info(f"Plivo SMS sent to {to_number}")
                return True
            else:
                logger.error(f"Plivo error: {resp.status_code} {resp.text}")
                return False
    except Exception as e:
        logger.error(f"Plivo exception: {e}")
        return False


async def send_via_aws_sns(access_key: str, secret_key: str, region: str,
                           to_number: str, message: str) -> bool:
    try:
        import boto3
        client = boto3.client(
            "sns",
            aws_access_key_id=access_key,
            aws_secret_access_key=secret_key,
            region_name=region or "us-east-1"
        )
        resp = client.publish(PhoneNumber=to_number, Message=message)
        msg_id = resp.get("MessageId", "")
        logger.info(f"AWS SNS SMS sent to {to_number}, MessageId: {msg_id}")
        return True
    except ImportError:
        logger.error("AWS SNS requires boto3: pip install boto3")
        return False
    except Exception as e:
        logger.error(f"AWS SNS exception: {e}")
        return False


async def send_sms(provider: str, config: dict, to_number: str, message: str) -> bool:
    """Route SMS through the configured provider"""
    if not to_number or not message:
        return False

    if provider == "twilio":
        return await send_via_twilio(
            account_sid=config.get("twilio_account_sid", ""),
            auth_token=config.get("twilio_auth_token", ""),
            from_number=config.get("twilio_from_number", ""),
            to_number=to_number, message=message
        )
    elif provider == "vonage":
        return await send_via_vonage(
            api_key=config.get("vonage_api_key", ""),
            api_secret=config.get("vonage_api_secret", ""),
            from_name=config.get("vonage_from_name", "Billing"),
            to_number=to_number, message=message
        )
    elif provider == "plivo":
        return await send_via_plivo(
            auth_id=config.get("plivo_auth_id", ""),
            auth_token=config.get("plivo_auth_token", ""),
            from_number=config.get("plivo_from_number", ""),
            to_number=to_number, message=message
        )
    elif provider == "aws_sns":
        return await send_via_aws_sns(
            access_key=config.get("aws_access_key", ""),
            secret_key=config.get("aws_secret_key", ""),
            region=config.get("aws_region", "us-east-1"),
            to_number=to_number, message=message
        )
    else:
        logger.error(f"Unknown SMS provider: {provider}")
        return False
