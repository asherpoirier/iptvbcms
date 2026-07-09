"""GhostSurf VPN Panel Service"""
import logging
import httpx
from typing import Optional, Dict, Any, List

logger = logging.getLogger(__name__)

BASE_URL = "https://ghostsurf.io/api/v1/reseller/api"


class GhostSurfService:
    def __init__(self, api_key: str, panel_url: str = None):
        self.api_key = api_key
        self.base_url = (panel_url.rstrip("/") if panel_url else BASE_URL)
        self.headers = {
            "X-Reseller-Key": api_key,
            "Content-Type": "application/json"
        }

    async def _get(self, path: str, timeout: float = 15.0) -> Dict[str, Any]:
        async with httpx.AsyncClient() as client:
            resp = await client.get(
                f"{self.base_url}{path}",
                headers=self.headers,
                timeout=timeout
            )
            resp.raise_for_status()
            return resp.json()

    async def _post(self, path: str, json_data: dict = None, timeout: float = 15.0) -> Dict[str, Any]:
        async with httpx.AsyncClient() as client:
            resp = await client.post(
                f"{self.base_url}{path}",
                headers=self.headers,
                json=json_data or {},
                timeout=timeout
            )
            resp.raise_for_status()
            return resp.json()

    async def _delete(self, path: str, timeout: float = 15.0) -> Dict[str, Any]:
        async with httpx.AsyncClient() as client:
            resp = await client.delete(
                f"{self.base_url}{path}",
                headers=self.headers,
                timeout=timeout
            )
            resp.raise_for_status()
            return resp.json()

    # ---- Public API methods ----

    async def get_balance(self) -> Dict[str, Any]:
        return await self._get("/balance")

    async def get_plans(self) -> List[Dict[str, Any]]:
        data = await self._get("/plans")
        return data if isinstance(data, list) else data.get("plans", data.get("data", []))

    async def get_servers(self) -> List[Dict[str, Any]]:
        data = await self._get("/servers")
        return data if isinstance(data, list) else data.get("servers", data.get("data", []))

    async def list_accounts(self) -> List[Dict[str, Any]]:
        data = await self._get("/accounts")
        return data if isinstance(data, list) else data.get("accounts", data.get("data", []))

    async def create_account(self, plan_id: str) -> Dict[str, Any]:
        return await self._post("/accounts", {"plan_id": plan_id})

    async def get_account(self, account_id: str) -> Dict[str, Any]:
        return await self._get(f"/accounts/{account_id}")

    async def get_credentials(self, account_id: str) -> Dict[str, Any]:
        return await self._get(f"/accounts/{account_id}/credentials")

    async def renew_account(self, account_id: str) -> Dict[str, Any]:
        return await self._post(f"/accounts/{account_id}/renew")

    async def rotate_password(self, account_id: str) -> Dict[str, Any]:
        return await self._post(f"/accounts/{account_id}/password")

    async def get_config(self, account_id: str, server: str, protocol: str = "wireguard") -> Any:
        async with httpx.AsyncClient() as client:
            resp = await client.get(
                f"{self.base_url}/accounts/{account_id}/config",
                headers=self.headers,
                params={"server": server, "protocol": protocol},
                timeout=15.0
            )
            resp.raise_for_status()
            return resp.text

    async def delete_account(self, account_id: str) -> Dict[str, Any]:
        return await self._delete(f"/accounts/{account_id}")

    async def test_connection(self) -> Dict[str, Any]:
        """Test API connectivity by fetching balance"""
        try:
            balance = await self.get_balance()
            plans = await self.get_plans()
            return {
                "success": True,
                "balance": balance,
                "plans_count": len(plans) if isinstance(plans, list) else 0
            }
        except Exception as e:
            return {"success": False, "error": str(e)}


def get_ghostsurf_service(settings: dict, panel_index: int = 0) -> Optional[GhostSurfService]:
    """Get GhostSurf service from settings"""
    ghostsurf = settings.get("ghostsurf", {})
    panels = ghostsurf.get("panels", [])
    if panel_index >= len(panels):
        return None
    panel = panels[panel_index]
    api_key = panel.get("api_key", "")
    if not api_key:
        return None
    panel_url = panel.get("panel_url", BASE_URL)
    return GhostSurfService(api_key, panel_url)
