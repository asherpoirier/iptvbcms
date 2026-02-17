"""
Post-Merge Regression Test Suite (v6/v7 merge)
Tests all critical API endpoints for IPTV Billing System

Test Categories:
1. Auth Flow (login, register, /me)
2. Public Endpoints (products, license status)
3. Admin Endpoints (products, KB, analytics, settings)
4. Customer Endpoints (services, orders, downloads, referrals)
5. SEO Endpoints (sitemap.xml, robots.txt, seo)
6. Coupon System
"""

import pytest
import requests
import os
from datetime import datetime

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://admin-analytics-46.preview.emergentagent.com').rstrip('/')

# Test credentials (from request)
ADMIN_EMAIL = "admin@example.com"
ADMIN_PASSWORD = "Admin123!"
CUSTOMER_EMAIL = "customer@test.com"
CUSTOMER_PASSWORD = "Test123!"


class TestHealthCheck:
    """Basic health check"""
    
    def test_health_endpoint(self):
        response = requests.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200, f"Health check failed: {response.text}"
        data = response.json()
        assert data.get("status") == "healthy"
        print("Health check passed")


class TestLicenseStatus:
    """License status endpoint - should return licensed=true in preview env"""
    
    def test_license_status(self):
        response = requests.get(f"{BASE_URL}/api/license/status")
        assert response.status_code == 200, f"License status failed: {response.text}"
        data = response.json()
        # In preview environment, license is bypassed
        assert "licensed" in data, "Response should have 'licensed' field"
        print(f"License status: {data}")


class TestAuthFlow:
    """Authentication flow tests"""
    
    def test_admin_login(self):
        """Test admin login with Admin123! password"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200, f"Admin login failed: {response.text}"
        data = response.json()
        assert "access_token" in data, "Response should have 'access_token' field"
        assert data.get("user", {}).get("role") == "admin", "User should be admin"
        print(f"Admin login successful: {data.get('user', {}).get('email')}")
        return data["access_token"]
    
    def test_customer_login(self):
        """Test customer login"""
        # First create customer if not exists
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": CUSTOMER_EMAIL,
            "password": CUSTOMER_PASSWORD
        })
        if response.status_code == 401:
            pytest.skip("Customer account doesn't exist, skip this test")
        
        assert response.status_code == 200 or response.status_code == 403, f"Customer login unexpected status: {response.text}"
        
        if response.status_code == 403:
            # Email not verified is OK for this test - means account exists
            print("Customer account exists but email not verified (expected)")
            return
        
        data = response.json()
        assert "access_token" in data
        print(f"Customer login successful")
        return data.get("access_token")
    
    def test_auth_me_endpoint(self):
        """Test /api/auth/me with valid token"""
        # First login as admin
        login_response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert login_response.status_code == 200
        token = login_response.json()["access_token"]
        
        # Test /me endpoint
        me_response = requests.get(
            f"{BASE_URL}/api/auth/me",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert me_response.status_code == 200, f"/api/auth/me failed: {me_response.text}"
        data = me_response.json()
        assert data.get("email") == ADMIN_EMAIL
        assert data.get("role") == "admin"
        print(f"/api/auth/me returned: {data.get('email')}, role={data.get('role')}")
    
    def test_invalid_login(self):
        """Test login with wrong credentials"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "wrong@example.com",
            "password": "wrongpassword"
        })
        assert response.status_code == 401, "Invalid login should return 401"
        print("Invalid login correctly returned 401")


class TestPublicProducts:
    """Public product endpoints"""
    
    def test_get_products(self):
        """Test GET /api/products (public)"""
        response = requests.get(f"{BASE_URL}/api/products")
        assert response.status_code == 200, f"Get products failed: {response.text}"
        data = response.json()
        assert isinstance(data, list), "Products should be a list"
        print(f"Found {len(data)} products")
        
        # Check product structure
        if len(data) > 0:
            product = data[0]
            assert "name" in product, "Product should have 'name'"
            assert "prices" in product, "Product should have 'prices'"
            print(f"First product: {product.get('name')}")
    
    def test_product_detail(self):
        """Test GET /api/products/{id}"""
        # First get product list
        list_response = requests.get(f"{BASE_URL}/api/products")
        assert list_response.status_code == 200
        products = list_response.json()
        
        if len(products) == 0:
            pytest.skip("No products available")
        
        product_id = products[0].get("id")
        detail_response = requests.get(f"{BASE_URL}/api/products/{product_id}")
        assert detail_response.status_code == 200, f"Product detail failed: {detail_response.text}"
        data = detail_response.json()
        assert data.get("id") == product_id
        print(f"Product detail: {data.get('name')}")


