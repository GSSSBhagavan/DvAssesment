const path = require('path');
const fs = require('fs');
const mongoose = require(path.join(process.cwd(), 'node_modules', 'mongoose'));
const jwt = require(path.join(process.cwd(), 'node_modules', 'jsonwebtoken'));

// Read env
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
    console.log(`✅ [TEST ${num}] PASS: ${title}`);
    results.push({ num, title, passed: true });
  } else {
    failCount++;
    console.error(`❌ [TEST ${num}] FAIL: ${title} - ${detail}`);
    results.push({ num, title, passed: false, detail });
  }
}

async function run() {
  console.log('\n========================================================================');
  console.log('   DATAVALLEY ASSESSMENT: END-TO-END EVALUATION CORRECTNESS SUITE    ');
  console.log('========================================================================\n');

  await mongoose.connect(mongoUri, { dbName: 'dvlabs' });
  const candidatesCol = mongoose.connection.db.collection('candidates');
  const sessionsCol = mongoose.connection.db.collection('assessmentsessions');

  const initialCount = await candidatesCol.countDocuments();
  console.log(`[Database] Connected to "${mongoose.connection.name}". Preserving ${initialCount} existing candidates.`);

  // Load safe questions and answer keys
  const safeQuestionsText = fs.readFileSync(path.join(process.cwd(), 'src/lib/safe-questions.ts'), 'utf8');
  const matchQuestions = safeQuestionsText.match(/export const assessmentData = (\[[\s\S]*?\]);\s*(\/\*\*|export)/);
  const questions = JSON.parse(matchQuestions[1]);

  const keysText = fs.readFileSync(path.join(process.cwd(), 'src/server/assessment-keys.ts'), 'utf8')
    .replace(/import\s+'server-only';/, '')
    .replace(/export\s+const\s+answerKeys\s*=\s*/, '')
    .replace(/;\s*$/, '');
  const answerKeys = JSON.parse(keysText);

  console.log(`[Setup] Loaded ${questions.length} questions and ${answerKeys.length} answer keys.`);

  // Build canonical answer sets
  // 1. UI Format: Option Letters ('A'-'E') for MCQs + Git commands
  const uiFormatCorrectAnswers = [];
  // 2. Full Text Format: Option Text for MCQs + Git commands
  const textFormatCorrectAnswers = [];

  for (let qId = 1; qId <= 60; qId++) {
    const q = questions.find(x => x.id === qId);
    const k = answerKeys.find(x => x.id === qId);

    if (qId >= 21 && qId <= 25) {
      let cmd = 'git status';
      if (qId === 21) cmd = 'git status';
      else if (qId === 22) cmd = 'git add app.py';
      else if (qId === 23) cmd = 'git commit -m "Add login feature"';
      else if (qId === 24) cmd = 'git log';
      else if (qId === 25) cmd = 'git push origin';

      // Git workspace stores JSON payload
      const payload = JSON.stringify({
        questionId: qId,
        value: cmd,
        rawValue: cmd,
        normalizedValue: cmd,
        answered: true,
        updatedAt: Date.now()
      });
      uiFormatCorrectAnswers.push({ questionId: qId, value: payload });
      textFormatCorrectAnswers.push({ questionId: qId, value: cmd });
    } else {
      // Find matching option index
      const keyVal = k.correctAnswer.trim();
      let matchIdx = q.options.findIndex(opt => opt.trim().toLowerCase() === keyVal.toLowerCase());
      if (matchIdx < 0 && /^[A-E]$/i.test(keyVal)) {
        matchIdx = keyVal.toUpperCase().charCodeAt(0) - 65;
      }
      if (matchIdx < 0) {
        throw new Error(`Could not resolve correct option for question ${qId}`);
      }
      const letter = String.fromCharCode(65 + matchIdx);
      const text = q.options[matchIdx];

      uiFormatCorrectAnswers.push({ questionId: qId, value: letter });
      textFormatCorrectAnswers.push({ questionId: qId, value: text });
    }
  }

  const createdCandidateIds = [];

  async function createCandidate(prefix) {
    const email = `${prefix}_${Date.now()}_${Math.random().toString(36).substring(7)}@test.com`;
    const res = await candidatesCol.insertOne({
      email,
      fullName: 'Evaluation Test Candidate',
      passwordHash: 'dummy_hash',
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
    // TEST 1: All 60 answers correct using UI format (Option Letters + Git JSON)
    // -------------------------------------------------------------------------
    console.log('--- TEST 1: ALL 60 ANSWERS CORRECT (UI FORMAT: OPTION LETTERS + GIT) ---');
    const cand1 = await createCandidate('eval_60_ui');
    const start1 = await (await fetch(`${BASE_URL}/api/assessment/start`, { method: 'POST', headers: { Cookie: cand1.cookie } })).json();
    
    // Sync UI-formatted answers
    const sync1 = await (await fetch(`${BASE_URL}/api/assessment/sync`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Cookie: cand1.cookie },
      body: JSON.stringify({ answers: uiFormatCorrectAnswers })
    })).json();

    const sub1 = await (await fetch(`${BASE_URL}/api/assessment/submit`, { method: 'POST', headers: { Cookie: cand1.cookie } })).json();
    const res1 = await (await fetch(`${BASE_URL}/api/assessment/results`, { headers: { Cookie: cand1.cookie } })).json();

    const t1Passed = (
      sub1.success === true &&
      res1.success === true &&
      res1.result.totalQuestions === 60 &&
      res1.result.answeredQuestions === 60 &&
      res1.result.correctAnswers === 60 &&
      res1.result.wrongAnswers === 0 &&
      res1.result.unansweredQuestions === 0 &&
      res1.result.totalScore === 60 &&
      res1.result.maximumScore === 60 &&
      res1.result.percentage === 100 &&
      res1.result.shortlistStatus === 'SHORTLISTED' &&
      res1.result.correctAnswers + res1.result.wrongAnswers + res1.result.unansweredQuestions === 60
    );
    recordResult(
      1,
      'All 60 correct answers in UI format (Option Letters + Git JSON) -> Score 60/60 (100%), SHORTLISTED',
      t1Passed,
      `correct: ${res1.result?.correctAnswers}, score: ${res1.result?.totalScore}, status: ${res1.result?.shortlistStatus}`
    );

    // -------------------------------------------------------------------------
    // TEST 1B: All 60 answers correct using Full Option Text
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 1B: ALL 60 ANSWERS CORRECT (FULL TEXT FORMAT) ---');
    const cand1B = await createCandidate('eval_60_text');
    await fetch(`${BASE_URL}/api/assessment/start`, { method: 'POST', headers: { Cookie: cand1B.cookie } });
    await fetch(`${BASE_URL}/api/assessment/sync`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Cookie: cand1B.cookie },
      body: JSON.stringify({ answers: textFormatCorrectAnswers })
    });
    const sub1B = await (await fetch(`${BASE_URL}/api/assessment/submit`, { method: 'POST', headers: { Cookie: cand1B.cookie } })).json();
    const res1B = await (await fetch(`${BASE_URL}/api/assessment/results`, { headers: { Cookie: cand1B.cookie } })).json();

    if (sub1B.score?.breakdown) {
      const failed1B = sub1B.score.breakdown.filter(b => !b.isCorrect);
      if (failed1B.length > 0) {
        console.log('Failed questions in 1B:', failed1B.map(b => b.questionId));
      }
    }

    const t1BPassed = (
      res1B.result?.correctAnswers === 60 &&
      res1B.result?.totalScore === 60 &&
      res1B.result?.shortlistStatus === 'SHORTLISTED'
    );
    recordResult(
      '1B',
      'All 60 correct answers in Text format -> Score 60/60 (100%), SHORTLISTED',
      t1BPassed,
      `correct: ${res1B.result?.correctAnswers}, score: ${res1B.result?.totalScore}`
    );

    // -------------------------------------------------------------------------
    // TEST 2: All 55 MCQs correct, 5 Git questions incorrect
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 2: 55 MCQS CORRECT + 5 GIT QUESTIONS INCORRECT ---');
    const cand2 = await createCandidate('eval_55_mcq');
    await fetch(`${BASE_URL}/api/assessment/start`, { method: 'POST', headers: { Cookie: cand2.cookie } });

    const answers55 = uiFormatCorrectAnswers.map(a => {
      if (a.questionId >= 21 && a.questionId <= 25) {
        return { questionId: a.questionId, value: 'git wrong-command' };
      }
      return a;
    });

    await fetch(`${BASE_URL}/api/assessment/sync`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Cookie: cand2.cookie },
      body: JSON.stringify({ answers: answers55 })
    });
    const sub2 = await (await fetch(`${BASE_URL}/api/assessment/submit`, { method: 'POST', headers: { Cookie: cand2.cookie } })).json();
    const res2 = await (await fetch(`${BASE_URL}/api/assessment/results`, { headers: { Cookie: cand2.cookie } })).json();

    const t2Passed = (
      res2.result?.totalQuestions === 60 &&
      res2.result?.answeredQuestions === 60 &&
      res2.result?.correctAnswers === 55 &&
      res2.result?.wrongAnswers === 5 &&
      res2.result?.unansweredQuestions === 0 &&
      res2.result?.totalScore === 55 &&
      res2.result?.shortlistStatus === 'SHORTLISTED' &&
      res2.result?.correctAnswers + res2.result?.wrongAnswers + res2.result?.unansweredQuestions === 60
    );
    recordResult(
      2,
      '55 MCQs correct + 5 Git incorrect -> Score 55/60, wrong: 5, unanswered: 0, SHORTLISTED',
      t2Passed,
      `correct: ${res2.result?.correctAnswers}, wrong: ${res2.result?.wrongAnswers}`
    );

    // -------------------------------------------------------------------------
    // TEST 3: Mixed answers and unanswered questions
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 3: MIXED ANSWERS (35 CORRECT, 10 WRONG, 15 UNANSWERED) ---');
    const cand3 = await createCandidate('eval_mixed');
    await fetch(`${BASE_URL}/api/assessment/start`, { method: 'POST', headers: { Cookie: cand3.cookie } });

    // Q1..35 correct
    // Q36..45 wrong ('Z' or invalid)
    // Q46..60 unanswered (omitted)
    const mixedAnswers = [];
    for (let i = 1; i <= 35; i++) {
      mixedAnswers.push(uiFormatCorrectAnswers.find(x => x.questionId === i));
    }
    for (let i = 36; i <= 45; i++) {
      mixedAnswers.push({ questionId: i, value: 'Z' });
    }

    await fetch(`${BASE_URL}/api/assessment/sync`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Cookie: cand3.cookie },
      body: JSON.stringify({ answers: mixedAnswers })
    });
    const sub3 = await (await fetch(`${BASE_URL}/api/assessment/submit`, { method: 'POST', headers: { Cookie: cand3.cookie } })).json();
    const res3 = await (await fetch(`${BASE_URL}/api/assessment/results`, { headers: { Cookie: cand3.cookie } })).json();

    const t3Passed = (
      res3.result?.totalQuestions === 60 &&
      res3.result?.answeredQuestions === 45 &&
      res3.result?.correctAnswers === 35 &&
      res3.result?.wrongAnswers === 10 &&
      res3.result?.unansweredQuestions === 15 &&
      res3.result?.totalScore === 35 &&
      res3.result?.shortlistStatus === 'SHORTLISTED' &&
      res3.result?.correctAnswers + res3.result?.wrongAnswers + res3.result?.unansweredQuestions === 60
    );
    recordResult(
      3,
      'Mixed: 35 correct, 10 wrong, 15 unanswered -> Sums to 60, SHORTLISTED',
      t3Passed,
      `correct: ${res3.result?.correctAnswers}, wrong: ${res3.result?.wrongAnswers}, unans: ${res3.result?.unansweredQuestions}`
    );

    // -------------------------------------------------------------------------
    // TEST 4: Randomized question order does not affect score
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 4: RANDOMIZED QUESTION ORDER WITH STABLE QUESTION IDS ---');
    const cand4 = await createCandidate('eval_random_order');
    const start4 = await (await fetch(`${BASE_URL}/api/assessment/start`, { method: 'POST', headers: { Cookie: cand4.cookie } })).json();
    const order4 = start4.questionOrder;

    // Submit answers in the shuffled order sequence
    const shuffledAnswers = order4.map(id => uiFormatCorrectAnswers.find(a => a.questionId === id));

    await fetch(`${BASE_URL}/api/assessment/sync`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Cookie: cand4.cookie },
      body: JSON.stringify({ answers: shuffledAnswers })
    });
    const sub4 = await (await fetch(`${BASE_URL}/api/assessment/submit`, { method: 'POST', headers: { Cookie: cand4.cookie } })).json();
    const res4 = await (await fetch(`${BASE_URL}/api/assessment/results`, { headers: { Cookie: cand4.cookie } })).json();

    const t4Passed = (
      res4.result?.correctAnswers === 60 &&
      res4.result?.totalScore === 60 &&
      res4.result?.shortlistStatus === 'SHORTLISTED'
    );
    recordResult(
      4,
      'Randomized delivery order evaluates identically by stable question ID -> 60/60 (100%)',
      t4Passed,
      `score: ${res4.result?.totalScore}`
    );

    // -------------------------------------------------------------------------
    // TEST 5: Persistence across sync, current-session hydration, and submit
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 5: PERSISTENCE ACROSS SYNC, REFRESH/RESUME, AND SUBMIT ---');
    const cand5 = await createCandidate('eval_persistence');
    await fetch(`${BASE_URL}/api/assessment/start`, { method: 'POST', headers: { Cookie: cand5.cookie } });

    // Sync 40 correct answers
    const answers40 = uiFormatCorrectAnswers.slice(0, 40);
    await fetch(`${BASE_URL}/api/assessment/sync`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Cookie: cand5.cookie },
      body: JSON.stringify({ answers: answers40 })
    });

    // Simulate page refresh / resume by calling /api/assessment/current
    const curr5 = await (await fetch(`${BASE_URL}/api/assessment/current`, { headers: { Cookie: cand5.cookie } })).json();
    const hydratedAnswers = curr5.session?.answers || [];

    // Final submit
    const sub5 = await (await fetch(`${BASE_URL}/api/assessment/submit`, { method: 'POST', headers: { Cookie: cand5.cookie } })).json();
    const res5 = await (await fetch(`${BASE_URL}/api/assessment/results`, { headers: { Cookie: cand5.cookie } })).json();

    const t5Passed = (
      hydratedAnswers.length === 40 &&
      res5.result?.correctAnswers === 40 &&
      res5.result?.unansweredQuestions === 20 &&
      res5.result?.shortlistStatus === 'SHORTLISTED'
    );
    recordResult(
      5,
      'Persistence: 40 saved answers reloaded via /current, submitted, verified via /results -> 40/60',
      t5Passed,
      `hydratedCount: ${hydratedAnswers.length}, finalScore: ${res5.result?.totalScore}`
    );

    // -------------------------------------------------------------------------
    // TEST 6: Security and edge cases
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 6: SECURITY & EDGE CASES ---');
    const cand6 = await createCandidate('eval_security');
    await fetch(`${BASE_URL}/api/assessment/start`, { method: 'POST', headers: { Cookie: cand6.cookie } });

    // Try sending unknown question IDs and malformed answers
    const maliciousSync = await fetch(`${BASE_URL}/api/assessment/sync`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Cookie: cand6.cookie },
      body: JSON.stringify({
        answers: [
          { questionId: 999, value: 'hack' }, // out of range ID
          { questionId: 1, value: '' }
        ]
      })
    });
    const maliciousRejected = maliciousSync.status === 400; // Zod schema rejects min(1).max(60)

    // Send forged client score to submit endpoint
    const forgeSubmit = await (await fetch(`${BASE_URL}/api/assessment/submit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cand6.cookie },
      body: JSON.stringify({
        clientScore: 60,
        scoreSummary: { totalScore: 60, correctAnswers: 60, shortlistStatus: 'SHORTLISTED' }
      })
    })).json();

    // The server must calculate authoritatively from actual answers (which is 0)
    const forgeIgnored = forgeSubmit.result?.correctAnswers === 0 && forgeSubmit.result?.shortlistStatus === 'NOT_SHORTLISTED';

    // Duplicate submit idempotency check
    const dupSubmit = await (await fetch(`${BASE_URL}/api/assessment/submit`, {
      method: 'POST',
      headers: { Cookie: cand6.cookie }
    })).json();
    const dupIdempotent = dupSubmit.alreadySubmitted === true && dupSubmit.result?.totalScore === 0;

    const t6Passed = maliciousRejected && forgeIgnored && dupIdempotent;
    recordResult(
      6,
      'Security: Out-of-bounds IDs rejected (400), forged client scores ignored, repeated submits idempotent',
      t6Passed,
      `maliciousRejected: ${maliciousRejected}, forgeIgnored: ${forgeIgnored}, dupIdempotent: ${dupIdempotent}`
    );

    // -------------------------------------------------------------------------
    // TEST 7: Concurrent update resilience (10 simultaneous sync requests)
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 7: CONCURRENT UPDATE RESILIENCE (NO 409 CONCURRENT UPDATE ERRORS) ---');
    const cand7 = await createCandidate('eval_concurrency');
    await fetch(`${BASE_URL}/api/assessment/start`, { method: 'POST', headers: { Cookie: cand7.cookie } });

    // Fire 10 simultaneous sync requests with different questions at the exact same millisecond
    const syncPromises = [];
    for (let i = 1; i <= 10; i++) {
      syncPromises.push(
        fetch(`${BASE_URL}/api/assessment/sync`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', Cookie: cand7.cookie },
          body: JSON.stringify({
            answers: [{ questionId: i, value: 'A' }]
          })
        })
      );
    }

    const syncResponses = await Promise.all(syncPromises);
    const statuses = syncResponses.map(r => r.status);
    const has409 = statuses.includes(409);
    const allSuccessful = statuses.every(s => s === 200);

    // Verify session in MongoDB merged all 10 answers
    const curr7 = await (await fetch(`${BASE_URL}/api/assessment/current`, { headers: { Cookie: cand7.cookie } })).json();
    const answerCount = curr7.session?.answers?.length || 0;

    const t7Passed = !has409 && allSuccessful && answerCount === 10;
    recordResult(
      7,
      'Concurrency: 10 simultaneous sync requests handled without 409 (Concurrent update detected) error',
      t7Passed,
      `statuses: [${statuses.join(', ')}], answersInDb: ${answerCount}`
    );

  } finally {
    // Purge test candidate accounts
    await candidatesCol.deleteMany({ _id: { $in: createdCandidateIds } });
    await sessionsCol.deleteMany({ candidateId: { $in: createdCandidateIds.map(id => id.toString()) } });
    const finalCount = await candidatesCol.countDocuments();
    console.log(`\n[Cleanup] Test candidates purged. Final candidate records in dvlabs: ${finalCount}`);
  }

  console.log('\n========================================================================');
  console.log(`TEST SUMMARY: ${passCount} / ${passCount + failCount} PASSED, ${failCount} FAILED`);
  console.log('========================================================================\n');

  if (failCount > 0) process.exit(1);
}

run().catch(err => {
  console.error('Test execution fatal error:', err);
  process.exit(1);
});
