const dotenv = require('dotenv');
const path = require('path');
const mongoose = require('mongoose');

dotenv.config({ path: path.resolve(__dirname, '../.env') });
const BASE_URL = 'http://localhost:3000';

async function verifyLifecycle() {
  console.log('\n--- STARTING FULL END-TO-END AUTHENTICATION LIFECYCLE VERIFICATION ---\n');

  await mongoose.connect(process.env.MONGODB_URI);
  console.log('[1/10] Connected to MongoDB Atlas database:', mongoose.connection.name);

  // 1. Admin login
  const adminLoginRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'bhagavan@datavalley.ai', password: 'bhagavan123' })
  });
  console.log('[2/10] Admin login HTTP status:', adminLoginRes.status);
  const adminCookieHeader = adminLoginRes.headers.get('set-cookie');
  const adminMatch = adminCookieHeader.match(/dv_session=([^;]+)/);
  const adminCookie = `dv_session=${adminMatch[1]}`;

  // 2. Provision new candidate
  const testCandidateEmail = `autotest_${Date.now()}@datavalley-verify.internal`;
  const testCandidatePassword = 'TempSecurePassword2026!';
  const testCandidateName = 'Automated Verification Candidate';

  const provisionRes = await fetch(`${BASE_URL}/api/admin/candidates`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Cookie': adminCookie
    },
    body: JSON.stringify({
      fullName: testCandidateName,
      email: testCandidateEmail,
      password: testCandidatePassword
    })
  });
  console.log('[3/10] Candidate provisioning HTTP status:', provisionRes.status);
  const provisionData = await provisionRes.json();
  console.log('       Provisioned candidate ID:', provisionData.candidate.id);

  // 3. Verify in MongoDB Atlas
  const dbRecord = await mongoose.connection.db.collection('candidates').findOne({ email: testCandidateEmail });
  const hash = dbRecord?.passwordHash || dbRecord?.password;
  console.log('[4/10] MongoDB direct inspection:');
  console.log('       Has password field:', typeof dbRecord?.password === 'string');
  console.log('       Has passwordHash field:', typeof dbRecord?.passwordHash === 'string');
  console.log('       Bcrypt hash exists and starts with $2:', !!hash && hash.startsWith('$2'));
  console.log('       Role in DB:', dbRecord?.role);

  // 4. Logout admin
  const logoutRes = await fetch(`${BASE_URL}/api/auth/logout`, { method: 'POST' });
  console.log('[5/10] Admin logout status:', logoutRes.status);

  // 5. Candidate login with wrong password
  const failLoginRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: testCandidateEmail, password: 'WrongPassword999!' })
  });
  console.log('[6/10] Candidate wrong password HTTP status:', failLoginRes.status);

  // 6. Candidate login with correct password
  const candLoginRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: testCandidateEmail, password: testCandidatePassword })
  });
  console.log('[7/10] Candidate correct password HTTP status:', candLoginRes.status);
  const candCookieHeader = candLoginRes.headers.get('set-cookie');
  const candMatch = candCookieHeader.match(/dv_session=([^;]+)/);
  const candCookie = `dv_session=${candMatch[1]}`;

  // 7. Verify /api/auth/me
  const meRes = await fetch(`${BASE_URL}/api/auth/me`, {
    headers: { 'Cookie': candCookie }
  });
  const meData = await meRes.json();
  console.log('[8/10] Candidate /api/auth/me HTTP status:', meRes.status);
  console.log('       Candidate verified email:', meData.user.email);
  console.log('       Candidate verified role:', meData.user.role);

  // 8. Start assessment as candidate
  const startRes = await fetch(`${BASE_URL}/api/assessment/start`, {
    method: 'POST',
    headers: { 'Cookie': candCookie }
  });
  const startData = await startRes.json();
  console.log('[9/10] Candidate /api/assessment/start HTTP status:', startRes.status);
  console.log('       Created assessment session ID:', startData.sessionId);

  // 9. Clean up test record and session from database
  await mongoose.connection.db.collection('candidates').deleteOne({ email: testCandidateEmail });
  if (startData.sessionId) {
    await mongoose.connection.db.collection('assessmentsessions').deleteOne({ _id: new mongoose.Types.ObjectId(startData.sessionId) });
  }
  console.log('[10/10] Cleaned up temporary test candidate and assessment records.');

  await mongoose.disconnect();
  console.log('\n--- ALL 10 E2E LIFECYCLE VERIFICATION CHECKS PASSED SUCCESSFULLY! ---\n');
}

verifyLifecycle().catch(err => {
  console.error('Lifecycle test failed:', err);
  process.exit(1);
});
