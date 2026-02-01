import requests
import json
import os
from typing import Dict, Any, Optional, List
from datetime import datetime, timedelta
import logging

logger = logging.getLogger(__name__)

class XtreamUIService:
    """XtreamUI R22F API Service - Python version of WHMCS module"""
    
    def __init__(self, panel_url: str, admin_username: str, admin_password: str, ssl_verify: bool = False):
        self.panel_url = panel_url.rstrip('/')
        self.admin_username = admin_username
        self.admin_password = admin_password
        self.ssl_verify = ssl_verify
        self.session = requests.Session()
        self.session.auth = (admin_username, admin_password)
        self.session.verify = ssl_verify
    
    def _make_request(self, endpoint: str, method: str = 'GET', data: Optional[Dict] = None) -> Dict[str, Any]:
        """Make API request to XtreamUI panel"""
        url = f"{self.panel_url}{endpoint}"
        
        try:
            logger.info(f"XtreamUI API: {method} {endpoint}")
            
            if method == 'GET':
                response = self.session.get(url, timeout=30)
            elif method == 'POST':
                response = self.session.post(url, data=data, timeout=30)
            elif method == 'DELETE':
                response = self.session.delete(url, params=data, timeout=30)
            else:
                return {'success': False, 'error': f'Unsupported method: {method}'}
            
            logger.info(f"XtreamUI Response: {response.status_code}")
            
            # R22F returns 200 for success even with non-JSON
            if response.status_code == 200:
                return {
                    'success': True,
                    'data': response.text,
                    'status_code': response.status_code
                }
            else:
                return {
                    'success': False,
                    'error': f'HTTP {response.status_code}',
                    'data': response.text
                }
                
        except requests.exceptions.RequestException as e:
            logger.error(f"XtreamUI API Error: {str(e)}")
            return {
                'success': False,
                'error': str(e)
            }
    
    def test_connection(self) -> Dict[str, Any]:
        """Test connection to XtreamUI panel"""
        return self._make_request('/api.php?action=test', 'GET')
    
    def create_subscriber(self, username: str, password: str, bouquets: List[int], 
                         max_connections: int, expiry_date: int) -> Dict[str, Any]:
        """Create subscriber line - DEPRECATED: Use create_subscriber_via_form instead"""
        data = {
            'username': username,
            'password': password,
            'exp_date': expiry_date,
            'max_connections': max_connections,
            'bouquets': json.dumps(bouquets)
        }
        return self._make_request('/api.php?action=user', 'POST', data)
    
    def create_subscriber_via_form(self, username: str, password: str, package_id: int, 
                                   bouquets: list, customer_name: str = None) -> Dict[str, Any]:
        """
        Create subscriber via reseller form POST (associates with reseller & deducts credits)
        This is the correct method for reseller-owned accounts
        """
        try:
            # First login to get session
            self.session.post(
                f"{self.panel_url}/login.php",
                data={'username': self.admin_username, 'password': self.admin_password},
                timeout=30
            )
            
            if 'PHPSESSID' not in self.session.cookies:
                return {'success': False, 'error': 'Login failed - no session'}
            
            # Build reseller notes with customer name
            reseller_notes = f"IPTV Billing System: {customer_name}" if customer_name else "IPTV Billing System"
            
            # Submit form to create user
            form_data = {
                'submit_user': '1',
                'username': username,
                'password': password,
                'package': str(package_id),
                'member_id': '0',  # 0 = owned by reseller themselves
                'reseller_notes': reseller_notes,
                'bouquets_selected': json.dumps(bouquets),
                # Don't include is_mag or is_e2 at all - they default to disabled
            }
            
            response = self.session.post(
                f"{self.panel_url}/user_reseller.php",
                data=form_data,
                allow_redirects=False,
                timeout=30
            )
            
            logger.info(f"Form POST status: {response.status_code}")
            
            if response.status_code == 302:
                redirect_url = response.headers.get('Location', '')
                if 'user_reseller.php?id=' in redirect_url:
                    user_id = redirect_url.split('id=')[1].split('&')[0] if '=' in redirect_url else 'unknown'
                    logger.info(f"User created successfully: {username} (ID: {user_id})")
                    return {
                        'success': True,
                        'user_id': user_id,
                        'username': username,
                        'message': f'User created under reseller (ID: {user_id})'
                    }
            
            return {
                'success': False,
                'error': f'Form POST returned {response.status_code}',
                'response': response.text[:200]
            }
            
        except Exception as e:
            logger.error(f"Form POST error: {e}")
            return {'success': False, 'error': str(e)}
    
    def create_reseller(self, username: str, password: str, credits: float, max_lines: int) -> Dict[str, Any]:
        """Create reseller line"""
        data = {
            'username': username,
            'password': password,
            'credits': credits,
            'max_lines': max_lines
        }
        return self._make_request('/api.php?action=reseller', 'POST', data)
    
    def suspend_account(self, username: str, password: str) -> Dict[str, Any]:
        """Suspend account"""
        data = {
            'username': username,
            'password': password,
            'enabled': 0
        }
        return self._make_request('/api.php?action=user', 'POST', data)
    
    def unsuspend_account(self, username: str, password: str) -> Dict[str, Any]:
        """Unsuspend account"""
        data = {
            'username': username,
            'password': password,
            'enabled': 1
        }
        return self._make_request('/api.php?action=user', 'POST', data)
    
    def terminate_account(self, username: str, password: str) -> Dict[str, Any]:
        """Terminate/delete account"""
        data = {
            'username': username,
            'password': password,
            'delete': 1
        }
        return self._make_request('/api.php?action=user', 'DELETE', data)
    
    def get_subscriber_info(self, username: str, password: str) -> Dict[str, Any]:
        """Get subscriber information"""
        endpoint = f'/api.php?action=user&username={username}&password={password}'
        return self._make_request(endpoint, 'GET')
    
    def get_reseller_info(self, username: str, password: str) -> Dict[str, Any]:
        """Get reseller information"""
        endpoint = f'/api.php?action=reseller&username={username}&password={password}'
        return self._make_request(endpoint, 'GET')
    
    def get_bouquets(self) -> Dict[str, Any]:
        """Get all available bouquets from XtreamUI panel"""
        # Try multiple endpoints for R22F
        endpoints_to_try = [
            '/api.php?action=get_bouquets',
            '/panel_api.php?action=get_bouquets',
            '/api.php?action=bouquets',
        ]
        
        for endpoint in endpoints_to_try:
            result = self._make_request(endpoint, 'GET')
            if result['success']:
                # Try to parse the response
                data = result.get('data', '')
                # R22F may return HTML or non-JSON
                # Return success but empty list if can't parse
                return {
                    'success': True,
                    'bouquets': [],
                    'raw_response': data[:200] if isinstance(data, str) else str(data)[:200]
                }
        
        return {
            'success': False,
            'error': 'Could not fetch bouquets from panel',
            'bouquets': []
        }
    
    def get_packages(self) -> Dict[str, Any]:
        """Get all available reseller packages from XtreamUI panel"""
        endpoints_to_try = [
            '/api.php?action=get_packages',
            '/panel_api.php?action=get_packages',
            '/api.php?action=packages',
        ]
        
        for endpoint in endpoints_to_try:
            result = self._make_request(endpoint, 'GET')
            if result['success']:
                data = result.get('data', '')
                return {
                    'success': True,
                    'packages': [],
                    'raw_response': data[:200] if isinstance(data, str) else str(data)[:200]
                }
        
        return {
            'success': False,
            'error': 'Could not fetch packages from panel',
            'packages': []
        }

# Singleton instance
_xtream_service = None

def get_xtream_service(settings: Optional[Dict] = None) -> Optional[XtreamUIService]:
    """Get XtreamUI service instance"""
    global _xtream_service
    
    if settings:
        _xtream_service = XtreamUIService(
            panel_url=settings.get('panel_url', ''),
            admin_username=settings.get('admin_username', ''),
            admin_password=settings.get('admin_password', ''),
            ssl_verify=settings.get('ssl_verify', False)
        )
    
    return _xtream_service
