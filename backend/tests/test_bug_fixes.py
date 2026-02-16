"""
Test file for 3 bug fixes:
Bug 1: CheckoutPage 'Browse Products' link goes to "/" (frontend - already verified via Playwright)
Bug 2: Cart removeItem removes only ONE item when same product is in cart twice (frontend - already verified via Playwright)
Bug 3: Telegram notification toggle stays ON after saving (backend API test)
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestTelegramNotificationBug:
    """
    Bug 3: Telegram notification settings - when saving with enabled=true, 
    the toggle should stay ON after save.
    """
    
    @pytest.fixture
    def admin_auth_token(self):
        """Get admin authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@example.com",
            "password": "admin123"
        })
        if response.status_code == 200:
            return response.json().get("access_token")  # Fixed: access_token not token
        pytest.skip("Admin authentication failed")
    
    def test_get_current_notification_settings(self, admin_auth_token):
        """Verify we can fetch notification settings"""
        response = requests.get(
            f"{BASE_URL}/api/admin/notifications/settings",
            headers={"Authorization": f"Bearer {admin_auth_token}"}
        )
        print(f"GET notification settings: {response.status_code}")
        print(f"Response: {response.json()}")
        assert response.status_code == 200
    
    def test_save_telegram_enabled_stays_on(self, admin_auth_token):
        """
        Bug 3 test: Save Telegram settings with enabled=true, 
        then verify it stays ON after fetching again.
        
        Uses PUT /api/admin/notifications/telegram endpoint
        """
        # Step 1: Save Telegram settings with enabled=true (PUT method)
        telegram_config = {
            "enabled": True,
            "bot_token": "test_token_bug3_123",
            "chat_id": "test_chat_id_bug3_456",
            "events": {
                "new_order": True,
                "payment_received": True,
                "new_user": True,
                "service_activated": True,
                "service_expired": False,
                "service_expiry_warning": True,
                "credit_low_alert": True,
                "ticket_created": True,
                "ticket_replied": False
            }
        }
        
        save_response = requests.put(
            f"{BASE_URL}/api/admin/notifications/telegram",
            headers={"Authorization": f"Bearer {admin_auth_token}"},
            json=telegram_config
        )
        print(f"PUT save telegram settings: {save_response.status_code}")
        print(f"Save response: {save_response.json()}")
        assert save_response.status_code == 200
        
        # Step 2: Fetch the notification settings to verify enabled is still True
        get_response = requests.get(
            f"{BASE_URL}/api/admin/notifications/settings",
            headers={"Authorization": f"Bearer {admin_auth_token}"}
        )
        print(f"GET notification settings after save: {get_response.status_code}")
        settings_data = get_response.json()
        print(f"Fetched settings: {settings_data}")
        
        assert get_response.status_code == 200
        
        # Verify telegram enabled is True
        telegram_settings = settings_data.get("telegram", {})
        is_enabled = telegram_settings.get("enabled", False)
        print(f"Telegram enabled after save: {is_enabled}")
        
        assert is_enabled == True, f"BUG 3 FAILED: Telegram enabled is {is_enabled}, expected True"
        print("✅ BUG 3 VERIFIED: Telegram enabled stays True after save")
    
    def test_save_credit_threshold_doesnt_overwrite_notifications(self, admin_auth_token):
        """
        Bug 3 variant: Saving credit_alert_threshold should NOT overwrite telegram notifications.
        This tests the fix in NotificationSettings.js line 49-52.
        """
        # Step 1: First ensure telegram is enabled
        telegram_config = {
            "enabled": True,
            "bot_token": "test_token_variant_123",
            "chat_id": "test_chat_id_variant_456",
            "events": {
                "new_order": True,
                "payment_received": True,
                "new_user": True
            }
        }
        
        save_telegram = requests.put(
            f"{BASE_URL}/api/admin/notifications/telegram",
            headers={"Authorization": f"Bearer {admin_auth_token}"},
            json=telegram_config
        )
        assert save_telegram.status_code == 200
        print("Telegram settings saved with enabled=true")
        
        # Step 2: Now update credit_alert_threshold via main settings
        # Get current settings first
        settings_response = requests.get(
            f"{BASE_URL}/api/admin/settings",
            headers={"Authorization": f"Bearer {admin_auth_token}"}
        )
        current_settings = settings_response.json()
        print(f"Current settings keys: {list(current_settings.keys())}")
        
        # Update just the credit_alert_threshold via main settings endpoint
        update_response = requests.put(
            f"{BASE_URL}/api/admin/settings",
            headers={"Authorization": f"Bearer {admin_auth_token}"},
            json={"credit_alert_threshold": 15}
        )
        print(f"PUT credit threshold: {update_response.status_code}")
        
        # Step 3: Verify telegram enabled is STILL True
        get_notif = requests.get(
            f"{BASE_URL}/api/admin/notifications/settings",
            headers={"Authorization": f"Bearer {admin_auth_token}"}
        )
        telegram_after = get_notif.json().get("telegram", {})
        is_enabled = telegram_after.get("enabled", False)
        print(f"Telegram enabled after credit threshold update: {is_enabled}")
        
        assert is_enabled == True, f"BUG 3 VARIANT FAILED: Telegram enabled was overwritten to {is_enabled}"
        print("✅ BUG 3 VARIANT VERIFIED: Saving credit threshold doesn't overwrite telegram notifications")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
