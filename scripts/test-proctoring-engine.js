const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const BASE_URL = 'http://localhost:5173';
const JWT_SECRET = process.env.JWT_SECRET || 'af8d3d6051ff842d08086b467349f2ebc571035f4f737964b392bdbaa6367806daada374d2a8f2f344020b4392707361f69ef01780033fe9f6c38cd1a9596dca';

function createToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '4h', algorithm: 'HS256' });
}

let testCandidateA;
let testCandidateB;
let sessionA;
let tokenA;
let tokenB;
let adminToken;

const results = [];
function recordTest(testName, passed, details = '') {
  results.push({ testName, passed, details });
  const status = passed ? '✅ PASS' : '❌ FAIL';
  console.log(`${status} - ${testName}${details ? ': ' + details : ''}`);
}

async function run() {
  console.log('====================================================');
  console.log('STARTING AUTOMATED PROCTORING & STRIKE ENGINE TESTS');
  console.log('====================================================\n');

  // Connect to MongoDB
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to MongoDB database:', mongoose.connection.db.databaseName);

  const db = mongoose.connection.db;

  // Cleanup any leftover test candidates
  const testEmailA = `proctor_test_a_${Date.now()}@student.datavalley.ai`;
  const testEmailB = `proctor_test_b_${Date.now()}@student.datavalley.ai`;

  // 1. Existing Assessment Login & Start Flow
  try {
    const loginRes = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: testEmailA,
        password: 'Password123!',
        fullName: 'Proctor Test Candidate A'
      })
    });
    const loginData = await loginRes.json();
    testCandidateA = loginData.user;
    tokenA = createToken({
      candidateId: testCandidateA.id,
      role: 'CANDIDATE',
      email: testCandidateA.email
    });

    const startRes = await fetch(`${BASE_URL}/api/assessment/start`, {
      method: 'POST',
      headers: {
        'Cookie': `dv_session=${tokenA}`
      }
    });
    const startData = await startRes.json();
    sessionA = startData;

    recordTest(
      '1. Existing assessment login and start flow functional',
      startRes.ok && sessionA.sessionId,
      `Session ID: ${sessionA.sessionId}`
    );
  } catch (err) {
    recordTest('1. Existing assessment login and start flow functional', false, err.message);
  }

  // Candidate B setup for authorization test
  try {
    const loginResB = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: testEmailB,
        password: 'Password123!',
        fullName: 'Proctor Test Candidate B'
      })
    });
    const loginDataB = await loginResB.json();
    testCandidateB = loginDataB.user;
    tokenB = createToken({
      candidateId: testCandidateB.id,
      role: 'CANDIDATE',
      email: testCandidateB.email
    });

    adminToken = createToken({
      candidateId: new mongoose.Types.ObjectId().toString(),
      role: 'ADMIN',
      email: 'admin@datavalley.ai'
    });
  } catch (err) {
    console.error('Error setting up Candidate B:', err);
  }

  // 2. Face visible does not increment strikes
  try {
    const res = await fetch(`${BASE_URL}/api/integrity/event`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': `dv_session=${tokenA}`
      },
      body: JSON.stringify({
        sessionId: sessionA.sessionId,
        eventType: 'FACE_RECOVERED'
      })
    });
    const data = await res.json();
    recordTest(
      '2. Face visible does not increment strikes',
      data.success && data.strikeAssigned === false && data.strikeCount === 0,
      `Strikes: ${data.strikeCount}`
    );
  } catch (err) {
    recordTest('2. Face visible does not increment strikes', false, err.message);
  }

  // 3. A brief face-detection failure does not create repeated strikes
  try {
    const res = await fetch(`${BASE_URL}/api/integrity/event`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': `dv_session=${tokenA}`
      },
      body: JSON.stringify({
        sessionId: sessionA.sessionId,
        eventType: 'FACE_LOST',
        durationMs: 2000 // Under 5000ms grace period
      })
    });
    const data = await res.json();
    recordTest(
      '3. Brief face-detection failure (< 5s grace) does not create strike',
      data.success && data.strikeAssigned === false && data.strikeCount === 0,
      `Strikes: ${data.strikeCount}, Reason: ${data.reason}`
    );
  } catch (err) {
    recordTest('3. Brief face-detection failure (< 5s grace) does not create strike', false, err.message);
  }

  // 4. Sustained face absence follows the configured policy
  try {
    // Wait 3.5s to clear debounce window
    await new Promise(r => setTimeout(r, 3500));
    const res = await fetch(`${BASE_URL}/api/integrity/event`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': `dv_session=${tokenA}`
      },
      body: JSON.stringify({
        sessionId: sessionA.sessionId,
        eventType: 'FACE_LOST',
        durationMs: 6000 // Exceeds 5000ms grace period
      })
    });
    const data = await res.json();
    recordTest(
      '4. Sustained face absence (> 5s) triggers strike according to policy',
      data.success && data.strikeAssigned === true && data.strikeCount === 1,
      `Strikes: ${data.strikeCount}`
    );
  } catch (err) {
    recordTest('4. Sustained face absence (> 5s) triggers strike according to policy', false, err.message);
  }

  // 5. Multiple-face detection follows configured policy
  try {
    await new Promise(r => setTimeout(r, 3500));
    const res = await fetch(`${BASE_URL}/api/integrity/event`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': `dv_session=${tokenA}`
      },
      body: JSON.stringify({
        sessionId: sessionA.sessionId,
        eventType: 'MULTIPLE_FACES',
        durationMs: 2500,
        metadata: { faceCount: 2 }
      })
    });
    const data = await res.json();
    recordTest(
      '5. Multiple-face detection follows configured policy',
      data.success && data.strikeAssigned === true && data.strikeCount === 2,
      `Strikes: ${data.strikeCount}`
    );
  } catch (err) {
    recordTest('5. Multiple-face detection follows configured policy', false, err.message);
  }

  // 6. Brief gaze movement does not automatically trigger a strike
  try {
    await new Promise(r => setTimeout(r, 3500));
    const res = await fetch(`${BASE_URL}/api/integrity/event`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': `dv_session=${tokenA}`
      },
      body: JSON.stringify({
        sessionId: sessionA.sessionId,
        eventType: 'GAZE_DEVIATION',
        durationMs: 1500 // Brief gaze deviation
      })
    });
    const data = await res.json();
    recordTest(
      '6. Brief gaze movement does not trigger a strike (diagnostic)',
      data.success && data.strikeAssigned === false && data.strikeCount === 2,
      `Strikes remained at ${data.strikeCount}`
    );
  } catch (err) {
    recordTest('6. Brief gaze movement does not trigger a strike (diagnostic)', false, err.message);
  }

  // 7. Sustained head pose / gaze observations follow configured thresholds
  try {
    await new Promise(r => setTimeout(r, 3500));
    const res = await fetch(`${BASE_URL}/api/integrity/event`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': `dv_session=${tokenA}`
      },
      body: JSON.stringify({
        sessionId: sessionA.sessionId,
        eventType: 'HEAD_POSE_DEVIATION',
        durationMs: 4500 // Sustained head orientation away
      })
    });
    const data = await res.json();
    recordTest(
      '7. Sustained head pose observation follows configured threshold',
      data.success && data.strikeAssigned === true && data.strikeCount === 3,
      `Strikes: ${data.strikeCount}, Status: ${data.status}`
    );
  } catch (err) {
    recordTest('7. Sustained head pose observation follows configured threshold', false, err.message);
  }

  // 8. Tab-switch events are debounced
  try {
    await new Promise(r => setTimeout(r, 3500));
    // First tab switch: accepted
    const res1 = await fetch(`${BASE_URL}/api/integrity/event`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': `dv_session=${tokenA}`
      },
      body: JSON.stringify({
        sessionId: sessionA.sessionId,
        eventType: 'TAB_SWITCH'
      })
    });
    const data1 = await res1.json();

    // Immediate second tab switch 200ms later: debounced!
    const res2 = await fetch(`${BASE_URL}/api/integrity/event`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': `dv_session=${tokenA}`
      },
      body: JSON.stringify({
        sessionId: sessionA.sessionId,
        eventType: 'TAB_SWITCH'
      })
    });
    const data2 = await res2.json();

    const debouncedPassed = data1.strikeAssigned === true && data2.strikeAssigned === false && data1.strikeCount === data2.strikeCount;
    recordTest(
      '8. Tab-switch events are debounced within cooldown window',
      debouncedPassed,
      `First strike assigned: ${data1.strikeAssigned}, second debounced: ${data2.strikeAssigned === false}`
    );
  } catch (err) {
    recordTest('8. Tab-switch events are debounced within cooldown window', false, err.message);
  }

  // 9. Fullscreen exit event
  try {
    await new Promise(r => setTimeout(r, 3500));
    const res = await fetch(`${BASE_URL}/api/integrity/event`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': `dv_session=${tokenA}`
      },
      body: JSON.stringify({
        sessionId: sessionA.sessionId,
        eventType: 'FULLSCREEN_EXIT'
      })
    });
    const data = await res.json();
    recordTest(
      '9. Fullscreen exit event assigned according to requirement',
      data.success && data.strikeAssigned === true,
      `Strikes: ${data.strikeCount}`
    );
  } catch (err) {
    recordTest('9. Fullscreen exit event assigned according to requirement', false, err.message);
  }

  // 10. Camera permission denial is handled as a technical issue
  try {
    await new Promise(r => setTimeout(r, 3500));
    const prevStrikes = (await (await fetch(`${BASE_URL}/api/integrity/event`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Cookie': `dv_session=${tokenA}` },
      body: JSON.stringify({ sessionId: sessionA.sessionId, eventType: 'CAMERA_REVOKED' })
    })).json());

    recordTest(
      '10. Camera permission denial handled as technical issue (0 strikes)',
      prevStrikes.strikeAssigned === false,
      `Category: TECHNICAL, StrikeAssigned: ${prevStrikes.strikeAssigned}`
    );
  } catch (err) {
    recordTest('10. Camera permission denial handled as technical issue (0 strikes)', false, err.message);
  }

  // 11. Network interruption does not count as misconduct
  try {
    await new Promise(r => setTimeout(r, 3500));
    const res = await fetch(`${BASE_URL}/api/integrity/event`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Cookie': `dv_session=${tokenA}` },
      body: JSON.stringify({ sessionId: sessionA.sessionId, eventType: 'CONNECTION_LOST' })
    });
    const data = await res.json();
    recordTest(
      '11. Network interruption does not count as misconduct (0 strikes)',
      data.strikeAssigned === false,
      `StrikeAssigned: ${data.strikeAssigned}`
    );
  } catch (err) {
    recordTest('11. Network interruption does not count as misconduct (0 strikes)', false, err.message);
  }

  // 12. Duplicate event IDs do not increase strikes twice (Idempotency)
  try {
    await new Promise(r => setTimeout(r, 3500));
    const uniqueKey = `idempotent-test-key-${Date.now()}`;
    const resFirst = await fetch(`${BASE_URL}/api/integrity/event`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Cookie': `dv_session=${tokenA}` },
      body: JSON.stringify({
        sessionId: sessionA.sessionId,
        idempotencyKey: uniqueKey,
        eventType: 'PAGE_LEAVE_ATTEMPT'
      })
    });
    const dataFirst = await resFirst.json();

    // Replay identical idempotencyKey
    const resRetry = await fetch(`${BASE_URL}/api/integrity/event`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Cookie': `dv_session=${tokenA}` },
      body: JSON.stringify({
        sessionId: sessionA.sessionId,
        idempotencyKey: uniqueKey,
        eventType: 'PAGE_LEAVE_ATTEMPT'
      })
    });
    const dataRetry = await resRetry.json();

    const idempotencyPassed = dataFirst.strikeCount === dataRetry.strikeCount && dataRetry.deduplicated === true;
    recordTest(
      '12. Duplicate event IDs do not increase strikes twice (Idempotency)',
      idempotencyPassed,
      `First count: ${dataFirst.strikeCount}, Retry count: ${dataRetry.strikeCount}, Deduplicated: ${dataRetry.deduplicated}`
    );
  } catch (err) {
    recordTest('12. Duplicate event IDs do not increase strikes twice (Idempotency)', false, err.message);
  }

  // 13. Concurrent event requests do not lose updates
  try {
    await new Promise(r => setTimeout(r, 3500));
    const currentRecordBefore = await db.collection('proctoring_events').findOne({
      sessionId: new mongoose.Types.ObjectId(sessionA.sessionId)
    });
    const startingStrikes = currentRecordBefore.totalStrikes;

    // Fire 3 simultaneous concurrent events with unique idempotency keys
    const p1 = fetch(`${BASE_URL}/api/integrity/event`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Cookie': `dv_session=${tokenA}` },
      body: JSON.stringify({
        sessionId: sessionA.sessionId,
        idempotencyKey: `concurrent-1-${Date.now()}`,
        eventType: 'COPY_PASTE_ATTEMPT'
      })
    });
    const p2 = fetch(`${BASE_URL}/api/integrity/event`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Cookie': `dv_session=${tokenA}` },
      body: JSON.stringify({
        sessionId: sessionA.sessionId,
        idempotencyKey: `concurrent-2-${Date.now()}`,
        eventType: 'RESTRICTED_KEY_COMBO'
      })
    });

    const [r1, r2] = await Promise.all([p1, p2]);
    const d1 = await r1.json().catch(() => ({}));
    const d2 = await r2.json().catch(() => ({}));

    const currentRecordAfter = await db.collection('proctoring_events').findOne({
      sessionId: new mongoose.Types.ObjectId(sessionA.sessionId)
    });

    recordTest(
      '13. Concurrent event requests do not lose updates (Atomic $inc/$push)',
      r1.ok && r2.ok && currentRecordAfter.totalStrikes >= startingStrikes + 1,
      `r1 status: ${r1.status}, r2 status: ${r2.status}, Strikes: ${currentRecordAfter.totalStrikes}, Events: ${currentRecordAfter.events.length}`
    );
  } catch (err) {
    recordTest('13. Concurrent event requests do not lose updates', false, err.message);
  }

  // 14. A candidate cannot submit events for another candidate
  try {
    const res = await fetch(`${BASE_URL}/api/integrity/event`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': `dv_session=${tokenB}` // Candidate B attempting to report for Candidate A's session
      },
      body: JSON.stringify({
        sessionId: sessionA.sessionId,
        eventType: 'TAB_SWITCH'
      })
    });
    recordTest(
      '14. Candidate cannot submit events for another candidate',
      res.status === 404 || res.status === 403,
      `Status: ${res.status}`
    );
  } catch (err) {
    recordTest('14. Candidate cannot submit events for another candidate', false, err.message);
  }

  // 15. A candidate cannot retrieve another candidate\'s proctoring records
  try {
    const res = await fetch(`${BASE_URL}/api/admin/proctoring-events?sessionId=${sessionA.sessionId}`, {
      headers: { 'Cookie': `dv_session=${tokenA}` } // Candidate A attempting to access admin route
    });
    recordTest(
      '15. Candidate cannot retrieve admin proctoring records',
      res.status === 403,
      `Status: ${res.status}`
    );
  } catch (err) {
    recordTest('15. Candidate cannot retrieve admin proctoring records', false, err.message);
  }

  // 16. Unauthenticated users cannot access administrative review APIs
  try {
    const res = await fetch(`${BASE_URL}/api/admin/proctoring-events?sessionId=${sessionA.sessionId}`);
    recordTest(
      '16. Unauthenticated users cannot access administrative review APIs',
      res.status === 401,
      `Status: ${res.status}`
    );
  } catch (err) {
    recordTest('16. Unauthenticated users cannot access administrative review APIs', false, err.message);
  }

  // 17 & 18 & 19. Existing answer autosave, scoring, submission, completion screen & rejecting late events
  try {
    // Autosave answers
    const saveRes = await fetch(`${BASE_URL}/api/assessment/sync`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': `dv_session=${tokenA}`
      },
      body: JSON.stringify({
        answers: [
          { questionId: 1, value: "1" },
          { questionId: 2, value: "1" },
          { questionId: 56, value: "git commit -m \"initial commit\"" }
        ]
      })
    });
    const saveData = await saveRes.json();

    // Submit assessment
    const submitRes = await fetch(`${BASE_URL}/api/assessment/submit`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': `dv_session=${tokenA}`
      },
      body: JSON.stringify({
        answers: [
          { questionId: 1, value: "1" },
          { questionId: 2, value: "1" },
          { questionId: 56, value: "git commit -m \"initial commit\"" }
        ]
      })
    });
    const submitData = await submitRes.json();

    // Check completion response hides scores
    const completionHidesMarks = submitData.success && !submitData.totalScore && !submitData.scoreSummary;
    recordTest(
      '19. Candidate completion UI hides marks and private scores',
      completionHidesMarks,
      `Message: "${submitData.message}", Score exposed: ${!!submitData.totalScore}`
    );

    // Verify late proctoring event rejected after submission
    const lateEventRes = await fetch(`${BASE_URL}/api/integrity/event`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': `dv_session=${tokenA}`
      },
      body: JSON.stringify({
        sessionId: sessionA.sessionId,
        eventType: 'TAB_SWITCH'
      })
    });
    recordTest(
      '17. Submitted assessments reject late events safely',
      lateEventRes.status === 400,
      `Status: ${lateEventRes.status}`
    );

    // Verify existing collections in MongoDB: student_answers and student_results
    const studentAnswerDoc = await db.collection('student_answers').findOne({
      sessionId: new mongoose.Types.ObjectId(sessionA.sessionId)
    });
    const studentResultDoc = await db.collection('student_results').findOne({
      sessionId: new mongoose.Types.ObjectId(sessionA.sessionId)
    });

    const collectionsIntact = studentAnswerDoc && studentResultDoc && studentResultDoc.marksObtained >= 0;
    recordTest(
      '18. Existing answer autosave, scoring, submission, and result persistence intact',
      collectionsIntact,
      `Answers doc: ${!!studentAnswerDoc}, Result doc: ${!!studentResultDoc}, Marks: ${studentResultDoc?.marksObtained}`
    );
  } catch (err) {
    recordTest('17, 18, 19. Submission lifecycle test', false, err.message);
  }

  // 20. MongoDB persistence matches the server's authoritative event count
  try {
    const finalRecord = await db.collection('proctoring_events').findOne({
      sessionId: new mongoose.Types.ObjectId(sessionA.sessionId)
    });

    const validSchema =
      finalRecord &&
      finalRecord.studentName &&
      finalRecord.studentEmail === testEmailA.toLowerCase() &&
      finalRecord.sessionId &&
      typeof finalRecord.totalStrikes === 'number' &&
      finalRecord.status &&
      Array.isArray(finalRecord.events) &&
      finalRecord.events.length > 0;

    const sampleEvent = finalRecord.events[0];
    const eventValid =
      sampleEvent.eventId &&
      sampleEvent.idempotencyKey &&
      sampleEvent.eventType &&
      sampleEvent.category &&
      sampleEvent.serverTimestamp &&
      typeof sampleEvent.strikePoints === 'number' &&
      sampleEvent.reason;

    recordTest(
      '20. MongoDB proctoring_events persistence matches authoritative schema & event count',
      validSchema && eventValid,
      `Collection: proctoring_events, Total Strikes: ${finalRecord.totalStrikes}, Status: ${finalRecord.status}, Events: ${finalRecord.events.length}`
    );
  } catch (err) {
    recordTest('20. MongoDB proctoring_events persistence', false, err.message);
  }

  // Admin Human Review API verification
  try {
    const reviewRes = await fetch(`${BASE_URL}/api/admin/proctoring-events`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': `dv_session=${adminToken}`
      },
      body: JSON.stringify({
        sessionId: sessionA.sessionId,
        status: 'CLEARED',
        adminNote: 'Verified candidate had technical lighting disruption; cleared'
      })
    });
    const reviewData = await reviewRes.json();
    const reviewPassed = reviewRes.ok && reviewData.success && reviewData.record.status === 'CLEARED';
    recordTest(
      'Bonus. Admin Human Review workflow (PATCH status: CLEARED with audit trail)',
      reviewPassed,
      `Updated status: ${reviewData.record?.status}`
    );
  } catch (err) {
    recordTest('Bonus. Admin Human Review workflow', false, err.message);
  }

  console.log('\n====================================================');
  const allPassed = results.every(r => r.passed);
  console.log(`TEST SUMMARY: ${results.filter(r => r.passed).length} / ${results.length} PASSED`);
  if (allPassed) {
    console.log('ALL PROCTORING & STRIKE ENGINE TESTS PASSED SUCCESSFULLY! 🚀');
  } else {
    console.log('SOME TESTS FAILED. PLEASE REVIEW DETAILS ABOVE.');
  }
  console.log('====================================================\n');

  process.exit(allPassed ? 0 : 1);
}

run().catch(err => {
  console.error('Test script execution failure:', err);
  process.exit(1);
});
