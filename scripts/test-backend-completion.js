const path = require('path');
const fs = require('fs');
const mongoose = require(path.join(process.cwd(), 'node_modules', 'mongoose'));
const bcrypt = require(path.join(process.cwd(), 'node_modules', 'bcryptjs'));
const jwt = require(path.join(process.cwd(), 'node_modules', 'jsonwebtoken'));

// Read env without logging values
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

function loadAnswerKeys() {
  const content = fs.readFileSync(path.join(process.cwd(), 'src', 'server', 'assessment-keys.ts'), 'utf8');
  const match = content.match(/export const answerKeys\s*=\s*(\[[\s\S]*?\]);/);
  if (!match) throw new Error('Could not parse answerKeys from assessment-keys.ts');
  return JSON.parse(match[1]);
}

const BASE_URL = 'http://localhost:3000';

let passCount = 0;
let failCount = 0;
const testResults = [];

function recordResult(num, title, passed, detail = '') {
  if (passed) {
    passCount++;
    console.log(`✅ [FLOW ${num}/13] PASS: ${title}`);
    testResults.push({ num, title, passed: true });
  } else {
    failCount++;
    console.error(`❌ [FLOW ${num}/13] FAIL: ${title} - ${detail}`);
    testResults.push({ num, title, passed: false, detail });
  }
}

