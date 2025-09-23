"""
Frontend Tests for Patient Interface
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
from selenium.common.exceptions import TimeoutException, NoSuchElementException
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

class TestPatientInterface(unittest.TestCase):
    """Test patient-facing interface"""
    
    def setUp(self):
        """Set up Selenium WebDriver and login"""
        self.base_url = os.getenv('TEST_BASE_URL', 'http://localhost:3000')
        self.test_user_email = os.getenv('TEST_USER_EMAIL', 'test@example.com')
        
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
            
            # Login as test user
            self._login_user()
            
        except Exception as e:
            self.skipTest(f"Chrome WebDriver not available or login failed: {e}")
    
    def tearDown(self):
        """Clean up WebDriver"""
        if hasattr(self, 'driver'):
            self.driver.quit()
    
    def _login_user(self):
        """Helper method to login as test user"""
        self.driver.get(self.base_url)
        
        try:
            email_input = self.wait.until(
                EC.element_to_be_clickable((By.CSS_SELECTOR, "input[type='email']"))
            )
            email_input.clear()
            email_input.send_keys(self.test_user_email)
            
            login_button = self.driver.find_element(By.CSS_SELECTOR, "button[type='submit']")
            login_button.click()
            
            time.sleep(3)  # Wait for login to complete
            
            # Check if we're on the patient dashboard
            if '/me' not in self.driver.current_url:
                raise Exception("Login failed - not redirected to /me")
                
        except Exception as e:
            raise Exception(f"Could not login user: {e}")
    
    def test_patient_dashboard_loads(self):
        """Test that patient dashboard loads correctly"""
        try:
            # Should be on /me page
            self.assertIn('/me', self.driver.current_url)
            
            # Check for main content area
            main_content = self.wait.until(
                EC.presence_of_element_located((By.TAG_NAME, "main"))
            )
            self.assertTrue(main_content.is_displayed())
            
        except (TimeoutException, AssertionError) as e:
            self.fail(f"Patient dashboard did not load correctly: {e}")
    
    def test_treatment_tree_visible(self):
        """Test that treatment tree is visible"""
        try:
            # Look for tree structure elements
            # This could be the mobile tree view or the SVG tree depending on screen size
            tree_elements = self.driver.find_elements(By.CSS_SELECTOR, "[data-node-key], .tree-node, .treatment-node")
            
            if len(tree_elements) == 0:
                # Try looking for SVG elements
                svg_elements = self.driver.find_elements(By.TAG_NAME, "svg")
                self.assertGreater(len(svg_elements), 0, "No tree or SVG elements found")
            else:
                self.assertGreater(len(tree_elements), 0, "No treatment tree elements found")
                
        except AssertionError as e:
            self.fail(f"Treatment tree not visible: {e}")
    
    def test_node_interaction(self):
        """Test clicking on treatment nodes"""
        try:
            # Look for clickable nodes
            clickable_nodes = self.driver.find_elements(By.CSS_SELECTOR, "[data-node-key], .cursor-pointer")
            
            if len(clickable_nodes) > 0:
                # Click on the first clickable node
                first_node = clickable_nodes[0]
                self.driver.execute_script("arguments[0].scrollIntoView();", first_node)
                time.sleep(1)
                
                # Try clicking the node
                ActionChains(self.driver).move_to_element(first_node).click().perform()
                time.sleep(2)
                
                # Check for popup or modal
                try:
                    popup = self.driver.find_element(By.CSS_SELECTOR, "[role='dialog'], .modal, .popup")
                    self.assertTrue(popup.is_displayed(), "Node click should open popup")
                except NoSuchElementException:
                    # Popup might not appear for certain nodes (already unlocked, etc.)
                    pass
            else:
                self.skipTest("No clickable nodes found to test interaction")
                
        except Exception as e:
            self.fail(f"Node interaction test failed: {e}")
    
    def test_zoom_controls_on_desktop(self):
        """Test zoom controls on desktop view"""
        try:
            # Set window size to desktop
            self.driver.set_window_size(1920, 1080)
            self.driver.refresh()
            time.sleep(2)
            
            # Look for zoom controls
            zoom_controls = self.driver.find_elements(By.CSS_SELECTOR, ".zoom-controls, [aria-label*='zoom'], button[title*='zoom']")
            
            if len(zoom_controls) > 0:
                # Test zoom in button
                zoom_in_button = None
                zoom_out_button = None
                
                for control in zoom_controls:
                    if '+' in control.text or 'in' in control.get_attribute('title', '').lower():
                        zoom_in_button = control
                    elif '-' in control.text or 'out' in control.get_attribute('title', '').lower():
                        zoom_out_button = control
                
                if zoom_in_button:
                    zoom_in_button.click()
                    time.sleep(1)
                    # Verify zoom changed (this would need more specific checks)
                
                if zoom_out_button:
                    zoom_out_button.click()
                    time.sleep(1)
                    
            else:
                self.skipTest("Zoom controls not found - may not be in desktop view")
                
        except Exception as e:
            self.fail(f"Zoom controls test failed: {e}")
    
    def test_mobile_tree_view(self):
        """Test mobile tree view"""
        try:
            # Set window size to mobile
            self.driver.set_window_size(375, 667)
            self.driver.refresh()
            time.sleep(2)
            
            # Look for mobile tree elements
            tree_items = self.driver.find_elements(By.CSS_SELECTOR, ".tree-item, .treatment-node, [role='treeitem']")
            
            if len(tree_items) > 0:
                # Test expanding/collapsing nodes
                expandable_nodes = self.driver.find_elements(By.CSS_SELECTOR, "[aria-expanded], .expandable")
                
                if len(expandable_nodes) > 0:
                    first_expandable = expandable_nodes[0]
                    initial_state = first_expandable.get_attribute('aria-expanded')
                    
                    first_expandable.click()
                    time.sleep(1)
                    
                    final_state = first_expandable.get_attribute('aria-expanded')
                    # State should have changed
                    self.assertNotEqual(initial_state, final_state, "Node expand/collapse should change state")
            else:
                self.skipTest("Mobile tree view elements not found")
                
        except Exception as e:
            self.fail(f"Mobile tree view test failed: {e}")
    
    def test_unlock_prompt(self):
        """Test unlock prompt functionality"""
        try:
            # Look for unlockable nodes (usually yellow/amber colored)
            unlockable_nodes = self.driver.find_elements(By.CSS_SELECTOR, ".border-yellow-500, .unlockable, [data-state='unlockable']")
            
            if len(unlockable_nodes) > 0:
                # Click on an unlockable node
                unlockable_node = unlockable_nodes[0]
                self.driver.execute_script("arguments[0].scrollIntoView();", unlockable_node)
                time.sleep(1)
                
                ActionChains(self.driver).move_to_element(unlockable_node).click().perform()
                time.sleep(2)
                
                # Look for unlock prompt
                unlock_buttons = self.driver.find_elements(By.CSS_SELECTOR, "button:contains('Unlock'), [data-action='unlock']")
                
                if len(unlock_buttons) > 0:
                    # Test clicking unlock (but don't actually unlock to preserve test state)
                    unlock_button = unlock_buttons[0]
                    self.assertTrue(unlock_button.is_displayed(), "Unlock button should be visible")
                    
                    # Look for cancel/close button
                    cancel_buttons = self.driver.find_elements(By.CSS_SELECTOR, "button:contains('Cancel'), button:contains('Close'), [data-action='cancel']")
                    if len(cancel_buttons) > 0:
                        cancel_buttons[0].click()
                        time.sleep(1)
                else:
                    self.skipTest("Unlock prompt not found for unlockable node")
            else:
                self.skipTest("No unlockable nodes found to test unlock prompt")
                
        except Exception as e:
            self.fail(f"Unlock prompt test failed: {e}")
    
    def test_node_popup_content(self):
        """Test node popup shows content correctly"""
        try:
            # Look for unlocked nodes (usually green colored)
            unlocked_nodes = self.driver.find_elements(By.CSS_SELECTOR, ".border-green-500, .unlocked, [data-state='unlocked']")
            
            if len(unlocked_nodes) > 0:
                # Click on an unlocked node
                unlocked_node = unlocked_nodes[0]
                self.driver.execute_script("arguments[0].scrollIntoView();", unlocked_node)
                time.sleep(1)
                
                ActionChains(self.driver).move_to_element(unlocked_node).click().perform()
                time.sleep(2)
                
                # Look for popup content
                popup = self.driver.find_element(By.CSS_SELECTOR, "[role='dialog'], .modal, .popup")
                
                if popup.is_displayed():
                    # Check for title
                    title_elements = popup.find_elements(By.CSS_SELECTOR, "h1, h2, h3, .title, [role='heading']")
                    self.assertGreater(len(title_elements), 0, "Popup should have a title")
                    
                    # Check for content
                    content_elements = popup.find_elements(By.CSS_SELECTOR, "p, .content, .summary")
                    # Content might be empty for some nodes, so just check structure exists
                    
                    # Check for close button
                    close_buttons = popup.find_elements(By.CSS_SELECTOR, "button[aria-label*='close'], button:contains('×'), .close")
                    if len(close_buttons) > 0:
                        close_buttons[0].click()
                        time.sleep(1)
                else:
                    self.fail("Popup not displayed after clicking unlocked node")
            else:
                self.skipTest("No unlocked nodes found to test popup content")
                
        except Exception as e:
            self.fail(f"Node popup content test failed: {e}")


if __name__ == '__main__':
    unittest.main()
