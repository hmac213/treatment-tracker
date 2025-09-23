"""
Backend API Tests for Patient/User endpoints
"""
import unittest
import requests
import json
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

class TestPatientAPI(unittest.TestCase):
    """Test patient/user API endpoints"""
    
    def setUp(self):
        """Set up test fixtures"""
        self.base_url = os.getenv('TEST_BASE_URL', 'http://localhost:3000')
        self.api_url = f"{self.base_url}/api"
        
        # Test user credentials
        self.user_email = os.getenv('TEST_USER_EMAIL', 'test@example.com')
        
        self.headers = {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        }
        
        # Get user session
        self.user_session = self._get_user_session()
    
    def _get_user_session(self):
        """Get user session cookie for authenticated requests"""
        data = {'email': self.user_email}
        
        response = requests.post(
            f"{self.api_url}/login",
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
        """Get headers with user session cookie"""
        headers = self.headers.copy()
        if self.user_session:
            headers['Cookie'] = f"session={self.user_session}"
        return headers
    
    def test_unlock_node_unauthorized(self):
        """Test unlock node without authentication"""
        data = {'nodeId': 'test-node-id'}
        
        response = requests.post(
            f"{self.api_url}/unlock-node",
            headers=self.headers,
            json=data
        )
        
        self.assertEqual(response.status_code, 401)
        response_data = response.json()
        self.assertEqual(response_data['error'], 'unauthorized')
    
    def test_unlock_node_missing_node_id(self):
        """Test unlock node without nodeId"""
        if not self.user_session:
            self.skipTest("User session not available")
        
        data = {}
        
        response = requests.post(
            f"{self.api_url}/unlock-node",
            headers=self._get_authenticated_headers(),
            json=data
        )
        
        self.assertEqual(response.status_code, 400)
        response_data = response.json()
        self.assertEqual(response_data['error'], 'nodeId is required')
    
    def test_unlock_node_invalid_node_id(self):
        """Test unlock node with invalid nodeId"""
        if not self.user_session:
            self.skipTest("User session not available")
        
        data = {'nodeId': 'invalid-node-id'}
        
        response = requests.post(
            f"{self.api_url}/unlock-node",
            headers=self._get_authenticated_headers(),
            json=data
        )
        
        # Should return 400 if node cannot be unlocked or doesn't exist
        self.assertEqual(response.status_code, 400)
        response_data = response.json()
        self.assertIn('error', response_data)
    
    def test_unlock_node_valid_request(self):
        """Test unlock node with valid, unlockable nodeId"""
        if not self.user_session:
            self.skipTest("User session not available")
        
        # This would need a real node ID that can be unlocked
        # In a real test, you'd set up test data or use a known unlockable node
        data = {'nodeId': 'unlockable-test-node-id'}
        
        response = requests.post(
            f"{self.api_url}/unlock-node",
            headers=self._get_authenticated_headers(),
            json=data
        )
        
        # Could be 200 (success), 400 (already unlocked/can't unlock)
        self.assertIn(response.status_code, [200, 400])
        
        response_data = response.json()
        if response.status_code == 200:
            self.assertTrue(response_data.get('success'))
        else:
            self.assertIn('error', response_data)
    
    def test_unlock_by_symptoms_unauthorized(self):
        """Test unlock by symptoms without authentication"""
        data = {'symptoms': ['pain', 'nausea']}
        
        response = requests.post(
            f"{self.api_url}/unlock-by-symptoms",
            headers=self.headers,
            json=data
        )
        
        self.assertEqual(response.status_code, 401)
    
    def test_unlock_by_symptoms_valid_request(self):
        """Test unlock by symptoms with authentication"""
        if not self.user_session:
            self.skipTest("User session not available")
        
        data = {'symptoms': ['pain', 'nausea']}
        
        response = requests.post(
            f"{self.api_url}/unlock-by-symptoms",
            headers=self._get_authenticated_headers(),
            json=data
        )
        
        # Should return 200 regardless of whether any nodes are unlocked
        self.assertEqual(response.status_code, 200)
        response_data = response.json()
        self.assertIn('unlockedNodes', response_data)
        self.assertIsInstance(response_data['unlockedNodes'], list)
    
    def test_unlock_by_symptoms_empty_symptoms(self):
        """Test unlock by symptoms with empty symptoms array"""
        if not self.user_session:
            self.skipTest("User session not available")
        
        data = {'symptoms': []}
        
        response = requests.post(
            f"{self.api_url}/unlock-by-symptoms",
            headers=self._get_authenticated_headers(),
            json=data
        )
        
        self.assertEqual(response.status_code, 200)
        response_data = response.json()
        self.assertEqual(response_data['unlockedNodes'], [])


class TestPublicEndpoints(unittest.TestCase):
    """Test public endpoints that don't require authentication"""
    
    def setUp(self):
        """Set up test fixtures"""
        self.base_url = os.getenv('TEST_BASE_URL', 'http://localhost:3000')
    
    def test_homepage_accessible(self):
        """Test that homepage is accessible"""
        response = requests.get(self.base_url)
        self.assertEqual(response.status_code, 200)
        self.assertIn('text/html', response.headers.get('content-type', ''))
    
    def test_me_page_when_not_logged_in(self):
        """Test that /me page handles unauthenticated users"""
        response = requests.get(f"{self.base_url}/me", allow_redirects=False)
        
        # Page returns 200 but shows message for unauthenticated users
        self.assertEqual(response.status_code, 200)
        
        # Check that the response contains the expected message
        self.assertIn('text/html', response.headers.get('content-type', ''))
        # Could check for specific text content if needed


if __name__ == '__main__':
    unittest.main()
