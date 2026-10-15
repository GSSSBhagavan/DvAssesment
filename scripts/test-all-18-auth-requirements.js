const path = require('path');
const fs = require('fs');
const mongoose = require(path.join(process.cwd(), 'node_modules', 'mongoose'));
const bcrypt = require(path.join(process.cwd(), 'node_modules', 'bcryptjs'));
const jwt = require(path.join(process.cwd(), 'node_modules', 'jsonwebtoken'));

const envContent = fs.readFileSync(path.join(process.cwd(), '.env'), 'utf8');
let mongoUri = '';
let jwtSecret = '';
for (const line of envContent.split(/\r?\n/)) {
  const trimmed = line.trim();
  if (trimmed.startsWith('MONGODB_URI=')) {
    let raw = trimmed.slice('MONGODB_URI='.length).trim();
    if (raw.startsWith('"') && raw.endsWith('"')) raw = raw.slice(1, -1);
    if (raw.startsWith("'") && raw.endsWith("'")) raw = raw.slice(1, -1);
    mongoUri = raw;
  }
  if (trimmed.startsWith('JWT_SECRET=')) {
    let raw = trimmed.slice('JWT_SECRET='.length).trim();
    if (raw.startsWith('"') && raw.endsWith('"')) raw = raw.slice(1, -1);
    if (raw.startsWith("'") && raw.endsWith("'")) raw = raw.slice(1, -1);
    jwtSecret = raw;
  }
}

const BASE_URL = 'http://localhost:3000';

let passCount = 0;
let failCount = 0;
const results = [];

function recordResult(num, title, passed, detail = '') {
  if (passed) {
    passCount++;
    console.log(`✅ [TEST ${num}/18] PASS: ${title}`);
    results.push({ num, title, passed: true });
  } else {
    failCount++;
    console.error(`❌ [TEST ${num}/18] FAIL: ${title} - ${detail}`);
    results.push({ num, title, passed: false, detail });
  }
}

