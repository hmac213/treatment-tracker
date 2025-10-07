# Treatment Tracker Test Suite

This directory contains comprehensive tests for the Treatment Tracker application, including backend API tests and database integrity tests.

## Test Structure

```
tests/
├── backend/                    # Backend API and database tests
│   ├── test_auth_api.py       # Authentication endpoint tests
│   ├── test_admin_api.py      # Admin endpoint tests  
│   ├── test_patient_api.py    # Patient/user endpoint tests
│   └── test_database_integrity.py # Database integrity via Supabase API
├── requirements.txt           # Python dependencies
├── env.example               # Environment variable template
└── run_tests.py             # Main test runner script
```

## Setup

### 1. Install Dependencies

```bash
cd tests
pip install -r requirements.txt
```

### 2. Environment Configuration

Copy `env.example` to `.env` and configure:

```bash
cp env.example .env
```

Required environment variables:

```env
# Application URL
TEST_BASE_URL=http://localhost:3000

# Test user credentials (must exist in your database)
TEST_USER_EMAIL=test@example.com
TEST_ADMIN_EMAIL=admin@example.com  
TEST_ADMIN_PASSWORD=your_admin_password

```

**Note**: For local testing, copy Supabase credentials from your `/web/.env` file. For CI/CD, all credentials are provided by GitHub Secrets.

## Running Tests

### All Tests
```bash
python run_tests.py
```

### Backend Tests Only
```bash
python run_tests.py --backend
```

### Frontend Tests (Removed)
Frontend Selenium tests have been removed from this project. Only backend API tests are supported.

### Individual Test Files
```bash
# Using pytest
python -m pytest backend/test_auth_api.py -v
python -m pytest backend/test_admin_api.py -v

# Using unittest
python backend/test_auth_api.py
python backend/test_admin_api.py
```

### Validate Environment
```bash
python run_tests.py --validate-env
```

## Test Categories

### Backend API Tests

**Authentication (`test_auth_api.py`)**
- User login with valid/invalid emails
- Admin login with credentials
- Logout functionality
- Session cookie handling

**Admin API (`test_admin_api.py`)**
- Tree save endpoints (authorized/unauthorized)
- User management endpoints
- Patient search functionality
- Data management operations

**Patient API (`test_patient_api.py`)**
- Node unlock functionality
- Symptom-based unlocking
- Authentication requirements
- Error handling

**Database Integrity (`test_database_integrity.py`)**
- Table accessibility via Supabase API
- Data relationships and constraints
- Root node validation
- Category and unlock data integrity

### Frontend UI Tests (Removed)

Frontend Selenium tests have been removed from this project to simplify the test suite and reduce CI/CD complexity. The backend API tests provide comprehensive coverage of the application's core functionality.

## CI/CD Integration

Tests run automatically on GitHub Actions:

1. **Pull Requests**: All tests run for validation
2. **Main Branch**: Tests run before deployment to Vercel
3. **Environment**: Uses GitHub Secrets for credentials

### Required GitHub Secrets

```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
APP_SECRET
TEST_USER_EMAIL
TEST_ADMIN_EMAIL
TEST_ADMIN_PASSWORD
VERCEL_TOKEN
VERCEL_PROJECT_ID  
VERCEL_ORG_ID
```

## Test Data Requirements

### Users
Tests require these users to exist in your database:
- A regular user (TEST_USER_EMAIL)
- An admin user (TEST_ADMIN_EMAIL) with password

### Treatment Tree
Tests expect:
- At least one root node with `key='root'`
- Some treatment nodes with edges
- Categories assigned to nodes
- Valid unlock conditions

## Troubleshooting

### Common Issues

**"Python dependencies missing"**
- Run `pip install -r requirements.txt` in the tests directory

**"Supabase credentials not available"**
- Verify NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY
- Check environment file loading

**"Test user not found"**
- Create test users in your database
- Verify email addresses in environment variables

**"Application not responding"**
- Ensure Next.js app is running on TEST_BASE_URL
- Check for port conflicts

### Debug Mode

Run tests with verbose output:
```bash
python -m pytest backend/ -v -s
```

### Verbose Output
```bash
python run_tests.py --verbose
```

## Contributing

When adding new tests:

1. Follow existing naming conventions (`test_*.py`)
2. Use descriptive test method names
3. Add proper setUp/tearDown methods
4. Handle environment dependencies gracefully
5. Add docstrings for test purposes
6. Update this README if adding new test categories

## Performance

- Backend tests: ~30-60 seconds
- Database tests: ~10-30 seconds

Tests run efficiently without browser automation overhead.
