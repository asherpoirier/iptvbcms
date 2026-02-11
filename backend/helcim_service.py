import os
import logging
import httpx

logger = logging.getLogger(__name__)

HELCIM_API_URL = "https://api.helcim.com/v2"


class HelcimService:
    def __init__(self, api_token=""):
        self.api_token = api_token
        if not self.api_token:
            logger.warning("No Helcim API token provided")

    async def initialize_checkout(self, amount: float, currency: str = "CAD", order_id: str = "", terminal_id: str = ""):
        """Initialize a HelcimPay.js checkout session and return checkoutToken + secretToken."""
        if not self.api_token:
            return {"success": False, "error": "Helcim API token not configured"}

        headers = {
            "accept": "application/json",
            "api-token": self.api_token,
            "content-type": "application/json",
        }

        payload = {
            "paymentType": "purchase",
            "amount": round(amount, 2),
            "currency": currency.upper(),
        }

        if terminal_id:
            payload["terminalId"] = int(terminal_id)

        try:
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    f"{HELCIM_API_URL}/helcim-pay/initialize",
                    json=payload,
                    headers=headers,
                    timeout=30.0,
                )

            if response.status_code == 200:
                data = response.json()
                checkout_token = data.get("checkoutToken")
                secret_token = data.get("secretToken")
                if checkout_token:
                    logger.info(f"Helcim checkout initialized for order {order_id}, token={checkout_token[:12]}...")
                    return {
                        "success": True,
                        "checkoutToken": checkout_token,
                        "secretToken": secret_token,
                    }
                return {"success": False, "error": "No checkoutToken in response"}
            else:
                error_text = response.text
                logger.error(f"Helcim init failed ({response.status_code}): {error_text}")
                return {"success": False, "error": f"Helcim API error ({response.status_code}): {error_text}"}

        except httpx.RequestError as e:
            logger.error(f"Helcim request error: {e}")
            return {"success": False, "error": f"Connection error: {str(e)}"}
        except Exception as e:
            logger.error(f"Helcim unexpected error: {e}")
            return {"success": False, "error": str(e)}


def get_helcim_service(helcim_settings=None):
    """Factory to create a HelcimService from settings dict."""
    if not helcim_settings or not helcim_settings.get("enabled"):
        return None
    api_token = helcim_settings.get("api_token", "")
    if not api_token:
        logger.warning("Helcim enabled but no api_token set")
        return None
    return HelcimService(api_token=api_token)
