import httpx
import logging
import os
from datetime import datetime

logger = logging.getLogger(__name__)

class BlockonomicsService:
    """Blockonomics Bitcoin payment processing service"""
    
    def __init__(self, api_key=None, callback_url=None):
        self.api_key = api_key or os.getenv("BLOCKONOMICS_API_KEY", "")
        self.callback_url = callback_url
        self.base_url = "https://www.blockonomics.co/api"
        self.headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json"
        }
    
    async def get_new_address(self, reset: int = 0) -> dict:
        """
        Request a new Bitcoin payment address from Blockonomics.
        Each address is unique per payment for better tracking.
        
        Args:
            reset: Set to 1 to get a fresh address even if previous one wasn't used
        """
        if not self.api_key:
            return {"success": False, "error": "Blockonomics API key not configured"}
        
        try:
            url = f"{self.base_url}/new_address"
            params = {}
            
            # Add callback URL if configured (required to match a store)
            if self.callback_url:
                params["match_callback"] = self.callback_url
            
            if reset:
                params["reset"] = 1
            
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    url, 
                    headers=self.headers, 
                    params=params,
                    timeout=30.0
                )
                
                # Check for error in response
                if response.status_code != 200:
                    error_data = response.json()
                    error_msg = error_data.get("error", {}).get("message", "Unknown error")
                    logger.error(f"Blockonomics address error: {error_msg}")
                    return {"success": False, "error": error_msg}
                
                data = response.json()
                
                if "address" in data:
                    logger.info(f"New Bitcoin address generated: {data['address']}")
                    return {"success": True, "address": data["address"]}
                else:
                    logger.error(f"Blockonomics address error: {data}")
                    return {"success": False, "error": data.get("message", "Failed to generate address")}
                    
        except httpx.HTTPStatusError as e:
            logger.error(f"Blockonomics HTTP error: {e.response.status_code} - {e.response.text}")
            return {"success": False, "error": f"HTTP error: {e.response.status_code}"}
        except Exception as e:
            logger.error(f"Blockonomics address generation error: {e}")
            return {"success": False, "error": str(e)}
    
    async def get_btc_price(self, currency: str = "USD") -> dict:
        """
        Fetch the current Bitcoin price from Blockonomics.
        """
        try:
            url = f"{self.base_url}/price"
            params = {"currency": currency}
            async with httpx.AsyncClient() as client:
                response = await client.get(url, params=params, timeout=10.0)
                response.raise_for_status()
                data = response.json()
                
                price = float(data.get("price", 0))
                logger.info(f"BTC price fetched: {price} {currency}")
                return {"success": True, "price": price, "currency": currency}
                
        except Exception as e:
            logger.error(f"Blockonomics price fetch error: {e}")
            return {"success": False, "error": str(e), "price": 0}
    
    async def get_address_balance(self, address: str) -> dict:
        """
        Check the balance/status of a Bitcoin address.
        Returns confirmed and unconfirmed balances in satoshis.
        """
        try:
            url = f"{self.base_url}/balance"
            params = {"addr": address}
            async with httpx.AsyncClient() as client:
                response = await client.get(url, headers=self.headers, params=params, timeout=10.0)
                response.raise_for_status()
                data = response.json()
                
                # Response contains array of address balances
                if "response" in data and len(data["response"]) > 0:
                    addr_data = data["response"][0]
                    return {
                        "success": True,
                        "address": addr_data.get("addr"),
                        "confirmed": addr_data.get("confirmed", 0),
                        "unconfirmed": addr_data.get("unconfirmed", 0)
                    }
                return {"success": True, "confirmed": 0, "unconfirmed": 0}
                
        except Exception as e:
            logger.error(f"Blockonomics balance check error: {e}")
            return {"success": False, "error": str(e)}
    
    async def get_address_history(self, address: str) -> dict:
        """
        Get transaction history for a Bitcoin address.
        Returns list of transactions with their status.
        """
        try:
            url = f"{self.base_url}/searchhistory"
            params = {"addr": address}
            async with httpx.AsyncClient() as client:
                response = await client.get(url, headers=self.headers, params=params, timeout=10.0)
                response.raise_for_status()
                data = response.json()
                
                transactions = []
                if "history" in data:
                    for tx in data["history"]:
                        transactions.append({
                            "txid": tx.get("txid"),
                            "value": tx.get("value", 0),  # Value in satoshis
                            "time": tx.get("time"),
                            "status": "confirmed" if tx.get("status", 0) >= 1 else "unconfirmed"
                        })
                
                return {"success": True, "transactions": transactions}
                
        except Exception as e:
            logger.error(f"Blockonomics history fetch error: {e}")
            return {"success": False, "error": str(e), "transactions": []}
    
    def convert_usd_to_satoshis(self, usd_amount: float, btc_price: float) -> int:
        """
        Convert USD amount to satoshis.
        1 BTC = 100,000,000 satoshis
        """
        if btc_price <= 0:
            return 0
        btc_amount = usd_amount / btc_price
        satoshis = int(btc_amount * 100_000_000)
        return satoshis
    
    def convert_satoshis_to_btc(self, satoshis: int) -> float:
        """Convert satoshis to BTC"""
        return satoshis / 100_000_000
    
    def verify_webhook_signature(self, secret: str, payload: bytes, signature: str) -> bool:
        """
        Verify Blockonomics webhook signature.
        Note: Blockonomics uses a simple secret matching for webhooks.
        """
        import hmac
        import hashlib
        
        if not secret:
            return True  # No secret configured, skip verification
        
        expected = hmac.new(
            secret.encode(),
            payload,
            hashlib.sha256
        ).hexdigest()
        
        return hmac.compare_digest(signature, expected)


def get_blockonomics_service(blockonomics_settings=None, callback_url=None):
    """Get Blockonomics service instance"""
    if not blockonomics_settings or not blockonomics_settings.get("enabled"):
        return None
    
    return BlockonomicsService(
        api_key=blockonomics_settings.get("api_key"),
        callback_url=callback_url
    )