async function run() {
  console.log('\n================================================================');
  console.log('   DATAVALLEY ASSESSMENT: 18-POINT AUTHENTICATION TEST SUITE   ');
  console.log('================================================================\n');

  await mongoose.connect(mongoUri, { dbName: 'dvlabs' });
  const candidatesCol = mongoose.connection.db.collection('candidates');
  const initialRecords = await candidatesCol.find({}).toArray();
  const initialEmails = new Set(initialRecords.map(c => c.email));
  console.log(`[Setup] Connected to database: "${mongoose.connection.name}". Existing candidates: ${initialRecords.length}`);

  const testTimestamp = Date.now();
  const testCandidateEmail = `test_candidate_${testTimestamp}@example.com`;
  const testCandidatePassword = 'ValidPassword123!';
  const testCandidateName = 'Test Candidate Automation';

  let adminCookie = '';
  let candidateCookie = '';

  try {
    // 17. Admin access with valid admin credentials (login first to be able to provision)
    const adminRes = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'bhagavan@datavalley.ai', password: 'bhagavan123' })
    });
    const adminData = await adminRes.json();
    const adminSetCookie = adminRes.headers.get('set-cookie');
    if (adminRes.status === 200 && adminData.user?.role === 'ADMIN' && adminSetCookie) {
      adminCookie = adminSetCookie.split(';')[0];
      recordResult(17, 'Admin access with valid admin credentials', true);
    } else {
      recordResult(17, 'Admin access with valid admin credentials', false, `Status: ${adminRes.status}`);
    }

    // Provision test candidate through Admin API
    const provRes = await fetch(`${BASE_URL}/api/admin/candidates`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Cookie': adminCookie },
      body: JSON.stringify({
        fullName: testCandidateName,
        email: testCandidateEmail,
        password: testCandidatePassword
      })
    });
    const provData = await provRes.json();
    if (!provRes.ok) {
      throw new Error(`Failed to provision candidate for tests: ${JSON.stringify(provData)}`);
    }

    // 1. Valid candidate login
    const loginRes = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: testCandidateEmail, password: testCandidatePassword })
    });
    const loginData = await loginRes.json();
    const setCookieHeader = loginRes.headers.get('set-cookie');
    if (loginRes.status === 200 && loginData.success && loginData.user?.email === testCandidateEmail) {
      candidateCookie = setCookieHeader ? setCookieHeader.split(';')[0] : '';
      recordResult(1, 'Valid candidate login', true);
    } else {
      recordResult(1, 'Valid candidate login', false, `Status: ${loginRes.status}, data: ${JSON.stringify(loginData)}`);
    }

    // 2. Unknown email rejection (NO auto-provisioning)
    const unknownRes = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: `nonexistent_${Date.now()}@example.com`, password: 'SomePassword123!' })
    });
    const unknownData = await unknownRes.json();
    if (unknownRes.status === 401 && unknownData.error) {
      recordResult(2, 'Unknown email rejection (no auto-provisioning)', true);
    } else {
      recordResult(2, 'Unknown email rejection', false, `Status: ${unknownRes.status}`);
    }

    // 3. Incorrect password rejection
    const wrongPassRes = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: testCandidateEmail, password: 'WrongPassword999!' })
    });
    const wrongPassData = await wrongPassRes.json();
    if (wrongPassRes.status === 401 && wrongPassData.error) {
      recordResult(3, 'Incorrect password rejection', true);
    } else {
      recordResult(3, 'Incorrect password rejection', false, `Status: ${wrongPassRes.status}`);
    }

    // 4. Missing email rejection
    const missingEmailRes = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: 'Password123!' })
    });
    if (missingEmailRes.status === 400) {
      recordResult(4, 'Missing email rejection (HTTP 400)', true);
    } else {
      recordResult(4, 'Missing email rejection', false, `Status: ${missingEmailRes.status}`);
    }

    // 5. Missing password rejection
    const missingPassRes = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: testCandidateEmail })
    });
    if (missingPassRes.status === 400) {
      recordResult(5, 'Missing password rejection (HTTP 400)', true);
    } else {
      recordResult(5, 'Missing password rejection', false, `Status: ${missingPassRes.status}`);
    }

    // 6. Email casing and whitespace normalization
    const messyEmail = `  ${testCandidateEmail.toUpperCase()}  `;
    const normRes = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: messyEmail, password: testCandidatePassword })
    });
    const normData = await normRes.json();
    if (normRes.status === 200 && normData.user?.email === testCandidateEmail) {
      recordResult(6, 'Email casing and whitespace normalization', true);
    } else {
      recordResult(6, 'Email casing and whitespace normalization', false, `Status: ${normRes.status}`);
    }

    // 7. Duplicate email prevention in candidate provisioning
    const dupRes = await fetch(`${BASE_URL}/api/admin/candidates`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Cookie': adminCookie },
      body: JSON.stringify({
        fullName: 'Duplicate Candidate',
        email: testCandidateEmail.toUpperCase(),
        password: 'AnotherPassword123!'
      })
    });
    if (dupRes.status === 409) {
      recordResult(7, 'Duplicate email prevention (HTTP 409)', true);
    } else {
      recordResult(7, 'Duplicate email prevention', false, `Status: ${dupRes.status}`);
    }

    // 8. Password hashing and verification in MongoDB
    const candInDb = await candidatesCol.findOne({ email: testCandidateEmail });
    const storedHash = candInDb?.passwordHash || candInDb?.password;
    const isBcrypt = typeof storedHash === 'string' && storedHash.startsWith('$2');
    const matchesBcrypt = isBcrypt && await bcrypt.compare(testCandidatePassword, storedHash);
    if (isBcrypt && matchesBcrypt) {
      recordResult(8, 'Password hashing and verification with bcrypt', true);
    } else {
      recordResult(8, 'Password hashing and verification', false, `isBcrypt: ${isBcrypt}, matches: ${matchesBcrypt}`);
    }

    // 9. Password hashes excluded from API responses
    const meResCheck = await fetch(`${BASE_URL}/api/auth/me`, {
      headers: { 'Cookie': candidateCookie }
    });
    const meDataCheck = await meResCheck.json();
    const noHashInLogin = !loginData.user?.password && !loginData.user?.passwordHash;
    const noHashInMe = !meDataCheck.user?.password && !meDataCheck.user?.passwordHash;
    const noHashInProv = !provData.candidate?.password && !provData.candidate?.passwordHash;
    if (noHashInLogin && noHashInMe && noHashInProv) {
      recordResult(9, 'Password hashes excluded from all API responses', true);
    } else {
      recordResult(9, 'Password hashes excluded', false, 'Hash detected in API response');
    }

    // 10. JWT secret missing or invalid handling
    try {
      const forgedToken = jwt.sign({ candidateId: candInDb._id.toString(), role: 'CANDIDATE', email: testCandidateEmail }, 'wrong-secret-signature', { algorithm: 'HS256' });
      const forgedRes = await fetch(`${BASE_URL}/api/auth/me`, {
        headers: { 'Cookie': `dv_session=${forgedToken}` }
      });
      if (forgedRes.status === 401) {
        recordResult(10, 'Invalid JWT signature fails closed (HTTP 401)', true);
      } else {
        recordResult(10, 'Invalid JWT signature handling', false, `Status: ${forgedRes.status}`);
      }
    } catch (e) {
      recordResult(10, 'Invalid JWT signature handling', false, e.message);
    }

    // 11. Correct HTTP-only cookie creation
    const cookieDetails = setCookieHeader || '';
    const isHttpOnly = cookieDetails.toLowerCase().includes('httponly');
    const hasDvSession = cookieDetails.includes('dv_session=');
    const hasPath = cookieDetails.toLowerCase().includes('path=/');
    if (isHttpOnly && hasDvSession && hasPath) {
      recordResult(11, 'Correct HTTP-only cookie creation (httpOnly, path=/)', true);
    } else {
      recordResult(11, 'Correct HTTP-only cookie creation', false, cookieDetails);
    }

    // 12. /api/auth/me after login returns authenticated candidate
    const meRes = await fetch(`${BASE_URL}/api/auth/me`, {
      headers: { 'Cookie': candidateCookie }
    });
    const meData = await meRes.json();
    if (meRes.status === 200 && meData.user?.email === testCandidateEmail && meData.user?.role === 'CANDIDATE') {
      recordResult(12, '/api/auth/me returns authenticated candidate profile', true);
    } else {
      recordResult(12, '/api/auth/me after login', false, `Status: ${meRes.status}, data: ${JSON.stringify(meData)}`);
    }

    // 13. Session persistence after refresh (repeated /api/auth/me calls with same cookie)
    const refreshRes = await fetch(`${BASE_URL}/api/auth/me`, {
      headers: { 'Cookie': candidateCookie }
    });
    const refreshData = await refreshRes.json();
    if (refreshRes.status === 200 && refreshData.user?.id === meData.user?.id) {
      recordResult(13, 'Session persistence after refresh (cookie verified)', true);
    } else {
      recordResult(13, 'Session persistence after refresh', false, `Status: ${refreshRes.status}`);
    }

    // 14. Logout and cookie clearing
    const logoutRes = await fetch(`${BASE_URL}/api/auth/logout`, {
      method: 'POST',
      headers: { 'Cookie': candidateCookie }
    });
    const logoutCookie = logoutRes.headers.get('set-cookie') || '';
    const cookieCleared = logoutCookie.includes('Max-Age=0') || logoutCookie.includes('expires=') || logoutCookie.includes('dv_session=;');
    // Check that making a request with cleared cookie fails
    const postLogoutRes = await fetch(`${BASE_URL}/api/auth/me`, {
      headers: { 'Cookie': 'dv_session=' }
    });
    if (logoutRes.status === 200 && cookieCleared && postLogoutRes.status === 401) {
      recordResult(14, 'Logout and cookie clearing (Max-Age=0 and 401 after logout)', true);
    } else {
      recordResult(14, 'Logout and cookie clearing', false, `logoutCookie: ${logoutCookie}, status: ${postLogoutRes.status}`);
    }

    // 15. Unauthenticated access to protected assessment APIs is rejected (401)
    const unauthCurrentRes = await fetch(`${BASE_URL}/api/assessment/current`);
    const unauthStartRes = await fetch(`${BASE_URL}/api/assessment/start`, { method: 'POST' });
    const unauthSyncRes = await fetch(`${BASE_URL}/api/assessment/sync`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ answers: [] }) });
    if (unauthCurrentRes.status === 401 && unauthStartRes.status === 401 && unauthSyncRes.status === 401) {
      recordResult(15, 'Unauthenticated access to protected assessment APIs rejected with 401', true);
    } else {
      recordResult(15, 'Unauthenticated access rejected', false, `current: ${unauthCurrentRes.status}, start: ${unauthStartRes.status}, sync: ${unauthSyncRes.status}`);
    }

    // 16. Candidate denial on admin endpoints (HTTP 403)
    const candOnAdminRes = await fetch(`${BASE_URL}/api/admin/results`, {
      headers: { 'Cookie': candidateCookie }
    });
    const candOnProvRes = await fetch(`${BASE_URL}/api/admin/candidates`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Cookie': candidateCookie },
      body: JSON.stringify({ email: 'hacker@example.com', fullName: 'Hacker', password: 'password123' })
    });
    if (candOnAdminRes.status === 403 && candOnProvRes.status === 403) {
      recordResult(16, 'Candidate denial on admin endpoints (HTTP 403 Forbidden)', true);
    } else {
      recordResult(16, 'Candidate denial on admin endpoints', false, `results: ${candOnAdminRes.status}, candidates: ${candOnProvRes.status}`);
    }

    // Clean up temporary test candidate
    await candidatesCol.deleteOne({ email: testCandidateEmail });

    // 18. Preservation of existing candidate records
    const postTestRecords = await candidatesCol.find({}).toArray();
    let preserved = true;
    for (const email of initialEmails) {
      if (!postTestRecords.some(c => c.email === email)) {
        preserved = false;
        break;
      }
    }
    if (preserved && postTestRecords.length === initialRecords.length) {
      recordResult(18, `Preservation of existing candidate records (${initialRecords.length} records intact)`, true);
    } else {
      recordResult(18, 'Preservation of existing candidate records', false, `Initial: ${initialRecords.length}, Final: ${postTestRecords.length}`);
    }

  } catch (err) {
    console.error('Test execution exception:', err);
  } finally {
    // Ensure test candidate cleaned up
    await candidatesCol.deleteOne({ email: testCandidateEmail });
    await mongoose.disconnect();
  }

  console.log('\n================================================================');
  console.log(`TEST SUMMARY: ${passCount} / 18 PASSED, ${failCount} FAILED`);
  console.log('================================================================\n');

  if (failCount > 0) {
    process.exit(1);
  }
}

run();
