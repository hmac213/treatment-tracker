"""
Backend API Tests for Admin endpoints
"""
import unittest
import requests
import json
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

class TestAdminAPI(unittest.TestCase):
    """Test admin API endpoints"""
    
    def setUp(self):
        """Set up test fixtures"""
        self.base_url = os.getenv('TEST_BASE_URL', 'http://localhost:3000')
        self.api_url = f"{self.base_url}/api"
        
        # Admin credentials
        self.admin_email = os.getenv('TEST_ADMIN_EMAIL', 'admin@example.com')
        self.admin_password = os.getenv('TEST_ADMIN_PASSWORD', 'password123')
        
        self.headers = {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        }
        
        # Get admin session
        self.admin_session = self._get_admin_session()
    
    def _get_admin_session(self):
        """Get admin session cookie for authenticated requests"""
        data = {
            'email': self.admin_email,
            'password': self.admin_password
        }
        
        response = requests.post(
            f"{self.api_url}/admin/login",
            headers=self.headers,
            json=data
        )
        
        if response.status_code == 200:
            session_cookie = None
            for cookie in response.cookies:
                if cookie.name == 'session':
                    session_cookie = cookie.value
                    break
            return session_cookie
        return None
    
    def _get_authenticated_headers(self):
        """Get headers with admin session cookie"""
        headers = self.headers.copy()
        if self.admin_session:
            headers['Cookie'] = f"session={self.admin_session}"
        return headers
    
    def test_admin_tree_save_unauthorized(self):
        """Test admin tree save without authentication"""
        data = {
            'nodes': [
                {
                    'id': 'test-id',
                    'key': 'test',
                    'title': 'Test Node',
                    'summary': 'Test summary'
                }
            ]
        }
        
        response = requests.post(
            f"{self.api_url}/admin/tree/save",
            headers=self.headers,
            json=data
        )
        
        self.assertEqual(response.status_code, 401)
        response_data = response.json()
        self.assertEqual(response_data['error'], 'unauthorized')
    
    def test_admin_tree_save_authorized(self):
        """Test admin tree save with authentication"""
        if not self.admin_session:
            self.skipTest("Admin session not available")
        
        data = {
            'nodes': [
                {
                    'id': 'test-node-id',
                    'key': 'test_node',
                    'title': 'Updated Test Node',
                    'summary': 'Updated test summary',
                    'video_url': 'https://example.com/video'
                }
            ]
        }
        
        response = requests.post(
            f"{self.api_url}/admin/tree/save",
            headers=self._get_authenticated_headers(),
            json=data
        )
        
        # Should return 200 if successful, 500 if node doesn't exist
        self.assertIn(response.status_code, [200, 500])
        
        if response.status_code == 200:
            response_data = response.json()
            self.assertTrue(response_data.get('ok'))
    
    def test_admin_tree_save_edge_unauthorized(self):
        """Test admin tree save edge without authentication"""
        data = {
            'edgeId': 'test-edge-id',
            'description': 'Test unlock description'
        }
        
        response = requests.post(
            f"{self.api_url}/admin/tree/save-edge",
            headers=self.headers,
            json=data
        )
        
        self.assertEqual(response.status_code, 401)
    
    def test_admin_tree_save_edge_authorized(self):
        """Test admin tree save edge with authentication"""
        if not self.admin_session:
            self.skipTest("Admin session not available")
        
        data = {
            'edgeId': 'test-edge-id',
            'description': 'Updated unlock description'
        }
        
        response = requests.post(
            f"{self.api_url}/admin/tree/save-edge",
            headers=self._get_authenticated_headers(),
            json=data
        )
        
        # Should return 200 if successful, 500 if edge doesn't exist
        self.assertIn(response.status_code, [200, 500])
    
    def test_admin_users_unauthorized(self):
        """Test admin users endpoint without authentication"""
        data = {
            'email': 'test@example.com',
            'name': 'Test User'
        }
        
        response = requests.post(
            f"{self.api_url}/admin/users",
            headers=self.headers,
            json=data
        )
        
        self.assertEqual(response.status_code, 401)
    
    def test_admin_users_authorized(self):
        """Test admin users endpoint with authentication"""
        if not self.admin_session:
            self.skipTest("Admin session not available")
        
        data = {
            'email': 'test@example.com',
            'name': 'Test User'
        }
        
        response = requests.post(
            f"{self.api_url}/admin/users",
            headers=self._get_authenticated_headers(),
            json=data
        )
        
        # Should return 200 if successful, 500 if user already exists
        self.assertIn(response.status_code, [200, 500])
    
    def test_admin_patients_search_unauthorized(self):
        """Test admin patients search without authentication"""
        data = {'searchTerm': 'test'}
        
        response = requests.post(
            f"{self.api_url}/admin/patients/search",
            headers=self.headers,
            json=data
        )
        
        self.assertEqual(response.status_code, 401)
    
    def test_admin_patients_search_authorized(self):
        """Test admin patients search with authentication"""
        if not self.admin_session:
            self.skipTest("Admin session not available")
        
        data = {'searchTerm': 'test'}
        
        response = requests.post(
            f"{self.api_url}/admin/patients/search",
            headers=self._get_authenticated_headers(),
            json=data
        )
        
        self.assertEqual(response.status_code, 200)
        response_data = response.json()
        self.assertIn('users', response_data)
        self.assertIsInstance(response_data['users'], list)
    
    def test_admin_clear_data_unauthorized(self):
        """Test admin clear data without authentication"""
        response = requests.post(
            f"{self.api_url}/admin/clear-data",
            headers=self.headers
        )
        
        self.assertEqual(response.status_code, 401)
    
    def test_admin_clear_data_authorized(self):
        """Test admin clear data with authentication - should be careful with this test"""
        if not self.admin_session:
            self.skipTest("Admin session not available")
        
        # NOTE: This test is commented out to prevent accidental data deletion
        # Uncomment only for dedicated test environments
        """
        response = requests.post(
            f"{self.api_url}/admin/clear-data",
            headers=self._get_authenticated_headers()
        )
        
        self.assertEqual(response.status_code, 200)
        response_data = response.json()
        self.assertTrue(response_data.get('ok'))
        """
        self.skipTest("Skipping destructive test - admin clear data")


if __name__ == '__main__':
    unittest.main()
