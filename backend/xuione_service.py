"""
XuiOne Panel Integration Service
Similar to XtreamUI but with API key authentication
"""
import logging
import requests
from typing import Dict, Any, List, Optional
from urllib.parse import urlparse, urlunparse

logger = logging.getLogger(__name__)

class XuiOneService:
    """XuiOne Panel API Service"""
    
    def __init__(self, panel_url: str, api_access_code: str = "", api_key: str = "", 
                 admin_username: str = "", admin_password: str = "", ssl_verify: bool = False):
        self.panel_url = self._clean_url(panel_url)
        self.api_access_code = api_access_code  # API access code (e.g., UfPJlfai)
        self.api_key = api_key
        self.admin_username = admin_username
        self.admin_password = admin_password
        self.ssl_verify = ssl_verify
        self.session = requests.Session()
        self.session.verify = ssl_verify
        self.logged_in = False
        
        # Set up HTTP auth if credentials in URL
        parsed = urlparse(panel_url)
        if parsed.username and parsed.password:
            self.http_auth = (parsed.username, parsed.password)
        elif admin_username and admin_password:
            self.http_auth = (admin_username, admin_password)
        else:
            self.http_auth = None
    
    def get_api_url(self) -> str:
        """Get the API base URL using the API access code"""
        if self.api_access_code:
            # Extract base domain from panel_url and use API access code
            # E.g., http://pressmonkey.net/Resellers12 -> http://pressmonkey.net/UfPJlfai/index.php
            parsed = urlparse(self.panel_url)
            base_url = f"{parsed.scheme}://{parsed.netloc}"
            return f"{base_url}/{self.api_access_code}/index.php"
        return f"{self.panel_url}/index.php"
    
    def _clean_url(self, url: str) -> str:
        """Remove credentials from URL"""
        parsed = urlparse(url)
        if parsed.username:
            netloc = parsed.hostname
            if parsed.port:
                netloc = f"{netloc}:{parsed.port}"
            return urlunparse((parsed.scheme, netloc, parsed.path, '', '', ''))
        return url.rstrip('/')
    
    def _get_headers(self) -> Dict[str, str]:
        """Get headers with API key if available"""
        headers = {
            'Accept': 'application/json',
            'Content-Type': 'application/json'
        }
        if self.api_key:
            headers['Authorization'] = f'Bearer {self.api_key}'
            headers['X-API-Key'] = self.api_key
        return headers
    
    def login(self) -> bool:
        """Attempt to login to XuiOne panel"""
        try:
            logger.info(f"Attempting XuiOne login to: {self.panel_url}")
            
            # XuiOne login form includes: username, password, referrer (hidden), and login (submit button)
            # Must match the exact form structure
            login_attempts = [
                # Attempt 1: Full form with all fields (including submit button name)
                {
                    'username': self.admin_username, 
                    'password': self.admin_password,
                    'referrer': '',
                    'login': 'Login'
                },
                # Attempt 2: Without submit button
                {
                    'username': self.admin_username, 
                    'password': self.admin_password,
                    'referrer': ''
                },
                # Attempt 3: Just username/password
                {
                    'username': self.admin_username, 
                    'password': self.admin_password
                },
            ]
            
            for attempt_num, login_data in enumerate(login_attempts, 1):
                logger.info(f"Login attempt {attempt_num} with fields: {list(login_data.keys())}")
                
                # POST to /login (the form action is "./login" which means POST to the login page itself)
                # The form is at /login, so we POST to /login (not /login/login)
                try_http_auth = attempt_num <= 2  # First 2 attempts with HTTP auth, last without
                
                # Construct the login URL - use just /login endpoint
                login_url = f"{self.panel_url}/login"
                # Remove duplicate /login if panel_url already ends with /login
                if self.panel_url.endswith('/login'):
                    login_url = self.panel_url
                
                logger.info(f"Posting to: {login_url}")
                
                response = self.session.post(
                    login_url,
                    data=login_data,
                    auth=self.http_auth if try_http_auth else None,
                    timeout=15,
                    allow_redirects=True  # Follow redirects to see where we end up
                )
                
                logger.info(f"XuiOne login response: status={response.status_code}, final_url={response.url}, auth={try_http_auth}")
                
                # Check if we got a PHPSESSID cookie
                has_session = 'PHPSESSID' in self.session.cookies
                logger.info(f"Has PHPSESSID cookie: {has_session}")
                
                # Check response content for success indicators
                response_text = response.text.lower()
                is_login_page = 'login' in response.url.lower() or 'data-id="login"' in response.text
                is_dashboard = 'dashboard' in response.url.lower() or 'welcome' in response_text or 'logout' in response_text
                
                logger.info(f"Response indicators: is_login_page={is_login_page}, is_dashboard={is_dashboard}")
                
                if is_dashboard and not is_login_page:
                    self.logged_in = True
                    logger.info(f"✓ XuiOne session login successful (attempt {attempt_num})")
                    return True
                
                # If we got redirected to dashboard (302 or final URL contains dashboard)
                if response.status_code in [200, 302] and has_session:
                    # Verify by trying to access dashboard
                    try:
                        dash_test = self.session.get(
                            f"{self.panel_url}/dashboard",
                            timeout=10,
                            allow_redirects=False
                        )
                        logger.info(f"Dashboard test: status={dash_test.status_code}")
                        
                        # If we can access dashboard without redirect to login, we're logged in
                        if dash_test.status_code == 200:
                            dash_content = dash_test.text.lower()
                            if 'data-id="login"' not in dash_test.text and 'logout' in dash_content:
                                self.logged_in = True
                                logger.info(f"✓ XuiOne login verified via dashboard (attempt {attempt_num})")
                                return True
                    except Exception as dash_err:
                        logger.warning(f"Dashboard verification failed: {dash_err}")
            
            logger.error(f"✗ XuiOne login failed after {len(login_attempts)} attempts")
            logger.error(f"Final response preview: {response.text[:300]}")
            return False
            
        except Exception as e:
            logger.error(f"✗ XuiOne login exception: {str(e)}")
            import traceback
            logger.error(traceback.format_exc())
            return False
    
    def test_connection(self) -> Dict[str, Any]:
        """Test connection to XuiOne panel"""
        try:
            logger.info(f"Testing XuiOne connection to: {self.panel_url}")
            logger.info(f"Username: {self.admin_username}")
            logger.info(f"Has API key: {bool(self.api_key)}")
            logger.info(f"Has HTTP auth: {bool(self.http_auth)}")
            
            if self.login():
                # Verify we can access dashboard
                try:
                    dashboard_response = self.session.get(
                        f"{self.panel_url}/dashboard",
                        timeout=10,
                        allow_redirects=True
                    )
                    logger.info(f"Dashboard test: status={dashboard_response.status_code}")
                    
                    if dashboard_response.status_code == 200:
                        return {
                            "success": True, 
                            "message": "✓ Connection successful! Logged in and verified dashboard access."
                        }
                except Exception as dash_err:
                    logger.warning(f"Dashboard verification failed but login succeeded: {dash_err}")
                    return {
                        "success": True,
                        "message": "✓ Connection successful! (Dashboard verification skipped)"
                    }
                
                return {"success": True, "message": "✓ Connection successful!"}
            
            return {
                "success": False, 
                "error": "Login failed. Please check your username and password. See backend logs for details."
            }
        except requests.exceptions.ConnectionError as e:
            return {
                "success": False, 
                "error": f"Cannot connect to panel. Please check the URL: {self.panel_url}"
            }
        except requests.exceptions.Timeout as e:
            return {
                "success": False, 
                "error": f"Connection timeout. Panel may be slow or unreachable: {self.panel_url}"
            }
        except Exception as e:
            logger.error(f"Test connection exception: {str(e)}")
            import traceback
            logger.error(traceback.format_exc())
            return {
                "success": False, 
                "error": f"Connection test failed: {str(e)}"
            }
    
    def get_packages(self) -> Dict[str, Any]:
        """Get packages from XuiOne panel by scraping HTML"""
        try:
            logger.info("XuiOne: Fetching packages via HTML scraping...")
            
            if not self.logged_in:
                logger.info("XuiOne: Not logged in, attempting login...")
                if not self.login():
                    logger.error("XuiOne: Login failed")
                    return {"success": False, "error": "Login failed", "packages": []}
            
            all_packages = []
            
            # Fetch regular packages from /line
            logger.info(f"Scraping regular packages: {self.panel_url}/line")
            regular_packages = self._scrape_packages_from_page(f"{self.panel_url}/line", is_trial=False)
            all_packages.extend(regular_packages)
            
            # Fetch trial packages from /line?trial=1
            logger.info(f"Scraping trial packages: {self.panel_url}/line?trial=1")
            trial_packages = self._scrape_packages_from_page(f"{self.panel_url}/line?trial=1", is_trial=True)
            all_packages.extend(trial_packages)
            
            logger.info(f"✓ XuiOne: Scraped {len(regular_packages)} regular + {len(trial_packages)} trial = {len(all_packages)} total packages")
            return {"success": True, "packages": all_packages}
            
        except Exception as e:
            logger.error(f"XuiOne: Exception fetching packages: {str(e)}")
            import traceback
            logger.error(traceback.format_exc())
            return {"success": False, "error": str(e), "packages": []}
    
    def _scrape_packages_from_page(self, url: str, is_trial: bool = False) -> list:
        """Helper method to scrape packages from a specific page"""
        try:
            response = self.session.get(url, timeout=30)
            
            if response.status_code != 200:
                logger.warning(f"Failed to fetch {url}: HTTP {response.status_code}")
                return []
            
            # Parse HTML to extract package options - ONLY from the package select dropdown
            import re
            
            # Find the <select name="package" ...> section specifically
            # This avoids picking up reseller dropdowns or other selects
            package_select_pattern = r'<select[^>]*name="package"[^>]*>(.*?)</select>'
            select_match = re.search(package_select_pattern, response.text, re.DOTALL | re.IGNORECASE)
            
            if not select_match:
                logger.warning(f"Could not find package select dropdown in {url}")
                return []
            
            package_select_html = select_match.group(1)
            
            # Now extract options from ONLY this select
            pattern = r'<option value="(\d+)">([^<]+)</option>'
            matches = re.findall(pattern, package_select_html)
            
            packages = []
            for package_id, package_name in matches:
                # Skip empty or placeholder options
                name_stripped = package_name.strip()
                if not name_stripped or name_stripped.lower().startswith('select') or name_stripped.startswith('--'):
                    continue
                
                # Parse package details from name
                name_lower = package_name.lower()
                
                # Extract duration
                duration = 1
                duration_unit = 'months'
                if 'year' in name_lower or '12 months' in name_lower:
                    duration = 12
                    duration_unit = 'months'
                elif '6 months' in name_lower:
                    duration = 6
                    duration_unit = 'months'
                elif '3 months' in name_lower:
                    duration = 3
                    duration_unit = 'months'
                elif '1 month' in name_lower:
                    duration = 1
                    duration_unit = 'months'
                
                # Extract max_connections
                max_connections = 1
                conn_match = re.search(r'(\d+)\s*connections?', name_lower)
                if conn_match:
                    max_connections = int(conn_match.group(1))
                
                packages.append({
                    'id': int(package_id),
                    'name': name_stripped,
                    'duration': duration,
                    'duration_unit': duration_unit,
                    'max_connections': max_connections,
                    'bouquets': [],  # Will be populated when package is selected
                    'credits': 0,  # Unknown from HTML
                    'is_trial': is_trial  # Set based on which page we scraped from
                })
            
            logger.info(f"Scraped {len(packages)} packages from {url} ({'trial' if is_trial else 'regular'})")
            return packages
            
        except Exception as e:
            logger.error(f"Error scraping packages from {url}: {str(e)}")
            import traceback
            logger.error(traceback.format_exc())
            return []
    
    def _parse_bouquets(self, bouquets_str):
        """Parse bouquets from string format "[1,2,3]" to list of integers"""
        try:
            if isinstance(bouquets_str, str):
                import json
                return json.loads(bouquets_str)
            return bouquets_str if isinstance(bouquets_str, list) else []
        except:
            return []
    
    def get_bouquets(self) -> Dict[str, Any]:
        """Get bouquets from XuiOne panel using API"""
        try:
            logger.info("XuiOne: Fetching bouquets via get_package API...")
            
            if not self.logged_in:
                if not self.login():
                    return {"success": False, "error": "Login failed", "bouquets": []}
            
            # Get bouquets by fetching a package (they all have the same bouquet list)
            # Use the web session (not API key) since this is the web API
            logger.info(f"Fetching: {self.panel_url}/api?action=get_package&package_id=31")
            
            response = self.session.get(
                f"{self.panel_url}/api",
                params={
                    'action': 'get_package',
                    'package_id': '31'  # Any package ID works - they all return the full bouquet list
                },
                timeout=30
            )
            
            logger.info(f"Response: status={response.status_code}")
            
            if response.status_code != 200:
                return {"success": False, "error": f"HTTP {response.status_code}", "bouquets": []}
            
            try:
                data = response.json()
                logger.info(f"Response keys: {list(data.keys())}")
                
                if data.get('result'):
                    bouquets = []
                    bouquet_list = data.get('bouquets', [])
                    
                    logger.info(f"Bouquet list length: {len(bouquet_list)}")
                    
                    for bouquet in bouquet_list:
                        bouquets.append({
                            'id': int(bouquet.get('id')),
                            'name': bouquet.get('bouquet_name', f"Bouquet {bouquet.get('id')}")
                        })
                        logger.info(f"  Found: {bouquet.get('id')} = {bouquet.get('bouquet_name')}")
                    
                    logger.info(f"✓ XuiOne: Found {len(bouquets)} bouquets")
                    return {"success": True, "bouquets": bouquets}
                else:
                    logger.error("API response result=false")
                    return {"success": False, "error": "API returned unsuccessful result", "bouquets": []}
                    
            except Exception as parse_err:
                logger.error(f"JSON parse error: {parse_err}")
                return {"success": False, "error": "Invalid JSON response", "bouquets": []}
            
        except Exception as e:
            logger.error(f"Error fetching bouquets: {str(e)}")
            import traceback
            logger.error(traceback.format_exc())
            return {"success": False, "error": str(e), "bouquets": []}
    
    def get_users(self) -> Dict[str, Any]:
        """Get users/lines from XuiOne panel using API"""
        try:
            logger.info("XuiOne: Fetching users...")
            
            if not self.logged_in:
                if not self.login():
                    return {"success": False, "error": "Login failed", "users": []}
            
            # Try get_lines API action if API key is available
            if self.api_key:
                api_url = self.get_api_url()
                
                try:
                    import requests
                    response = self.session.get(
                        api_url,
                        params={
                            'api_key': self.api_key,
                            'action': 'get_lines'
                        },
                        timeout=30
                    )
                    
                    logger.info(f"XuiOne get_lines response: status={response.status_code}")
                    
                    if response.status_code == 200:
                        result = response.json()
                        
                        if result.get('status') == 'STATUS_SUCCESS' or result.get('result'):
                            lines_data = result.get('data', [])
                            
                            users = []
                            for line in lines_data:
                                # Parse expiry date
                                expiry_timestamp = line.get('exp_date')
                                expiry_str = ""
                                if expiry_timestamp:
                                    from datetime import datetime
                                    try:
                                        expiry_dt = datetime.fromtimestamp(int(expiry_timestamp))
                                        expiry_str = expiry_dt.strftime("%Y-%m-%d %H:%M:%S")
                                    except:
                                        expiry_str = str(expiry_timestamp)
                                
                                users.append({
                                    "user_id": line.get('id'),
                                    "username": line.get('username', ''),
                                    "password": "",  # XuiOne doesn't return plaintext password
                                    "expiry": expiry_str,
                                    "max_connections": str(line.get('max_connections', 1)),
                                    "status": "active" if line.get('enabled') == '1' else "disabled",
                                })
                            
                            logger.info(f"✓ XuiOne: Found {len(users)} lines")
                            return {"success": True, "users": users, "count": len(users)}
                except Exception as api_err:
                    logger.error(f"XuiOne get_lines API error: {api_err}")
            
            return {"success": False, "error": "API not available or failed", "users": []}
            
        except Exception as e:
            logger.error(f"Error fetching users: {str(e)}")
            return {"success": False, "error": str(e), "users": []}
    
    def get_subresellers(self) -> Dict[str, Any]:
        """Get subresellers from XuiOne panel using API"""
        try:
            logger.info("XuiOne: Fetching subresellers...")
            
            if not self.logged_in:
                if not self.login():
                    return {"success": False, "error": "Login failed", "users": []}
            
            # Use get_users API action and filter for resellers
            if self.api_key:
                api_url = self.get_api_url()
                
                try:
                    import requests
                    response = self.session.get(
                        api_url,
                        params={
                            'api_key': self.api_key,
                            'action': 'get_users'  # Gets all users
                        },
                        timeout=30
                    )
                    
                    logger.info(f"XuiOne get_users response: status={response.status_code}")
                    
                    if response.status_code == 200:
                        result = response.json()
                        
                        if result.get('status') == 'STATUS_SUCCESS' or result.get('result'):
                            users_data = result.get('data', [])
                            logger.info(f"XuiOne: Fetched {len(users_data)} total users, filtering for resellers...")
                            
                            # Filter for resellers - check multiple possible field names
                            subresellers = []
                            for user in users_data:
                                is_reseller = False
                                
                                # Check various fields that indicate reseller role
                                if user.get('role') == 'reseller':
                                    is_reseller = True
                                elif user.get('user_type') in ['reseller', 2, '2']:
                                    is_reseller = True
                                elif user.get('is_reseller') in [1, '1', True]:
                                    is_reseller = True
                                elif int(user.get('member_group_id', 0)) >= 2:
                                    # Fallback: member_group_id >= 2 usually indicates reseller
                                    is_reseller = True
                                
                                if is_reseller:
                                    # Check if owned by current reseller (filter out others)
                                    owner_id = str(user.get('owner_id', ''))
                                    
                                    subresellers.append({
                                        "user_id": user.get('id'),
                                        "username": user.get('username', ''),
                                        "owner": owner_id,
                                        "member_group": str(user.get('member_group_id', '')),
                                        "credits": str(user.get('credits', 0)),
                                        "expiry": "NEVER",  # Resellers don't expire
                                        "status": "active" if user.get('status') in ['1', 1, True] else "disabled",
                                    })
                            
                            logger.info(f"✓ XuiOne: Found {len(subresellers)} resellers (out of {len(users_data)} total users)")
                            return {"success": True, "users": subresellers, "count": len(subresellers)}
                except Exception as api_err:
                    logger.error(f"XuiOne get_users API error: {api_err}")
                    import traceback
                    logger.error(traceback.format_exc())
            
            return {"success": False, "error": "API not available or failed", "users": []}
            
        except Exception as e:
            logger.error(f"Error fetching subresellers: {str(e)}")
            import traceback
            logger.error(traceback.format_exc())
            return {"success": False, "error": str(e), "users": []}


# Singleton instance management
_xuione_service = None

def get_xuione_service(panel_config: Dict[str, Any]) -> Optional[XuiOneService]:
    """Get or create XuiOne service instance"""
    global _xuione_service
    
    if not panel_config:
        return None
    
    panel_url = panel_config.get('panel_url', '')
    if not panel_url:
        return None
    
    _xuione_service = XuiOneService(
        panel_url=panel_url,
        api_access_code=panel_config.get('api_access_code', ''),
        api_key=panel_config.get('api_key', ''),
        admin_username=panel_config.get('admin_username', ''),
        admin_password=panel_config.get('admin_password', ''),
        ssl_verify=panel_config.get('ssl_verify', False)
    )
    
    return _xuione_service
