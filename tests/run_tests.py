#!/usr/bin/env python3
"""
Main test runner for Treatment Tracker
"""
import os
import sys
import unittest
import argparse
from dotenv import load_dotenv

# Load environment variables
load_dotenv()  # Load from tests/.env for local testing
# In CI/CD, environment variables are provided by GitHub Secrets

def discover_and_run_tests(test_dir=None, pattern='test_*.py', verbosity=2):
    """
    Discover and run tests from specified directory
    """
    if test_dir is None:
        test_dir = os.path.dirname(os.path.abspath(__file__))
    
    # Discover tests
    loader = unittest.TestLoader()
    suite = loader.discover(test_dir, pattern=pattern)
    
    # Run tests
    runner = unittest.TextTestRunner(verbosity=verbosity)
    result = runner.run(suite)
    
    return result.wasSuccessful()

def run_backend_tests():
    """Run backend API and database tests"""
    print("=" * 60)
    print("RUNNING BACKEND TESTS")
    print("=" * 60)
    
    backend_dir = os.path.join(os.path.dirname(__file__), 'backend')
    return discover_and_run_tests(backend_dir)

def run_frontend_tests():
    """Run frontend Selenium tests"""
    print("=" * 60)
    print("RUNNING FRONTEND TESTS")
    print("=" * 60)
    
    # Check if Chrome is available for Selenium tests
    try:
        from selenium import webdriver
        from selenium.webdriver.chrome.options import Options
        
        chrome_options = Options()
        chrome_options.add_argument('--headless')
        chrome_options.add_argument('--no-sandbox')
        chrome_options.add_argument('--disable-dev-shm-usage')
        
        driver = webdriver.Chrome(options=chrome_options)
        driver.quit()
        
        frontend_dir = os.path.join(os.path.dirname(__file__), 'frontend')
        return discover_and_run_tests(frontend_dir)
        
    except Exception as e:
        print(f"Skipping frontend tests - Chrome WebDriver not available: {e}")
        return True  # Don't fail the overall test run

def run_all_tests():
    """Run all tests"""
    print("=" * 60)
    print("TREATMENT TRACKER - FULL TEST SUITE")
    print("=" * 60)
    
    backend_success = run_backend_tests()
    frontend_success = run_frontend_tests()
    
    print("=" * 60)
    print("TEST SUMMARY")
    print("=" * 60)
    print(f"Backend Tests: {'PASSED' if backend_success else 'FAILED'}")
    print(f"Frontend Tests: {'PASSED' if frontend_success else 'FAILED'}")
    
    overall_success = backend_success and frontend_success
    print(f"Overall Result: {'PASSED' if overall_success else 'FAILED'}")
    print("=" * 60)
    
    return overall_success

def validate_environment():
    """Validate that required environment variables are set"""
    required_vars = [
        'TEST_BASE_URL',
        'TEST_USER_EMAIL',
        'TEST_ADMIN_EMAIL',
        'TEST_ADMIN_PASSWORD'
    ]
    
    missing_vars = []
    for var in required_vars:
        if not os.getenv(var):
            missing_vars.append(var)
    
    if missing_vars:
        print("WARNING: Missing environment variables:")
        for var in missing_vars:
            print(f"  - {var}")
        print("\nSome tests may be skipped or fail.")
        print("Create a .env file in the tests directory with required variables.")
        return False
    
    return True

def main():
    """Main test runner"""
    parser = argparse.ArgumentParser(description='Run Treatment Tracker tests')
    parser.add_argument('--backend', action='store_true', help='Run only backend tests')
    parser.add_argument('--frontend', action='store_true', help='Run only frontend tests')
    parser.add_argument('--validate-env', action='store_true', help='Only validate environment setup')
    parser.add_argument('--verbose', '-v', action='store_true', help='Verbose output')
    
    args = parser.parse_args()
    
    # Validate environment
    env_valid = validate_environment()
    if args.validate_env:
        sys.exit(0 if env_valid else 1)
    
    if not env_valid:
        response = input("Continue with missing environment variables? (y/N): ")
        if response.lower() != 'y':
            sys.exit(1)
    
    # Set verbosity
    verbosity = 2 if args.verbose else 1
    
    try:
        if args.backend:
            success = run_backend_tests()
        elif args.frontend:
            success = run_frontend_tests()
        else:
            success = run_all_tests()
        
        sys.exit(0 if success else 1)
        
    except KeyboardInterrupt:
        print("\nTests interrupted by user")
        sys.exit(1)
    except Exception as e:
        print(f"Error running tests: {e}")
        sys.exit(1)

if __name__ == '__main__':
    main()