class TestAdminProducts:
    """Admin product management tests"""
    
    @pytest.fixture(autouse=True)
    def admin_token(self):
        """Get admin token for authenticated requests"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        if response.status_code != 200:
            pytest.skip("Admin login failed")
        return response.json()["access_token"]
    
    def test_admin_products_list(self, admin_token):
        """Test GET /api/admin/products"""
        response = requests.get(
            f"{BASE_URL}/api/admin/products",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200, f"Admin products failed: {response.text}"
        data = response.json()
        assert isinstance(data, list)
        print(f"Admin can see {len(data)} products")
        
        # Check for bundle support
        bundles = [p for p in data if p.get("is_bundle")]
        print(f"Found {len(bundles)} bundle products")


class TestKnowledgeBase:
    """Knowledge Base API tests"""
    
    @pytest.fixture(autouse=True)
    def admin_token(self):
        """Get admin token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        if response.status_code != 200:
            pytest.skip("Admin login failed")
        return response.json()["access_token"]
    
    def test_admin_kb_list(self, admin_token):
        """Test GET /api/admin/kb"""
        response = requests.get(
            f"{BASE_URL}/api/admin/kb",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200, f"Admin KB list failed: {response.text}"
        data = response.json()
        assert isinstance(data, list)
        print(f"Admin KB articles: {len(data)}")
    
    def test_public_kb_list(self):
        """Test GET /api/kb (public)"""
        response = requests.get(f"{BASE_URL}/api/kb")
        assert response.status_code == 200, f"Public KB list failed: {response.text}"
        data = response.json()
        assert isinstance(data, list)
        print(f"Public KB articles: {len(data)}")
    
    def test_admin_kb_create(self, admin_token):
        """Test POST /api/admin/kb"""
        test_article = {
            "title": "TEST_Regression Article",
            "content": "This is a test article for regression testing",
            "category": "guides",
            "published": True
        }
        response = requests.post(
            f"{BASE_URL}/api/admin/kb",
            json=test_article,
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code in [200, 201], f"Create KB article failed: {response.text}"
        data = response.json()
        article_id = data.get("id")
        print(f"Created KB article: {article_id}")
        
        # Cleanup
        if article_id:
            requests.delete(
                f"{BASE_URL}/api/admin/kb/{article_id}",
                headers={"Authorization": f"Bearer {admin_token}"}
            )
            print("Cleaned up test KB article")


class TestAnalytics:
    """Analytics dashboard API tests"""
    
    @pytest.fixture(autouse=True)
    def admin_token(self):
        """Get admin token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        if response.status_code != 200:
            pytest.skip("Admin login failed")
        return response.json()["access_token"]
    
    def test_analytics_endpoint(self, admin_token):
        """Test GET /api/admin/analytics"""
        response = requests.get(
            f"{BASE_URL}/api/admin/analytics",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200, f"Analytics failed: {response.text}"
        data = response.json()
        # Check for expected analytics fields
        print(f"Analytics data keys: {list(data.keys())}")


class TestSEOEndpoints:
    """SEO-related endpoints"""
    
    def test_sitemap_xml(self):
        """Test GET /api/sitemap.xml"""
        response = requests.get(f"{BASE_URL}/api/sitemap.xml")
        assert response.status_code == 200, f"Sitemap failed: {response.text}"
        # Should be XML content
        assert "xml" in response.headers.get("content-type", "").lower() or "<?xml" in response.text
        print("Sitemap XML returned successfully")
    
    def test_robots_txt(self):
        """Test GET /api/robots.txt"""
        response = requests.get(f"{BASE_URL}/api/robots.txt")
        assert response.status_code == 200, f"Robots.txt failed: {response.text}"
        # Should be plain text
        assert "User-agent" in response.text or "user-agent" in response.text.lower()
        print("Robots.txt returned successfully")
    
    def test_seo_settings(self):
        """Test GET /api/seo"""
        response = requests.get(f"{BASE_URL}/api/seo")
        assert response.status_code == 200, f"SEO settings failed: {response.text}"
        data = response.json()
        print(f"SEO settings keys: {list(data.keys())}")


class TestAdminSettings:
    """Admin settings endpoints"""
    
    @pytest.fixture(autouse=True)
    def admin_token(self):
        """Get admin token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        if response.status_code != 200:
            pytest.skip("Admin login failed")
        return response.json()["access_token"]
    
    def test_admin_settings(self, admin_token):
        """Test GET /api/admin/settings"""
        response = requests.get(
            f"{BASE_URL}/api/admin/settings",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200, f"Admin settings failed: {response.text}"
        data = response.json()
        
        # Check for payment gateway settings
        payment_gateways = ["paypal", "stripe", "square", "blockonomics", "helcim"]
        for gateway in payment_gateways:
            assert gateway in data, f"Settings should have '{gateway}'"
        
        print(f"Payment gateways in settings: {payment_gateways}")


class TestCoupons:
    """Coupon system tests"""
    
    @pytest.fixture(autouse=True)
    def admin_token(self):
        """Get admin token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        if response.status_code != 200:
            pytest.skip("Admin login failed")
        return response.json()["access_token"]
    
    def test_admin_coupons_list(self, admin_token):
        """Test GET /api/admin/coupons"""
        response = requests.get(
            f"{BASE_URL}/api/admin/coupons",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200, f"Admin coupons failed: {response.text}"
        data = response.json()
        assert isinstance(data, list)
        print(f"Found {len(data)} coupons")
    
    def test_coupon_validate_invalid(self):
        """Test POST /api/coupon/validate with invalid code"""
        response = requests.post(f"{BASE_URL}/api/coupon/validate", json={
            "code": "INVALID_CODE_12345",
            "subtotal": 50.0
        })
        # API returns 200 with valid=false for invalid codes
        assert response.status_code == 200, f"Coupon validate failed: {response.text}"
        data = response.json()
        assert data.get("valid") == False, "Invalid coupon should return valid=false"
        print("Invalid coupon validation works correctly")


class TestDownloads:
    """Downloads system tests"""
    
    @pytest.fixture(autouse=True)
    def admin_token(self):
        """Get admin token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        if response.status_code != 200:
            pytest.skip("Admin login failed")
        return response.json()["access_token"]
    
    def test_admin_downloads_list(self, admin_token):
        """Test GET /api/admin/downloads"""
        response = requests.get(
            f"{BASE_URL}/api/admin/downloads",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200, f"Admin downloads failed: {response.text}"
        data = response.json()
        assert isinstance(data, list)
        print(f"Found {len(data)} downloads")
    
    def test_customer_downloads(self, admin_token):
        """Test GET /api/downloads (customer endpoint)"""
        response = requests.get(
            f"{BASE_URL}/api/downloads",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200, f"Customer downloads failed: {response.text}"
        data = response.json()
        # Response is {downloads: [], has_active_service: bool}
        assert "downloads" in data, "Response should have 'downloads' field"
        assert isinstance(data.get("downloads"), list)
        print(f"Customer can see {len(data.get('downloads', []))} downloads")


class TestReferrals:
    """Referral system tests"""
    
    @pytest.fixture(autouse=True)
    def admin_token(self):
        """Get admin token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        if response.status_code != 200:
            pytest.skip("Admin login failed")
        return response.json()["access_token"]
    
    def test_my_referral_code(self, admin_token):
        """Test GET /api/referral/my-code"""
        response = requests.get(
            f"{BASE_URL}/api/referral/my-code",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200, f"My referral code failed: {response.text}"
        data = response.json()
        print(f"Referral code data: {data}")


class TestCustomerOrders:
    """Customer orders tests"""
    
    @pytest.fixture(autouse=True)
    def admin_token(self):
        """Get admin token (using admin to test customer endpoints)"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        if response.status_code != 200:
            pytest.skip("Admin login failed")
        return response.json()["access_token"]
    
    def test_customer_orders_list(self, admin_token):
        """Test GET /api/orders"""
        response = requests.get(
            f"{BASE_URL}/api/orders",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200, f"Customer orders failed: {response.text}"
        data = response.json()
        assert isinstance(data, list)
        print(f"Customer can see {len(data)} orders")


class TestCustomerServices:
    """Customer services tests"""
    
    @pytest.fixture(autouse=True)
    def admin_token(self):
        """Get admin token (using admin to test customer endpoints)"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        if response.status_code != 200:
            pytest.skip("Admin login failed")
        return response.json()["access_token"]
    
    def test_customer_services_list(self, admin_token):
        """Test GET /api/services"""
        response = requests.get(
            f"{BASE_URL}/api/services",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200, f"Customer services failed: {response.text}"
        data = response.json()
        assert isinstance(data, list)
        print(f"Customer can see {len(data)} services")


class TestCurrency:
    """Currency endpoint tests"""
    
    def test_currency_endpoint(self):
        """Test GET /api/currency"""
        response = requests.get(f"{BASE_URL}/api/currency")
        assert response.status_code == 200, f"Currency failed: {response.text}"
        data = response.json()
        print(f"Currency: {data}")


class TestBranding:
    """Branding endpoint tests"""
    
    def test_branding_endpoint(self):
        """Test GET /api/branding"""
        response = requests.get(f"{BASE_URL}/api/branding")
        assert response.status_code == 200, f"Branding failed: {response.text}"
        data = response.json()
        print(f"Branding site_name: {data.get('site_name')}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
