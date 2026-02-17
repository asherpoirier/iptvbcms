"""
Knowledge Base API Tests
Tests for KB article CRUD operations and public/admin access
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://admin-analytics-46.preview.emergentagent.com')

class TestKnowledgeBasePublic:
    """Public Knowledge Base endpoint tests"""
    
    def test_get_kb_returns_empty_list_when_no_articles(self, api_client):
        """GET /api/kb returns empty array when no articles exist"""
        response = api_client.get(f"{BASE_URL}/api/kb")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"Public KB articles count: {len(data)}")
    
    def test_get_kb_article_not_found(self, api_client):
        """GET /api/kb/{id} returns 404 for non-existent article"""
        response = api_client.get(f"{BASE_URL}/api/kb/non-existent-article-id")
        assert response.status_code == 404
        print("Non-existent article returns 404 as expected")


class TestKnowledgeBaseAdminCRUD:
    """Admin KB article CRUD operations requiring authentication"""
    
    def test_admin_kb_requires_auth(self, api_client):
        """Admin KB endpoints require authentication"""
        # Test without auth
        response = api_client.get(f"{BASE_URL}/api/admin/kb")
        assert response.status_code in [401, 403], f"Expected 401/403 without auth, got {response.status_code}"
        print("Admin KB GET requires authentication")
    
    def test_admin_kb_create_requires_auth(self, api_client):
        """POST /api/admin/kb requires authentication"""
        response = api_client.post(f"{BASE_URL}/api/admin/kb", json={
            "title": "Test Article",
            "content": "Test content"
        })
        assert response.status_code in [401, 403], f"Expected 401/403 without auth, got {response.status_code}"
        print("Admin KB POST requires authentication")
    
    def test_create_kb_article(self, authenticated_client):
        """POST /api/admin/kb creates a KB article"""
        article_data = {
            "title": "TEST_How to Setup IPTV",
            "content": "This is a test article for setting up IPTV services.\n\nStep 1: Download the app\nStep 2: Enter credentials\nStep 3: Enjoy!",
            "category": "Setup Guides",
            "is_published": True,
            "display_order": 1
        }
        response = authenticated_client.post(f"{BASE_URL}/api/admin/kb", json=article_data)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "id" in data, "Response should contain article id"
        assert data["title"] == article_data["title"]
        assert data["content"] == article_data["content"]
        assert data["category"] == article_data["category"]
        assert data["is_published"] == article_data["is_published"]
        assert data["display_order"] == article_data["display_order"]
        
        # Store article ID for subsequent tests
        TestKnowledgeBaseAdminCRUD.created_article_id = data["id"]
        print(f"Created KB article: {data['id']}")
        return data
    
    def test_get_admin_kb_articles(self, authenticated_client):
        """GET /api/admin/kb returns all articles for admin"""
        response = authenticated_client.get(f"{BASE_URL}/api/admin/kb")
        assert response.status_code == 200
        
        data = response.json()
        assert isinstance(data, list)
        assert len(data) >= 1, "Should have at least one article (created in previous test)"
        
        # Verify article structure
        if data:
            article = data[0]
            assert "id" in article
            assert "title" in article
            assert "content" in article
            assert "category" in article
            assert "is_published" in article
            assert "display_order" in article
        
        print(f"Admin KB returned {len(data)} articles")
    
    def test_update_kb_article(self, authenticated_client):
        """PUT /api/admin/kb/{id} updates an article"""
        article_id = getattr(TestKnowledgeBaseAdminCRUD, 'created_article_id', None)
        if not article_id:
            pytest.skip("No article created in previous test")
        
        update_data = {
            "title": "TEST_Updated How to Setup IPTV",
            "content": "Updated content with more detailed instructions.",
            "category": "Getting Started",
            "is_published": False,
            "display_order": 2
        }
        response = authenticated_client.put(f"{BASE_URL}/api/admin/kb/{article_id}", json=update_data)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data["title"] == update_data["title"]
        assert data["content"] == update_data["content"]
        assert data["category"] == update_data["category"]
        assert data["is_published"] == update_data["is_published"]
        assert data["display_order"] == update_data["display_order"]
        
        print(f"Updated KB article: {article_id}")
    
    def test_unpublished_article_not_in_public(self, api_client, authenticated_client):
        """Unpublished articles should not appear in public /api/kb"""
        # Get public articles
        response = api_client.get(f"{BASE_URL}/api/kb")
        assert response.status_code == 200
        
        public_articles = response.json()
        
        # Check that our unpublished test article is not in public list
        article_id = getattr(TestKnowledgeBaseAdminCRUD, 'created_article_id', None)
        if article_id:
            article_ids = [a["id"] for a in public_articles]
            assert article_id not in article_ids, "Unpublished article should not appear in public KB"
            print("Unpublished article correctly hidden from public")
        else:
            pytest.skip("No article created in previous test")
    
    def test_publish_article_appears_in_public(self, authenticated_client, api_client):
        """Published articles should appear in public /api/kb"""
        article_id = getattr(TestKnowledgeBaseAdminCRUD, 'created_article_id', None)
        if not article_id:
            pytest.skip("No article created in previous test")
        
        # Publish the article
        response = authenticated_client.put(f"{BASE_URL}/api/admin/kb/{article_id}", json={
            "is_published": True
        })
        assert response.status_code == 200
        
        # Check public endpoint
        response = api_client.get(f"{BASE_URL}/api/kb")
        assert response.status_code == 200
        
        public_articles = response.json()
        article_ids = [a["id"] for a in public_articles]
        assert article_id in article_ids, "Published article should appear in public KB"
        print("Published article correctly visible in public KB")
    
    def test_get_single_published_article(self, api_client):
        """GET /api/kb/{id} returns a single published article"""
        article_id = getattr(TestKnowledgeBaseAdminCRUD, 'created_article_id', None)
        if not article_id:
            pytest.skip("No article created in previous test")
        
        response = api_client.get(f"{BASE_URL}/api/kb/{article_id}")
        assert response.status_code == 200
        
        data = response.json()
        assert data["id"] == article_id
        assert "title" in data
        assert "content" in data
        print(f"Retrieved single article: {data['title']}")
    
    def test_update_nonexistent_article(self, authenticated_client):
        """PUT /api/admin/kb/{id} returns 404 for non-existent article"""
        response = authenticated_client.put(f"{BASE_URL}/api/admin/kb/non-existent-id", json={
            "title": "Test"
        })
        assert response.status_code == 404
        print("Update non-existent article returns 404")
    
    def test_delete_kb_article(self, authenticated_client):
        """DELETE /api/admin/kb/{id} deletes an article"""
        article_id = getattr(TestKnowledgeBaseAdminCRUD, 'created_article_id', None)
        if not article_id:
            pytest.skip("No article created in previous test")
        
        response = authenticated_client.delete(f"{BASE_URL}/api/admin/kb/{article_id}")
        assert response.status_code == 200
        
        # Verify article is deleted
        response = authenticated_client.get(f"{BASE_URL}/api/admin/kb")
        articles = response.json()
        article_ids = [a["id"] for a in articles]
        assert article_id not in article_ids, "Deleted article should not appear in list"
        
        print(f"Deleted KB article: {article_id}")
    
    def test_delete_nonexistent_article(self, authenticated_client):
        """DELETE /api/admin/kb/{id} returns 404 for non-existent article"""
        response = authenticated_client.delete(f"{BASE_URL}/api/admin/kb/non-existent-id")
        assert response.status_code == 404
        print("Delete non-existent article returns 404")


class TestKnowledgeBaseValidation:
    """Validation tests for KB articles"""
    
    def test_create_article_without_title(self, authenticated_client):
        """POST /api/admin/kb returns 400 when title is missing"""
        response = authenticated_client.post(f"{BASE_URL}/api/admin/kb", json={
            "content": "Some content without title"
        })
        assert response.status_code == 400
        print("Article creation without title returns 400")
    
    def test_create_article_without_content(self, authenticated_client):
        """POST /api/admin/kb returns 400 when content is missing"""
        response = authenticated_client.post(f"{BASE_URL}/api/admin/kb", json={
            "title": "Title without content"
        })
        assert response.status_code == 400
        print("Article creation without content returns 400")


# Fixtures
@pytest.fixture
def api_client():
    """Shared requests session without auth"""
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    return session


@pytest.fixture
def auth_token(api_client):
    """Get authentication token for admin user"""
    response = api_client.post(f"{BASE_URL}/api/auth/login", json={
        "email": "admin@example.com",
        "password": "admin123"
    })
    if response.status_code == 200:
        data = response.json()
        return data.get("access_token")
    pytest.skip("Authentication failed - skipping authenticated tests")


@pytest.fixture
def authenticated_client(api_client, auth_token):
    """Session with auth header"""
    api_client.headers.update({"Authorization": f"Bearer {auth_token}"})
    return api_client
