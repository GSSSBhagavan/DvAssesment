const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const BASE_URL = 'http://localhost:5173';
const JWT_SECRET = process.env.JWT_SECRET || 'af8d3d6051ff842d08086b467349f2ebc571035f4f737964b392bdbaa6367806daada374d2a8f2f344020b4392707361f69ef01780033fe9f6c38cd1a9596dca';

function createToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '4h', algorithm: 'HS256' });
}

const results = [];
function recordTest(testName, passed, details = '') {
  results.push({ testName, passed, details });
  const status = passed ? '✅ PASS' : '❌ FAIL';
  console.log(`${status} - ${testName}${details ? ': ' + details : ''}`);
}

async function run() {
  console.log('================================================================');
  console.log('STARTING AUTOMATED AUTO-RECOVERY & EXACT ASSESSMENT RESUME TESTS');
  console.log('================================================================\n');

  // Connect to MongoDB
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to MongoDB database:', mongoose.connection.db.databaseName);
  const db = mongoose.connection.db;

  const timestamp = Date.now();
  const testEmailA = `resume_cand_a_${timestamp}@student.datavalley.ai`;
  const testEmailB = `resume_cand_b_${timestamp}@student.datavalley.ai`;
  const testEmailExpired = `resume_cand_exp_${timestamp}@student.datavalley.ai`;
  const testEmailSubmit = `resume_cand_sub_${timestamp}@student.datavalley.ai`;

  let candA, tokenA, sessionA;
  let candB, tokenB;

  try {
    // Register / Login Candidate A
    const loginResA = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: testEmailA,
        password: 'Password123!',
        fullName: 'Recovery Candidate A'
      })
    });
    const loginDataA = await loginResA.json();
    candA = loginDataA.user;
    tokenA = createToken({ candidateId: candA.id, role: 'CANDIDATE', email: candA.email });

    // -----------------------------------------------------------------------------------
    // Scenario 1: Start assessment and save answers to questions 1-18
    // -----------------------------------------------------------------------------------
    const startRes = await fetch(`${BASE_URL}/api/assessment/start`, {
      method: 'POST',
      headers: { 'Cookie': `dv_session=${tokenA}` }
    });
    sessionA = await startRes.json();
    const sessionIdA = sessionA.sessionId;
    const initialRemaining = sessionA.remainingSeconds;
    const initialExpiresAt = sessionA.expiresAt;
    const initialStartedAt = sessionA.startedAt;
    const questionOrderA = sessionA.questionOrder;

    recordTest(
      'Scenario 1.1: Assessment started successfully with server-authoritative timer',
      startRes.ok && sessionIdA && initialRemaining > 3500,
      `Session ID: ${sessionIdA}, Initial Remaining: ${initialRemaining}s`
    );

    // Save answers for questions 1 to 18
    const answers1to18 = [];
    for (let i = 0; i < 18; i++) {
      const qId = questionOrderA[i] || (i + 1);
      answers1to18.push({
        questionId: qId,
        value: i % 2 === 0 ? 'Option A' : 'Option B'
      });
    }

    const syncRes1 = await fetch(`${BASE_URL}/api/assessment/sync`, {
      method: 'PUT',
      headers: {
        'Cookie': `dv_session=${tokenA}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        answers: answers1to18,
        currentIndex: 17,
        currentQuestionId: questionOrderA[17] || 18,
        currentSection: 'Workplace Communication',
        visited: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17]
      })
    });
    const syncData1 = await syncRes1.json();

    recordTest(
      'Scenario 1.2: Answers 1-18 saved to MongoDB via authenticated autosave',
      syncRes1.ok && syncData1.totalAnswered === 18,
      `Total answers saved: ${syncData1.totalAnswered}`
    );

    // -----------------------------------------------------------------------------------
    // Scenario 2: Navigate to question 19 (index 18) and record stable question ID
    // -----------------------------------------------------------------------------------
    const questionId19 = questionOrderA[18] || 19;
    const syncResNav = await fetch(`${BASE_URL}/api/assessment/sync`, {
      method: 'PUT',
      headers: {
        'Cookie': `dv_session=${tokenA}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        currentIndex: 18,
        currentQuestionId: questionId19,
        currentSection: 'Workplace Communication',
        flags: [questionId19, 5],
        visited: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18]
      })
    });
    const syncNavData = await syncResNav.json();

    recordTest(
      'Scenario 2: Navigation to Question 19 and flags checkpointed in MongoDB',
      syncResNav.ok && syncNavData.currentIndex === 18 && syncNavData.currentQuestionId === questionId19,
      `Checkpoint: index=${syncNavData.currentIndex}, questionId=${syncNavData.currentQuestionId}`
    );

    // -----------------------------------------------------------------------------------
    // Scenario 3 & 4: Simulate browser refresh - restore question 19, saved answers, order, timer
    // -----------------------------------------------------------------------------------
    // Simulate elapsed time (e.g. 2 seconds)
    await new Promise(r => setTimeout(r, 2000));

    const refreshRes = await fetch(`${BASE_URL}/api/assessment/current`, {
      method: 'GET',
      headers: { 'Cookie': `dv_session=${tokenA}` }
    });
    const refreshData = await refreshRes.json();
    const restoredSession = refreshData.session;

    const answersRestoredCount = restoredSession?.answers?.length || 0;
    const orderRestoredIdentical = JSON.stringify(restoredSession?.questionOrder) === JSON.stringify(questionOrderA);
    const questionRestoredCorrect = restoredSession?.currentIndex === 18 && restoredSession?.currentQuestionId === questionId19;
    const flagsRestoredCorrect = Array.isArray(restoredSession?.flags) && restoredSession.flags.includes(questionId19);
    const timerRestoredContinuing = restoredSession?.remainingSeconds < initialRemaining;

    recordTest(
      'Scenario 3 & 4: Browser refresh restores Question 19, all 18 answers, order & timer',
      refreshRes.ok && questionRestoredCorrect && answersRestoredCount === 18 && orderRestoredIdentical && flagsRestoredCorrect && timerRestoredContinuing,
      `Restored: Q index ${restoredSession?.currentIndex} (Q ID ${restoredSession?.currentQuestionId}), Answers: ${answersRestoredCount}, Remaining: ${restoredSession?.remainingSeconds}s`
    );

    // -----------------------------------------------------------------------------------
    // Scenario 5 & 6: Simulate network interruption & recovery without creating duplicate attempt
    // -----------------------------------------------------------------------------------
    // Simulate offline gap
    await new Promise(r => setTimeout(r, 1500));

    // Client reconnects: checks session & syncs question 19 answer
    const netRecoveryRes = await fetch(`${BASE_URL}/api/assessment/sync`, {
      method: 'PUT',
      headers: {
        'Cookie': `dv_session=${tokenA}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        answers: [{ questionId: questionId19, value: 'Option C' }],
        currentIndex: 18,
        currentQuestionId: questionId19
      })
    });
    const netRecoveryData = await netRecoveryRes.json();

    // Check MongoDB session count for Candidate A
    const sessionCountA = await db.collection('assessmentsessions').countDocuments({
      candidateId: new mongoose.Types.ObjectId(candA.id)
    });

    recordTest(
      'Scenario 5 & 6: Network interruption recovered; answer saved; NO duplicate attempt created',
      netRecoveryRes.ok && netRecoveryData.totalAnswered === 19 && sessionCountA === 1,
      `Total sessions in MongoDB: ${sessionCountA}, Total answers: ${netRecoveryData.totalAnswered}`
    );

    // -----------------------------------------------------------------------------------
    // Scenario 7 & 8: Simulate laptop restart (closed browser, new login, Resume flow)
    // -----------------------------------------------------------------------------------
    // Drop token, simulate reopening browser and logging in again
    const reLoginRes = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: testEmailA,
        password: 'Password123!',
        fullName: 'Recovery Candidate A'
      })
    });
    const reLoginData = await reLoginRes.json();
    const freshTokenA = createToken({ candidateId: reLoginData.user.id, role: 'CANDIDATE', email: reLoginData.user.email });

    // Call /api/assessment/start again (this triggers the resume branch)
    const resumeRes = await fetch(`${BASE_URL}/api/assessment/start`, {
      method: 'POST',
      headers: { 'Cookie': `dv_session=${freshTokenA}` }
    });
    const resumeData = await resumeRes.json();

    const isSameSessionId = resumeData.sessionId === sessionIdA;
    const isResumedFlag = resumeData.resumed === true;
    const isRestoredIndex18 = resumeData.currentIndex === 18 && resumeData.currentQuestionId === questionId19;
    const isAnswersPreserved = resumeData.answers?.length === 19;

    recordTest(
      'Scenario 7 & 8: Laptop restart & re-login resumes EXACT existing session and Question 19',
      resumeRes.ok && isSameSessionId && isResumedFlag && isRestoredIndex18 && isAnswersPreserved,
      `Resumed: ${isResumedFlag}, SessionId match: ${isSameSessionId}, Restored Question: ${resumeData.currentQuestionId}`
    );

    // -----------------------------------------------------------------------------------
    // Scenario 9: Timer does NOT restart from 60 minutes
    // -----------------------------------------------------------------------------------
    const resumeRemaining = resumeData.remainingSeconds;
    const timerDidNotReset = resumeRemaining < initialRemaining && resumeRemaining > 0;

    recordTest(
      'Scenario 9: Assessment timer does not restart from 60 minutes (clock continued)',
      timerDidNotReset,
      `Initial: ${initialRemaining}s, Upon Resume: ${resumeRemaining}s (elapsed: ${initialRemaining - resumeRemaining}s)`
    );

    // -----------------------------------------------------------------------------------
    // Scenario 10: Authoritative deadline continues to apply while disconnected
    // -----------------------------------------------------------------------------------
    const dbSessionA = await db.collection('assessmentsessions').findOne({ _id: new mongoose.Types.ObjectId(sessionIdA) });
    const deadlineUnchanged = dbSessionA.expiresAt.toISOString() === initialExpiresAt;
    const startedAtUnchanged = dbSessionA.startedAt.toISOString() === initialStartedAt;

    recordTest(
      'Scenario 10: Authoritative deadline in MongoDB remains constant while disconnected',
      deadlineUnchanged && startedAtUnchanged,
      `DB expiresAt: ${dbSessionA.expiresAt.toISOString()}, initial: ${initialExpiresAt}`
    );

    // -----------------------------------------------------------------------------------
    // Scenario 11: Expired assessments cannot be resumed as active attempts
    // -----------------------------------------------------------------------------------
    // Register candidate with expired session
    const loginExp = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: testEmailExpired,
        password: 'Password123!',
        fullName: 'Expired Candidate'
      })
    });
    const candExp = (await loginExp.json()).user;
    const tokenExp = createToken({ candidateId: candExp.id, role: 'CANDIDATE', email: candExp.email });

    // Start session
    const startExpRes = await fetch(`${BASE_URL}/api/assessment/start`, {
      method: 'POST',
      headers: { 'Cookie': `dv_session=${tokenExp}` }
    });
    const expSessionData = await startExpRes.json();

    // Force deadline to 1 minute in the past in MongoDB
    const pastDate = new Date(Date.now() - 60000);
    await db.collection('assessmentsessions').updateOne(
      { _id: new mongoose.Types.ObjectId(expSessionData.sessionId) },
      { $set: { expiresAt: pastDate } }
    );

    // Reconnect after expiry: check /api/assessment/current
    const currExpRes = await fetch(`${BASE_URL}/api/assessment/current`, {
      method: 'GET',
      headers: { 'Cookie': `dv_session=${tokenExp}` }
    });
    const currExpData = await currExpRes.json();
    const isMarkedExpired = currExpData.session?.status === 'EXPIRED' && currExpData.session?.remainingSeconds === 0;

    // Attempt to resume via /api/assessment/start
    const resumeExpRes = await fetch(`${BASE_URL}/api/assessment/start`, {
      method: 'POST',
      headers: { 'Cookie': `dv_session=${tokenExp}` }
    });

    // Attempt to sync answer to expired session
    const syncExpRes = await fetch(`${BASE_URL}/api/assessment/sync`, {
      method: 'PUT',
      headers: {
        'Cookie': `dv_session=${tokenExp}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ answers: [{ questionId: 1, value: 'Late Option' }] })
    });

    recordTest(
      'Scenario 11: Expired assessments rejected from resuming and reject answer writes',
      isMarkedExpired && !resumeExpRes.ok && !syncExpRes.ok,
      `Current Status: ${currExpData.session?.status}, Start Status: ${resumeExpRes.status}, Sync Status: ${syncExpRes.status}`
    );

    // -----------------------------------------------------------------------------------
    // Scenario 12: Submitted assessments cannot be reopened or resumed
    // -----------------------------------------------------------------------------------
    // Register candidate for submit testing
    const loginSub = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: testEmailSubmit,
        password: 'Password123!',
        fullName: 'Submit Candidate'
      })
    });
    const candSub = (await loginSub.json()).user;
    const tokenSub = createToken({ candidateId: candSub.id, role: 'CANDIDATE', email: candSub.email });

    await fetch(`${BASE_URL}/api/assessment/start`, {
      method: 'POST',
      headers: { 'Cookie': `dv_session=${tokenSub}` }
    });

    // Submit assessment
    const submitRes = await fetch(`${BASE_URL}/api/assessment/submit`, {
      method: 'POST',
      headers: { 'Cookie': `dv_session=${tokenSub}` }
    });
    const submitData = await submitRes.json();

    // Try to restart submitted assessment
    const reStartSub = await fetch(`${BASE_URL}/api/assessment/start`, {
      method: 'POST',
      headers: { 'Cookie': `dv_session=${tokenSub}` }
    });
    const reStartSubData = await reStartSub.json();

    // Try to sync answer to submitted assessment
    const reSyncSub = await fetch(`${BASE_URL}/api/assessment/sync`, {
      method: 'PUT',
      headers: {
        'Cookie': `dv_session=${tokenSub}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ answers: [{ questionId: 1, value: 'Late Attempt' }] })
    });

    recordTest(
      'Scenario 12: Submitted assessments cannot be reopened or modified',
      submitRes.ok && reStartSubData.alreadySubmitted === true && !reSyncSub.ok,
      `Submit ok: ${submitRes.ok}, Start rejected: ${reStartSub.status}, Sync rejected: ${reSyncSub.status}`
    );

    // -----------------------------------------------------------------------------------
    // Scenario 13: Candidate B cannot resume Candidate A's session (Authorization)
    // -----------------------------------------------------------------------------------
    const loginResB = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: testEmailB,
        password: 'Password123!',
        fullName: 'Candidate B'
      })
    });
    candB = (await loginResB.json()).user;
    tokenB = createToken({ candidateId: candB.id, role: 'CANDIDATE', email: candB.email });

    const currBRes = await fetch(`${BASE_URL}/api/assessment/current`, {
      method: 'GET',
      headers: { 'Cookie': `dv_session=${tokenB}` }
    });
    const currBData = await currBRes.json();

    // Candidate B should have no session yet
    const candBSessionIsolated = currBData.session === null || currBData.session?.id !== sessionIdA;

    recordTest(
      "Scenario 13: Strict isolation: Candidate B cannot resume or see Candidate A's session",
      candBSessionIsolated,
      `Candidate B received session: ${currBData.session ? currBData.session.id : 'null'}`
    );

    // -----------------------------------------------------------------------------------
    // Scenario 14: Duplicate concurrent resume requests do NOT create duplicate sessions
    // -----------------------------------------------------------------------------------
    const concurrentResumePromises = Array.from({ length: 5 }, () =>
      fetch(`${BASE_URL}/api/assessment/start`, {
        method: 'POST',
        headers: { 'Cookie': `dv_session=${tokenA}` }
      }).then(r => r.json())
    );
    const concurrentResults = await Promise.all(concurrentResumePromises);

    const allMatchedSameSession = concurrentResults.every(r => r.sessionId === sessionIdA);
    const postSessionCountA = await db.collection('assessmentsessions').countDocuments({
      candidateId: new mongoose.Types.ObjectId(candA.id)
    });

    recordTest(
      'Scenario 14: 5 concurrent resume requests safely resolve to 1 authoritative session',
      allMatchedSameSession && postSessionCountA === 1,
      `All 5 returned Session ID ${sessionIdA}, Total sessions in MongoDB: ${postSessionCountA}`
    );

    // -----------------------------------------------------------------------------------
    // Scenario 15: Autosave and submission races do not corrupt saved answers or score
    // -----------------------------------------------------------------------------------
    // Candidate B starts an assessment
    const startBRes = await fetch(`${BASE_URL}/api/assessment/start`, {
      method: 'POST',
      headers: { 'Cookie': `dv_session=${tokenB}` }
    });
    const sessionB = await startBRes.json();

    // Fire an autosave and submission at the exact same instant
    const [raceSync, raceSubmit] = await Promise.all([
      fetch(`${BASE_URL}/api/assessment/sync`, {
        method: 'PUT',
        headers: {
          'Cookie': `dv_session=${tokenB}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          answers: [{ questionId: sessionB.questionOrder[0], value: 'Option A' }]
        })
      }),
      fetch(`${BASE_URL}/api/assessment/submit`, {
        method: 'POST',
        headers: { 'Cookie': `dv_session=${tokenB}` }
      })
    ]);

    const raceSubmitData = await raceSubmit.json();
    const finalSessionB = await db.collection('assessmentsessions').findOne({
      _id: new mongoose.Types.ObjectId(sessionB.sessionId)
    });

    recordTest(
      'Scenario 15: Autosave and submission race completes cleanly without crashing or corrupting',
      raceSubmit.ok && finalSessionB.status === 'SUBMITTED',
      `Submit status: ${raceSubmit.status}, Final session status in DB: ${finalSessionB.status}`
    );

    // -----------------------------------------------------------------------------------
    // Scenario 16: Stale local answers cannot overwrite newer server-persisted answers
    // -----------------------------------------------------------------------------------
    // Session A has question 19 with Option C saved at server time T2
    // Stale client tries to send question 19 with Option X and old timestamp T1
    const pastTimestamp = new Date(Date.now() - 300000).toISOString(); // 5 minutes ago
    await fetch(`${BASE_URL}/api/assessment/sync`, {
      method: 'PUT',
      headers: {
        'Cookie': `dv_session=${tokenA}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        answers: [{
          questionId: questionId19,
          value: 'STALE_OVERWRITE_OPTION_X',
          clientTimestamp: pastTimestamp
        }]
      })
    });

    const verifyStaleSession = await db.collection('assessmentsessions').findOne({
      _id: new mongoose.Types.ObjectId(sessionIdA)
    });
    const q19Answer = verifyStaleSession.answers.find(a => a.questionId === questionId19);
    const staleOverwritten = q19Answer?.value === 'STALE_OVERWRITE_OPTION_X';

    recordTest(
      'Scenario 16: Stale local answer with older timestamp was rejected by server',
      !staleOverwritten && q19Answer?.value === 'Option C',
      `Persisted answer: "${q19Answer?.value}" (Expected: "Option C")`
    );

    // -----------------------------------------------------------------------------------
    // Scenario 17: Network failures / technical disconnects do NOT generate cheating strikes
    // -----------------------------------------------------------------------------------
    const currCheckStrikes = await fetch(`${BASE_URL}/api/assessment/current`, {
      method: 'GET',
      headers: { 'Cookie': `dv_session=${tokenA}` }
    });
    const strikesData = await currCheckStrikes.json();
    const zeroStrikes = strikesData.session?.strikeCount === 0;

    recordTest(
      'Scenario 17: Network disconnects & reconnects did not generate cheating strikes',
      zeroStrikes,
      `Strike count: ${strikesData.session?.strikeCount}`
    );

    // -----------------------------------------------------------------------------------
    // Scenario 18: Verify existing scoring and MongoDB result persistence remain unchanged
    // -----------------------------------------------------------------------------------
    const studentResultB = await db.collection('student_results').findOne({
      sessionId: new mongoose.Types.ObjectId(sessionB.sessionId)
    });
    const studentAnswerB = await db.collection('student_answers').findOne({
      sessionId: new mongoose.Types.ObjectId(sessionB.sessionId)
    });

    recordTest(
      'Scenario 18: Existing scoring and MongoDB persistence (student_results & student_answers) verified',
      studentResultB !== null && studentAnswerB !== null,
      `student_answers ID: ${studentAnswerB?._id}, student_results totalScore: ${studentResultB?.totalScore ?? 'N/A'}`
    );

    // -----------------------------------------------------------------------------------
    // Scenario 19: Proctoring strikes persist across a legitimate resume
    // -----------------------------------------------------------------------------------
    // Add 2 strikes to Session A in DB
    await db.collection('assessmentsessions').updateOne(
      { _id: new mongoose.Types.ObjectId(sessionIdA) },
      { $set: { strikeCount: 2, integrityStatus: 'WARNING' } }
    );

    // Candidate resumes again
    const postStrikeResume = await fetch(`${BASE_URL}/api/assessment/start`, {
      method: 'POST',
      headers: { 'Cookie': `dv_session=${tokenA}` }
    });
    const postStrikeData = await postStrikeResume.json();

    recordTest(
      'Scenario 19: Proctoring strikes and integrity status persist across legitimate resume',
      postStrikeData.strikeCount === 2 && postStrikeData.integrityStatus === 'WARNING',
      `Strike Count on resume: ${postStrikeData.strikeCount}, Integrity Status: ${postStrikeData.integrityStatus}`
    );

    // -----------------------------------------------------------------------------------
    // Summary
    // -----------------------------------------------------------------------------------
    console.log('\n================================================================');
    console.log('AUTO-RECOVERY & EXACT ASSESSMENT RESUME TEST SUMMARY');
    console.log('================================================================');
    const passedCount = results.filter(r => r.passed).length;
    const totalCount = results.length;
    console.log(`Passed: ${passedCount} / ${totalCount}`);

    if (passedCount === totalCount) {
      console.log('🎉 ALL AUTO-RECOVERY & RESUME SCENARIOS PASSED PERFECTLY!\n');
    } else {
      console.error(`⚠️ ${totalCount - passedCount} TEST(S) FAILED.\n`);
    }

  } catch (err) {
    console.error('Fatal error during test run:', err);
  } finally {
    await mongoose.disconnect();
  }
}

run();
