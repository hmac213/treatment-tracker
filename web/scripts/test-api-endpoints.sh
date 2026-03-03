#!/usr/bin/env bash
# Quick test of all API endpoints. Run from repo root with dev server up: npm run dev (in web/)
# Usage: ./web/scripts/test-api-endpoints.sh [BASE_URL]
set -e
BASE="${1:-http://localhost:3000}"
echo "Testing API endpoints at $BASE"
echo ""

test() {
  local method="$1"
  local path="$2"
  local body="$3"
  local desc="$4"
  if [[ -z "$body" ]]; then
    code=$(curl -s -o /tmp/curl_out -w "%{http_code}" -X "$method" "$BASE$path" 2>/dev/null || echo "000")
  else
    code=$(curl -s -o /tmp/curl_out -w "%{http_code}" -X "$method" "$BASE$path" -H "Content-Type: application/json" -d "$body" 2>/dev/null || echo "000")
  fi
  if [[ "$code" == "000" ]]; then
    echo "FAIL $method $path - connection failed (is dev server running?)"
  else
    echo "$code $method $path ${desc:+($desc)}"
  fi
}

# Unauthenticated
test POST /api/login '{"email":"test@example.com"}' "no user - expect 404"
test POST /api/logout "" "clear session"

# Patient session required (401 without cookie)
test POST /api/unlock-node '{"nodeId":"some-uuid"}' "expect 401"
test POST /api/unlock-by-symptoms '{"symptoms":[]}' "expect 401"

# Admin required (401 without admin cookie)
test GET  /api/admin/symptoms "" "expect 401"
test POST /api/admin/symptoms '{"key":"t","label":"Test"}' "expect 401"
test GET  /api/admin/positions "" "expect 401"
test POST /api/admin/positions '{"type":"node","key":"x","position":{}}' "expect 401"
test GET  /api/admin/category-videos "" "expect 401"
test GET  /api/admin/bonus-content "" "expect 401"
test GET  /api/admin/introduction-tree "" "expect 401"
test POST /api/admin/login '{"email":"a@b.com","password":"x"}' "expect 401"
test POST /api/admin/users '{"email":"u@x.com","name":"U"}' "expect 401"
test POST /api/admin/patients/search '{"searchTerm":"a"}' "expect 401"
test GET  "/api/admin/patients/some-user-id/unlocks" "" "expect 401"
test POST /api/admin/patients/some-user-id/reset "" "expect 401"
test POST /api/admin/patients/some-user-id/unlock-all "" "expect 401"
test POST /api/admin/tree/save '{}' "expect 401"
test POST /api/admin/tree/save-edge '{"edgeId":"e1","description":"x"}' "expect 401"
test POST /api/admin/clear-data '{"action":"unlocks"}' "expect 401"

echo ""
echo "Done. 401 = auth required (expected without cookies). 404/400 = bad input. 500 = server error."
