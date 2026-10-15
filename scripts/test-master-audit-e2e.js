const path = require('path');
const fs = require('fs');
const mongoose = require(path.join(process.cwd(), 'node_modules', 'mongoose'));
const jwt = require(path.join(process.cwd(), 'node_modules', 'jsonwebtoken'));
const bcrypt = require(path.join(process.cwd(), 'node_modules', 'bcryptjs'));

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
    console.log(`✅ [AUDIT CHECK ${num}] PASS: ${title}`);
    results.push({ num, title, passed: true });
  } else {
    failCount++;
    console.error(`❌ [AUDIT CHECK ${num}] FAIL: ${title} - ${detail}`);
    results.push({ num, title, passed: false, detail });
  }
}

async function run() {
  console.log('\n========================================================================');
  console.log('   DATAVALLEY ASSESSMENT: MASTER ENGINEERING AUDIT & E2E VERIFICATION  ');
  console.log('========================================================================\n');

  await mongoose.connect(mongoUri, { dbName: 'dvlabs' });
  const candidatesCol = mongoose.connection.db.collection('candidates');
  const sessionsCol = mongoose.connection.db.collection('assessmentsessions');

  const baselineCandidateCount = await candidatesCol.countDocuments();
  console.log(`[Database] Connected to "${mongoose.connection.name}". Preserving ${baselineCandidateCount} existing candidate records.`);

  // Load safe questions and answer keys
  const safeQuestionsText = fs.readFileSync(path.join(process.cwd(), 'src/lib/safe-questions.ts'), 'utf8');
  const matchQuestions = safeQuestionsText.match(/export const assessmentData = (\[[\s\S]*?\]);\s*(\/\*\*|export)/);
  const questions = JSON.parse(matchQuestions[1]);

  const answerKeysText = fs.readFileSync(path.join(process.cwd(), 'src/server/assessment-keys.ts'), 'utf8');
  const matchKeys = answerKeysText.match(/export const answerKeys = (\[[\s\S]*?\]);/);
  const answerKeys = JSON.parse(matchKeys[1]);

  // Construct UI-format correct answers (Option Letters A-E + Git JSON payloads)
  const gitCorrectCommands = {
    21: 'git status',
    22: 'git add app.py',
    23: 'git commit -m "Add login feature"',
    24: 'git log',
    25: 'git push origin main'
  };

  const uiFormatCorrectAnswers = [];
  for (let qId = 1; qId <= 60; qId++) {
    const q = questions.find(x => x.id === qId);
    const k = answerKeys.find(x => x.id === qId);

    if (qId >= 21 && qId <= 25) {
      const cmd = gitCorrectCommands[qId];
      uiFormatCorrectAnswers.push({
        questionId: qId,
        value: JSON.stringify({
          questionId: qId,
          value: cmd,
          rawValue: cmd,
          normalizedValue: cmd,
          answered: true,
          updatedAt: Date.now()
        })
      });
    } else {
      const keyVal = k.correctAnswer.trim();
      let matchIdx = q.options.findIndex(opt => opt.trim().toLowerCase() === keyVal.toLowerCase());
      if (matchIdx < 0 && /^[A-E]$/i.test(keyVal)) {
        matchIdx = keyVal.toUpperCase().charCodeAt(0) - 65;
      }
      const letter = String.fromCharCode(65 + matchIdx);
      uiFormatCorrectAnswers.push({ questionId: qId, value: letter });
    }
  }

  const createdCandidateIds = [];

  async function createCandidate(emailPrefix, rawPassword = 'AuditPassword123!') {
    const email = `${emailPrefix}_${Date.now()}_${Math.random().toString(36).substring(7)}@test.com`;
    const passwordHash = await bcrypt.hash(rawPassword, 10);
    const res = await candidatesCol.insertOne({
      email,
      fullName: 'Audit Candidate',
      passwordHash,
      role: 'CANDIDATE',
      createdAt: new Date(),
      updatedAt: new Date()
    });
    createdCandidateIds.push(res.insertedId);

    // Login via API to test real auth endpoint
    const loginRes = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password: rawPassword })
    });
    const setCookie = loginRes.headers.get('set-cookie') || '';
    const cookieMatch = setCookie.match(/dv_session=([^;]+)/);
    const cookie = cookieMatch ? `dv_session=${cookieMatch[1]}` : '';

    return { id: res.insertedId.toString(), email, cookie, rawPassword };
  }

  try {
    // -------------------------------------------------------------------------
    // 1. TRUE END-TO-END 60/60 FLOW VIA REAL APIS & DIRECT MONGODB VERIFICATION
    // -------------------------------------------------------------------------
    console.log('--- AUDIT CHECK 1: ALL 60 CORRECT ANSWERS (REAL API -> MONGODB COMPARISON) ---');
    const cand1 = await createCandidate('audit_60_correct');
    
    // Start assessment
    const startRes = await (await fetch(`${BASE_URL}/api/assessment/start`, { method: 'POST', headers: { Cookie: cand1.cookie } })).json();
    
    // Check answer keys are NOT exposed in start payload
    const startQuestions = startRes.questions || [];
    const keysExposedInStart = startQuestions.some(q => q.correctAnswer || q.explanation || q.answerKey);

    // Sync all 60 correct answers
    const syncRes = await (await fetch(`${BASE_URL}/api/assessment/sync`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Cookie: cand1.cookie },
      body: JSON.stringify({ answers: uiFormatCorrectAnswers })
    })).json();

    // Verify current-session hydration
    const currRes = await (await fetch(`${BASE_URL}/api/assessment/current`, { headers: { Cookie: cand1.cookie } })).json();
    const currAnswers = currRes.session?.answers || [];

    // Final submit
    const submitRes = await (await fetch(`${BASE_URL}/api/assessment/submit`, { method: 'POST', headers: { Cookie: cand1.cookie } })).json();

    // Fetch result via results API
    const resultsRes = await (await fetch(`${BASE_URL}/api/assessment/results`, { headers: { Cookie: cand1.cookie } })).json();
    const apiResult = resultsRes.result;

    // Fetch session directly from MongoDB database
    const dbSession = await sessionsCol.findOne({ candidateId: new mongoose.Types.ObjectId(cand1.id) });
    const dbScore = dbSession?.scoreSummary;

    // Compare API result vs MongoDB stored document
    const matchScore = (
      apiResult.totalScore === 60 &&
      dbScore.totalScore === 60 &&
      apiResult.totalScore === dbScore.totalScore
    );
    const matchCorrect = (
      apiResult.correctAnswers === 60 &&
      dbScore.correctAnswers === 60 &&
      apiResult.correctAnswers === dbScore.correctAnswers
    );
    const matchWrong = (
      apiResult.wrongAnswers === 0 &&
      dbScore.wrongAnswers === 0 &&
      apiResult.wrongAnswers === dbScore.wrongAnswers
    );
    const matchUnanswered = (
      apiResult.unansweredQuestions === 0 &&
      dbScore.unansweredQuestions === 0 &&
      apiResult.unansweredQuestions === dbScore.unansweredQuestions
    );
    const matchPercentage = (
      apiResult.percentage === 100 &&
      dbScore.percentage === 100 &&
      apiResult.percentage === dbScore.percentage
    );
    const matchShortlist = (
      apiResult.shortlistStatus === 'SHORTLISTED' &&
      dbSession.shortlistStatus === 'SHORTLISTED' &&
      apiResult.shortlistStatus === dbSession.shortlistStatus
    );
    const matchSum = (apiResult.correctAnswers + apiResult.wrongAnswers + apiResult.unansweredQuestions === 60);

    const check1Passed = (
      startRes.success === true &&
      !keysExposedInStart &&
      syncRes.success === true &&
      currAnswers.length === 60 &&
      submitRes.success === true &&
      matchScore &&
      matchCorrect &&
      matchWrong &&
      matchUnanswered &&
      matchPercentage &&
      matchShortlist &&
      matchSum
    );

    recordResult(
      1,
      'Full API Flow -> MongoDB Direct Document Match (Score 60/60, 100%, SHORTLISTED, Invariant sum=60)',
      check1Passed,
      `API Score: ${apiResult?.totalScore}, DB Score: ${dbScore?.totalScore}, DB Status: ${dbSession?.shortlistStatus}`
    );

    // -------------------------------------------------------------------------
    // 2. IDEMPOTENT SUBMISSION & TAMPER RESISTANCE
    // -------------------------------------------------------------------------
    console.log('\n--- AUDIT CHECK 2: IDEMPOTENT SUBMISSION & TAMPER RESISTANCE ---');
    // Repeated submit call
    const repeatSubmit = await (await fetch(`${BASE_URL}/api/assessment/submit`, { method: 'POST', headers: { Cookie: cand1.cookie } })).json();
    const isIdempotent = repeatSubmit.alreadySubmitted === true && repeatSubmit.result?.totalScore === 60;

    // Refresh & resume check
    const resumeAfterSubmit = await (await fetch(`${BASE_URL}/api/assessment/current`, { headers: { Cookie: cand1.cookie } })).json();
    const resumeIntact = resumeAfterSubmit.session?.status === 'SUBMITTED' && resumeAfterSubmit.session?.answers?.length === 60;

    // Forged score payload submitted
    const candForge = await createCandidate('audit_forge');
    await fetch(`${BASE_URL}/api/assessment/start`, { method: 'POST', headers: { Cookie: candForge.cookie } });
    const forgedSubmit = await (await fetch(`${BASE_URL}/api/assessment/submit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: candForge.cookie },
      body: JSON.stringify({
        totalScore: 60,
        correctAnswers: 60,
        percentage: 100,
        shortlistStatus: 'SHORTLISTED'
      })
    })).json();
    const forgedIgnored = forgedSubmit.result?.totalScore === 0 && forgedSubmit.result?.shortlistStatus === 'NOT_SHORTLISTED';

    const check2Passed = isIdempotent && resumeIntact && forgedIgnored;
    recordResult(
      2,
      'Idempotent duplicate submission, resume preserved, forged client score ignored',
      check2Passed,
      `isIdempotent: ${isIdempotent}, resumeIntact: ${resumeIntact}, forgedIgnored: ${forgedIgnored}`
    );

    // -------------------------------------------------------------------------
    // 3. STRICT MCQ ANSWER NORMALIZATION & CONTRADICTION REJECTION
    // -------------------------------------------------------------------------
    console.log('\n--- AUDIT CHECK 3: STRICT MCQ NORMALIZATION & CONTRADICTION REJECTION ---');
    const candNorm = await createCandidate('audit_norm');
    await fetch(`${BASE_URL}/api/assessment/start`, { method: 'POST', headers: { Cookie: candNorm.cookie } });

    // Test Question 1 (Options: Text strings). Correct option is A.
    // Send ambiguous numeric index "1", contradictory "B) CorrectText", out of range "Z", empty ""
    const normAnswers = [
      { questionId: 1, value: "1" },                    // Ambiguous numeric index -> MUST BE REJECTED
      { questionId: 2, value: "B) Wrong text for B" },   // Contradictory prefix -> MUST BE REJECTED
      { questionId: 3, value: "Z" },                    // Out of range letter -> MUST BE REJECTED
      { questionId: 4, value: "  " },                   // Whitespace only -> UNANSWERED
      { questionId: 5, value: uiFormatCorrectAnswers.find(a => a.questionId === 5).value } // 1 valid correct
    ];

    await fetch(`${BASE_URL}/api/assessment/sync`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Cookie: candNorm.cookie },
      body: JSON.stringify({ answers: normAnswers })
    });

    const submitNorm = await (await fetch(`${BASE_URL}/api/assessment/submit`, { method: 'POST', headers: { Cookie: candNorm.cookie } })).json();
    const normBreakdown = submitNorm.result?.breakdown || submitNorm.score?.breakdown || [];

    const q1Res = normBreakdown.find(b => b.questionId === 1);
    const q2Res = normBreakdown.find(b => b.questionId === 2);
    const q3Res = normBreakdown.find(b => b.questionId === 3);
    const q4Res = normBreakdown.find(b => b.questionId === 4);
    const q5Res = normBreakdown.find(b => b.questionId === 5);

    const check3Passed = (
      q1Res?.isCorrect === false && // Ambiguous numeric input awarded 0
      q2Res?.isCorrect === false && // Contradictory format awarded 0
      q3Res?.isCorrect === false && // Out of range awarded 0
      q4Res?.isAnswered === false && // Empty/whitespace counted as unanswered
      q5Res?.isCorrect === true &&  // Valid option awarded 1
      submitNorm.result?.correctAnswers === 1
    );

    recordResult(
      3,
      'Strict MCQ Normalization: Ambiguous numbers, contradictory letters/texts, out-of-range rejected',
      check3Passed,
      `q1Correct: ${q1Res?.isCorrect}, q2Correct: ${q2Res?.isCorrect}, q5Correct: ${q5Res?.isCorrect}`
    );

    // -------------------------------------------------------------------------
    // 4. GIT COMMAND EVALUATION (NO SHELL EXECUTION, SEMANTIC VALIDATION)
    // -------------------------------------------------------------------------
    console.log('\n--- AUDIT CHECK 4: GIT EVALUATION (SEMANTIC NORMALIZATION & INVARIANTS) ---');
    const candGit = await createCandidate('audit_git');
    await fetch(`${BASE_URL}/api/assessment/start`, { method: 'POST', headers: { Cookie: candGit.cookie } });

    // Test all 5 Git questions with valid command variants and whitespace
    const gitVariantAnswers = [
      { questionId: 21, value: JSON.stringify({ rawValue: '  git   status  -s  ' }) }, // Q21: status with flag & extra whitespace
      { questionId: 22, value: JSON.stringify({ rawValue: 'git   add   ./app.py' }) },   // Q22: add with ./app.py
      { questionId: 23, value: JSON.stringify({ rawValue: "git commit -m 'Add login feature'" }) }, // Q23: single quotes
      { questionId: 24, value: JSON.stringify({ rawValue: 'git log --oneline' }) },      // Q24: log with flag
      { questionId: 25, value: JSON.stringify({ rawValue: 'git push -u origin main' }) } // Q25: push with -u flag
    ];

    await fetch(`${BASE_URL}/api/assessment/sync`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Cookie: candGit.cookie },
      body: JSON.stringify({ answers: gitVariantAnswers })
    });

    const submitGit = await (await fetch(`${BASE_URL}/api/assessment/submit`, { method: 'POST', headers: { Cookie: candGit.cookie } })).json();
    const gitBreakdown = (submitGit.result?.breakdown || submitGit.score?.breakdown || []).filter(b => b.questionId >= 21 && b.questionId <= 25);
    const allGitPassed = gitBreakdown.length === 5 && gitBreakdown.every(b => b.isCorrect === true);

    recordResult(
      4,
      'Git Command Evaluation: Semantic normalization, quotes, flags, extra spaces accepted without shell',
      allGitPassed,
      `gitScores: [${gitBreakdown.map(b => b.isCorrect).join(', ')}]`
    );

    // -------------------------------------------------------------------------
    // 5. SHORTLISTING THRESHOLDS (34 -> NOT_SHORTLISTED, 35 -> SHORTLISTED)
    // -------------------------------------------------------------------------
    console.log('\n--- AUDIT CHECK 5: SHORTLISTING THRESHOLDS (34 vs 35 CORRECT) ---');
    // Test candidate with 34 correct answers
    const cand34 = await createCandidate('audit_34');
    await fetch(`${BASE_URL}/api/assessment/start`, { method: 'POST', headers: { Cookie: cand34.cookie } });
    await fetch(`${BASE_URL}/api/assessment/sync`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Cookie: cand34.cookie },
      body: JSON.stringify({ answers: uiFormatCorrectAnswers.slice(0, 34) })
    });
    const submit34 = await (await fetch(`${BASE_URL}/api/assessment/submit`, { method: 'POST', headers: { Cookie: cand34.cookie } })).json();

    // Test candidate with 35 correct answers
    const cand35 = await createCandidate('audit_35');
    await fetch(`${BASE_URL}/api/assessment/start`, { method: 'POST', headers: { Cookie: cand35.cookie } });
    await fetch(`${BASE_URL}/api/assessment/sync`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Cookie: cand35.cookie },
      body: JSON.stringify({ answers: uiFormatCorrectAnswers.slice(0, 35) })
    });
    const submit35 = await (await fetch(`${BASE_URL}/api/assessment/submit`, { method: 'POST', headers: { Cookie: cand35.cookie } })).json();

    const t34Ok = submit34.result?.correctAnswers === 34 && submit34.result?.shortlistStatus === 'NOT_SHORTLISTED';
    const t35Ok = submit35.result?.correctAnswers === 35 && submit35.result?.shortlistStatus === 'SHORTLISTED';

    const check5Passed = t34Ok && t35Ok;
    recordResult(
      5,
      'Threshold Invariants: 34 correct -> NOT_SHORTLISTED, 35 correct -> SHORTLISTED',
      check5Passed,
      `34Status: ${submit34.result?.shortlistStatus}, 35Status: ${submit35.result?.shortlistStatus}`
    );

    // -------------------------------------------------------------------------
    // 6. CANDIDATE ISOLATION & DATA CONFIDENTIALITY
    // -------------------------------------------------------------------------
    console.log('\n--- AUDIT CHECK 6: CANDIDATE ISOLATION & ANSWER KEY CONFIDENTIALITY ---');
    // Candidate A cannot view Candidate B's results
    // Results endpoint uses JWT session cookie, not candidateId in query param
    const candA = await createCandidate('audit_iso_a');
    await fetch(`${BASE_URL}/api/assessment/start`, { method: 'POST', headers: { Cookie: candA.cookie } });
    await fetch(`${BASE_URL}/api/assessment/sync`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Cookie: candA.cookie },
      body: JSON.stringify({ answers: uiFormatCorrectAnswers.slice(0, 5) })
    });
    await fetch(`${BASE_URL}/api/assessment/submit`, { method: 'POST', headers: { Cookie: candA.cookie } });

    const candB = await createCandidate('audit_iso_b');
    // Cand B has not submitted an assessment yet -> /api/assessment/results must return 404
    const candBResultsRes = await fetch(`${BASE_URL}/api/assessment/results`, { headers: { Cookie: candB.cookie } });
    const isolationOk = candBResultsRes.status === 404;

    // Verify answer keys are NEVER present in results endpoint
    const candAResults = await (await fetch(`${BASE_URL}/api/assessment/results`, { headers: { Cookie: candA.cookie } })).json();
    const resultString = JSON.stringify(candAResults);
    const keysConfidential = !resultString.includes('"correctAnswer"') && !resultString.includes('"explanation"');

    const check6Passed = isolationOk && keysConfidential;
    recordResult(
      6,
      'Candidate Isolation & Answer Key Confidentiality (Candidate B cannot see A, keys hidden)',
      check6Passed,
      `isolationStatus: ${candBResultsRes.status}, keysConfidential: ${keysConfidential}`
    );

    // -------------------------------------------------------------------------
    // 7. PER-CANDIDATE SECTION-WISE SHUFFLING INTEGRITY
    // -------------------------------------------------------------------------
    console.log('\n--- AUDIT CHECK 7: PER-CANDIDATE SECTION SHUFFLE & STABLE ID MAPPING ---');
    const candShuffle1 = await createCandidate('audit_shuf_1');
    const startShuf1 = await (await fetch(`${BASE_URL}/api/assessment/start`, { method: 'POST', headers: { Cookie: candShuffle1.cookie } })).json();
    const qOrder1 = startShuf1.questionOrder || [];

    // Verify every question 1-60 appears exactly once
    const uniqueQuestions = new Set(qOrder1);
    const all60Present = qOrder1.length === 60 && uniqueQuestions.size === 60;
    const boundsOk = qOrder1.every(id => id >= 1 && id <= 60);

    // Verify Section membership is strictly preserved
    // Section 1: IDs 1-10
    // Section 2: IDs 11-20
    // Section 3: IDs 21-30
    // Section 4: IDs 31-50
    // Section 5: IDs 51-60
    const sec1 = qOrder1.slice(0, 10);
    const sec2 = qOrder1.slice(10, 20);
    const sec3 = qOrder1.slice(20, 30);
    const sec4 = qOrder1.slice(30, 50);
    const sec5 = qOrder1.slice(50, 60);

    const sec1Valid = sec1.every(id => id >= 1 && id <= 10);
    const sec2Valid = sec2.every(id => id >= 11 && id <= 20);
    const sec3Valid = sec3.every(id => id >= 21 && id <= 30);
    const sec4Valid = sec4.every(id => id >= 31 && id <= 50);
    const sec5Valid = sec5.every(id => id >= 51 && id <= 60);

    const sectionsIntact = sec1Valid && sec2Valid && sec3Valid && sec4Valid && sec5Valid;

    // Verify refresh/resume does not reshuffle
    const resumeShuf1 = await (await fetch(`${BASE_URL}/api/assessment/current`, { headers: { Cookie: candShuffle1.cookie } })).json();
    const resumedOrder = resumeShuf1.session?.questionOrder || [];
    const orderPreservedOnResume = JSON.stringify(qOrder1) === JSON.stringify(resumedOrder);

    const check7Passed = all60Present && boundsOk && sectionsIntact && orderPreservedOnResume;
    recordResult(
      7,
      'Randomization: Server-side shuffle, section boundary integrity, order preserved on resume',
      check7Passed,
      `all60Present: ${all60Present}, sectionsIntact: ${sectionsIntact}, resumeMatched: ${orderPreservedOnResume}`
    );

  } finally {
    // Purge test candidate accounts created by this test script ONLY
    await candidatesCol.deleteMany({ _id: { $in: createdCandidateIds } });
    await sessionsCol.deleteMany({ candidateId: { $in: createdCandidateIds } });
    const finalCount = await candidatesCol.countDocuments();
    console.log(`\n[Database Cleanup] Purged ${createdCandidateIds.length} audit test accounts.`);
    console.log(`[Database Safety] Candidate count in dvlabs: ${finalCount} (Baseline preserved: ${finalCount === baselineCandidateCount})`);
  }

  console.log('\n========================================================================');
  console.log(`MASTER AUDIT SUMMARY: ${passCount} / ${passCount + failCount} PASSED, ${failCount} FAILED`);
  console.log('========================================================================\n');

  if (failCount > 0) process.exit(1);
}

run().catch(err => {
  console.error('Audit execution fatal error:', err);
  process.exit(1);
});
