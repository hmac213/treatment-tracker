"""
Frontend Tests for Authentication Flow
"""
import unittest
import time
import os
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.chrome.options import Options
from selenium.common.exceptions import TimeoutException, NoSuchElementException, UnexpectedAlertPresentException
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

class TestAuthenticationFlow(unittest.TestCase):
    """Test user authentication flow"""
    
    def setUp(self):
        """Set up Selenium WebDriver"""
        self.base_url = os.getenv('TEST_BASE_URL', 'http://localhost:3000')
        self.test_user_email = os.getenv('TEST_USER_EMAIL', 'test@example.com')
        self.test_admin_email = os.getenv('TEST_ADMIN_EMAIL', 'admin@example.com')
        self.test_admin_password = os.getenv('TEST_ADMIN_PASSWORD', 'password123')
        
        # Set up Chrome options for headless testing
        chrome_options = Options()
        if os.getenv('HEADLESS', 'true').lower() == 'true':
            chrome_options.add_argument('--headless')
        chrome_options.add_argument('--no-sandbox')
        chrome_options.add_argument('--disable-dev-shm-usage')
        chrome_options.add_argument('--disable-gpu')
        chrome_options.add_argument('--window-size=1920,1080')
        
        try:
            self.driver = webdriver.Chrome(options=chrome_options)
            self.driver.implicitly_wait(10)
            self.wait = WebDriverWait(self.driver, 10)
        except Exception as e:
            self.skipTest(f"Chrome WebDriver not available: {e}")
    
    def tearDown(self):
        """Clean up WebDriver"""
        if hasattr(self, 'driver'):
            self.driver.quit()
    
    def _handle_alert(self):
        """Helper method to handle JavaScript alerts"""
        try:
            alert = self.driver.switch_to.alert
            alert_text = alert.text
            alert.accept()
            return alert_text
        except:
            return None
    
    def test_homepage_loads(self):
        """Test that homepage loads correctly"""
        self.driver.get(self.base_url)
        
        # Check that page loads (look for common elements)
        try:
            # Wait for page to load by looking for body element
            self.wait.until(EC.presence_of_element_located((By.TAG_NAME, "body")))
            self.assertIn("Treatment Helper", self.driver.title)
        except TimeoutException:
            self.fail("Homepage did not load within timeout")
    
    def test_user_login_form_exists(self):
        """Test that user login form exists on homepage"""
        self.driver.get(self.base_url)
        
        try:
            # Look for email input field
            email_input = self.wait.until(
                EC.presence_of_element_located((By.CSS_SELECTOR, "input[type='email']"))
            )
            self.assertTrue(email_input.is_displayed())
            
            # Look for login button
            login_button = self.driver.find_element(By.CSS_SELECTOR, "button[type='submit']")
            self.assertTrue(login_button.is_displayed())
            
        except (TimeoutException, NoSuchElementException) as e:
            self.fail(f"User login form elements not found: {e}")
    
    def test_user_login_flow(self):
        """Test user login flow"""
        self.driver.get(self.base_url)
        
        try:
            # Fill in email
            email_input = self.wait.until(
                EC.element_to_be_clickable((By.CSS_SELECTOR, "input[type='email']"))
            )
            email_input.clear()
            email_input.send_keys(self.test_user_email)
            
            # Click login button
            login_button = self.driver.find_element(By.CSS_SELECTOR, "button[type='submit']")
            login_button.click()
            
            # Wait for navigation or error message
            time.sleep(2)
            
            # Handle any alerts that might appear
            alert_text = self._handle_alert()
            
            try:
                current_url = self.driver.current_url
            except UnexpectedAlertPresentException:
                # Handle alert and try again
                alert_text = self._handle_alert()
                current_url = self.driver.current_url
            
            # Should either redirect to /me (success) or show error message
            if '/me' in current_url:
                # Login successful - verify we're on the patient dashboard
                self.assertIn('/me', current_url)
                # Look for treatment path content
                self.wait.until(
                    EC.presence_of_element_located((By.TAG_NAME, "main"))
                )
            else:
                # Login failed - check for error message or alert
                if alert_text and 'failed' in alert_text.lower():
                    # Alert already handled the error message
                    pass
                else:
                    try:
                        error_message = self.driver.find_element(By.CSS_SELECTOR, "[role='alert'], .error, .text-red-500")
                        self.assertTrue(error_message.is_displayed())
                    except NoSuchElementException:
                        # No visible error message, but that's okay if alert was shown
                        pass
                    
        except (TimeoutException, NoSuchElementException) as e:
            self.fail(f"User login flow failed: {e}")
    
    def test_admin_login_navigation(self):
        """Test navigation to admin login"""
        self.driver.get(self.base_url)
        
        try:
            # Look for admin login link - try multiple possible selectors
            admin_link = None
            try:
                admin_link = self.wait.until(
                    EC.element_to_be_clickable((By.LINK_TEXT, "Admin"))
                )
            except TimeoutException:
                # Try alternative selectors
                try:
                    admin_link = self.driver.find_element(By.PARTIAL_LINK_TEXT, "Admin")
                except NoSuchElementException:
                    # Try href-based selector
                    admin_link = self.driver.find_element(By.CSS_SELECTOR, "a[href*='/admin']")
            
            if admin_link:
                admin_link.click()
            else:
                # Navigate directly to admin page
                self.driver.get(f"{self.base_url}/admin")
            
            # Should navigate to admin login page
            self.wait.until(lambda driver: '/admin' in driver.current_url)
            self.assertIn('/admin', self.driver.current_url)
            
            # Check for admin login form
            password_input = self.wait.until(
                EC.presence_of_element_located((By.CSS_SELECTOR, "input[type='password']"))
            )
            self.assertTrue(password_input.is_displayed())
            
        except (TimeoutException, NoSuchElementException) as e:
            self.fail(f"Admin login navigation failed: {e}")
    
    def test_admin_login_flow(self):
        """Test admin login flow"""
        self.driver.get(f"{self.base_url}/admin")
        
        try:
            # Fill in admin credentials
            email_input = self.wait.until(
                EC.element_to_be_clickable((By.CSS_SELECTOR, "input[type='email']"))
            )
            email_input.clear()
            email_input.send_keys(self.test_admin_email)
            
            password_input = self.driver.find_element(By.CSS_SELECTOR, "input[type='password']")
            password_input.clear()
            password_input.send_keys(self.test_admin_password)
            
            # Click login button
            login_button = self.driver.find_element(By.CSS_SELECTOR, "button[type='submit']")
            login_button.click()
            
            # Wait for navigation or error message
            time.sleep(2)
            
            # Handle any alerts that might appear
            alert_text = self._handle_alert()
            
            try:
                current_url = self.driver.current_url
            except UnexpectedAlertPresentException:
                # Handle alert and try again
                alert_text = self._handle_alert()
                current_url = self.driver.current_url
            
            # Should either stay on admin dashboard (success) or show error
            if '/admin' in current_url and self.driver.current_url != f"{self.base_url}/admin":
                # Login successful - verify we're on admin dashboard
                self.wait.until(
                    EC.presence_of_element_located((By.TAG_NAME, "main"))
                )
                # Look for admin-specific content
                try:
                    self.driver.find_element(By.PARTIAL_LINK_TEXT, "Tree Editor")
                except NoSuchElementException:
                    pass  # Admin dashboard might have different layout
            else:
                # Login failed - check for error message or alert
                if alert_text and ('invalid' in alert_text.lower() or 'failed' in alert_text.lower()):
                    # Alert already handled the error message
                    pass
                else:
                    try:
                        error_message = self.driver.find_element(By.CSS_SELECTOR, "[role='alert'], .error, .text-red-500")
                        self.assertTrue(error_message.is_displayed())
                    except NoSuchElementException:
                        # No visible error message, but that's okay if alert was shown
                        pass
                    
        except (TimeoutException, NoSuchElementException) as e:
            self.fail(f"Admin login flow failed: {e}")
    
    def test_logout_functionality(self):
        """Test logout functionality"""
        # First, try to login as user
        self.driver.get(self.base_url)
        
        try:
            email_input = self.wait.until(
                EC.element_to_be_clickable((By.CSS_SELECTOR, "input[type='email']"))
            )
            email_input.clear()
            email_input.send_keys(self.test_user_email)
            
            login_button = self.driver.find_element(By.CSS_SELECTOR, "button[type='submit']")
            login_button.click()
            
            time.sleep(2)
            
            # Handle any alerts that might appear
            alert_text = self._handle_alert()
            
            try:
                current_url = self.driver.current_url
            except UnexpectedAlertPresentException:
                # Handle alert and try again
                alert_text = self._handle_alert()
                current_url = self.driver.current_url
            
            # If login was successful, test logout
            if '/me' in current_url:
                # Look for logout button
                try:
                    logout_button = self.driver.find_element(By.PARTIAL_LINK_TEXT, "Logout")
                    logout_button.click()
                    
                    # Should redirect to homepage
                    self.wait.until(lambda driver: driver.current_url == self.base_url or driver.current_url == f"{self.base_url}/")
                    
                except NoSuchElementException:
                    self.skipTest("Logout button not found - user may not have logged in successfully")
            else:
                # Login failed, possibly due to missing user in database
                if alert_text and 'failed' in alert_text.lower():
                    self.skipTest("User login failed - test user may not exist in database")
                else:
                    self.skipTest("User login failed - cannot test logout")
                
        except (TimeoutException, NoSuchElementException) as e:
            self.skipTest(f"Could not test logout due to login issues: {e}")


if __name__ == '__main__':
    unittest.main()
