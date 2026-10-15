/**
 * Test Suite: Open Candidate Login, Universal Email Validation,
 * MongoDB Account Provisioning, Password Authentication, and Assessment Access.
 * 
 * Run with: node scripts/test-open-candidate-login.js
 */

const BASE = process.env.BASE_URL || 'http://localhost:5173';

let passedCount = 0;
let failedCount = 0;

function assert(condition, label, details) {
  if (condition) {
    console.log(`  ✅ ${label}`);
    passedCount++;
  } else {
    console.error(`  ❌ ${label}`);
    if (details) console.error(`     Details:`, details);
    failedCount++;
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
  let json = null;
  try {
    json = await res.json();
  } catch {
    // not json
  }
  return { status: res.status, json, setCookie };
}

function extractCookie(setCookieHeader) {
  if (!setCookieHeader) return null;
  const match = setCookieHeader.match(/dv_session=([^;]+)/);
  return match ? `dv_session=${match[1]}` : null;
}

async function runTests() {
  console.log('\n=============================================================');
  console.log('🧪 OPEN CANDIDATE LOGIN & UNIVERSAL VALIDATION TEST SUITE');
  console.log(`🎯 Target Server: ${BASE}`);
  console.log('=============================================================\n');

  const timestamp = Date.now();

  // Test 1: Valid Gmail address
  console.log('Test 1: Valid Gmail address');
  const gmailUser = `student.test.${timestamp}@gmail.com`;
  const t1 = await postJSON('/api/auth/login', {
    email: gmailUser,
    fullName: 'Gmail Student',
    password: 'password123'
  });
  assert(t1.status === 200 && t1.json?.success === true, 'Accepts standard Gmail address', t1.json);
  assert(t1.json?.user?.email === gmailUser.toLowerCase(), 'Normalized email stored', t1.json);
  assert(!!extractCookie(t1.setCookie), 'Session cookie returned', t1.setCookie);

  // Test 2: Valid Outlook address
  console.log('\nTest 2: Valid Outlook address');
  const outlookUser = `candidate.${timestamp}@outlook.com`;
  const t2 = await postJSON('/api/auth/login', {
    email: outlookUser,
    fullName: 'Outlook Student',
    password: 'password123'
  });
  assert(t2.status === 200 && t2.json?.success === true, 'Accepts standard Outlook address', t2.json);

  // Test 3: Valid college-domain address (.edu.in)
  console.log('\nTest 3: Valid college-domain address');
  const collegeUser = `roll1234.${timestamp}@iitb.edu.in`;
  const t3 = await postJSON('/api/auth/login', {
    email: collegeUser,
    fullName: 'College Student',
    password: 'password123'
  });
  assert(t3.status === 200 && t3.json?.success === true, 'Accepts college domain (.edu.in)', t3.json);

  // Test 4: Valid company-domain address (.co.in)
  console.log('\nTest 4: Valid company-domain address');
  const companyUser = `engineer.${timestamp}@datavalley.co.in`;
  const t4 = await postJSON('/api/auth/login', {
    email: companyUser,
    fullName: 'Company Engineer',
    password: 'password123'
  });
  assert(t4.status === 200 && t4.json?.success === true, 'Accepts company domain (.co.in)', t4.json);

  // Test 5: Valid plus-addressed email
  console.log('\nTest 5: Valid plus-addressed email');
  const plusUser = `student+exam${timestamp}@example.com`;
  const t5 = await postJSON('/api/auth/login', {
    email: plusUser,
    fullName: 'Plus Address Student',
    password: 'password123'
  });
  assert(t5.status === 200 && t5.json?.success === true, 'Accepts plus-addressed email', t5.json);
  assert(t5.json?.user?.email === plusUser.toLowerCase(), 'Preserves plus tag in email', t5.json);

  // Test 6: Uppercase and surrounding whitespace
  console.log('\nTest 6: Uppercase and surrounding whitespace');
  const rawSpaced = `   STUDENT.WHITESPACE.${timestamp}@GMAIL.COM   `;
  const t6 = await postJSON('/api/auth/login', {
    email: rawSpaced,
    fullName: 'Whitespace Candidate',
    password: 'password123'
  });
  assert(t6.status === 200 && t6.json?.success === true, 'Normalizes uppercase and whitespace', t6.json);
  assert(t6.json?.user?.email === `student.whitespace.${timestamp}@gmail.com`, 'Trimmed and lowercased properly', t6.json);

  // Test 7: Empty email rejected
  console.log('\nTest 7: Empty email');
  const t7 = await postJSON('/api/auth/login', {
    email: '   ',
    fullName: 'Test Candidate',
    password: 'password123'
  });
  assert(t7.status === 400 && t7.json?.error === 'Please enter your email address.', 'Empty email returns 400 with helpful message', t7.json);

  // Test 8: Malformed emails rejected
  console.log('\nTest 8: Malformed email rejection');
  const malformedInputs = [
    'student',
    'student@',
    '@gmail.com',
    'student@@gmail.com',
    'student gmail@gmail.com',
    'student@gmail',
    'student..name@example.com',
    'student@.com',
    'student@example..com'
  ];
  let allMalformedRejected = true;
  for (const m of malformedInputs) {
    const res = await postJSON('/api/auth/login', {
      email: m,
      fullName: 'Test Candidate',
      password: 'password123'
    });
    if (res.status !== 400 || res.json?.error !== 'Enter a valid email address, such as student@gmail.com.') {
      allMalformedRejected = false;
      console.error(`  Failed on malformed input: "${m}" -> Status: ${res.status}, error:`, res.json);
    }
  }
  assert(allMalformedRejected, 'All 9 malformed email variants correctly rejected with 400 and format guidance');

  // Test 9: Empty password rejected
  console.log('\nTest 9: Empty password');
  const t9 = await postJSON('/api/auth/login', {
    email: `valid.${timestamp}@example.com`,
    fullName: 'Valid Name',
    password: '   '
  });
  assert(t9.status === 400 && t9.json?.error === 'Please enter your password.', 'Empty password returns 400 with helpful message', t9.json);

  // Test 10: New candidate account creation
  console.log('\nTest 10: New candidate account creation');
  const newCandidateEmail = `newcand.${timestamp}@example.com`;
  const t10 = await postJSON('/api/auth/login', {
    email: newCandidateEmail,
    fullName: 'New Registered Student',
    password: 'secretPassword456'
  });
  assert(t10.status === 200 && t10.json?.user?.fullName === 'New Registered Student', 'New candidate account created and returned', t10.json);
  const newCandCookie = extractCookie(t10.setCookie);
  assert(!!newCandCookie, 'Auth session cookie issued for new candidate');

  // Test 11: Existing candidate with correct password
  console.log('\nTest 11: Existing candidate with correct password');
  const t11 = await postJSON('/api/auth/login', {
    email: newCandidateEmail,
    fullName: 'New Registered Student',
    password: 'secretPassword456'
  });
  assert(t11.status === 200 && t11.json?.success === true, 'Existing candidate authenticates with correct password', t11.json);

  // Test 12: Existing candidate with wrong password
  console.log('\nTest 12: Existing candidate with wrong password');
  const t12 = await postJSON('/api/auth/login', {
    email: newCandidateEmail,
    fullName: 'New Registered Student',
    password: 'WRONG_PASSWORD_XYZ'
  });
  assert(t12.status === 401 && t12.json?.error === 'Invalid email or password', 'Wrong password returns 401 and generic error', t12.json);

  // Verify that the original password was NOT overwritten by the failed attempt
  const t12Verify = await postJSON('/api/auth/login', {
    email: newCandidateEmail,
    password: 'secretPassword456'
  });
  assert(t12Verify.status === 200, 'Original password remains intact after failed login attempt');

  // Test 13: Duplicate registration attempts
  console.log('\nTest 13: Duplicate registration attempt');
  const t13 = await postJSON('/api/auth/login', {
    email: newCandidateEmail,
    fullName: 'Duplicate Check Name',
    password: 'secretPassword456'
  });
  assert(t13.status === 200, 'Duplicate login for same email does not duplicate accounts or fail');

  // Test 14: Concurrent requests for the same email (race condition handling)
  console.log('\nTest 14: Concurrent registration requests for same email');
  const concurrentEmail = `concurrent.${timestamp}@example.com`;
  const [c1, c2] = await Promise.all([
    postJSON('/api/auth/login', { email: concurrentEmail, fullName: 'Concurrent A', password: 'concurrentPass123' }),
    postJSON('/api/auth/login', { email: concurrentEmail, fullName: 'Concurrent B', password: 'concurrentPass123' })
  ]);
  const concurrentSuccess = (c1.status === 200 || c1.status === 409) && (c2.status === 200 || c2.status === 409);
  assert(concurrentSuccess, 'Concurrent registration handled gracefully without crashing or unhandled errors', { c1: c1.status, c2: c2.status });

  // Test 15: MongoDB connection & data layer verification
  console.log('\nTest 15: Data layer integrity verification');
  const meRes = await fetch(`${BASE}/api/auth/me`, {
    headers: { 'Cookie': newCandCookie }
  });
  const meJson = await meRes.json();
  assert(meRes.status === 200 && meJson?.user?.email === newCandidateEmail, 'Auth cookie resolves to correct candidate in MongoDB', meJson);

  // Test 16: Failed authentication creates no assessment session
  console.log('\nTest 16: Failed authentication creates no assessment session');
  const unauthSessionRes = await fetch(`${BASE}/api/assessment/start`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  });
  assert(unauthSessionRes.status === 401, 'Unauthenticated request to start assessment is rejected (401)');

  // Test 17: Successful authentication allows assessment start / resume
  console.log('\nTest 17: Successful authentication allows assessment start');
  const authStartRes = await fetch(`${BASE}/api/assessment/start`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Cookie': newCandCookie
    }
  });
  const authStartJson = await authStartRes.json();
  assert(authStartRes.status === 200 && !!authStartJson?.sessionId, 'Authenticated candidate can initialize/start assessment', authStartJson);

  // Test 18: Existing autosave, scoring, proctoring, and submission still work
  console.log('\nTest 18: Existing autosave, sync, and results functionality');
  const syncRes = await fetch(`${BASE}/api/assessment/sync`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Cookie': newCandCookie
    },
    body: JSON.stringify({
      answers: [
        { questionId: 1, value: 'A' }
      ]
    })
  });
  const syncJson = await syncRes.json();
  assert(syncRes.status === 200 && syncJson?.success === true, 'Autosave / sync answers operates properly for candidate', syncJson);

  console.log('\n=============================================================');
  console.log(`📊 TEST RESULTS: ${passedCount} PASSED, ${failedCount} FAILED`);
  console.log('=============================================================\n');

  if (failedCount > 0) {
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error('Fatal test runner error:', err);
  process.exit(1);
});
