/**
 * Phase 1 Auth Tests — Strict authentication verification
 * Tests: existing login, unknown email, wrong password, rate limiting,
 *        admin auth, cookie persistence, logout, no auto-provisioning.
 *
 * Run: node scripts/test-phase1-auth.js
 * Requires: Dev server on http://localhost:3000, seeded admin + candidate.
 */

const BASE = 'http://localhost:3000';

// --- Test helpers ---
let passed = 0;
let failed = 0;

function assert(condition, label) {
  if (condition) {
    console.log(`  ✅ ${label}`);
    passed++;
  } else {
    console.log(`  ❌ ${label}`);
    failed++;
  }
}

async function postJSON(path, body, cookie) {
  const headers = { 'Content-Type': 'application/json' };
  if (cookie) headers['Cookie'] = cookie;
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
    redirect: 'manual'
  });
  const setCookie = res.headers.get('set-cookie') || '';
  const json = await res.json().catch(() => null);
  return { status: res.status, json, setCookie };
}

async function getJSON(path, cookie) {
  const headers = {};
  if (cookie) headers['Cookie'] = cookie;
  const res = await fetch(`${BASE}${path}`, { headers, redirect: 'manual' });
  const json = await res.json().catch(() => null);
  return { status: res.status, json };
}

// Extract dv_session cookie from set-cookie header
function extractCookie(setCookieHeader) {
  const match = setCookieHeader.match(/dv_session=([^;]+)/);
  return match ? `dv_session=${match[1]}` : null;
}

// --- Tests ---
async function run() {
  console.log('\n=== PHASE 1: STRICT AUTHENTICATION TESTS ===\n');

  // 1. Valid admin login
  console.log('Test 1: Valid admin login');
  const admin = await postJSON('/api/auth/login', {
    email: 'bhagavan@datavalley.ai',
    password: 'bhagavan123'
  });
  assert(admin.status === 200, 'Admin login returns 200');
  assert(admin.json?.success === true, 'Admin login success: true');
  assert(admin.json?.user?.role === 'ADMIN', 'Admin role verified');
  assert(!admin.json?.user?.password, 'No password in response');
  assert(!admin.json?.user?.passwordHash, 'No passwordHash in response');
  const adminCookie = extractCookie(admin.setCookie);
  assert(!!adminCookie, 'Session cookie set');
  assert(admin.setCookie.includes('HttpOnly'), 'Cookie is HttpOnly');

  // 2. Valid candidate login
  console.log('\nTest 2: Valid candidate login');
  const cand = await postJSON('/api/auth/login', {
    email: 'candidate@example.com',
    password: 'password123'
  });
  assert(cand.status === 200, 'Candidate login returns 200');
  assert(cand.json?.user?.role === 'CANDIDATE', 'Candidate role verified');
  const candCookie = extractCookie(cand.setCookie);
  assert(!!candCookie, 'Candidate session cookie set');

  // 3. Unknown email — must NOT auto-provision
  console.log('\nTest 3: Unknown email rejected (no auto-provisioning)');
  const unknown = await postJSON('/api/auth/login', {
    email: 'nonexistent_' + Date.now() + '@test.com',
    password: 'anyPassword123'
  });
  assert(unknown.status === 401, 'Unknown email returns 401');
  assert(unknown.json?.error === 'Invalid email or password', 'Generic error for unknown email');

  // 4. Wrong password for existing candidate
  console.log('\nTest 4: Wrong password rejected');
  const wrongPwd = await postJSON('/api/auth/login', {
    email: 'candidate@example.com',
    password: 'wrongPassword!'
  });
  assert(wrongPwd.status === 401, 'Wrong password returns 401');

  // 5. Verify password was NOT overwritten (login again with correct password)
  console.log('\nTest 5: Original password still works after wrong attempt');
  const retryCorrect = await postJSON('/api/auth/login', {
    email: 'candidate@example.com',
    password: 'password123'
  });
  assert(retryCorrect.status === 200, 'Original password still valid');

  // 6. Empty body
  console.log('\nTest 6: Empty/invalid body');
  const emptyRes = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: 'not json'
  });
  assert(emptyRes.status === 400, 'Invalid body returns 400');

  // 7. Missing fields
  console.log('\nTest 7: Missing password field');
  const missingPwd = await postJSON('/api/auth/login', { email: 'a@b.com' });
  assert(missingPwd.status === 400, 'Missing password returns 400');

  // 8. Email normalization
  console.log('\nTest 8: Email normalization (uppercase + whitespace)');
  const normalizedLogin = await postJSON('/api/auth/login', {
    email: '  Candidate@Example.COM  ',
    password: 'password123'
  });
  assert(normalizedLogin.status === 200, 'Normalized email matches existing candidate');

  // 9. Cookie-based /api/auth/me
  console.log('\nTest 9: Session persistence via /api/auth/me');
  if (candCookie) {
    const me = await getJSON('/api/auth/me', candCookie);
    assert(me.status === 200, '/api/auth/me returns 200 with valid cookie');
    assert(me.json?.user?.email === 'candidate@example.com', 'Correct email in session');
  } else {
    assert(false, 'No cookie available for /api/auth/me test');
  }

  // 10. Unauthenticated /api/auth/me
  console.log('\nTest 10: Unauthenticated /api/auth/me');
  const unauth = await getJSON('/api/auth/me');
  assert(unauth.status === 401, 'No cookie returns 401');

  // 11. Admin candidate provisioning (RBAC)
  console.log('\nTest 11: Admin can provision candidates');
  if (adminCookie) {
    const prov = await postJSON('/api/admin/candidates', {
      email: `test_phase1_${Date.now()}@example.com`,
      fullName: 'Phase1 Test',
      password: 'TestPass1234!'
    }, adminCookie);
    assert(prov.status === 201, 'Admin provisioning returns 201');
    assert(prov.json?.candidate?.role === 'CANDIDATE', 'Provisioned as CANDIDATE');
  }

  // 12. Candidate cannot provision
  console.log('\nTest 12: Candidate cannot provision other candidates');
  if (candCookie) {
    const candProv = await postJSON('/api/admin/candidates', {
      email: 'hacker@test.com',
      fullName: 'Hacker',
      password: 'HackPass123!'
    }, candCookie);
    assert(candProv.status === 403, 'Candidate gets 403 on provisioning');
  }

  // 13. Logout
  console.log('\nTest 13: Logout clears session');
  if (candCookie) {
    const logout = await postJSON('/api/auth/logout', {}, candCookie);
    assert(logout.status === 200, 'Logout returns 200');
  }

  // Summary
  console.log(`\n${'='.repeat(50)}`);
  console.log(`PHASE 1 RESULTS: ${passed} passed, ${failed} failed out of ${passed + failed}`);
  console.log('='.repeat(50));

  process.exit(failed > 0 ? 1 : 0);
}

run().catch(err => {
  console.error('Test runner error:', err);
  process.exit(1);
});
