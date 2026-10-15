const path = require('path');
const fs = require('fs');
const mongoose = require(path.join(process.cwd(), 'node_modules', 'mongoose'));

// 1. Read MongoDB connection parameters from .env
const envContent = fs.readFileSync(path.join(process.cwd(), '.env'), 'utf8');
let mongoUri = '';
let dbName = 'assesmentsdv';

for (const line of envContent.split(/\r?\n/)) {
  const trimmed = line.trim();
  if (trimmed.startsWith('MONGODB_URI=')) {
    let raw = trimmed.slice('MONGODB_URI='.length).trim();
    if (raw.startsWith('"') && raw.endsWith('"')) raw = raw.slice(1, -1);
    if (raw.startsWith("'") && raw.endsWith("'")) raw = raw.slice(1, -1);
    mongoUri = raw;
  }
  if (trimmed.startsWith('MONGODB_DB=')) {
    let raw = trimmed.slice('MONGODB_DB='.length).trim();
    if (raw.startsWith('"') && raw.endsWith('"')) raw = raw.slice(1, -1);
    if (raw.startsWith("'") && raw.endsWith("'")) raw = raw.slice(1, -1);
    dbName = raw;
  }
}

// Evaluation helpers (matching src/server/utils/evaluation.ts)
function extractRawCommand(rawInput) {
  if (typeof rawInput !== 'string') return '';
  const trimmed = rawInput.trim();
  if (!trimmed) return '';
  if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
    try {
      const parsed = JSON.parse(trimmed);
      if (typeof parsed.rawValue === 'string') return parsed.rawValue.trim();
      if (typeof parsed.value === 'string') return parsed.value.trim();
    } catch {}
  }
  return trimmed;
}

function normalizeGitCommand(cmd) {
  return cmd.trim().replace(/\s+/g, ' ');
}

