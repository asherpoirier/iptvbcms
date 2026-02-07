"""
1-Stream Panel Integration Service
Uses the B2B Billing API (JSON REST)
Docs: https://billing.1-stream.com/whmcs/index.php/knowledgebase/23/B2B-Billing-API.html
"""
import logging
import requests
from typing import Dict, Any, List, Optional
from datetime import datetime, timedelta
import uuid

logger = logging.getLogger(__name__)


class OneStreamService:
    """1-Stream Panel API Service"""

    def __init__(self, panel_url: str, api_key: str, auth_user_token: str, name: str = "", ssl_verify: bool = False):
        self.panel_url = panel_url.rstrip("/")
        self.api_key = api_key
        self.auth_user_token = auth_user_token
        self.name = name
        self.ssl_verify = ssl_verify
        self.session = requests.Session()
        self.session.verify = ssl_verify
        self.session.headers.update({
            "Content-Type": "application/json",
            "Accept": "application/json",
            "X-Api-Key": self.api_key,
            "X-Auth-User": self.auth_user_token,
        })

    def _url(self, path: str) -> str:
        return f"{self.panel_url}{path}"

    def _request(self, method: str, path: str, json_data: dict = None, params: dict = None) -> Dict[str, Any]:
        """Make an API request and return parsed JSON."""
        try:
            url = self._url(path)
            logger.info(f"1-Stream API {method} {url}")
            resp = self.session.request(method, url, json=json_data, params=params, timeout=30)
            resp.raise_for_status()
            return resp.json()
        except requests.exceptions.HTTPError as e:
            body = {}
            try:
                body = e.response.json()
            except Exception:
                pass
            error_msg = body.get("error", str(e))
            logger.error(f"1-Stream API error ({method} {path}): {error_msg}")
            return {"error": error_msg}
        except Exception as e:
            logger.error(f"1-Stream request failed ({method} {path}): {e}")
            return {"error": str(e)}

    # ---- Profile ----
    def get_profile(self) -> Dict[str, Any]:
        return self._request("GET", "/ext/profile")

    # ---- Test Connection ----
    def test_connection(self) -> Dict[str, Any]:
        result = self.get_profile()
        if "error" in result:
            return {"success": False, "error": result["error"]}
        return {
            "success": True,
            "name": result.get("name", "Unknown"),
            "credits": result.get("credits", 0),
        }

    # ---- Packages ----
    def get_packages(self) -> Dict[str, Any]:
        data = self._request("GET", "/ext/packages")
        if isinstance(data, dict) and "error" in data:
            return {"success": False, "error": data["error"], "packages": []}

        packages = []
        trial_packages = []
        if isinstance(data, list):
            for pkg in data:
                duration_hours = pkg.get("duration_hours", 0) or 0
                # Convert hours to a human-readable duration
                if duration_hours >= 720:
                    duration = duration_hours // 720
                    duration_unit = "months"
                elif duration_hours >= 24:
                    duration = duration_hours // 24
                    duration_unit = "days"
                else:
                    duration = duration_hours
                    duration_unit = "hours"

                parsed = {
                    "id": pkg.get("id"),
                    "name": pkg.get("name", ""),
                    "description": pkg.get("description", ""),
                    "credits": pkg.get("price_credits", 0),
                    "duration": duration,
                    "duration_hours": duration_hours,
                    "duration_unit": duration_unit,
                    "max_connections": pkg.get("max_connections", 1),
                    "package_type": pkg.get("package_type", "all"),
                    "bouquets": pkg.get("bouquets", []),
                    "is_trial": "trial" in (pkg.get("description", "") or "").lower(),
                }
                if parsed["is_trial"]:
                    trial_packages.append(parsed)
                else:
                    packages.append(parsed)

        return {
            "success": True,
            "packages": packages,
            "trial_packages": trial_packages,
            "count": len(packages),
            "trial_count": len(trial_packages),
        }

    # ---- Bouquets ----
    def get_bouquets(self) -> Dict[str, Any]:
        data = self._request("GET", "/ext/bouquets")
        if isinstance(data, dict) and "error" in data:
            return {"success": False, "error": data["error"], "bouquets": []}
        bouquets = []
        if isinstance(data, list):
            for b in data:
                bouquets.append({"id": b.get("id"), "name": b.get("name", "")})
        return {"success": True, "bouquets": bouquets}

    # ---- Lines (subscribers) ----
    def get_lines(self) -> Dict[str, Any]:
        """Fetch all lines from the panel."""
        data = self._request("GET", "/ext/lines")
        if isinstance(data, dict) and "error" in data:
            return {"success": False, "error": data["error"], "users": []}

        users = []
        if isinstance(data, list):
            for line in data:
                expiry_str = line.get("expire_at")
                expiry_date = None
                if expiry_str:
                    try:
                        expiry_date = datetime.fromisoformat(expiry_str.replace("Z", "+00:00"))
                    except Exception:
                        pass

                status = "active"
                if not line.get("is_enabled", True):
                    status = "suspended"
                elif expiry_date and expiry_date < datetime.utcnow():
                    status = "expired"

                users.append({
                    "line_id": line.get("line_id", ""),
                    "username": line.get("username", ""),
                    "password": line.get("password", ""),
                    "mac_addr": line.get("mac_addr"),
                    "type": line.get("type", "regular"),
                    "expiry": expiry_str,
                    "expiry_date": expiry_date,
                    "status": status,
                    "is_enabled": line.get("is_enabled", True),
                    "is_trial": line.get("is_trial", False),
                    "package_id": line.get("package_id"),
                    "max_connections": line.get("max_connections", 1),
                    "bouquets": line.get("bouquets", []),
                    "owner": line.get("owner", ""),
                    "reseller_notes": line.get("reseller_notes", ""),
                })
        return {"success": True, "users": users}

    # ---- Sub-resellers ----
    def get_subresellers(self) -> Dict[str, Any]:
        data = self._request("GET", "/ext/user/find")
        if isinstance(data, dict) and "error" in data:
            return {"success": False, "error": data["error"], "users": []}
        users = []
        if isinstance(data, list):
            for u in data:
                users.append({
                    "user_id": u.get("id", 0),
                    "username": u.get("name", ""),
                    "email": u.get("email", ""),
                    "credits": u.get("credits", 0),
                    "notes": u.get("notes", ""),
                })
        return {"success": True, "users": users}

    # ---- Create Line ----
    def create_line(self, username: str = None, password: str = None,
                    package_id: int = None, reseller_notes: str = "",
                    bouquets: list = None, max_connections: int = None) -> Dict[str, Any]:
        body = {
            "package": package_id,
            "rid": str(uuid.uuid4())[:20],
        }
        if username:
            body["username"] = username
        if password:
            body["password"] = password
        if reseller_notes:
            body["reseller_notes"] = reseller_notes
        if bouquets:
            body["bouquets"] = bouquets
        if max_connections is not None:
            body["max_connections"] = max_connections

        result = self._request("POST", "/ext/line/create", json_data=body)
        if "error" in result:
            return {"success": False, "error": result["error"]}
        return {
            "success": True,
            "line_id": result.get("line_id", ""),
            "expire_at": result.get("expire_at"),
            "transaction_amount": result.get("transaction_amount", 0),
        }

    # ---- Find Line ----
    def find_line(self, username: str, password: str) -> Dict[str, Any]:
        result = self._request("GET", "/ext/line/find", params={"username": username, "password": password})
        if "error" in result:
            return {"success": False, "error": result["error"]}
        return {"success": True, "line_id": result.get("line_id", "")}

    # ---- Renew / Extend Line ----
    def renew_line(self, line_id: str, package_id: int = None) -> Dict[str, Any]:
        body = {"rid": str(uuid.uuid4())[:20]}
        if package_id:
            body["package"] = package_id
        result = self._request("POST", f"/ext/line/{line_id}/renew", json_data=body)
        if "error" in result:
            return {"success": False, "error": result["error"]}
        return {
            "success": True,
            "line_id": result.get("line_id", ""),
            "expire_at": result.get("expire_at"),
            "transaction_amount": result.get("transaction_amount", 0),
        }

    # ---- Enable / Disable / Terminate ----
    def enable_line(self, line_id: str) -> Dict[str, Any]:
        result = self._request("POST", f"/ext/line/{line_id}/enable")
        if "error" in result:
            return {"success": False, "error": result["error"]}
        return {"success": True, "line_id": result.get("line_id", "")}

    def disable_line(self, line_id: str) -> Dict[str, Any]:
        result = self._request("POST", f"/ext/line/{line_id}/disable")
        if "error" in result:
            return {"success": False, "error": result["error"]}
        return {"success": True, "line_id": result.get("line_id", "")}

    def terminate_line(self, line_id: str) -> Dict[str, Any]:
        result = self._request("POST", f"/ext/line/{line_id}/terminate")
        if "error" in result:
            return {"success": False, "error": result["error"]}
        return {"success": True, "line_id": result.get("line_id", "")}

    # ---- Create Sub-reseller ----
    def create_subreseller(self, name: str, email: str, password: str, credits: float = 0, notes: str = "") -> Dict[str, Any]:
        body = {
            "name": name,
            "email": email,
            "password": password,
            "password_confirmation": password,
        }
        if credits > 0:
            body["credits"] = credits
        if notes:
            body["notes"] = notes
        result = self._request("POST", "/ext/user/create", json_data=body)
        if "error" in result:
            return {"success": False, "error": result["error"]}
        return {"success": True, "user_id": result.get("id", 0)}

    # ---- Update Sub-reseller credits ----
    def update_subreseller_credits(self, user_id: int, credits: float) -> Dict[str, Any]:
        result = self._request("POST", f"/ext/user/{user_id}/credit", json_data={"credits": credits})
        if "error" in result:
            return {"success": False, "error": result["error"]}
        return {"success": True}


def get_onestream_service(panel_config: Dict[str, Any]) -> Optional[OneStreamService]:
    """Create a OneStreamService from panel config dict."""
    panel_url = panel_config.get("panel_url", "")
    api_key = panel_config.get("api_key", "")
    auth_user_token = panel_config.get("auth_user_token", "")

    if not panel_url or not api_key or not auth_user_token:
        logger.warning("1-Stream panel config missing required fields (panel_url, api_key, auth_user_token)")
        return None

    return OneStreamService(
        panel_url=panel_url,
        api_key=api_key,
        auth_user_token=auth_user_token,
        name=panel_config.get("name", ""),
        ssl_verify=panel_config.get("ssl_verify", False),
    )
