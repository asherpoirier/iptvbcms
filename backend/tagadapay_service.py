"""TagadaPay Payment Gateway Service"""
import logging
import httpx
from typing import Optional, Dict, Any

logger = logging.getLogger(__name__)

BASE_URL = "https://api.tagadapay.io"


class TagadaPayService:
    def __init__(self, api_key: str, store_id: str):
        self.api_key = api_key
        self.store_id = store_id
        self.headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json"
        }
    
    async def create_payment_instrument(self, tagada_token: str, customer_email: str,
                                         first_name: str = "", last_name: str = "") -> Dict[str, Any]:
        """Exchange a browser tagadaToken for a reusable paymentInstrumentId"""
        try:
            async with httpx.AsyncClient() as client:
                resp = await client.post(
                    f"{BASE_URL}/api/public/v1/payment-instruments/create-from-token",
                    headers=self.headers,
                    json={
                        "tagadaToken": tagada_token,
                        "storeId": self.store_id,
                        "customerData": {
                            "email": customer_email,
                            "firstName": first_name or "Customer",
                            "lastName": last_name or ""
                        }
                    },
                    timeout=15.0
                )
                if resp.status_code in (200, 201):
                    data = resp.json()
                    return {
                        "success": True,
                        "payment_instrument_id": data.get("paymentInstrument", {}).get("id"),
                        "customer_id": data.get("customer", {}).get("id"),
                        "data": data
                    }
                else:
                    logger.error(f"TagadaPay create instrument error: {resp.status_code} {resp.text}")
                    return {"success": False, "error": resp.json().get("error", {}).get("message", f"HTTP {resp.status_code}")}
        except Exception as e:
            logger.error(f"TagadaPay create instrument exception: {e}")
            return {"success": False, "error": str(e)}
    
    async def create_3ds_session(self, payment_instrument_id: str, session_data: dict = None) -> Dict[str, Any]:
        """Create a 3DS session for SCA"""
        try:
            async with httpx.AsyncClient() as client:
                payload = {
                    "provider": "basis_theory",
                    "storeId": self.store_id,
                    "paymentInstrumentId": payment_instrument_id,
                }
                if session_data:
                    payload["sessionData"] = session_data
                
                resp = await client.post(
                    f"{BASE_URL}/api/public/v1/threeds/create-session",
                    headers=self.headers,
                    json=payload,
                    timeout=15.0
                )
                if resp.status_code in (200, 201):
                    data = resp.json()
                    return {"success": True, "threeds_session_id": data.get("id"), "data": data}
                else:
                    logger.warning(f"TagadaPay 3DS session error: {resp.status_code} {resp.text}")
                    return {"success": False, "error": resp.json().get("error", {}).get("message", "")}
        except Exception as e:
            logger.error(f"TagadaPay 3DS exception: {e}")
            return {"success": False, "error": str(e)}
    
    async def process_payment(self, payment_instrument_id: str, customer_id: str,
                               amount: int, currency: str = "USD",
                               threeds_session_id: str = None,
                               return_url: str = "", metadata: dict = None) -> Dict[str, Any]:
        """Process a card payment"""
        try:
            payload = {
                "paymentInstrumentId": payment_instrument_id,
                "customerId": customer_id,
                "storeId": self.store_id,
                "amount": amount,  # in cents
                "currency": currency.upper(),
                "paymentMethod": "card",
                "mode": "purchase",
            }
            if threeds_session_id:
                payload["threedsSessionId"] = threeds_session_id
            if return_url:
                payload["returnUrl"] = return_url
            if metadata:
                payload["metadata"] = metadata
            
            async with httpx.AsyncClient() as client:
                resp = await client.post(
                    f"{BASE_URL}/api/public/v1/payments/process",
                    headers=self.headers,
                    json=payload,
                    timeout=30.0
                )
                if resp.status_code in (200, 201):
                    data = resp.json()
                    payment = data.get("payment", data)
                    status = payment.get("status", "unknown")
                    result = {
                        "success": status in ("succeeded", "paid", "authorized"),
                        "status": status,
                        "payment_id": payment.get("id"),
                        "data": data
                    }
                    if payment.get("requireAction") == "redirect":
                        result["requires_redirect"] = True
                        result["redirect_url"] = payment.get("requireActionData", {}).get("redirectUrl", "")
                    return result
                else:
                    error_data = resp.json()
                    logger.error(f"TagadaPay process error: {resp.status_code} {resp.text}")
                    return {"success": False, "error": error_data.get("error", {}).get("message", f"Payment failed ({resp.status_code})")}
        except Exception as e:
            logger.error(f"TagadaPay process exception: {e}")
            return {"success": False, "error": str(e)}
    
    async def get_payment(self, payment_id: str) -> Dict[str, Any]:
        """Get payment status"""
        try:
            async with httpx.AsyncClient() as client:
                resp = await client.get(
                    f"{BASE_URL}/api/public/v1/payments/{payment_id}",
                    headers=self.headers,
                    timeout=10.0
                )
                if resp.status_code == 200:
                    data = resp.json()
                    return {"success": True, "status": data.get("status"), "data": data}
                return {"success": False, "error": f"HTTP {resp.status_code}"}
        except Exception as e:
            logger.error(f"TagadaPay get payment exception: {e}")
            return {"success": False, "error": str(e)}


def get_tagadapay_service(settings: dict) -> Optional[TagadaPayService]:
    """Get TagadaPay service from settings"""
    tagada = settings.get("tagadapay", {})
    api_key = tagada.get("api_key", "")
    store_id = tagada.get("store_id", "")
    if not api_key or not store_id or not tagada.get("enabled"):
        return None
    return TagadaPayService(api_key, store_id)
