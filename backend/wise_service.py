"""
Wise (TransferWise) Payment Integration Service
Uses the Wise Business API for monitoring incoming payments
"""
import logging
import requests
from typing import Dict, Any, Optional
from datetime import datetime

logger = logging.getLogger(__name__)


class WiseService:
    """Wise Business API Service for payment monitoring"""

    BASE_URL = "https://api.wise.com"
    SANDBOX_URL = "https://api.sandbox.wise.com"

    def __init__(self, api_token: str, profile_id: str = "", sandbox: bool = False):
        self.api_token = api_token.strip()
        self.profile_id = profile_id.strip()
        self.base_url = self.SANDBOX_URL if sandbox else self.BASE_URL
        self.session = requests.Session()
        self.session.headers.update({
            "Authorization": f"Bearer {self.api_token}",
            "Content-Type": "application/json",
        })

    def test_connection(self) -> Dict[str, Any]:
        """Test API connection by fetching profiles"""
        try:
            resp = self.session.get(f"{self.base_url}/v2/profiles", timeout=15)
            if resp.status_code == 200:
                profiles = resp.json()
                if profiles:
                    return {"success": True, "profiles": [{"id": p["id"], "type": p["type"]} for p in profiles]}
            return {"success": False, "error": f"HTTP {resp.status_code}"}
        except Exception as e:
            return {"success": False, "error": str(e)}

    def get_balance(self) -> Dict[str, Any]:
        """Get account balances"""
        try:
            resp = self.session.get(
                f"{self.base_url}/v4/profiles/{self.profile_id}/balances?types=STANDARD",
                timeout=15
            )
            if resp.status_code == 200:
                balances = resp.json()
                return {"success": True, "balances": balances}
            return {"success": False, "error": f"HTTP {resp.status_code}"}
        except Exception as e:
            return {"success": False, "error": str(e)}

    def get_recent_transactions(self, currency: str = "USD", limit: int = 20) -> Dict[str, Any]:
        """Get recent transactions to check for incoming payments"""
        try:
            # Find the balance ID for the currency
            balances = self.get_balance()
            if not balances.get("success"):
                return balances

            balance_id = None
            for b in balances.get("balances", []):
                if b.get("currency") == currency:
                    balance_id = b.get("id")
                    break

            if not balance_id:
                return {"success": False, "error": f"No {currency} balance found"}

            resp = self.session.get(
                f"{self.base_url}/v1/profiles/{self.profile_id}/balance-statements/{balance_id}/statement",
                params={"intervalStart": "", "intervalEnd": "", "type": "FLAT"},
                timeout=15
            )
            if resp.status_code == 200:
                data = resp.json()
                return {"success": True, "transactions": data.get("transactions", [])}
            return {"success": False, "error": f"HTTP {resp.status_code}"}
        except Exception as e:
            return {"success": False, "error": str(e)}


def get_wise_service(wise_settings: Dict[str, Any]) -> Optional[WiseService]:
    """Create WiseService from settings"""
    if not wise_settings or not wise_settings.get("enabled"):
        return None
    api_token = wise_settings.get("api_token", "")
    profile_id = wise_settings.get("profile_id", "")
    if not api_token:
        return None
    return WiseService(api_token=api_token, profile_id=profile_id)
