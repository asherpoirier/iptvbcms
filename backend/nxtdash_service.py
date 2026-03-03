"""
NXT Dash Panel Integration Service
API reverse-engineered from WHMCS module (NXTAllwebcreation).
Base URL: https://{dns}/api/wclient/v1/
Auth: Bearer token + username/password headers.
"""
import logging
import httpx
from typing import Dict, Any, List, Optional

logger = logging.getLogger(__name__)


class NxtDashService:
    """NXT Dash Panel API Service"""

    def __init__(self, panel_url: str, token: str, username: str, password: str,
                 name: str = "", portal_url: str = ""):
        self.panel_url = panel_url.strip().rstrip("/")
        # Ensure https:// prefix
        if not self.panel_url.startswith("http"):
            self.panel_url = f"https://{self.panel_url}"
        self.token = token.strip()
        self.username = username.strip()
        self.password = password.strip()
        self.name = name
        self.portal_url = portal_url.strip().rstrip("/") if portal_url else ""
        self.headers = {
            "Content-Type": "application/json",
            "Accept": "application/json",
            "Authorization": f"Bearer {self.token}",
            "username": self.username,
            "password": self.password,
        }

    def _url(self, path: str) -> str:
        return f"{self.panel_url}/api/wclient/v1{path}"

    async def _request(self, method: str, path: str, json_data: dict = None, params: dict = None) -> Dict[str, Any]:
        """Make an async API request."""
        url = self._url(path)
        try:
            logger.info(f"NxtDash API {method} {url}")
            async with httpx.AsyncClient(verify=False, timeout=30.0) as client:
                resp = await client.request(method, url, headers=self.headers, json=json_data, params=params)

            if resp.status_code == 200:
                data = resp.json()
                logger.info(f"NxtDash response: {str(data)[:300]}")
                return data
            else:
                text = resp.text[:500]
                logger.error(f"NxtDash API error ({resp.status_code}): {text}")
                return {"result": False, "message": f"HTTP {resp.status_code}: {text}"}
        except httpx.RequestError as e:
            logger.error(f"NxtDash connection error: {e}")
            return {"result": False, "message": f"Connection error: {str(e)}"}
        except Exception as e:
            logger.error(f"NxtDash unexpected error: {e}")
            return {"result": False, "message": str(e)}

    # ---- Core API Methods ----

    async def test_connection(self) -> Dict[str, Any]:
        """Test connection and get account info (credits etc)."""
        data = await self._request("GET", "/account-info")
        if data.get("result") is False:
            return {"success": False, "error": data.get("message", "Connection failed")}
        return {"success": True, "data": data}

    async def get_packages(self, trial: bool = False) -> Dict[str, Any]:
        """Get available packages. trial=True for trial packages."""
        suffix = "/1" if trial else "/0"
        data = await self._request("GET", f"/packages{suffix}")
        if isinstance(data, dict) and data.get("result") is False:
            return {"success": False, "error": data.get("message", "Failed to get packages"), "packages": []}
        # NXT Dash returns packages as a dict keyed by ID, convert to list
        if isinstance(data, dict):
            packages = list(data.values()) if data else []
        elif isinstance(data, list):
            packages = data
        else:
            packages = []
        return {"success": True, "packages": packages}

    async def get_lines(self, line_username: str = "", line_password: str = "", page: int = 0) -> Dict[str, Any]:
        """Get lines. If username/password given, search specific line. Otherwise get all (paginated)."""
        if line_username:
            data = await self._request("GET", "/lines", params={"username": line_username, "password": line_password})
        elif page > 0:
            data = await self._request("GET", "/lines", params={"page": page})
        else:
            data = await self._request("GET", "/lines")
        if isinstance(data, dict) and data.get("result") is False:
            return {"success": False, "error": data.get("message", "Failed"), "lines": []}
        # Paginated response
        if isinstance(data, dict) and "data" in data:
            return {
                "success": True,
                "lines": data.get("data", []),
                "current_page": data.get("current_page", 1),
                "last_page": data.get("last_page", 1),
                "total": data.get("total", 0),
            }
        return {"success": True, "lines": data if isinstance(data, list) else []}

    async def create_line(self, username: str, password: str, package_id: int,
                          description: str = "", is_trial: bool = False,
                          bouquets: list = None) -> Dict[str, Any]:
        """Create a new subscriber line with optional bouquet selection."""
        path = "/create-line/1" if is_trial else "/create-line"
        payload = {
            "line_type": "line",
            "package": package_id,
            "username": username,
            "password": password,
            "description": description,
        }
        if bouquets is not None:
            payload["bouquet"] = bouquets
        data = await self._request("POST", path, json_data=payload)
        if data.get("result") in [1, True, "1"]:
            line_id = data.get("id", "")
            # If bouquets specified and line created, update bouquets explicitly
            if bouquets is not None and line_id:
                await self.update_line_bouquets(str(line_id), bouquets)
            return {
                "success": True,
                "username": data.get("username", username),
                "password": data.get("password", password),
                "expire_date": data.get("expire_date"),
                "line_id": line_id,
            }
        error = data.get("message", "Failed to create line")
        if isinstance(error, dict) and "username" in error:
            error = error["username"][0] if isinstance(error["username"], list) else str(error)
        return {"success": False, "error": str(error)}

    async def update_line_bouquets(self, line_id: str, bouquets: list) -> Dict[str, Any]:
        """Update a line's bouquets to only include the specified ones."""
        data = await self._request("POST", f"/edit-line/{line_id}", json_data={"bouquet": bouquets})
        if data.get("result") in [1, True, "1"]:
            logger.info(f"NXT Dash bouquets updated for line {line_id}: {len(bouquets)} bouquets")
            return {"success": True}
        logger.warning(f"NXT Dash bouquet update failed for line {line_id}: {data}")
        return {"success": False, "error": str(data.get("message", "Failed"))}

    async def extend_line(self, line_id: str, package_id: int) -> Dict[str, Any]:
        """Extend/renew a subscriber line."""
        data = await self._request("POST", f"/extend/{line_id}", json_data={"package": package_id})
        if data.get("result") in [1, True, "1"]:
            return {
                "success": True,
                "expire_date": data.get("expire_date"),
            }
        return {"success": False, "error": data.get("message", "Failed to extend line")}

    async def enable_line(self, line_id: str) -> Dict[str, Any]:
        """Enable (unsuspend) or toggle a line."""
        data = await self._request("POST", f"/enable/{line_id}")
        if data.get("result") in [1, True, "1"]:
            return {"success": True}
        return {"success": False, "error": data.get("message", "Failed to enable line")}

    async def get_line_id(self, line_username: str, line_password: str) -> Optional[str]:
        """Helper: get the line ID for a subscriber by username."""
        result = await self.get_lines(line_username, line_password)
        if result.get("success") and result.get("lines"):
            return str(result["lines"][0].get("id", ""))
        return None


def get_nxtdash_service(panel_settings: dict) -> Optional[NxtDashService]:
    """Factory: create NxtDashService from panel config dict."""
    if not panel_settings:
        return None
    panel_url = panel_settings.get("panel_url", "")
    token = panel_settings.get("token", "")
    username = panel_settings.get("username", "")
    password = panel_settings.get("password", "")
    if not panel_url or not token or not username or not password:
        logger.warning("NxtDash: missing panel_url, token, username, or password")
        return None
    return NxtDashService(
        panel_url=panel_url,
        token=token,
        username=username,
        password=password,
        name=panel_settings.get("name", ""),
        portal_url=panel_settings.get("portal_url", ""),
    )
