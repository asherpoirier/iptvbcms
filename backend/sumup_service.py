"""
SumUp Payment Service — Card Widget Integration
Server-side checkout creation and payment verification.
"""
import httpx
import logging
from typing import Optional, Dict, Any

logger = logging.getLogger(__name__)

SUMUP_API_URL = "https://api.sumup.com"


class SumUpService:
    def __init__(self, api_key: str, merchant_code: str, sandbox: bool = False):
        self.api_key = api_key
        self.merchant_code = merchant_code
        self.sandbox = sandbox
        self.headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        }

    async def create_checkout(
        self,
        amount: float,
        currency: str,
        checkout_reference: str,
        description: str = "",
        return_url: str = "",
        redirect_url: str = "",
    ) -> Dict[str, Any]:
        """Create a SumUp checkout. Returns checkout id for the card widget."""
        payload = {
            "checkout_reference": checkout_reference,
            "amount": round(amount, 2),
            "currency": currency.upper(),
            "merchant_code": self.merchant_code,
        }
        if description:
            payload["description"] = description
        if return_url:
            payload["return_url"] = return_url
        if redirect_url:
            payload["redirect_url"] = redirect_url

        try:
            async with httpx.AsyncClient(timeout=30) as client:
                response = await client.post(
                    f"{SUMUP_API_URL}/v0.1/checkouts",
                    headers=self.headers,
                    json=payload,
                )

                if response.status_code == 201:
                    data = response.json()
                    logger.info(f"SumUp checkout created: {data.get('id')} for ref {checkout_reference}")
                    return {
                        "success": True,
                        "checkout_id": data["id"],
                        "status": data.get("status", "PENDING"),
                        "data": data,
                    }
                elif response.status_code == 409:
                    # Duplicate checkout — return existing
                    data = response.json()
                    logger.warning(f"SumUp duplicate checkout for ref {checkout_reference}: {data}")
                    return {
                        "success": False,
                        "error": data.get("message", "Duplicate checkout"),
                        "error_code": "DUPLICATE",
                    }
                else:
                    data = response.json() if response.headers.get("content-type", "").startswith("application/json") else {}
                    error_msg = data.get("message") or data.get("error_message") or response.text
                    logger.error(f"SumUp create checkout failed ({response.status_code}): {error_msg}")
                    return {
                        "success": False,
                        "error": error_msg,
                        "status_code": response.status_code,
                    }
        except Exception as e:
            logger.error(f"SumUp create checkout exception: {e}")
            return {"success": False, "error": str(e)}

    async def get_checkout(self, checkout_id: str) -> Dict[str, Any]:
        """Retrieve a checkout to verify its status. Always call this to confirm payment."""
        try:
            async with httpx.AsyncClient(timeout=30) as client:
                response = await client.get(
                    f"{SUMUP_API_URL}/v0.1/checkouts/{checkout_id}",
                    headers=self.headers,
                )

                if response.status_code == 200:
                    data = response.json()
                    return {
                        "success": True,
                        "checkout_id": data.get("id"),
                        "status": data.get("status", "UNKNOWN"),
                        "amount": data.get("amount"),
                        "currency": data.get("currency"),
                        "transactions": data.get("transactions", []),
                        "data": data,
                    }
                else:
                    data = response.json() if response.headers.get("content-type", "").startswith("application/json") else {}
                    error_msg = data.get("message") or data.get("detail") or response.text
                    logger.error(f"SumUp get checkout failed ({response.status_code}): {error_msg}")
                    return {"success": False, "error": error_msg}
        except Exception as e:
            logger.error(f"SumUp get checkout exception: {e}")
            return {"success": False, "error": str(e)}

    async def deactivate_checkout(self, checkout_id: str) -> Dict[str, Any]:
        """Deactivate/cancel a pending checkout."""
        try:
            async with httpx.AsyncClient(timeout=30) as client:
                response = await client.delete(
                    f"{SUMUP_API_URL}/v0.1/checkouts/{checkout_id}",
                    headers=self.headers,
                )
                if response.status_code in (200, 204):
                    return {"success": True}
                else:
                    return {"success": False, "error": response.text}
        except Exception as e:
            return {"success": False, "error": str(e)}


def get_sumup_service(settings: dict) -> Optional[SumUpService]:
    """Create SumUp service from settings. Returns None if not configured."""
    sumup_settings = settings.get("sumup", {})
    if not sumup_settings.get("enabled"):
        return None

    api_key = sumup_settings.get("api_key", "")
    merchant_code = sumup_settings.get("merchant_code", "")

    if not api_key or not merchant_code:
        return None

    return SumUpService(
        api_key=api_key,
        merchant_code=merchant_code,
        sandbox=sumup_settings.get("sandbox", False),
    )
