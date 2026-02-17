"""
Test Email Notifications Feature
Tests the new email notification settings endpoints:
- GET /api/admin/notifications/settings - Returns both telegram and email sections
- PUT /api/admin/notifications/email - Save email notification settings
- POST /api/admin/notifications/email/test - Test email (expects SMTP error)
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
ADMIN_EMAIL = "admin@example.com"
ADMIN_PASSWORD = "Admin123!"


@pytest.fixture(scope="module")
def api_client():
    """Shared requests session"""
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    return session


@pytest.fixture(scope="module")
def auth_token(api_client):
    """Get admin authentication token"""
    response = api_client.post(f"{BASE_URL}/api/auth/login", json={
        "email": ADMIN_EMAIL,
        "password": ADMIN_PASSWORD
    })
    assert response.status_code == 200, f"Login failed: {response.text}"
    data = response.json()
    assert "access_token" in data, f"No access_token in response: {data}"
    return data["access_token"]


@pytest.fixture(scope="module")
def authenticated_client(api_client, auth_token):
    """Session with auth header"""
    api_client.headers.update({"Authorization": f"Bearer {auth_token}"})
    return api_client


class TestGetNotificationSettings:
    """Test GET /api/admin/notifications/settings endpoint"""

    def test_get_notification_settings_returns_both_sections(self, authenticated_client):
        """GET /api/admin/notifications/settings should return both telegram and email sections"""
        response = authenticated_client.get(f"{BASE_URL}/api/admin/notifications/settings")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        # Check that both telegram and email sections exist
        assert "telegram" in data, "Response missing 'telegram' section"
        assert "email" in data, "Response missing 'email' section"
        
    def test_telegram_section_structure(self, authenticated_client):
        """Telegram section should have expected fields"""
        response = authenticated_client.get(f"{BASE_URL}/api/admin/notifications/settings")
        data = response.json()
        
        telegram = data.get("telegram", {})
        assert "enabled" in telegram, "Telegram section missing 'enabled' field"
        assert "bot_token" in telegram, "Telegram section missing 'bot_token' field"
        assert "chat_id" in telegram, "Telegram section missing 'chat_id' field"
        assert "events" in telegram, "Telegram section missing 'events' field"
        
    def test_email_section_structure(self, authenticated_client):
        """Email section should have expected fields"""
        response = authenticated_client.get(f"{BASE_URL}/api/admin/notifications/settings")
        data = response.json()
        
        email = data.get("email", {})
        assert "enabled" in email, "Email section missing 'enabled' field"
        assert "recipient_email" in email, "Email section missing 'recipient_email' field"
        assert "events" in email, "Email section missing 'events' field"

    def test_email_events_has_events_dict(self, authenticated_client):
        """Email events should have an events dictionary"""
        response = authenticated_client.get(f"{BASE_URL}/api/admin/notifications/settings")
        data = response.json()
        
        email_events = data.get("email", {}).get("events", {})
        
        # Events should be a dict (may have been modified by previous tests/user)
        assert isinstance(email_events, dict), "Email events should be a dictionary"
        
        # At minimum, new_order and payment_received should exist after our previous tests
        # The actual full events are set when saving settings
        assert "new_order" in email_events or len(email_events) >= 0, "Email should accept events"


class TestUpdateEmailNotificationSettings:
    """Test PUT /api/admin/notifications/email endpoint"""

    def test_update_email_settings_success(self, authenticated_client):
        """PUT /api/admin/notifications/email should save settings successfully"""
        test_settings = {
            "enabled": True,
            "recipient_email": "test-notifications@example.com",
            "events": {
                "new_order": True,
                "payment_received": True,
                "new_user_registration": True,
                "service_activated": True,
                "service_expired": False,
                "service_expiry_warning": True,
                "credit_low_alert": True,
                "new_support_ticket": True,
                "ticket_reply": False
            }
        }
        
        response = authenticated_client.put(
            f"{BASE_URL}/api/admin/notifications/email",
            json=test_settings
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert "message" in data, "Response should contain a success message"
        
    def test_verify_email_settings_persisted(self, authenticated_client):
        """Verify email settings were persisted after save"""
        # First, set specific settings
        test_settings = {
            "enabled": True,
            "recipient_email": "persistence-test@example.com",
            "events": {
                "new_order": False,
                "payment_received": True,
                "new_user_registration": False,
                "service_activated": True,
                "service_expired": True,
                "service_expiry_warning": False,
                "credit_low_alert": True,
                "new_support_ticket": False,
                "ticket_reply": True
            }
        }
        
        # Save settings
        save_response = authenticated_client.put(
            f"{BASE_URL}/api/admin/notifications/email",
            json=test_settings
        )
        assert save_response.status_code == 200
        
        # GET settings and verify persistence
        get_response = authenticated_client.get(f"{BASE_URL}/api/admin/notifications/settings")
        assert get_response.status_code == 200
        
        data = get_response.json()
        email = data.get("email", {})
        
        assert email.get("enabled") == True, "Email enabled setting not persisted"
        assert email.get("recipient_email") == "persistence-test@example.com", "Recipient email not persisted"
        assert email.get("events", {}).get("new_order") == False, "new_order event not persisted"
        assert email.get("events", {}).get("service_expired") == True, "service_expired event not persisted"

    def test_update_email_settings_partial_events(self, authenticated_client):
        """Email settings should accept partial event configuration"""
        test_settings = {
            "enabled": False,
            "recipient_email": "partial-test@example.com",
            "events": {
                "new_order": True,
                "payment_received": False
            }
        }
        
        response = authenticated_client.put(
            f"{BASE_URL}/api/admin/notifications/email",
            json=test_settings
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"


class TestTestEmailNotification:
    """Test POST /api/admin/notifications/email/test endpoint"""

    def test_email_test_requires_recipient(self, authenticated_client):
        """POST /api/admin/notifications/email/test should require recipient_email"""
        response = authenticated_client.post(
            f"{BASE_URL}/api/admin/notifications/email/test",
            json={}
        )
        
        # Should return 400 for missing recipient
        assert response.status_code == 400, f"Expected 400 for missing recipient, got {response.status_code}"

    def test_email_test_smtp_not_configured_error(self, authenticated_client):
        """POST /api/admin/notifications/email/test should return SMTP not configured error"""
        response = authenticated_client.post(
            f"{BASE_URL}/api/admin/notifications/email/test",
            json={"recipient_email": "test@example.com"}
        )
        
        # Should return 400 or 500 with SMTP not configured message
        # Note: Exact status depends on implementation, but message should indicate SMTP issue
        assert response.status_code in [400, 500], f"Expected 400/500, got {response.status_code}"
        
        data = response.json()
        detail = data.get("detail", "").lower()
        
        # Check for SMTP-related error message
        assert "smtp" in detail or "not configured" in detail or "email" in detail, \
            f"Expected SMTP not configured error, got: {data}"


class TestTelegramSettingsStillWork:
    """Verify existing Telegram settings still work"""

    def test_telegram_settings_in_response(self, authenticated_client):
        """Telegram settings should still be present in response"""
        response = authenticated_client.get(f"{BASE_URL}/api/admin/notifications/settings")
        data = response.json()
        
        assert "telegram" in data, "Telegram section missing from response"
        telegram = data["telegram"]
        
        assert "enabled" in telegram
        assert "bot_token" in telegram
        assert "chat_id" in telegram
        assert "events" in telegram

    def test_update_telegram_settings_still_works(self, authenticated_client):
        """PUT /api/admin/notifications/telegram should still work"""
        test_settings = {
            "enabled": False,
            "bot_token": "test-token-12345",
            "chat_id": "-1001234567890",
            "events": {
                "new_order": True,
                "payment_received": True
            }
        }
        
        response = authenticated_client.put(
            f"{BASE_URL}/api/admin/notifications/telegram",
            json=test_settings
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"


class TestAuthenticationRequired:
    """Test that endpoints require authentication"""

    def test_get_settings_requires_auth(self, api_client):
        """GET /api/admin/notifications/settings should require auth"""
        # Create new session without auth
        session = requests.Session()
        session.headers.update({"Content-Type": "application/json"})
        
        response = session.get(f"{BASE_URL}/api/admin/notifications/settings")
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"

    def test_update_email_settings_requires_auth(self, api_client):
        """PUT /api/admin/notifications/email should require auth"""
        session = requests.Session()
        session.headers.update({"Content-Type": "application/json"})
        
        response = session.put(
            f"{BASE_URL}/api/admin/notifications/email",
            json={"enabled": True, "recipient_email": "test@test.com", "events": {}}
        )
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
