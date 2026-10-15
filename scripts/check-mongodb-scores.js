const path = require('path');
const fs = require('fs');
const mongoose = require(path.join(process.cwd(), 'node_modules', 'mongoose'));

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

async function checkScores() {
  await mongoose.connect(mongoUri, { dbName });
  const db = mongoose.connection.db;

  console.log(`\n======================================================`);
  console.log(`CONNECTED TO MONGODB DATABASE: [${dbName}]`);
  console.log(`======================================================\n`);

  // 1. Check Master Roster Array in student_results
  const studentResultsCol = db.collection('student_results');
  const rosterDoc = await studentResultsCol.findOne({
    docType: 'ALL_STUDENTS_ROSTER',
    rosterKey: 'ALL_RESULTS'
  });

  console.log(`--- [1] ALL STUDENTS RESULTS ARRAY (in "student_results" collection) ---`);
  if (rosterDoc && Array.isArray(rosterDoc.allStudentsResults) && rosterDoc.allStudentsResults.length > 0) {
    console.table(rosterDoc.allStudentsResults.map((r, idx) => ({
      '#': idx + 1,
      'Student Name': r.studentName,
      'Student Email': r.studentEmail,
      'Marks Obtained': `${r.marksObtained} / ${r.totalMarks || 60}`,
      'Percentage': `${r.percentage}%`,
      'Status': r.shortlistStatus,
      'Submitted At': r.submittedAt ? new Date(r.submittedAt).toLocaleTimeString() : 'N/A'
    })));
  } else {
    console.log('No results in master roster array yet.');
  }

  // 2. Check student_answers collection
  const studentAnswersCol = db.collection('student_answers');
  const allAnswers = await studentAnswersCol.find().sort({ updatedAt: -1 }).limit(10).toArray();

  console.log(`\n--- [2] RECENT STUDENT ANSWERS (in "student_answers" collection) ---`);
  if (allAnswers.length > 0) {
    console.table(allAnswers.map((a, idx) => ({
      '#': idx + 1,
      'Student Name': a.studentName,
      'Student Email': a.studentEmail,
      'Total Answered': a.totalAnswered || (a.answers ? a.answers.length : 0),
      'Status': a.status,
      'Updated At': a.updatedAt ? new Date(a.updatedAt).toLocaleTimeString() : 'N/A'
    })));
  } else {
    console.log('No student answers found yet.');
  }

  await mongoose.disconnect();
}

checkScores().catch(console.error);