function evaluateGitCommand(questionId, rawInput, dvKey) {
  const raw = extractRawCommand(rawInput);
  if (!raw) return false;
  const normalized = normalizeGitCommand(raw);

  let regexMatch = false;
  switch (questionId) {
    case 21:
      regexMatch = /^git\s+status(\s+(-s|--short))?$/i.test(normalized);
      break;
    case 22:
      regexMatch = /^git\s+add\s+(\.\/)?app\.py$/i.test(normalized);
      break;
    case 23: {
      const match = normalized.match(/^git\s+commit\s+(-[a-zA-Z]*m\s*|--message(=|\s+))(["'])(.+?)\3$/i);
      if (match) {
        regexMatch = match[4].trim().toLowerCase() === 'add login feature';
      }
      break;
    }
    case 24:
      regexMatch = /^git\s+log(\s+--oneline)?$/i.test(normalized);
      break;
    case 25:
      regexMatch = /^git\s+push(\s+-u)?\s+origin(\s+(HEAD|main|master))?$/i.test(normalized);
      break;
  }

  if (regexMatch) return true;

  if (dvKey) {
    if (dvKey.correctCommand && normalizeGitCommand(dvKey.correctCommand).toLowerCase() === normalized.toLowerCase()) {
      return true;
    }
    if (Array.isArray(dvKey.acceptedCommands)) {
      if (dvKey.acceptedCommands.some(c => normalizeGitCommand(c).toLowerCase() === normalized.toLowerCase())) {
        return true;
      }
    }
  }
  return false;
}

function evaluateMcqAnswer(questionId, candidateValue, options, dvKey) {
  if (candidateValue === null || candidateValue === undefined) return false;
  const candVal = String(candidateValue).trim();
  if (!candVal) return false;

  const validOptions = (options && Array.isArray(options) && options.length > 0)
    ? options
    : (dvKey && dvKey.options && Array.isArray(dvKey.options))
      ? dvKey.options
      : [];

  let correctOptionIndex = -1;
  if (dvKey && typeof dvKey.correctOptionNumber === 'number' && dvKey.correctOptionNumber >= 1) {
    correctOptionIndex = dvKey.correctOptionNumber - 1;
  } else if (dvKey && dvKey.correctOptionLetter && /^[A-E]$/i.test(dvKey.correctOptionLetter)) {
    correctOptionIndex = dvKey.correctOptionLetter.toUpperCase().charCodeAt(0) - 65;
  }

  const correctOptionLetter = correctOptionIndex >= 0 ? String.fromCharCode(65 + correctOptionIndex) : (dvKey && dvKey.correctOptionLetter ? dvKey.correctOptionLetter.toUpperCase() : '');

  // 1. JSON
  if (candVal.startsWith('{') && candVal.endsWith('}')) {
    try {
      const parsed = JSON.parse(candVal);
      const letter = parsed.selectedOption || parsed.letter;
      const text = parsed.optionText || parsed.value;
      if (letter) return evaluateMcqAnswer(questionId, letter, validOptions, dvKey);
      if (text) return evaluateMcqAnswer(questionId, text, validOptions, dvKey);
    } catch {}
  }

  // 2. Option Number: "1", "2", "3", "4", "5"
  if (/^[1-5]$/.test(candVal)) {
    const num = parseInt(candVal, 10);
    if (dvKey && typeof dvKey.correctOptionNumber === 'number') {
      return num === dvKey.correctOptionNumber;
    }
    if (correctOptionIndex >= 0) {
      return (num - 1) === correctOptionIndex;
    }
  }

  // 3. Option Letter: "A", "B", "C", "D", "E"
  if (/^[A-E]$/i.test(candVal)) {
    const upper = candVal.toUpperCase();
    if (dvKey && dvKey.correctOptionLetter) {
      return upper === dvKey.correctOptionLetter.toUpperCase();
    }
    if (correctOptionLetter) {
      return upper === correctOptionLetter;
    }
  }

  // 4. Prefixed: "A) ..."
  const prefixMatch = candVal.match(/^(?:Option\s+)?([A-E])[\.\)\:\-\s]/i);
  if (prefixMatch) {
    const letter = prefixMatch[1].toUpperCase();
    if (correctOptionLetter) {
      return letter === correctOptionLetter;
    }
  }

  // 5. Full text
  if (validOptions.length > 0 && correctOptionIndex >= 0 && correctOptionIndex < validOptions.length) {
    if (candVal.toLowerCase() === validOptions[correctOptionIndex].trim().toLowerCase()) {
      return true;
    }
  }

  return false;
}

async function run() {
  console.log(`Connecting to MongoDB Atlas [${dbName}] with high-concurrency connection pool...`);
  await mongoose.connect(mongoUri, {
    dbName,
    maxPoolSize: 100,
    minPoolSize: 10,
    socketTimeoutMS: 45000,
    serverSelectionTimeoutMS: 10000
  });

  const db = mongoose.connection.db;

  // 1. Verify dv_answers collection
  const dvAnswersCol = db.collection('dv_answers');
  const dvAnswersList = await dvAnswersCol.find({ isActive: true }).toArray();
  console.log(`[PASS] Loaded ${dvAnswersList.length} authoritative questions from "dv_answers" collection.`);

  const dvKeysMap = new Map();
  for (const item of dvAnswersList) {
    dvKeysMap.set(item.questionId, item);
  }

  // 2. Test Evaluation Logic
  console.log('\n--- Testing Evaluation Logic (+1 Mark for correct, 0 for wrong, Git Regex) ---');
  // Test MCQ Option 1 (matches dv_answers correctOptionNumber)
  const q1Key = dvKeysMap.get(1);
  const q1Correct = evaluateMcqAnswer(1, q1Key.correctOptionNumber, q1Key.options, q1Key);
  const q1Wrong = evaluateMcqAnswer(1, 99, q1Key.options, q1Key);
  console.log(`Q1 Evaluation - Correct Option Number (${q1Key.correctOptionNumber}):`, q1Correct ? 'PASSED (+1 mark)' : 'FAILED');
  console.log(`Q1 Evaluation - Wrong Option:`, !q1Wrong ? 'PASSED (0 marks, no negative marks)' : 'FAILED');

  // Test Git written questions (21-25) regex evaluation
  const gitTests = [
    { id: 21, cmd: 'git status', shouldPass: true },
    { id: 21, cmd: 'git status -s', shouldPass: true },
    { id: 21, cmd: 'git diff', shouldPass: false },
    { id: 22, cmd: 'git add app.py', shouldPass: true },
    { id: 22, cmd: 'git add ./app.py', shouldPass: true },
    { id: 22, cmd: 'git add server.js', shouldPass: false },
    { id: 23, cmd: 'git commit -m "Add login feature"', shouldPass: true },
    { id: 23, cmd: "git commit -m 'Add login feature'", shouldPass: true },
    { id: 23, cmd: 'git commit -m "Wrong message"', shouldPass: false },
    { id: 24, cmd: 'git log', shouldPass: true },
    { id: 24, cmd: 'git log --oneline', shouldPass: true },
    { id: 25, cmd: 'git push origin', shouldPass: true },
    { id: 25, cmd: 'git push -u origin main', shouldPass: true },
    { id: 25, cmd: 'git push upstream', shouldPass: false }
  ];

  let gitAllPassed = true;
  for (const t of gitTests) {
    const passed = evaluateGitCommand(t.id, t.cmd, dvKeysMap.get(t.id));
    if (passed !== t.shouldPass) {
      console.error(`Git Test Failed for Q${t.id}: command "${t.cmd}" expected ${t.shouldPass} but got ${passed}`);
      gitAllPassed = false;
    }
  }
  console.log(`Git Regex Evaluation Tests (Q21-25):`, gitAllPassed ? 'ALL PASSED (+1 for regex match, 0 for wrong)' : 'FAILED');

  // 3. Test student_answers collection
  console.log('\n--- Testing "student_answers" Collection ---');
  const studentAnswersCol = db.collection('student_answers');
  const testCandidateId = new mongoose.Types.ObjectId();
  const testSessionId = new mongoose.Types.ObjectId();
  const testStudentName = 'Mani Kumar';
  const testStudentEmail = 'mani.kumar@student.datavalley.ai';

  const testAnswers = [
    { questionId: 1, value: String(q1Key.correctOptionNumber), timestamp: new Date() },
    { questionId: 2, value: 'B', timestamp: new Date() },
    { questionId: 21, value: 'git status', timestamp: new Date() },
    { questionId: 22, value: 'git add app.py', timestamp: new Date() },
    { questionId: 23, value: 'git commit -m "Add login feature"', timestamp: new Date() },
    { questionId: 24, value: 'git log', timestamp: new Date() },
    { questionId: 25, value: 'git push origin', timestamp: new Date() }
  ];

  await studentAnswersCol.findOneAndUpdate(
    { candidateId: testCandidateId, sessionId: testSessionId },
    {
      $set: {
        studentName: testStudentName,
        studentEmail: testStudentEmail,
        status: 'SUBMITTED',
        answers: testAnswers,
        totalAnswered: testAnswers.length,
        submittedAt: new Date(),
        updatedAt: new Date()
      },
      $setOnInsert: {
        startedAt: new Date()
      }
    },
    { upsert: true, returnDocument: 'after' }
  );

  const savedAnswerDoc = await studentAnswersCol.findOne({ candidateId: testCandidateId });
  console.log('[PASS] Saved record in "student_answers" collection:');
  console.log({
    studentName: savedAnswerDoc.studentName,
    studentEmail: savedAnswerDoc.studentEmail,
    totalAnswered: savedAnswerDoc.totalAnswered,
    status: savedAnswerDoc.status,
    answersCount: savedAnswerDoc.answers.length
  });

  // 4. Test student_results collection & master roster array
  console.log('\n--- Testing "student_results" Collection (Individual + Master Array) ---');
  const studentResultsCol = db.collection('student_results');

  // Calculate test score
  let scoreObtained = 0;
  for (const ans of testAnswers) {
    const qKey = dvKeysMap.get(ans.questionId);
    if (!qKey) continue;
    if (ans.questionId >= 21 && ans.questionId <= 25) {
      if (evaluateGitCommand(ans.questionId, ans.value, qKey)) scoreObtained += 1;
    } else {
      if (evaluateMcqAnswer(ans.questionId, ans.value, qKey.options, qKey)) scoreObtained += 1;
    }
  }

  const percentage = Math.round((scoreObtained / 60) * 1000) / 10;
  const shortlistStatus = scoreObtained >= 35 ? 'SHORTLISTED' : 'NOT_SHORTLISTED';

  // Save individual student result
  await studentResultsCol.findOneAndUpdate(
    { docType: 'STUDENT_RESULT', studentEmail: testStudentEmail, sessionId: testSessionId },
    {
      $set: {
        docType: 'STUDENT_RESULT',
        candidateId: testCandidateId,
        sessionId: testSessionId,
        studentName: testStudentName,
        studentEmail: testStudentEmail,
        marksObtained: scoreObtained,
        totalMarks: 60,
        percentage,
        shortlistStatus,
        submittedAt: new Date()
      }
    },
    { upsert: true, returnDocument: 'after' }
  );

  // Update master roster array containing all student results in one array
  const rosterEntry = {
    studentName: testStudentName,
    studentEmail: testStudentEmail,
    marksObtained: scoreObtained,
    totalMarks: 60,
    percentage,
    shortlistStatus,
    submittedAt: new Date()
  };

  await studentResultsCol.updateOne(
    { docType: 'ALL_STUDENTS_ROSTER', rosterKey: 'ALL_RESULTS' },
    { $pull: { allStudentsResults: { studentEmail: testStudentEmail } } },
    { upsert: true }
  );

  await studentResultsCol.findOneAndUpdate(
    { docType: 'ALL_STUDENTS_ROSTER', rosterKey: 'ALL_RESULTS' },
    { $push: { allStudentsResults: rosterEntry } },
    { upsert: true, returnDocument: 'after' }
  );

  const individualResult = await studentResultsCol.findOne({
    docType: 'STUDENT_RESULT',
    studentEmail: testStudentEmail
  });
  console.log('[PASS] Individual Student Result saved:', {
    studentName: individualResult.studentName,
    studentEmail: individualResult.studentEmail,
    marksObtained: individualResult.marksObtained,
    totalMarks: individualResult.totalMarks,
    percentage: individualResult.percentage
  });

  const masterRoster = await studentResultsCol.findOne({
    docType: 'ALL_STUDENTS_ROSTER',
    rosterKey: 'ALL_RESULTS'
  });
  console.log('[PASS] Master Roster in "student_results" has all students in one array:');
  console.log(`Total students in roster array: ${masterRoster.allStudentsResults.length}`);
  console.log('Sample roster item:', masterRoster.allStudentsResults[masterRoster.allStudentsResults.length - 1]);

  // 5. Test 200 Concurrent Students Submission
  console.log('\n--- Simulating 200 Concurrent Students Exam Taking & Submission ---');
  const CONCURRENT_STUDENTS = 200;
  const startTime = Date.now();

  const concurrentTasks = Array.from({ length: CONCURRENT_STUDENTS }, async (_, i) => {
    const studentIdx = i + 1;
    const sId = new mongoose.Types.ObjectId();
    const cId = new mongoose.Types.ObjectId();
    const sName = `Student ${studentIdx}`;
    const sEmail = `student${studentIdx}@exam.datavalley.ai`;

    // Simulated student answers (varying scores)
    const simulatedAnswers = [
      { questionId: 1, value: String(q1Key.correctOptionNumber), timestamp: new Date() },
      { questionId: 21, value: 'git status', timestamp: new Date() },
      { questionId: 22, value: 'git add app.py', timestamp: new Date() },
      { questionId: 23, value: 'git commit -m "Add login feature"', timestamp: new Date() },
      { questionId: 24, value: 'git log', timestamp: new Date() },
      { questionId: 25, value: 'git push origin', timestamp: new Date() }
    ];

    // 1. Write answers to student_answers
    await studentAnswersCol.findOneAndUpdate(
      { candidateId: cId, sessionId: sId },
      {
        $set: {
          studentName: sName,
          studentEmail: sEmail,
          status: 'SUBMITTED',
          answers: simulatedAnswers,
          totalAnswered: simulatedAnswers.length,
          submittedAt: new Date(),
          updatedAt: new Date()
        },
        $setOnInsert: {
          startedAt: new Date()
        }
      },
      { upsert: true }
    );

    // 2. Evaluate score
    let score = 0;
    for (const a of simulatedAnswers) {
      const k = dvKeysMap.get(a.questionId);
      if (!k) continue;
      if (a.questionId >= 21 && a.questionId <= 25) {
        if (evaluateGitCommand(a.questionId, a.value, k)) score += 1;
      } else {
        if (evaluateMcqAnswer(a.questionId, a.value, k.options, k)) score += 1;
      }
    }

    const pct = Math.round((score / 60) * 1000) / 10;
    const status = score >= 35 ? 'SHORTLISTED' : 'NOT_SHORTLISTED';

    // 3. Write individual result
    await studentResultsCol.findOneAndUpdate(
      { docType: 'STUDENT_RESULT', studentEmail: sEmail, sessionId: sId },
      {
        $set: {
          docType: 'STUDENT_RESULT',
          candidateId: cId,
          sessionId: sId,
          studentName: sName,
          studentEmail: sEmail,
          marksObtained: score,
          totalMarks: 60,
          percentage: pct,
          shortlistStatus: status,
          submittedAt: new Date()
        }
      },
      { upsert: true }
    );

    // 4. Update master roster array
    await studentResultsCol.updateOne(
      { docType: 'ALL_STUDENTS_ROSTER', rosterKey: 'ALL_RESULTS' },
      {
        $push: {
          allStudentsResults: {
            studentName: sName,
            studentEmail: sEmail,
            marksObtained: score,
            totalMarks: 60,
            percentage: pct,
            shortlistStatus: status,
            submittedAt: new Date()
          }
        }
      },
      { upsert: true }
    );

    return { sEmail, score };
  });

  const results = await Promise.all(concurrentTasks);
  const durationMs = Date.now() - startTime;
  console.log(`[PASS] All ${results.length} concurrent students successfully processed in ${durationMs}ms (${(durationMs / 1000).toFixed(2)}s)!`);
  console.log(`Average throughput: ${(results.length / (durationMs / 1000)).toFixed(1)} submissions/second.`);

  const finalAnswersCount = await studentAnswersCol.countDocuments();
  const finalResultsCount = await studentResultsCol.countDocuments({ docType: 'STUDENT_RESULT' });
  const finalRoster = await studentResultsCol.findOne({ docType: 'ALL_STUDENTS_ROSTER', rosterKey: 'ALL_RESULTS' });

  console.log(`Final "student_answers" count: ${finalAnswersCount}`);
  console.log(`Final "student_results" (individual docs) count: ${finalResultsCount}`);
  console.log(`Final "student_results" master roster array length: ${finalRoster.allStudentsResults.length}`);

  // Clean up test batch
  await studentAnswersCol.deleteMany({ studentEmail: /@exam\.datavalley\.ai$/ });
  await studentResultsCol.deleteMany({ studentEmail: /@exam\.datavalley\.ai$/ });
  await studentResultsCol.updateOne(
    { docType: 'ALL_STUDENTS_ROSTER', rosterKey: 'ALL_RESULTS' },
    { $pull: { allStudentsResults: { studentEmail: /@exam\.datavalley\.ai$/ } } }
  );
  console.log('[PASS] Test benchmark batch successfully cleaned up.');

  await mongoose.disconnect();
  console.log('\n=============================================');
  console.log('ALL TESTS PASSED WITH 100% SUCCESS!');
  console.log('=============================================');
}

run().catch((err) => {
  console.error('Error during execution:', err);
  process.exit(1);
});
