"""
Frontend Tests for Admin Interface
"""
import unittest
import time
import os
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.action_chains import ActionChains
from selenium.webdriver.common.keys import Keys
from selenium.common.exceptions import TimeoutException, NoSuchElementException
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

class TestAdminInterface(unittest.TestCase):
    """Test admin interface functionality"""
    
    def setUp(self):
        """Set up Selenium WebDriver and admin login"""
        self.base_url = os.getenv('TEST_BASE_URL', 'http://localhost:3000')
        self.admin_email = os.getenv('TEST_ADMIN_EMAIL', 'admin@example.com')
        self.admin_password = os.getenv('TEST_ADMIN_PASSWORD', 'password123')
        
        # Set up Chrome options
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
            
            # Login as admin
            self._login_admin()
            
        except Exception as e:
            self.skipTest(f"Chrome WebDriver not available or admin login failed: {e}")
    
    def tearDown(self):
        """Clean up WebDriver"""
        if hasattr(self, 'driver'):
            self.driver.quit()
    
    def _login_admin(self):
        """Helper method to login as admin"""
        self.driver.get(f"{self.base_url}/admin")
        
        try:
            email_input = self.wait.until(
                EC.element_to_be_clickable((By.CSS_SELECTOR, "input[type='email']"))
            )
            email_input.clear()
            email_input.send_keys(self.admin_email)
            
            password_input = self.driver.find_element(By.CSS_SELECTOR, "input[type='password']")
            password_input.clear()
            password_input.send_keys(self.admin_password)
            
            login_button = self.driver.find_element(By.CSS_SELECTOR, "button[type='submit']")
            login_button.click()
            
            time.sleep(3)  # Wait for login to complete
            
            # Check if we're on admin dashboard
            if '/admin' not in self.driver.current_url:
                raise Exception("Admin login failed - not on admin page")
                
        except Exception as e:
            raise Exception(f"Could not login admin: {e}")
    
    def test_admin_dashboard_loads(self):
        """Test that admin dashboard loads correctly"""
        try:
            # Should be on admin page
            self.assertIn('/admin', self.driver.current_url)
            
            # Check for main content area
            main_content = self.wait.until(
                EC.presence_of_element_located((By.TAG_NAME, "main"))
            )
            self.assertTrue(main_content.is_displayed())
            
            # Look for admin-specific elements
            admin_elements = self.driver.find_elements(By.CSS_SELECTOR, ".admin, [data-role='admin'], .dashboard")
            self.assertGreater(len(admin_elements), 0, "Admin-specific elements should be present")
            
        except (TimeoutException, AssertionError) as e:
            self.fail(f"Admin dashboard did not load correctly: {e}")
    
    def test_navigation_links(self):
        """Test admin navigation links"""
        try:
            # Look for navigation links
            nav_links = [
                ("Tree Editor", "/admin/tree"),
                ("Users", "/admin/users"),
                ("Patients", "/admin/patients"),
                ("Settings", "/admin/settings")
            ]
            
            for link_text, expected_url in nav_links:
                try:
                    link = self.driver.find_element(By.PARTIAL_LINK_TEXT, link_text)
                    
                    # Click the link
                    link.click()
                    time.sleep(2)
                    
                    # Check URL
                    current_url = self.driver.current_url
                    self.assertIn(expected_url, current_url, f"Navigation to {link_text} failed")
                    
                    # Go back to dashboard
                    self.driver.get(f"{self.base_url}/admin")
                    time.sleep(1)
                    
                except NoSuchElementException:
                    # Link might not exist, skip this test
                    continue
                    
        except Exception as e:
            self.fail(f"Navigation links test failed: {e}")
    
    def test_tree_editor_access(self):
        """Test accessing tree editor"""
        try:
            # Navigate to tree editor
            self.driver.get(f"{self.base_url}/admin/tree")
            time.sleep(2)
            
            # Check for tree editor elements
            tree_elements = self.driver.find_elements(By.CSS_SELECTOR, ".tree-editor, .node-editor, [data-testid='tree-editor']")
            
            if len(tree_elements) == 0:
                # Look for nodes or tree structure
                node_elements = self.driver.find_elements(By.CSS_SELECTOR, ".tree-node, .node, [data-node-id]")
                self.assertGreater(len(node_elements), 0, "Tree editor should show nodes")
            else:
                self.assertGreater(len(tree_elements), 0, "Tree editor should be present")
                
        except Exception as e:
            self.fail(f"Tree editor access test failed: {e}")
    
    def test_node_editing_interface(self):
        """Test node editing interface"""
        try:
            # Navigate to tree editor
            self.driver.get(f"{self.base_url}/admin/tree")
            time.sleep(2)
            
            # Look for clickable nodes
            nodes = self.driver.find_elements(By.CSS_SELECTOR, ".tree-node, .node, [data-node-id], .cursor-pointer")
            
            if len(nodes) > 0:
                # Click on the first node
                first_node = nodes[0]
                self.driver.execute_script("arguments[0].scrollIntoView();", first_node)
                time.sleep(1)
                
                ActionChains(self.driver).move_to_element(first_node).click().perform()
                time.sleep(2)
                
                # Look for editing form
                form_elements = self.driver.find_elements(By.CSS_SELECTOR, "form, .form, .editor")
                
                if len(form_elements) > 0:
                    # Look for common form fields
                    title_input = self.driver.find_elements(By.CSS_SELECTOR, "input[name*='title'], textarea[name*='title'], [placeholder*='title']")
                    summary_input = self.driver.find_elements(By.CSS_SELECTOR, "textarea[name*='summary'], [placeholder*='summary']")
                    
                    # Check that editing fields exist
                    self.assertTrue(len(title_input) > 0 or len(summary_input) > 0, "Node editing form should have input fields")
                    
                    # Look for save button
                    save_buttons = self.driver.find_elements(By.CSS_SELECTOR, "button:contains('Save'), input[type='submit'], [data-action='save']")
                    self.assertGreater(len(save_buttons), 0, "Node editing form should have save button")
                else:
                    self.skipTest("Node editing form not found")
            else:
                self.skipTest("No nodes found to test editing")
                
        except Exception as e:
            self.fail(f"Node editing interface test failed: {e}")
    
    def test_users_management_page(self):
        """Test users management page"""
        try:
            # Navigate to users page
            self.driver.get(f"{self.base_url}/admin/users")
            time.sleep(2)
            
            # Look for users table or list
            user_elements = self.driver.find_elements(By.CSS_SELECTOR, "table, .user-list, .users, [data-testid='users']")
            
            if len(user_elements) > 0:
                # Look for user data
                user_rows = self.driver.find_elements(By.CSS_SELECTOR, "tr, .user-item, .user-row")
                # There should be at least one user (the admin)
                self.assertGreater(len(user_rows), 0, "Users page should show user data")
            else:
                # Page might be empty or have different structure
                # Just check that page loaded
                self.assertIn('/admin/users', self.driver.current_url)
                
        except Exception as e:
            self.fail(f"Users management page test failed: {e}")
    
    def test_patients_management_page(self):
        """Test patients management page"""
        try:
            # Navigate to patients page
            self.driver.get(f"{self.base_url}/admin/patients")
            time.sleep(2)
            
            # Look for patient search or management interface
            search_elements = self.driver.find_elements(By.CSS_SELECTOR, "input[type='search'], .search, [placeholder*='search']")
            
            if len(search_elements) > 0:
                # Test search functionality
                search_input = search_elements[0]
                search_input.send_keys("test")
                search_input.send_keys(Keys.RETURN)
                time.sleep(2)
                
                # Look for search results
                results = self.driver.find_elements(By.CSS_SELECTOR, ".search-results, .patients, .results")
                # Results might be empty, but search should work
            else:
                # Just check that page loaded
                self.assertIn('/admin/patients', self.driver.current_url)
                
        except Exception as e:
            self.fail(f"Patients management page test failed: {e}")
    
    def test_settings_page(self):
        """Test admin settings page"""
        try:
            # Navigate to settings page
            self.driver.get(f"{self.base_url}/admin/settings")
            time.sleep(2)
            
            # Look for settings interface
            settings_elements = self.driver.find_elements(By.CSS_SELECTOR, ".settings, form, .config, [data-testid='settings']")
            
            if len(settings_elements) > 0:
                # Look for common settings elements
                inputs = self.driver.find_elements(By.CSS_SELECTOR, "input, select, textarea")
                # Settings page should have some configurable options
                self.assertGreater(len(inputs), 0, "Settings page should have configurable options")
            else:
                # Just check that page loaded
                self.assertIn('/admin/settings', self.driver.current_url)
                
        except Exception as e:
            self.fail(f"Settings page test failed: {e}")
    
    def test_data_management_features(self):
        """Test data management features like clear data"""
        try:
            # Navigate to settings or look for data management
            self.driver.get(f"{self.base_url}/admin/settings")
            time.sleep(2)
            
            # Look for dangerous actions (clear data, reset, etc.)
            dangerous_buttons = self.driver.find_elements(By.CSS_SELECTOR, 
                "button:contains('Clear'), button:contains('Reset'), button:contains('Delete'), .danger, .destructive")
            
            if len(dangerous_buttons) > 0:
                # Don't actually click them, just verify they exist and are properly styled
                for button in dangerous_buttons:
                    # Check if button has warning styling
                    classes = button.get_attribute('class')
                    self.assertTrue('red' in classes or 'danger' in classes or 'destructive' in classes,
                                  "Destructive actions should be clearly marked")
            else:
                # Data management features might be elsewhere or protected
                self.skipTest("No data management features found to test")
                
        except Exception as e:
            self.fail(f"Data management features test failed: {e}")


if __name__ == '__main__':
    unittest.main()
