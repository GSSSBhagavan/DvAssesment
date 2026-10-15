const path = require('path');
const fs = require('fs');
const mongoose = require(path.join(process.cwd(), 'node_modules', 'mongoose'));
const jwt = require(path.join(process.cwd(), 'node_modules', 'jsonwebtoken'));
const bcrypt = require(path.join(process.cwd(), 'node_modules', 'bcryptjs'));

// Read env safely
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
    console.log(`✅ [RACE TEST ${num}] PASS: ${title}`);
    results.push({ num, title, passed: true });
  } else {
    failCount++;
    console.error(`❌ [RACE TEST ${num}] FAIL: ${title} - ${detail}`);
    results.push({ num, title, passed: false, detail });
  }
}

async function run() {
  console.log('\n========================================================================');
  console.log('   DATAVALLEY ASSESSMENT: AUTOSAVE & SUBMIT CONCURRENCY SUITE           ');
  console.log('========================================================================\n');

  await mongoose.connect(mongoUri, { dbName: 'dvlabs' });
  const candidatesCol = mongoose.connection.db.collection('candidates');
  const sessionsCol = mongoose.connection.db.collection('assessmentsessions');

  const baselineCount = await candidatesCol.countDocuments();
  console.log(`[Database] Preserving ${baselineCount} existing candidate records.`);

  const createdCandidateIds = [];

  async function createTestCandidate(prefix) {
    const email = `${prefix}_${Date.now()}_${Math.random().toString(36).substring(7)}@test.com`;
    const passwordHash = await bcrypt.hash('TestPass123!', 10);
    const res = await candidatesCol.insertOne({
      email,
      fullName: 'Concurrency Test Candidate',
      passwordHash,
      role: 'CANDIDATE',
      createdAt: new Date(),
      updatedAt: new Date()
    });
    createdCandidateIds.push(res.insertedId);

    const token = jwt.sign(
      { candidateId: res.insertedId.toString(), email, role: 'CANDIDATE' },
      jwtSecret,
      { expiresIn: '2h', algorithm: 'HS256' }
    );
    return { id: res.insertedId.toString(), email, cookie: `dv_session=${token}` };
  }

  try {
    // -------------------------------------------------------------------------
    // TEST 1: Simultaneous concurrent syncs updating DIFFERENT question IDs
    // -------------------------------------------------------------------------
    console.log('--- TEST 1: 10 CONCURRENT SYNCS (DIFFERENT QUESTIONS) ---');
    const cand1 = await createTestCandidate('race_diff_q');
    await fetch(`${BASE_URL}/api/assessment/start`, { method: 'POST', headers: { Cookie: cand1.cookie } });

    const diffPromises = [];
    for (let i = 1; i <= 10; i++) {
      diffPromises.push(
        fetch(`${BASE_URL}/api/assessment/sync`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', Cookie: cand1.cookie },
          body: JSON.stringify({ answers: [{ questionId: i, value: 'A' }] })
        })
      );
    }
    const diffResponses = await Promise.all(diffPromises);
    const diffStatuses = diffResponses.map(r => r.status);
    const diffAll200 = diffStatuses.every(s => s === 200);

    const curr1 = await (await fetch(`${BASE_URL}/api/assessment/current`, { headers: { Cookie: cand1.cookie } })).json();
    const currAnswers1 = curr1.session?.answers || [];
    const t1Passed = diffAll200 && currAnswers1.length === 10;

    recordResult(
      1,
      'Concurrent syncs on different questions merge completely without loss (10/10 present)',
      t1Passed,
      `statuses: [${diffStatuses.join(', ')}], answersCount: ${currAnswers1.length}`
    );

    // -------------------------------------------------------------------------
    // TEST 2: Rapid concurrent syncs on the SAME question ID
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 2: 5 CONCURRENT SYNCS ON SAME QUESTION ID ---');
    const cand2 = await createTestCandidate('race_same_q');
    await fetch(`${BASE_URL}/api/assessment/start`, { method: 'POST', headers: { Cookie: cand2.cookie } });

    const samePromises = [];
    const values = ['A', 'B', 'C', 'D', 'A'];
    for (const val of values) {
      samePromises.push(
        fetch(`${BASE_URL}/api/assessment/sync`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', Cookie: cand2.cookie },
          body: JSON.stringify({ answers: [{ questionId: 5, value: val }] })
        })
      );
    }
    const sameResponses = await Promise.all(samePromises);
    const sameStatuses = sameResponses.map(r => r.status);
    const sameAll200 = sameStatuses.every(s => s === 200);

    const curr2 = await (await fetch(`${BASE_URL}/api/assessment/current`, { headers: { Cookie: cand2.cookie } })).json();
    const q5Answer = (curr2.session?.answers || []).find(a => a.questionId === 5);
    const t2Passed = sameAll200 && q5Answer && typeof q5Answer.value === 'string';

    recordResult(
      2,
      'Concurrent syncs on same question resolve deterministically without 409 crash',
      t2Passed,
      `statuses: [${sameStatuses.join(', ')}], finalValue: ${q5Answer?.value}`
    );

    // -------------------------------------------------------------------------
    // TEST 3: Autosave RACING simultaneously with final Submission
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 3: AUTOSAVE RACING AGAINST FINAL SUBMIT ---');
    const cand3 = await createTestCandidate('race_autosave_submit');
    await fetch(`${BASE_URL}/api/assessment/start`, { method: 'POST', headers: { Cookie: cand3.cookie } });

    // Initial sync of 5 answers
    await fetch(`${BASE_URL}/api/assessment/sync`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Cookie: cand3.cookie },
      body: JSON.stringify({
        answers: [
          { questionId: 1, value: 'A' },
          { questionId: 2, value: 'B' },
          { questionId: 3, value: 'A' }
        ]
      })
    });

    // Fire a late autosave AND a final submit at the exact same millisecond
    const racePromises = [
      fetch(`${BASE_URL}/api/assessment/sync`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Cookie: cand3.cookie },
        body: JSON.stringify({ answers: [{ questionId: 4, value: 'C' }] })
      }),
      fetch(`${BASE_URL}/api/assessment/submit`, {
        method: 'POST',
        headers: { Cookie: cand3.cookie }
      })
    ];

    const [raceSyncRes, raceSubmitRes] = await Promise.all(racePromises);
    const raceSubmitJson = await raceSubmitRes.json();

    // Verify session in DB has valid SUBMITTED status and stable score
    const dbSession3 = await sessionsCol.findOne({ candidateId: new mongoose.Types.ObjectId(cand3.id) });
    const isSubmitted = dbSession3?.status === 'SUBMITTED';
    const scoreValid = typeof dbSession3?.scoreSummary?.totalScore === 'number';

    const t3Passed = raceSubmitRes.status === 200 && isSubmitted && scoreValid;
    recordResult(
      3,
      'Autosave vs Submit race: Database transitions to SUBMITTED with consistent score',
      t3Passed,
      `syncStatus: ${raceSyncRes.status}, submitStatus: ${raceSubmitRes.status}, dbStatus: ${dbSession3?.status}`
    );

    // -------------------------------------------------------------------------
    // TEST 4: Late sync AFTER submission MUST BE STRICTLY REJECTED
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 4: LATE SYNC AFTER SUBMISSION (REJECTED) ---');
    const scoreBeforeLateSync = dbSession3?.scoreSummary?.totalScore;

    const lateSyncRes = await fetch(`${BASE_URL}/api/assessment/sync`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Cookie: cand3.cookie },
      body: JSON.stringify({ answers: [{ questionId: 1, value: 'D' }, { questionId: 20, value: 'A' }] })
    });

    const lateSyncRejected = lateSyncRes.status === 400;

    // Check DB document was NOT modified
    const dbSession3After = await sessionsCol.findOne({ candidateId: new mongoose.Types.ObjectId(cand3.id) });
    const scoreUnchanged = dbSession3After?.scoreSummary?.totalScore === scoreBeforeLateSync;
    const statusStillSubmitted = dbSession3After?.status === 'SUBMITTED';

    const t4Passed = lateSyncRejected && scoreUnchanged && statusStillSubmitted;
    recordResult(
      4,
      'Late sync after submission is rejected with 400; final score & status unchanged',
      t4Passed,
      `lateSyncStatus: ${lateSyncRes.status}, scoreUnchanged: ${scoreUnchanged}, status: ${dbSession3After?.status}`
    );

    // -------------------------------------------------------------------------
    // TEST 5: Simultaneous duplicate submissions (IDEMPOTENCY)
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 5: 5 SIMULTANEOUS DUPLICATE SUBMISSIONS ---');
    const cand5 = await createTestCandidate('race_dup_submit');
    await fetch(`${BASE_URL}/api/assessment/start`, { method: 'POST', headers: { Cookie: cand5.cookie } });
    await fetch(`${BASE_URL}/api/assessment/sync`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Cookie: cand5.cookie },
      body: JSON.stringify({ answers: [{ questionId: 1, value: 'A' }] })
    });

    // Fire 5 simultaneous submit requests
    const dupSubmitPromises = [];
    for (let i = 0; i < 5; i++) {
      dupSubmitPromises.push(
        fetch(`${BASE_URL}/api/assessment/submit`, { method: 'POST', headers: { Cookie: cand5.cookie } })
      );
    }

    const dupResponses = await Promise.all(dupSubmitPromises);
    const dupStatuses = dupResponses.map(r => r.status);
    const dupAll200 = dupStatuses.every(s => s === 200);

    const dupJsons = await Promise.all(dupResponses.map(r => r.json()));
    const scores = dupJsons.map(j => j.result?.totalScore);
    const allScoresMatch = scores.every(s => s === scores[0]);

    // Check MongoDB session document count for this candidate: exactly 1 session
    const cand5SessionCount = await sessionsCol.countDocuments({ candidateId: new mongoose.Types.ObjectId(cand5.id) });

    const t5Passed = dupAll200 && allScoresMatch && cand5SessionCount === 1;
    recordResult(
      5,
      '5 simultaneous submit requests are idempotent: 200 OK, identical score, 1 session document',
      t5Passed,
      `statuses: [${dupStatuses.join(', ')}], scores: [${scores.join(', ')}], sessionCount: ${cand5SessionCount}`
    );

    // -------------------------------------------------------------------------
    // TEST 6: CSRF / Cross-Origin state-changing request rejection
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 6: CSRF CROSS-ORIGIN REJECTION ---');
    const csrfCrossRes = await fetch(`${BASE_URL}/api/assessment/sync`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Cookie: cand1.cookie,
        'Origin': 'https://attacker-domain.evil.com'
      },
      body: JSON.stringify({ answers: [{ questionId: 1, value: 'A' }] })
    });

    const csrfBlocked = csrfCrossRes.status === 403;
    recordResult(
      6,
      'CSRF defense-in-depth: Cross-origin state-changing mutation is rejected with 403 Forbidden',
      csrfBlocked,
      `crossOriginStatus: ${csrfCrossRes.status}`
    );

  } finally {
    // Purge only test candidates created by this test script
    await candidatesCol.deleteMany({ _id: { $in: createdCandidateIds } });
    await sessionsCol.deleteMany({ candidateId: { $in: createdCandidateIds.map(id => id.toString()) } });
    await sessionsCol.deleteMany({ candidateId: { $in: createdCandidateIds } });

    const finalCount = await candidatesCol.countDocuments();
    console.log(`\n[Database Cleanup] Purged ${createdCandidateIds.length} test accounts.`);
    console.log(`[Database Safety] Candidate count in dvlabs: ${finalCount} (Baseline preserved: ${finalCount === baselineCount})`);
    await mongoose.disconnect();
  }

  console.log('\n========================================================================');
  console.log(`CONCURRENCY SUITE SUMMARY: ${passCount} / ${passCount + failCount} PASSED, ${failCount} FAILED`);
  console.log('========================================================================\n');

  process.exit(failCount > 0 ? 1 : 0);
}

run().catch(err => {
  console.error('Concurrency test suite fatal error:', err);
  process.exit(1);
});
