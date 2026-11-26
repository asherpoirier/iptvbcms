"""
Ghost Panel Integration Service
Reseller API at {panel_url}/reseller_api.php?api_key=KEY&action=...
Clean JSON responses with result/message/data format.
Supports: list users/packages/bouquets, create/extend/delete/suspend/unsuspend users,
bouquet management, GhostAPK integration, sub-reseller management.
"""
import logging
import httpx
from datetime import datetime
from typing import Dict, Any, Optional, List
from urllib.parse import urlparse

logger = logging.getLogger(__name__)


class GhostPanelError(Exception):
    def __init__(self, message: str, code: str = "api_error"):
        super().__init__(message)
        self.message = message
        self.code = code


class GhostPanelService:
    def __init__(self, panel_url: str, api_key: str, name: str = "", streaming_url: str = "", ssl_verify: bool = True):
        url = panel_url.strip().rstrip("/")
        if not url.startswith("http"):
            url = f"https://{url}"
        # Normalize — strip trailing /reseller_api.php if user pasted the full endpoint
        if url.endswith("/reseller_api.php"):
            url = url[: -len("/reseller_api.php")]
        self.origin = url
        self.api_url = f"{url}/reseller_api.php"
        self.api_key = api_key.strip()
        self.name = name
        self.streaming_url = streaming_url.strip().rstrip("/") if streaming_url else ""
        self.ssl_verify = ssl_verify

    # ---- transport ----

    async def _get(self, action: str, **params) -> dict:
        """GET request to the Ghost Panel API."""
        query = {"api_key": self.api_key, "action": action}
        query.update({k: v for k, v in params.items() if v not in (None, "")})
        logger.info(f"GhostPanel GET {action} params={list(params.keys())}")
        try:
            async with httpx.AsyncClient(verify=self.ssl_verify, timeout=30.0) as client:
                resp = await client.get(self.api_url, params=query)
        except httpx.RequestError as e:
            raise GhostPanelError(f"Cannot reach panel: {e}", "connection_error")
        return self._parse_response(resp, action)

    async def _post(self, action: str, **params) -> dict:
        """POST request to the Ghost Panel API."""
        data = {"api_key": self.api_key, "action": action}
        data.update({k: v for k, v in params.items() if v not in (None, "")})
        logger.info(f"GhostPanel POST {action} params={list(params.keys())}")
        try:
            async with httpx.AsyncClient(verify=self.ssl_verify, timeout=30.0) as client:
                resp = await client.post(self.api_url, data=data)
        except httpx.RequestError as e:
            raise GhostPanelError(f"Cannot reach panel: {e}", "connection_error")
        return self._parse_response(resp, action)

    def _parse_response(self, resp, action: str) -> dict:
        """Parse and validate API response."""
        if resp.status_code == 401:
            raise GhostPanelError("Invalid or missing API key", "invalid_key")
        if resp.status_code == 403:
            raise GhostPanelError("API key disabled or permission denied", "permission_denied")
        if resp.status_code == 404:
            raise GhostPanelError("Resource not found", "not_found")
        try:
            body = resp.json()
        except ValueError:
            raise GhostPanelError(f"Non-JSON response: {resp.text[:200]}", "bad_response")
        if not isinstance(body, dict):
            raise GhostPanelError("Unexpected response shape", "bad_response")
        if body.get("result") is False:
            msg = body.get("message", "Request failed")
            code = "invalid_key" if "api key" in msg.lower() else (
                "not_found" if "not found" in msg.lower() else (
                    "insufficient_credits" if "insufficient" in msg.lower() else (
                        "permission_denied" if "permission" in msg.lower() else "api_error"
                    )
                )
            )
            raise GhostPanelError(msg, code)
        return body

    # ---- Account ----

    async def account_info(self) -> dict:
        """Get reseller account summary."""
        result = await self._get("account_info")
        return result.get("data", {})

    async def test_connection(self) -> dict:
        """Test API key and return account info."""
        try:
            info = await self.account_info()
            return {
                "success": True,
                "username": info.get("username", ""),
                "credits": info.get("credits", 0),
                "user_count": info.get("user_count", 0),
                "sub_reseller_count": info.get("sub_reseller_count", 0),
            }
        except GhostPanelError as e:
            return {"success": False, "error": e.message, "code": e.code}
        except Exception as e:
            return {"success": False, "error": str(e)}

    # ---- Packages ----

    async def list_packages(self, trial: bool = False) -> List[dict]:
        """Get all available packages."""
        params = {}
        if trial:
            params["trial"] = 1
        result = await self._get("list_packages", **params)
        return result.get("data", {}).get("packages", [])

    # ---- Bouquets ----

    async def list_bouquets(self) -> List[dict]:
        """Get all available bouquets."""
        result = await self._get("list_bouquets")
        return result.get("data", {}).get("bouquets", [])

    async def get_user_bouquets(self, username: str = None, user_id: int = None) -> dict:
        """Get a user's current bouquet assignments."""
        params = {}
        if username:
            params["username"] = username
        if user_id:
            params["user_id"] = user_id
        result = await self._get("get_user_bouquets", **params)
        return result.get("data", {})

    async def update_user_bouquets(self, bouquet_ids: list, username: str = None, user_id: int = None) -> dict:
        """Set a user's bouquet assignments (replaces all current)."""
        import json
        params = {"bouquet_ids": json.dumps(bouquet_ids)}
        if username:
            params["username"] = username
        if user_id:
            params["user_id"] = user_id
        result = await self._post("update_user_bouquets", **params)
        return result.get("data", {})

    # ---- Users ----

    async def list_users(self, search: str = None, limit: int = 500, offset: int = 0) -> dict:
        """List all users with optional search and pagination."""
        params = {"limit": limit, "offset": offset}
        if search:
            params["search"] = search
        result = await self._get("list_users", **params)
        return result.get("data", {})

    async def user_stats(self, username: str = None, user_id: int = None) -> dict:
        """Get detailed info about a specific user."""
        params = {}
        if username:
            params["username"] = username
        if user_id:
            params["user_id"] = user_id
        result = await self._get("user_stats", **params)
        return result.get("data", {})

    async def create_user(self, package_id: int, username: str = None, password: str = None,
                          bouquets: list = None, allowed_outputs: list = None) -> dict:
        """Create a new IPTV user.
        allowed_outputs: list of output IDs to enable (1=HLS, 2=MPEGTS, 3=RTMP).
                         Defaults to [1,2,3] (all enabled) if not specified.
        """
        import json
        params = {"package_id": package_id}
        if username:
            params["username"] = username
        if password:
            params["password"] = password
        if bouquets:
            params["bouquets"] = json.dumps(bouquets)
        # Send access outputs — default to all enabled (HLS, MPEGTS, RTMP)
        outputs = allowed_outputs if allowed_outputs is not None else [1, 2, 3]
        params["allowed_outputs"] = json.dumps(outputs)
        # Also send individual flags for maximum compatibility with XtreamUI-based panels
        params["is_e2"] = 1       # Enable Enigma2/MPEGTS output
        params["is_mag"] = 1      # Enable MAG/MPEGTS output
        params["is_restreamer"] = 1  # Enable restreamer/HLS output
        result = await self._post("create_user", **params)
        return result.get("data", {})

    async def extend_user(self, package_id: int, username: str = None, user_id: int = None) -> dict:
        """Extend a user's subscription."""
        params = {"package_id": package_id}
        if username:
            params["username"] = username
        if user_id:
            params["user_id"] = user_id
        result = await self._post("extend_user", **params)
        return result.get("data", {})

    async def delete_user(self, username: str = None, user_id: int = None) -> dict:
        """Delete a user (credits refunded for remaining time)."""
        params = {}
        if username:
            params["username"] = username
        if user_id:
            params["user_id"] = user_id
        result = await self._post("delete_user", **params)
        return result.get("data", {})

    async def suspend_user(self, username: str = None, user_id: int = None) -> dict:
        """Suspend/disable a user account."""
        params = {}
        if username:
            params["username"] = username
        if user_id:
            params["user_id"] = user_id
        result = await self._post("suspend_user", **params)
        return result.get("data", {})

    async def unsuspend_user(self, username: str = None, user_id: int = None) -> dict:
        """Unsuspend/re-enable a user account."""
        params = {}
        if username:
            params["username"] = username
        if user_id:
            params["user_id"] = user_id
        result = await self._post("unsuspend_user", **params)
        return result.get("data", {})

    # ---- GhostAPK ----

    async def ghostapk_create_user(self, username: str = None, user_id: int = None) -> dict:
        """Create GhostAPK user and generate login code."""
        params = {}
        if username:
            params["username"] = username
        if user_id:
            params["user_id"] = user_id
        result = await self._post("ghostapk_create_user", **params)
        return result.get("data", {})

    async def ghostapk_get_code(self, username: str = None, user_id: int = None) -> dict:
        """Get existing GhostAPK login code."""
        params = {}
        if username:
            params["username"] = username
        if user_id:
            params["user_id"] = user_id
        result = await self._get("ghostapk_get_code", **params)
        return result.get("data", {})

    async def ghostapk_regenerate_code(self, username: str = None, user_id: int = None) -> dict:
        """Regenerate GhostAPK login code."""
        params = {}
        if username:
            params["username"] = username
        if user_id:
            params["user_id"] = user_id
        result = await self._post("ghostapk_regenerate_code", **params)
        return result.get("data", {})

    # ---- Sub-Resellers ----

    async def create_subreseller(self, username: str, password: str = None, credits: float = None) -> dict:
        """Create a sub-reseller account."""
        params = {"username": username}
        if password:
            params["password"] = password
        if credits is not None:
            params["credits"] = credits
        result = await self._post("create_subreseller", **params)
        return result.get("data", {})

    async def add_credits(self, credits: float, reseller_id: int = None, reseller_username: str = None) -> dict:
        """Add credits to a sub-reseller."""
        params = {"credits": credits}
        if reseller_id:
            params["reseller_id"] = reseller_id
        if reseller_username:
            params["reseller_username"] = reseller_username
        result = await self._post("add_credits", **params)
        return result.get("data", {})

    # ---- Sync helper ----

    async def sync_all_users(self) -> List[dict]:
        """Fetch all users with pagination for import/sync."""
        all_users = []
        offset = 0
        limit = 500
        while True:
            data = await self.list_users(limit=limit, offset=offset)
            users = data.get("users", [])
            all_users.extend(users)
            total = data.get("total", 0)
            if offset + limit >= total or not users:
                break
            offset += limit
        return all_users

    def normalize_user(self, user: dict, panel_name: str = "") -> dict:
        """Normalize a Ghost Panel user record for the billing system."""
        expiry_ts = user.get("expiry_ts")
        expiry_dt = None
        if expiry_ts and expiry_ts < 9999999990:
            expiry_dt = datetime.utcfromtimestamp(expiry_ts)
        elif user.get("expiry"):
            try:
                expiry_dt = datetime.strptime(user["expiry"], "%Y-%m-%d %H:%M:%S")
            except (ValueError, TypeError):
                pass

        is_expired = user.get("is_expired", False)
        if expiry_dt and not is_expired:
            is_expired = expiry_dt < datetime.utcnow()

        enabled = user.get("enabled", 1)
        if enabled == 1 and not is_expired:
            status = "active"
        elif enabled == 0:
            status = "suspended"
        else:
            status = "expired"

        return {
            "panel_user_id": user.get("id"),
            "username": user.get("username", ""),
            "password": user.get("password", ""),
            "expiry": expiry_dt.isoformat() if expiry_dt else None,
            "expiry_ts": expiry_ts,
            "max_connections": user.get("max_connections", 1),
            "is_trial": user.get("is_trial", 0) == 1,
            "enabled": enabled == 1,
            "status": status,
            "panel_type": "ghostpanel",
            "panel_name": panel_name or self.name,
            "streaming_url": self.streaming_url or self.origin,
            "created_at": user.get("created_at"),
        }


def get_ghostpanel_service(panel_config: dict) -> Optional[GhostPanelService]:
    """Create a GhostPanelService from a panel config dict."""
    url = panel_config.get("url", "").strip()
    api_key = panel_config.get("api_key", "").strip()
    if not url or not api_key:
        return None
    return GhostPanelService(
        panel_url=url,
        api_key=api_key,
        name=panel_config.get("name", ""),
        streaming_url=panel_config.get("streaming_url", ""),
        ssl_verify=panel_config.get("ssl_verify", True),
    )