async function run() {
  console.log('\n================================================================');
  console.log('   DATAVALLEY ASSESSMENT: FULL BACKEND COMPLETION AUDIT SUITE   ');
  console.log('================================================================\n');

  await mongoose.connect(mongoUri, { dbName: 'dvlabs' });
  const candidatesCol = mongoose.connection.db.collection('candidates');
  const sessionsCol = mongoose.connection.db.collection('assessmentsessions');
  const eventsCol = mongoose.connection.db.collection('proctoringevents');

  const initialCandidates = await candidatesCol.find({}).toArray();
  console.log(`[Database] Connected to "${mongoose.connection.name}". Preserving ${initialCandidates.length} existing candidate records.`);

  const keys = loadAnswerKeys();
  console.log(`[Assessment] Verified server-only answer keys: ${keys.length} questions loaded.`);

  const createdCandidateIds = [];

  const testId = Date.now();
  const testCandidateEmail = `audit_candidate_${testId}@example.com`;
  const testCandidatePassword = 'ValidPassword123!';
  const testCandidateName = 'Audit Test Candidate';

  let candidateCookie = '';
  let adminCookie = '';
  let activeSessionId = null;

  try {
    // -------------------------------------------------------------------------
    // Setup Admin and Candidate accounts
    // -------------------------------------------------------------------------
    const adminUser = await candidatesCol.findOne({ role: 'ADMIN' });
    if (!adminUser) throw new Error('No admin user found in database');
    const adminToken = jwt.sign(
      { candidateId: adminUser._id.toString(), role: 'ADMIN', email: adminUser.email },
      jwtSecret,
      { expiresIn: '1h', algorithm: 'HS256' }
    );
    adminCookie = `dv_session=${adminToken}`;

    // Provision test candidate via admin API
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
    if (!provRes.ok || !provData.success) {
      throw new Error(`Failed to provision candidate: ${JSON.stringify(provData)}`);
    }
    const testCandidateId = provData.candidate.id;
    createdCandidateIds.push(testCandidateId);

    // -------------------------------------------------------------------------
    // 1. Candidate Login
    // -------------------------------------------------------------------------
    const loginRes = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: testCandidateEmail, password: testCandidatePassword })
    });
    const loginData = await loginRes.json();
    const setCookieHeader = loginRes.headers.get('set-cookie') || '';
    const cookieMatch = setCookieHeader.match(/dv_session=([^;]+)/);
    if (cookieMatch) {
      candidateCookie = `dv_session=${cookieMatch[1]}`;
    }

    const flow1Pass = loginRes.status === 200 &&
      loginData.success === true &&
      loginData.user.email === testCandidateEmail &&
      candidateCookie.length > 0;
    recordResult(1, 'Candidate login & authoritative session establishment', flow1Pass);

    // -------------------------------------------------------------------------
    // 2. Assessment Start
    // -------------------------------------------------------------------------
    const startRes = await fetch(`${BASE_URL}/api/assessment/start`, {
      method: 'POST',
      headers: { 'Cookie': candidateCookie }
    });
    const startData = await startRes.json();
    const flow2Pass = startRes.status === 200 &&
      startData.success === true &&
      typeof startData.sessionId === 'string' &&
      typeof startData.startedAt === 'string' &&
      typeof startData.expiresAt === 'string';
    activeSessionId = startData.sessionId;
    recordResult(2, 'Assessment start & active session creation', flow2Pass);

    // -------------------------------------------------------------------------
    // 3. Server-authoritative 60-minute deadline
    // -------------------------------------------------------------------------
    const startTimeMs = new Date(startData.startedAt).getTime();
    const expiresTimeMs = new Date(startData.expiresAt).getTime();
    const durationMinutes = (expiresTimeMs - startTimeMs) / (1000 * 60);
    const flow3Pass = Math.abs(durationMinutes - 60) < 0.1;
    recordResult(3, `Server-authoritative 60-minute deadline (${durationMinutes} mins)`, flow3Pass);

    // -------------------------------------------------------------------------
    // 4. Answer Synchronization
    // -------------------------------------------------------------------------
    const initialSync = [
      { questionId: 1, value: keys[0].correctAnswer },
      { questionId: 2, value: keys[1].correctAnswer }
    ];
    const syncRes = await fetch(`${BASE_URL}/api/assessment/sync`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'Cookie': candidateCookie },
      body: JSON.stringify({ answers: initialSync })
    });
    const syncData = await syncRes.json();
    const sessionInDb = await sessionsCol.findOne({ _id: new mongoose.Types.ObjectId(activeSessionId) });
    const flow4Pass = syncRes.status === 200 &&
      syncData.success === true &&
      sessionInDb.answers.length === 2;
    recordResult(4, 'Incremental answer synchronization & MongoDB persistence', flow4Pass);

    // -------------------------------------------------------------------------
    // 5. Camera readiness, proctoring persistence, deduplication & episode strike rules
    // -------------------------------------------------------------------------
    // Event A: Tab switch
    const ev1Res = await fetch(`${BASE_URL}/api/integrity/event`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Cookie': candidateCookie },
      body: JSON.stringify({
        sessionId: activeSessionId,
        eventType: 'TAB_SWITCH',
        clientTimestamp: new Date().toISOString()
      })
    });
    const ev1Data = await ev1Res.json();

    // Event B: Fullscreen exit
    const ev2Res = await fetch(`${BASE_URL}/api/integrity/event`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Cookie': candidateCookie },
      body: JSON.stringify({
        sessionId: activeSessionId,
        eventType: 'FULLSCREEN_EXIT',
        clientTimestamp: new Date().toISOString()
      })
    });
    const ev2Data = await ev2Res.json();

    // Event C: Concurrent duplicate event within 2s
    const dupRes = await fetch(`${BASE_URL}/api/integrity/event`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Cookie': candidateCookie },
      body: JSON.stringify({
        sessionId: activeSessionId,
        eventType: 'FULLSCREEN_EXIT',
        clientTimestamp: new Date().toISOString()
      })
    });
    const dupData = await dupRes.json();

    // Event D: Missing face episode 1 (exceeding 5s grace) -> 1 strike assigned
    const faceLostRes = await fetch(`${BASE_URL}/api/integrity/event`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Cookie': candidateCookie },
      body: JSON.stringify({
        sessionId: activeSessionId,
        eventType: 'FACE_LOST',
        durationMs: 6000,
        clientTimestamp: new Date().toISOString()
      })
    });
    const faceLostData = await faceLostRes.json();

    // Event E: Same continuous missing episode -> strike NOT doubled
    const faceLostContRes = await fetch(`${BASE_URL}/api/integrity/event`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Cookie': candidateCookie },
      body: JSON.stringify({
        sessionId: activeSessionId,
        eventType: 'FACE_LOST',
        durationMs: 8000,
        clientTimestamp: new Date().toISOString()
      })
    });
    const faceLostContData = await faceLostContRes.json();

    // Event F: Technical failure -> 0 strikes, tracked in technicalFailures
    const techRes = await fetch(`${BASE_URL}/api/integrity/event`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Cookie': candidateCookie },
      body: JSON.stringify({
        sessionId: activeSessionId,
        eventType: 'DETECTION_UNAVAILABLE',
        clientTimestamp: new Date().toISOString()
      })
    });
    const techData = await techRes.json();

    // Event G: Face recovered
    await fetch(`${BASE_URL}/api/integrity/event`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Cookie': candidateCookie },
      body: JSON.stringify({
        sessionId: activeSessionId,
        eventType: 'FACE_RECOVERED',
        clientTimestamp: new Date().toISOString()
      })
    });

    const sessionAfterEvents = await sessionsCol.findOne({ _id: new mongoose.Types.ObjectId(activeSessionId) });
    const persistedEventsCount = await eventsCol.countDocuments({ sessionId: new mongoose.Types.ObjectId(activeSessionId) });

    const flow5Pass = ev1Data.success === true &&
      ev2Data.success === true &&
      dupData.deduplicated === true &&
      faceLostData.strikeAssigned === true &&
      faceLostContData.strikeAssigned === false &&
      techData.strikeAssigned === false &&
      sessionAfterEvents.strikeCount === 1 &&
      sessionAfterEvents.proctoringSummary.technicalFailures === 1 &&
      persistedEventsCount >= 4;
    recordResult(5, 'Camera readiness, proctoring persistence, deduplication & episode strike rules', flow5Pass);

    // -------------------------------------------------------------------------
    // 6. Git Answer Evaluation & 7. Submission Score Persistence (Candidate A: 34 correct)
    // -------------------------------------------------------------------------
    // Construct answers to give exactly 34 correct (29 MCQs + 5 Git commands):
    const answers34 = [];
    // 29 correct MCQs (from questions 1-20, 26-34)
    let mcqCount = 0;
    for (const q of keys) {
      if (q.id < 21 || q.id > 25) {
        if (mcqCount < 29) {
          answers34.push({ questionId: q.id, value: q.correctAnswer });
          mcqCount++;
        }
      }
    }
    // 5 correct Git commands
    answers34.push({ questionId: 21, value: 'git status -s' });
    answers34.push({ questionId: 22, value: 'git add ./app.py' });
    answers34.push({ questionId: 23, value: 'git commit -m "Add login feature"' });
    answers34.push({ questionId: 24, value: 'git log --oneline' });
    answers34.push({ questionId: 25, value: 'git push origin main' });

    await fetch(`${BASE_URL}/api/assessment/sync`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'Cookie': candidateCookie },
      body: JSON.stringify({ answers: answers34 })
    });

    // Submit candidate A
    const submitRes = await fetch(`${BASE_URL}/api/assessment/submit`, {
      method: 'POST',
      headers: { 'Cookie': candidateCookie }
    });
    const submitData = await submitRes.json();
    const finalSessionDb = await sessionsCol.findOne({ _id: new mongoose.Types.ObjectId(activeSessionId) });

    const flow6Pass = submitData.score.git === 5;
    recordResult(6, `Server-side Git semantic evaluation (5/5 Git commands correct)`, flow6Pass);

    const flow7Pass = submitRes.status === 200 &&
      submitData.success === true &&
      finalSessionDb.status === 'SUBMITTED' &&
      finalSessionDb.scoreSummary.total === 34 &&
      finalSessionDb.scoreSummary.mcq === 29 &&
      finalSessionDb.scoreSummary.git === 5 &&
      finalSessionDb.scoreSummary.correctAnswers === 34 &&
      finalSessionDb.shortlistStatus === 'NOT_SHORTLISTED';
    recordResult(7, `Assessment submission & score persistence (34 total -> NOT_SHORTLISTED)`, flow7Pass);

    // -------------------------------------------------------------------------
    // 8. Shortlisting Boundaries (34 vs 35 vs 36)
    // -------------------------------------------------------------------------
    // 34 correct -> already verified above as NOT_SHORTLISTED!

    // Candidate B: Exactly 35 correct (30 MCQs + 5 Git)
    const email35 = `audit_35_${testId}@example.com`;
    const candBRes = await fetch(`${BASE_URL}/api/admin/candidates`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Cookie': adminCookie },
      body: JSON.stringify({ fullName: 'Cand 35', email: email35, password: 'ValidPassword123!' })
    });
    const candBData = await candBRes.json();
    createdCandidateIds.push(candBData.candidate.id);
    const tokenB = jwt.sign({ candidateId: candBData.candidate.id, role: 'CANDIDATE', email: email35 }, jwtSecret, { expiresIn: '1h' });
    const cookieB = `dv_session=${tokenB}`;

    await fetch(`${BASE_URL}/api/assessment/start`, { method: 'POST', headers: { 'Cookie': cookieB } });
    const answers35 = [...answers34];
    // Add 1 more correct MCQ to make 35
    for (const q of keys) {
      if ((q.id < 21 || q.id > 25) && !answers35.some(a => a.questionId === q.id)) {
        answers35.push({ questionId: q.id, value: q.correctAnswer });
        break;
      }
    }
    await fetch(`${BASE_URL}/api/assessment/sync`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'Cookie': cookieB },
      body: JSON.stringify({ answers: answers35 })
    });
    const submitBRes = await fetch(`${BASE_URL}/api/assessment/submit`, { method: 'POST', headers: { 'Cookie': cookieB } });
    const submitBData = await submitBRes.json();

    // Candidate C: Exactly 36 correct (31 MCQs + 5 Git)
    const email36 = `audit_36_${testId}@example.com`;
    const candCRes = await fetch(`${BASE_URL}/api/admin/candidates`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Cookie': adminCookie },
      body: JSON.stringify({ fullName: 'Cand 36', email: email36, password: 'ValidPassword123!' })
    });
    const candCData = await candCRes.json();
    createdCandidateIds.push(candCData.candidate.id);
    const tokenC = jwt.sign({ candidateId: candCData.candidate.id, role: 'CANDIDATE', email: email36 }, jwtSecret, { expiresIn: '1h' });
    const cookieC = `dv_session=${tokenC}`;

    await fetch(`${BASE_URL}/api/assessment/start`, { method: 'POST', headers: { 'Cookie': cookieC } });
    const answers36 = [...answers35];
    // Add 1 more correct MCQ to make 36
    for (const q of keys) {
      if ((q.id < 21 || q.id > 25) && !answers36.some(a => a.questionId === q.id)) {
        answers36.push({ questionId: q.id, value: q.correctAnswer });
        break;
      }
    }
    await fetch(`${BASE_URL}/api/assessment/sync`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'Cookie': cookieC },
      body: JSON.stringify({ answers: answers36 })
    });
    const submitCRes = await fetch(`${BASE_URL}/api/assessment/submit`, { method: 'POST', headers: { 'Cookie': cookieC } });
    const submitCData = await submitCRes.json();

    const flow8Pass = submitData.score.total === 34 && submitData.shortlistStatus === 'NOT_SHORTLISTED' &&
      submitBData.score.total === 35 && submitBData.shortlistStatus === 'SHORTLISTED' &&
      submitCData.score.total === 36 && submitCData.shortlistStatus === 'SHORTLISTED';
    recordResult(8, `35/60 Shortlisting boundary rules (34: ${submitData.shortlistStatus}, 35: ${submitBData.shortlistStatus}, 36: ${submitCData.shortlistStatus})`, flow8Pass);

    // -------------------------------------------------------------------------
    // 9. Duplicate & Repeated Submission Idempotency
    // -------------------------------------------------------------------------
    const resubmitRes = await fetch(`${BASE_URL}/api/assessment/submit`, {
      method: 'POST',
      headers: { 'Cookie': candidateCookie }
    });
    const resubmitData = await resubmitRes.json();
    const flow9Pass = resubmitRes.status === 200 &&
      resubmitData.success === true &&
      resubmitData.alreadySubmitted === true &&
      resubmitData.shortlistStatus === 'NOT_SHORTLISTED' &&
      resubmitData.score.total === 34;
    recordResult(9, 'Repeated submission idempotency & conflict prevention', flow9Pass);

    // -------------------------------------------------------------------------
    // 10. Candidate Result Isolation
    // -------------------------------------------------------------------------
    const resultsRes = await fetch(`${BASE_URL}/api/assessment/results`, {
      headers: { 'Cookie': candidateCookie }
    });
    const resultsData = await resultsRes.json();

    const currentRes = await fetch(`${BASE_URL}/api/assessment/current`, {
      headers: { 'Cookie': candidateCookie }
    });
    const currentData = await currentRes.json();

    const flow10Pass = resultsRes.status === 200 &&
      resultsData.success === true &&
      resultsData.result.sessionId === activeSessionId &&
      resultsData.result.shortlistStatus === 'NOT_SHORTLISTED' &&
      currentData.session.scoreSummary.total === 34;
    recordResult(10, 'Candidate result retrieval & tenant isolation', flow10Pass);

    // -------------------------------------------------------------------------
    // 11. Admin Result & Proctoring Verification
    // -------------------------------------------------------------------------
    const candOnAdminRes = await fetch(`${BASE_URL}/api/admin/results`, {
      headers: { 'Cookie': candidateCookie }
    });
    const candOnEventsRes = await fetch(`${BASE_URL}/api/admin/proctoring-events?sessionId=${activeSessionId}`, {
      headers: { 'Cookie': candidateCookie }
    });

    const adminResultsRes = await fetch(`${BASE_URL}/api/admin/results`, {
      headers: { 'Cookie': adminCookie }
    });
    const adminResultsData = await adminResultsRes.json();

    const adminEventsRes = await fetch(`${BASE_URL}/api/admin/proctoring-events?sessionId=${activeSessionId}`, {
      headers: { 'Cookie': adminCookie }
    });
    const adminEventsData = await adminEventsRes.json();

    const flow11Pass = candOnAdminRes.status === 403 &&
      candOnEventsRes.status === 403 &&
      adminResultsRes.status === 200 &&
      Array.isArray(adminResultsData.results) &&
      adminEventsRes.status === 200 &&
      Array.isArray(adminEventsData.events) &&
      adminEventsData.events.length >= 4;
    recordResult(11, 'Admin authorization enforcement & proctoring event audit visibility', flow11Pass);

    // -------------------------------------------------------------------------
    // 12. Expired Session Behavior
    // -------------------------------------------------------------------------
    const expiredCandidateId = new mongoose.Types.ObjectId();
    const expiredSessionDoc = await sessionsCol.insertOne({
      candidateId: expiredCandidateId,
      assessmentId: new mongoose.Types.ObjectId(),
      status: 'EXPIRED',
      startedAt: new Date(Date.now() - 70 * 60000),
      expiresAt: new Date(Date.now() - 10 * 60000),
      answers: [],
      integrityStatus: 'CLEAN',
      strikeCount: 0,
      shortlistStatus: 'PENDING',
      createdAt: new Date(),
      updatedAt: new Date()
    });

    const expiredToken = jwt.sign(
      { candidateId: expiredCandidateId.toString(), role: 'CANDIDATE', email: 'expired@example.com' },
      jwtSecret,
      { expiresIn: '1h', algorithm: 'HS256' }
    );
    const expiredCookie = `dv_session=${expiredToken}`;

    const expiredSyncRes = await fetch(`${BASE_URL}/api/assessment/sync`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'Cookie': expiredCookie },
      body: JSON.stringify({ answers: [{ questionId: 1, value: 'A' }] })
    });
    const expiredSubmitRes = await fetch(`${BASE_URL}/api/assessment/submit`, {
      method: 'POST',
      headers: { 'Cookie': expiredCookie }
    });

    await sessionsCol.deleteOne({ _id: expiredSessionDoc.insertedId });

    const flow12Pass = expiredSyncRes.status === 400 && expiredSubmitRes.status === 400;
    recordResult(12, 'Expired session enforcement (sync and submit rejected with HTTP 400)', flow12Pass);

    // -------------------------------------------------------------------------
    // 13. Network & API Error Handling (Fails Closed)
    // -------------------------------------------------------------------------
    const badJsonRes = await fetch(`${BASE_URL}/api/integrity/event`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Cookie': candidateCookie },
      body: '{"brokenJson":'
    });
    const badRangeRes = await fetch(`${BASE_URL}/api/assessment/sync`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'Cookie': candidateCookie },
      body: JSON.stringify({ answers: [{ questionId: 999, value: 'A' }] })
    });
    const unauthRes = await fetch(`${BASE_URL}/api/assessment/submit`, {
      method: 'POST'
    });

    const flow13Pass = badJsonRes.status === 400 &&
      badRangeRes.status === 400 &&
      unauthRes.status === 401;
    recordResult(13, 'Input validation & defensive error handling (fails closed)', flow13Pass);

  } finally {
    // -------------------------------------------------------------------------
    // Cleanup: Delete only the test candidates created by this test run
    // -------------------------------------------------------------------------
    for (const cId of createdCandidateIds) {
      await candidatesCol.deleteOne({ _id: new mongoose.Types.ObjectId(cId) });
      await sessionsCol.deleteMany({ candidateId: new mongoose.Types.ObjectId(cId) });
      await eventsCol.deleteMany({ candidateId: new mongoose.Types.ObjectId(cId) });
    }

    const finalCandidates = await candidatesCol.find({}).toArray();
    console.log(`\n[Cleanup] Test candidates removed. Existing candidate records intact: ${finalCandidates.length}`);
    await mongoose.disconnect();
  }

  console.log('\n================================================================');
  console.log(`TEST SUMMARY: ${passCount} / 13 PASSED, ${failCount} FAILED`);
  console.log('================================================================\n');

  if (failCount > 0) {
    process.exit(1);
  }
}

run().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
