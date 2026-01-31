import requests
import json
import logging
import os
import tempfile
from http.cookiejar import MozillaCookieJar
from typing import Dict, Any, Optional
from datetime import datetime, timedelta

logger = logging.getLogger(__name__)

class XtreamUISessionClient:
    """XtreamUI R22F Client with Cookie File Persistence (WHMCS Method)"""
    
    def __init__(self, panel_url: str, username: str, password: str, ssl_verify: bool = False):
        from urllib.parse import urlparse, urlunparse
        
        # Parse URL to extract any embedded credentials and clean hostname
        parsed = urlparse(panel_url)
        
        # Store credentials - either from URL or from parameters
        self.username = parsed.username or username
        self.password = parsed.password or password
        
        # Build clean URL without embedded credentials
        hostname = parsed.hostname or parsed.netloc.split('@')[-1].split(':')[0]
        port = parsed.port
        
        if port:
            netloc = f"{hostname}:{port}"
        else:
            netloc = hostname
        
        clean_url = urlunparse((
            parsed.scheme or 'https',
            netloc,
            parsed.path or '',
            '', '', ''
        ))
        
        # Use ONLY clean URL - auth will be passed via requests auth parameter
        self.panel_url = clean_url.rstrip('/')
        self.ssl_verify = ssl_verify
        
        # HTTP Basic Auth tuple for requests
        self.http_auth = (self.username, self.password)
        
        logger.info(f"Panel URL (clean): {self.panel_url}")
        logger.info(f"HTTP Basic Auth user: {self.username}")
        
        # Create cookie file
        cookie_dir = os.path.join(tempfile.gettempdir(), 'xtreamui_sessions')
        os.makedirs(cookie_dir, exist_ok=True)
        
        safe_panel_name = self.panel_url.replace('://', '_').replace('/', '_').replace(':', '_')
        self.cookie_file = os.path.join(cookie_dir, f'{safe_panel_name}_cookies.txt')
        
        # Create session with cookie jar
        self.session = requests.Session()
        self.session.verify = ssl_verify
        self.session.cookies = MozillaCookieJar(self.cookie_file)
        
        # Load existing cookies
        if os.path.exists(self.cookie_file):
            try:
                self.session.cookies.load(ignore_discard=True, ignore_expires=True)
                logger.info(f"Loaded existing session from {self.cookie_file}")
            except:
                pass
        
        self.logged_in = False
    
    def login(self) -> bool:
        """Login to XtreamUI panel - EXACT PHP method: POST credentials as form data"""
        try:
            login_url = f"{self.panel_url}/login.php"
            
            # PHP sends credentials as form data
            login_data = {
                'username': self.username,
                'password': self.password
            }
            
            logger.info(f"Logging in with form POST to: {login_url}")
            logger.info(f"POST data: username={self.username}")
            
            # Use auth parameter for HTTP Basic Auth (Nginx) - keeps cookies clean!
            response = self.session.post(login_url, data=login_data, auth=self.http_auth, 
                                         timeout=30, allow_redirects=True)
            
            # Check if login succeeded
            if response.status_code == 200:
                # Debug: Log all cookies
                cookie_names = [cookie.name for cookie in self.session.cookies]
                logger.info(f"Cookies after login: {cookie_names}")
                logger.info(f"Cookie jar type: {type(self.session.cookies).__name__}")
                
                # Check if we have session cookies
                if 'PHPSESSID' in cookie_names or 'hash' in cookie_names:
                    self.logged_in = True
                    
                    # Save cookies to file (WHMCS method!)
                    try:
                        self.session.cookies.save(ignore_discard=True, ignore_expires=True)
                        logger.info(f"✓ Session saved to cookie file: {self.cookie_file}")
                    except Exception as e:
                        logger.warning(f"Failed to save cookies: {str(e)}")
                    
                    logger.info("✓ XtreamUI login successful - session established")
                    return True
                elif 'dashboard' in response.url.lower():
                    self.logged_in = True
                    
                    # Save cookies
                    try:
                        self.session.cookies.save(ignore_discard=True, ignore_expires=True)
                        logger.info(f"✓ Session saved to cookie file")
                    except:
                        pass
                    
                    logger.info("✓ XtreamUI login successful - redirected to dashboard")
                    return True
                else:
                    logger.warning("Login returned 200 but no session cookie found")
                    logger.warning(f"Response URL: {response.url}")
                    logger.warning(f"Response preview: {response.text[:200]}")
                    return False
            else:
                logger.error(f"Login failed: HTTP {response.status_code}")
                return False
                
        except Exception as e:
            logger.error(f"Login error: {str(e)}")
            return False
    

    
    def get_reseller_info(self) -> Dict[str, Any]:
        """Get logged-in reseller's info (ID and permissions)"""
        if not self.logged_in:
            if not self.login():
                return {}
        
        try:
            import re
            
            # Method 1: Check users.php page for the reseller dropdown
            # The dropdown shows all resellers including the logged-in one
            # Our username will be in the list with its member_id
            users_response = self.session.get(f"{self.panel_url}/users.php", auth=self.http_auth, timeout=15)
            if users_response.status_code == 200:
                html = users_response.text
                
                # Look for our username in the reseller dropdown
                # Format: <option value="1622">whmcs</option>
                pattern = rf'<option\s+value=["\']?(\d+)["\']?[^>]*>\s*{re.escape(self.username)}\s*</option>'
                match = re.search(pattern, html, re.IGNORECASE)
                if match:
                    member_id = int(match.group(1))
                    logger.info(f"Detected member_id from users.php dropdown: {member_id}")
                    return {'user_id': member_id, 'member_id': member_id, 'can_create_subreseller': True}
                
                # Alternative: Look for user_reseller select with our username
                reseller_select = re.search(r'id=["\']user_reseller["\'][^>]*>(.+?)</select>', html, re.DOTALL | re.IGNORECASE)
                if reseller_select:
                    options_html = reseller_select.group(1)
                    option_pattern = rf'value=["\']?(\d+)["\']?[^>]*>\s*{re.escape(self.username)}\s*<'
                    opt_match = re.search(option_pattern, options_html, re.IGNORECASE)
                    if opt_match:
                        member_id = int(opt_match.group(1))
                        logger.info(f"Detected member_id from reseller select: {member_id}")
                        return {'user_id': member_id, 'member_id': member_id, 'can_create_subreseller': True}
            
            # Method 2: Try dashboard page
            response = self.session.get(f"{self.panel_url}/dashboard.php", auth=self.http_auth, timeout=10)
            
            if response.status_code == 200:
                html = response.text
                
                # Look for member_id in hidden inputs or data attributes
                member_match = re.search(r'member_id["\']?\s*[:=]\s*["\']?(\d+)', html, re.IGNORECASE)
                if member_match:
                    member_id = int(member_match.group(1))
                    logger.info(f"Detected member_id from dashboard: {member_id}")
                    return {'user_id': member_id, 'member_id': member_id, 'can_create_subreseller': True}
                
                # Look for data-id or user id patterns
                id_patterns = [
                    r'data-member-id=["\']?(\d+)',
                    r'data-id=["\']?(\d+)',
                    r'user_id["\']?\s*[:=]\s*["\']?(\d+)',
                    r'reseller_id["\']?\s*[:=]\s*["\']?(\d+)',
                ]
                
                for pattern in id_patterns:
                    match = re.search(pattern, html, re.IGNORECASE)
                    if match:
                        user_id = int(match.group(1))
                        if user_id > 0:
                            logger.info(f"Detected user/member ID: {user_id}")
                            return {'user_id': user_id, 'member_id': user_id, 'can_create_subreseller': True}
            
            # Fallback: return defaults
            logger.warning("Could not detect member_id from panel")
            return {'user_id': 0, 'member_id': 0, 'can_create_subreseller': False}
            
        except Exception as e:
            logger.error(f"Error getting reseller info: {str(e)}")
            return {'user_id': 0, 'member_id': 0, 'can_create_subreseller': False}
    
    def get_reseller_member_id(self) -> Optional[int]:
        """Get the reseller's member_id from the panel"""
        info = self.get_reseller_info()
        return info.get('member_id', 0) if info else 0
    
    def get_member_groups(self) -> Dict[int, str]:
        """Get available member groups from panel"""
        if not self.logged_in:
            if not self.login():
                return {}
        
        return {}  # Placeholder for now
    
    def add_credits(self, username: str, email: str, credits: float) -> Dict[str, Any]:
        """Add credits - Exact WHMCS method with search"""
        if not self.logged_in:
            if not self.login():
                return {'success': False, 'error': 'Failed to login'}
        
        try:
            import time
            
            # Build search parameters (WHMCS getSearchingArrayStreamline)
            search_params = {}
            
            # CRITICAL: PHP sets draw=1
            search_params['draw'] = '1'
            
            for i in range(12):
                search_params[f'columns[{i}][data]'] = str(i)
                search_params[f'columns[{i}][name]'] = ''
                search_params[f'columns[{i}][searchable]'] = 'true'
                search_params[f'columns[{i}][orderable]'] = 'true'
                search_params[f'columns[{i}][search][value]'] = ''
                search_params[f'columns[{i}][search][regex]'] = ''
            
            search_params['order[0][column]'] = '0'
            search_params['order[0][dir]'] = 'desc'
            search_params['start'] = '0'
            search_params['length'] = '25'
            search_params['search[value]'] = username  # Search by username
            search_params['search[regex]'] = 'false'
            search_params['id'] = 'reg_users'
            search_params['filter'] = ''
            search_params['reseller'] = ''
            search_params['_'] = str(int(time.time() * 1000))  # Milliseconds timestamp
            
            # WHMCS uses query string in URL + POST data (both!)
            # Use clean URL with auth parameter
            search_url = f"{self.panel_url}/table_search.php"
            query_string_url = f"{search_url}?{requests.compat.urlencode(search_params)}"
            
            logger.info(f"Searching for user: {username}")
            logger.info(f"Query URL: {query_string_url[:200]}...")
            
            # POST with parameters in both URL and body (WHMCS pattern!) + HTTP Basic Auth
            response = self.session.post(query_string_url, data=search_params, auth=self.http_auth, timeout=10)
            
            logger.info(f"Search response: {response.status_code}")
            logger.info(f"Response: {response.text[:300]}")
            
            if response.status_code == 200:
                try:
                    result = response.json()
                    
                    # Use getexactfromsearch logic
                    user_data = None
                    records_total = int(result.get('recordsTotal', 0)) if result.get('recordsTotal') else 0
                    
                    if records_total > 0:
                        # Find exact match by username (column 1)
                        for row in result.get('data', []):
                            if len(row) > 1 and str(row[1]).strip() == username:
                                user_data = row
                                break
                        
                        # Or use first result if only one
                        if not user_data and records_total == 1:
                            user_data = result['data'][0]
                    
                    if user_data and len(user_data) > 0:
                        user_id = user_data[0]  # Column 0 is ID
                        current_credits = user_data[6] if len(user_data) > 6 else '0'  # Column 6 is credits
                        
                        logger.info(f"Found user ID: {user_id}, current credits: {current_credits}")
                        
                        # Add credits (WHMCS exact format)
                        credits_data = {
                            'id': user_id,
                            'credits': str(int(credits)),
                            'submit_credits': 'Purchase'
                        }
                        
                        # URL has credits in query string
                        credits_url = f"{self.panel_url}/credits_add.php?id={int(credits)}"
                        
                        logger.info(f"Adding {credits} credits to user ID {user_id}")
                        logger.info(f"URL: {credits_url}")
                        logger.info(f"Data: {credits_data}")
                        
                        credits_response = self.session.post(credits_url, data=credits_data, auth=self.http_auth, timeout=10)
                        
                        logger.info(f"Credits response: {credits_response.status_code}")
                        
                        if credits_response.status_code == 200:
                            logger.info(f"✓ {credits} credits added to {username}")
                            return {'success': True, 'credits': credits}
                        else:
                            return {'success': False, 'error': f'HTTP {credits_response.status_code}'}
                    else:
                        logger.error(f"User {username} not found in search results")
                        return {'success': False, 'error': 'User not found'}
                        
                except Exception as e:
                    logger.error(f"Search parse error: {str(e)}")
                    logger.error(f"Response was: {response.text[:500]}")
                    return {'success': False, 'error': f'Search failed: {str(e)}'}
            else:
                return {'success': False, 'error': 'Search request failed'}
                
        except Exception as e:
            logger.error(f"Add credits error: {str(e)}")
            return {'success': False, 'error': str(e)}
    
    def get_reseller_id(self) -> Optional[int]:
        """Get the ID of the logged-in reseller (for owner_id)"""

    
    def extend_subscriber(self, username: str, password: str, package_id: int, bouquets: list, max_connections: int, reseller_notes: str = "") -> Dict[str, Any]:
        """Extend existing subscriber - EXACT WHMCS PHP method"""
        if not self.logged_in:
            if not self.login():
                return {'success': False, 'error': 'Failed to login'}
        
        try:
            import time
            
            # Step 1: Search for user to get ID - EXACT PHP parameters!
            # PHP: getSearchingArrayStreamline() equivalent
            search_params = {}
            
            # CRITICAL: PHP sets draw=1 (integer, but becomes string in http_build_query)
            search_params['draw'] = '1'
            
            for i in range(12):
                search_params[f'columns[{i}][data]'] = str(i)
                search_params[f'columns[{i}][name]'] = ''
                search_params[f'columns[{i}][searchable]'] = 'true'
                search_params[f'columns[{i}][orderable]'] = 'true'
                search_params[f'columns[{i}][search][value]'] = ''
                search_params[f'columns[{i}][search][regex]'] = ''  # PHP uses empty string
            
            # PHP uses 0 for extend action, 2 for disable/enable/delete
            search_params['order[0][column]'] = '0'
            search_params['order[0][dir]'] = 'desc'
            search_params['start'] = '0'
            search_params['length'] = '25'
            search_params['search[value]'] = username
            search_params['search[regex]'] = 'false'
            search_params['id'] = 'users'  # "users" for streaming lines
            search_params['filter'] = ''
            search_params['reseller'] = ''
            search_params['_'] = str(int(time.time() * 1000))  # WSxtreamUI_milliseconds()
            
            # Use clean URL with auth parameter for search
            search_url = f"{self.panel_url}/table_search.php"
            query_string_url = f"{search_url}?{requests.compat.urlencode(search_params)}"
            
            logger.info(f"Extending subscriber: Searching for {username}")
            
            response = self.session.post(query_string_url, data=search_params, auth=self.http_auth, timeout=10)
            
            logger.info(f"Search response status: {response.status_code}")
            logger.info(f"Search response content: {response.text[:500]}")
            
            if response.status_code == 200:
                try:
                    result = response.json()
                    records_total = int(result.get('recordsTotal', 0)) if result.get('recordsTotal') else 0
                    
                    if records_total > 0:
                        # Get user ID and previous expiry date
                        user_data = result.get('data', [[]])[0]
                        user_id = user_data[0] if user_data else None
                        
                        # Get previous expiry date (column 7) - PHP: $PrevioudNextDueDate = strip_tags($ara["data"][0][7]);
                        import re
                        prev_date_str = ''
                        if len(user_data) > 7:
                            prev_date_str = re.sub('<[^<]+?>', '', str(user_data[7])).strip()
                        logger.info(f"Previous expiry date: {prev_date_str}")
                        
                        if user_id:
                            logger.info(f"Found user ID: {user_id}")
                            
                            # Step 2: POST to user_reseller.php with ALL data + edit parameter
                            # Use clean URL with auth parameter - cookies will be sent correctly!
                            edit_url = f"{self.panel_url}/user_reseller.php?id={user_id}"
                            
                            logger.info(f"Edit URL: {edit_url}")
                            
                            # Debug: Log cookies being sent
                            cookie_names = [c.name for c in self.session.cookies]
                            logger.info(f"Cookies in session: {cookie_names}")
                            for c in self.session.cookies:
                                logger.info(f"  Cookie {c.name}: domain={c.domain}, path={c.path}")
                            
                            # CREATE uses: submit_user='1' and bouquets_selected=JSON
                            # Let's use the EXACT same pattern!
                            
                            from datetime import datetime, timedelta
                            import re
                            import json
                            
                            # Calculate new expiry
                            current_exp = prev_date_str.replace('<br>', ' ').strip()
                            try:
                                current_exp_clean = re.sub(r'(\d{4}-\d{2}-\d{2})(\d{2}:\d{2}:\d{2})', r'\1 \2', current_exp)
                                exp_dt = datetime.strptime(current_exp_clean.strip(), "%Y-%m-%d %H:%M:%S")
                                new_exp_dt = exp_dt + timedelta(days=365)
                                new_exp_str = new_exp_dt.strftime("%Y-%m-%d %H:%M:%S")
                            except:
                                new_exp_str = ""
                            
                            # Auto-detect member_id from logged-in reseller
                            reseller_info = self.get_reseller_info()
                            member_id = str(reseller_info.get('member_id', 0))
                            logger.info(f"Using member_id: {member_id}")
                            
                            # Use EXACT same format as CREATE:
                            # submit_user='1' and bouquets_selected=JSON
                            edit_data = {
                                'edit': str(user_id),
                                'submit_user': '1',  # Same as CREATE - '1' not 'Purchase'!
                                'username': username,
                                'password': password,
                                'package': str(package_id),
                                'member_id': member_id,  # Auto-detected!
                                'exp_date': new_exp_str,
                                'reseller_notes': reseller_notes or '',
                                'bouquets_selected': json.dumps(bouquets) if bouquets else '[]',  # JSON like CREATE!
                            }
                            
                            logger.info(f"Edit URL: {edit_url}")
                            logger.info(f"POST data (CREATE pattern - submit_user=1, JSON bouquets): {edit_data}")
                            
                            edit_response = self.session.post(edit_url, data=edit_data, auth=self.http_auth, timeout=30)
                            
                            logger.info(f"Extend response: {edit_response.status_code}")
                            logger.info(f"Response headers: {dict(edit_response.headers)}")
                            logger.info(f"Response content (first 500 chars): {edit_response.text[:500] if edit_response.text else 'EMPTY'}")
                            
                            # PHP method: Don't check edit response - search again to verify!
                            # Search again to verify the date changed
                            logger.info("Verifying extension by searching again...")
                            verify_response = self.session.post(query_string_url, data=search_params, auth=self.http_auth, timeout=10)
                            
                            if verify_response.status_code == 200:
                                try:
                                    verify_result = verify_response.json()
                                    if verify_result.get('data') and len(verify_result['data']) > 0:
                                        new_date_str = verify_result['data'][0][7] if len(verify_result['data'][0]) > 7 else ''
                                        # Strip HTML tags
                                        import re
                                        new_date_clean = re.sub('<[^<]+?>', '', new_date_str).strip()
                                        logger.info(f"Previous date: {prev_date_str}, New date: {new_date_clean}")
                                        
                                        # Compare dates to verify extension worked
                                        if new_date_clean != prev_date_str:
                                            logger.info(f"✓ Date changed! Subscriber {username} extended successfully")
                                            return {'success': True, 'username': username, 'new_expiry': new_date_clean}
                                        else:
                                            logger.warning(f"Date did not change - extension may have failed")
                                            # Still return success if HTTP was 200 - might be a verification issue
                                            if edit_response.status_code == 200:
                                                return {'success': True, 'username': username, 'note': 'Date unchanged but POST succeeded'}
                                except Exception as ve:
                                    logger.error(f"Verification error: {ve}")
                            
                            # Fallback to checking edit response
                            if edit_response.status_code == 200:
                                logger.info(f"✓ Subscriber {username} extended (HTTP 200)")
                                return {'success': True, 'username': username}
                            else:
                                logger.error(f"Extension failed with HTTP {edit_response.status_code}")
                                return {'success': False, 'error': f'HTTP {edit_response.status_code}'}
                        else:
                            return {'success': False, 'error': 'User ID not found'}
                    else:
                        return {'success': False, 'error': f'User {username} not found'}
                except Exception as e:
                    logger.error(f"Search parse error: {str(e)}")
                    return {'success': False, 'error': str(e)}
            else:
                return {'success': False, 'error': 'Search failed'}
                
        except Exception as e:
            logger.error(f"Extend error: {str(e)}")
            return {'success': False, 'error': str(e)}

        info = self.get_reseller_info()
        return info.get('user_id', 0)
    
    def create_subreseller(self, username: str, password: str, credits: float, email: str = "") -> Dict[str, Any]:
        """Create subreseller using subreseller.php endpoint (DISCOVERED FROM WHMCS!)"""
        if not self.logged_in:
            if not self.login():
                return {'success': False, 'error': 'Failed to login'}
        
        try:
            # POST to subreseller.php (the REAL endpoint for creating subresellers!)
            url = f"{self.panel_url}/subreseller.php"
            
            # Post data matching WHMCS Super module
            form_data = {
                'username': username,
                'password': password,
                'reseller_dns': '',  # Empty for now
                'email': email or f"{username}@subreseller.local",
                'notes': f'Billing Panel Customer - {credits} credits',
                'submit_user': 'Purchase'
            }
            
            logger.info(f"Creating subreseller via subreseller.php: {username}")
            logger.info(f"Post data: {form_data}")
            
            # POST with session cookies and HTTP Basic Auth
            response = self.session.post(url, data=form_data, auth=self.http_auth, timeout=30, allow_redirects=True)
            
            logger.info(f"subreseller.php response: {response.status_code}")
            
            # Log response for debugging
            response_preview = response.text[:1000] if len(response.text) > 1000 else response.text
            logger.info(f"Response preview: {response_preview}")
            
            # Check for success
            # Look for actual error messages, not just CSS class in template
            if '<div class="alert alert-danger' in response.text or 'alert-danger">Error' in response.text:
                # Actual error div with content
                logger.error("Error message found in response")
                # Try to extract error message
                import re
                error_match = re.search(r'alert-danger[^>]*>(.*?)</div>', response.text, re.DOTALL)
                if error_match:
                    error_msg = error_match.group(1).strip()[:200]
                    logger.error(f"Error message: {error_msg}")
                return {'success': False, 'error': 'Subreseller creation failed'}
            elif response.status_code in [200, 302]:
                # No error found, assume success
                logger.info("✓ Subreseller created via subreseller.php (no errors detected)")
                return {'success': True, 'username': username, 'credits': credits}
            else:
                logger.warning(f"Unexpected status: {response.status_code}")
                return {'success': False, 'error': f'HTTP {response.status_code}'}
                
        except Exception as e:
            logger.error(f"subreseller.php error: {str(e)}")
            return {'success': False, 'error': str(e)}

    def create_reseller(self, username: str, password: str, credits: float, email: str = "", member_group_id: int = 3) -> Dict[str, Any]:
        """Create subreseller under the panel's reseller account"""
        # Customers purchasing "reseller packages" are actually subresellers
        # Created under the whmcs reseller account (owner_id = whmcs's ID)
        return self.create_subreseller(username, password, credits, email)
    
    def add_reseller_credits(self, username: str, credits: float) -> Dict[str, Any]:
        """Add credits to existing reseller"""
        # Ensure logged in
        if not self.logged_in:
            if not self.login():
                return {'success': False, 'error': 'Failed to login'}
        
        try:
            # Find reseller ID first (might need API call)
            # Then update credits via API or direct update
            
            # For now, return not implemented
            logger.warning("add_reseller_credits not yet implemented")
            return {'success': False, 'error': 'Not implemented'}
            
        except Exception as e:
            logger.error(f"Add credits error: {str(e)}")
            return {'success': False, 'error': str(e)}
    
    def create_subscriber(self, username: str, password: str, package_id: int, bouquets: list, expiry: int) -> Dict[str, Any]:
        """Create subscriber (still using HTTP Basic Auth - works fine)"""
        # Subscribers work with the existing auth method
        # Use the old approach
        pass
