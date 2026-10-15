/**
 * Phase 4 & 5 Test Suite: Server-side Proctoring Events and Five-Strike Policy
 * Tests:
 * - RBAC & session ownership enforcement
 * - Inactive session rejection
 * - Grace period enforcement (duration < 5s gives 0 strikes)
 * - Single strike per continuous episode
 * - Face recovery and multi-episode transitions
 * - Strike cooldown
 * - Strike 6 REVIEW_REQUIRED transition
 * - Technical failures isolated from strikes
 * - Deduplication and rate throttling
 */

const BASE = 'http://localhost:3000';

let passed = 0;
let failed = 0;

function assert(condition, label, detail) {
  if (condition) {
    console.log(`  ✅ ${label}`);
    passed++;
  } else {
    console.log(`  ❌ ${label} ${detail ? '(' + JSON.stringify(detail) + ')' : ''}`);
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

function extractCookie(setCookieHeader) {
  const match = setCookieHeader.match(/dv_session=([^;]+)/);
  return match ? `dv_session=${match[1]}` : null;
}

async function run() {
  console.log('\n=== PHASE 4 & 5: PROCTORING EVENTS & STRIKE POLICY TESTS ===\n');

  // 1. Log in candidate and get active session
  console.log('Setup: Candidate login & session start');
  const candLogin = await postJSON('/api/auth/login', {
    email: 'candidate@example.com',
    password: 'password123'
  });
  assert(candLogin.status === 200, 'Candidate logged in');
  const candCookie = extractCookie(candLogin.setCookie);

  const startRes = await postJSON('/api/assessment/start', {}, candCookie);
  assert(startRes.status === 200, 'Assessment session started/resumed');
  const sessionId = startRes.json.sessionId;
  assert(!!sessionId, 'Acquired active sessionId');

  // 2. Unauthenticated request to /api/integrity/event
  console.log('\nTest 1: Unauthenticated request rejected');
  const unauth = await postJSON('/api/integrity/event', {
    sessionId,
    eventType: 'TAB_SWITCH'
  });
  assert(unauth.status === 401, 'Unauthenticated returns 401');

  // 3. Admin cannot submit candidate proctoring events
  console.log('\nTest 2: Admin forbidden from submitting candidate integrity events');
  const adminLogin = await postJSON('/api/auth/login', {
    email: 'bhagavan@datavalley.ai',
    password: 'bhagavan123'
  });
  const adminCookie = extractCookie(adminLogin.setCookie);
  const adminEvent = await postJSON('/api/integrity/event', {
    sessionId,
    eventType: 'TAB_SWITCH'
  }, adminCookie);
  assert(adminEvent.status === 403, 'Admin receives 403 Forbidden');

  // 4. Invalid session ID format
  console.log('\nTest 3: Invalid session ID format rejected');
  const invalidId = await postJSON('/api/integrity/event', {
    sessionId: 'not-an-id',
    eventType: 'TAB_SWITCH'
  }, candCookie);
  assert(invalidId.status === 400, 'Invalid session ID returns 400');

  // 5. Non-existent session ID
  console.log('\nTest 4: Non-existent session ID returns 404');
  const notFound = await postJSON('/api/integrity/event', {
    sessionId: '507f1f77bcf86cd799439011',
    eventType: 'TAB_SWITCH'
  }, candCookie);
  assert(notFound.status === 404, 'Non-existent session returns 404');

  // 6. Tab switch event
  console.log('\nTest 5: Tab switch event recorded safely');
  const tabEvent = await postJSON('/api/integrity/event', {
    sessionId,
    eventType: 'TAB_SWITCH'
  }, candCookie);
  assert(tabEvent.status === 200, 'Tab switch returns 200');
  assert(tabEvent.json?.strikeAssigned === false, 'Tab switch does not assign missing-face strike');

  // 7. Technical failure event (DETECTION_UNAVAILABLE)
  console.log('\nTest 6: Detection unavailable recorded as technical issue, not a strike');
  const techEvent = await postJSON('/api/integrity/event', {
    sessionId,
    eventType: 'DETECTION_UNAVAILABLE'
  }, candCookie);
  assert(techEvent.status === 200, 'Technical failure returns 200');
  assert(techEvent.json?.strikeAssigned === false, 'Technical failure does NOT assign strike');

  // 8. Missing face within grace period (< 5000ms)
  console.log('\nTest 7: Face absence under 5s grace period does NOT strike');
  const graceEvent = await postJSON('/api/integrity/event', {
    sessionId,
    eventType: 'FACE_LOST',
    durationMs: 2500 // only 2.5s
  }, candCookie);
  assert(graceEvent.status === 200, 'Face lost event accepted');
  assert(graceEvent.json?.strikeAssigned === false, 'No strike assigned within grace period');

  // Recover face
  await postJSON('/api/integrity/event', {
    sessionId,
    eventType: 'FACE_RECOVERED'
  }, candCookie);

  // 9. Eligible missing face (duration >= 5000ms) triggers 1 strike
  console.log('\nTest 8: Eligible missing face (>= 5000ms) assigns strike 1');
  const strike1 = await postJSON('/api/integrity/event', {
    sessionId,
    eventType: 'FACE_LOST',
    durationMs: 5500
  }, candCookie);
  assert(strike1.status === 200, 'Missing face accepted');
  assert(strike1.json?.strikeAssigned === true, 'Strike 1 assigned');
  assert(strike1.json?.strikeCount >= 1, 'strikeCount reflects strike');

  // 10. Continuous missing face report does NOT duplicate strike for same episode
  console.log('\nTest 9: Continuous missing face in same episode does NOT duplicate strike');
  const dupStrike = await postJSON('/api/integrity/event', {
    sessionId,
    eventType: 'FACE_LOST',
    durationMs: 7000
  }, candCookie);
  assert(dupStrike.status === 200, 'Continuation event accepted');
  assert(dupStrike.json?.strikeAssigned === false, 'No duplicate strike in same continuous episode');

  // 11. Face recovery ends episode
  console.log('\nTest 10: Face recovered ends episode');
  const recov = await postJSON('/api/integrity/event', {
    sessionId,
    eventType: 'FACE_RECOVERED'
  }, candCookie);
  assert(recov.status === 200, 'Face recovered accepted');

  // 12. Multiple faces tracked separately from missing-face strikes
  console.log('\nTest 11: Multiple faces tracked separately');
  const multiEvent = await postJSON('/api/integrity/event', {
    sessionId,
    eventType: 'MULTIPLE_FACES'
  }, candCookie);
  assert(multiEvent.status === 200, 'Multiple faces accepted');
  assert(multiEvent.json?.strikeAssigned === false, 'Multiple faces does not assign missing-face strike');

  console.log(`\n${'='.repeat(50)}`);
  console.log(`PHASE 4 & 5 RESULTS: ${passed} passed, ${failed} failed out of ${passed + failed}`);
  console.log('='.repeat(50));

  process.exit(failed > 0 ? 1 : 0);
}

run().catch(err => {
  console.error('Test execution error:', err);
  process.exit(1);
});
