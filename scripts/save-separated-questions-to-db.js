const path = require('path');
const fs = require('fs');
const mongoose = require(path.join(process.cwd(), 'node_modules', 'mongoose'));

// Read env safely
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

// 1. Read assessment questions
const safeQuestionsPath = path.join(process.cwd(), 'src', 'lib', 'safe-questions.ts');
const safeQuestionsCode = fs.readFileSync(safeQuestionsPath, 'utf8');
const dataMatch = safeQuestionsCode.match(/export const assessmentData = (\[[\s\S]*?\n\]);/);
if (!dataMatch) {
  console.error('Failed to parse assessmentData');
  process.exit(1);
}
const questions = JSON.parse(dataMatch[1]);

// 2. Read answer keys
const keysPath = path.join(process.cwd(), 'src', 'server', 'assessment-keys.ts');
const keysCode = fs.readFileSync(keysPath, 'utf8');
const keysMatch = keysCode.match(/export const answerKeys = (\[[\s\S]*?\n\]);/);
if (!keysMatch) {
  console.error('Failed to parse answerKeys');
  process.exit(1);
}
const answerKeys = JSON.parse(keysMatch[1]);
const keyMap = new Map(answerKeys.map(k => [k.id, k]));

const gitAcceptedMap = {
  21: ['git status', 'git status -s', 'git status --short'],
  22: ['git add app.py', 'git add ./app.py'],
  23: ['git commit -m "Add login feature"', "git commit -m 'Add login feature'", 'git commit -am "Add login feature"'],
  24: ['git log', 'git log --oneline'],
  25: ['git push origin', 'git push origin main', 'git push origin master', 'git push -u origin main']
};

const mcqQuestions = [];
const gitWrittenQuestions = [];

for (const q of questions) {
  const k = keyMap.get(q.id) || {};
  if (q.id >= 21 && q.id <= 25) {
    // 5 Git written questions
    gitWrittenQuestions.push({
      questionNumber: q.id,
      questionId: q.id,
      category: q.category,
      type: 'GIT_COMMAND',
      question: q.question,
      passage: q.passage || '',
      correctCommand: k.correctAnswer,
      correctAnswer: k.correctAnswer,
      acceptedCommands: gitAcceptedMap[q.id] || [k.correctAnswer],
      explanation: k.explanation || '',
      assets: q.assets || null
    });
  } else {
    // 55 Multiple Choice Questions
    const opts = q.options || [];
    let optIndex = opts.findIndex(o => o.trim().toLowerCase() === (k.correctAnswer || '').trim().toLowerCase());
    if (optIndex === -1 && /^[A-E]$/i.test((k.correctAnswer || '').trim())) {
      optIndex = (k.correctAnswer || '').trim().toUpperCase().charCodeAt(0) - 65;
    }
    const correctOptionNumber = optIndex >= 0 ? optIndex + 1 : null;
    const correctOptionLetter = optIndex >= 0 ? String.fromCharCode(65 + optIndex) : null;

    mcqQuestions.push({
      questionNumber: q.id,
      questionId: q.id,
      category: q.category,
      type: q.type || 'MULTIPLE_CHOICE',
      question: q.question,
      options: opts,
      correctOptionNumber,
      correctOptionLetter,
      correctAnswer: k.correctAnswer,
      explanation: k.explanation || '',
      assets: q.assets || null,
      image: q.image || null
    });
  }
}

// Sort by question number for clean, predictable indexing
mcqQuestions.sort((a, b) => a.questionNumber - b.questionNumber);
gitWrittenQuestions.sort((a, b) => a.questionNumber - b.questionNumber);

console.log(`\nPrepared 55 MCQs with correctOptionNumber and 5 separate Git written questions.`);

async function saveToCluster() {
  console.log(`Connecting to MongoDB Atlas cluster [Database: "${dbName}"]...`);
  await mongoose.connect(mongoUri, { dbName });
  const db = mongoose.connection.db;

  // -------------------------------------------------------------
  // 1. UPDATE 'dv_answers' COLLECTION
  // -------------------------------------------------------------
  const dvAnswersCol = db.collection('dv_answers');
  console.log('\n--- UPDATING "dv_answers" COLLECTION ---');

  // A. Save Master Bank document in dv_answers containing both separated arrays
  const masterDoc = {
    docType: 'MASTER_QUESTION_ANSWER_BANK',
    title: 'DataValley Engineering Assessment Master Bank',
    totalQuestions: 60,
    totalMcqQuestions: mcqQuestions.length,
    totalGitQuestions: gitWrittenQuestions.length,
    mcqQuestions: mcqQuestions,           // 55 MCQs in one array with correctOptionNumber
    gitWrittenQuestions: gitWrittenQuestions, // 5 Git written questions in a separate array
    updatedAt: new Date()
  };

  await dvAnswersCol.updateOne(
    { docType: 'MASTER_QUESTION_ANSWER_BANK' },
    { $set: masterDoc, $setOnInsert: { createdAt: new Date() } },
    { upsert: true }
  );
  console.log('Saved master bank document with separate mcqQuestions (55) & gitWrittenQuestions (5) into "dv_answers".');

  // B. Also update individual question documents in dv_answers with option numbers
  for (const mcq of mcqQuestions) {
    await dvAnswersCol.updateOne(
      { questionId: mcq.questionId },
      {
        $set: {
          questionNumber: mcq.questionNumber,
          category: mcq.category,
          type: mcq.type,
          question: mcq.question,
          options: mcq.options,
          correctOptionNumber: mcq.correctOptionNumber, // e.g. 1, 2, 3, 4
          correctOptionLetter: mcq.correctOptionLetter, // 'A', 'B', 'C', 'D'
          correctAnswer: mcq.correctAnswer,
          explanation: mcq.explanation,
          isActive: true,
          updatedAt: new Date()
        }
      },
      { upsert: true }
    );
  }

  for (const git of gitWrittenQuestions) {
    await dvAnswersCol.updateOne(
      { questionId: git.questionId },
      {
        $set: {
          questionNumber: git.questionNumber,
          category: git.category,
          type: 'GIT_COMMAND',
          question: git.question,
          passage: git.passage,
          correctCommand: git.correctCommand,
          correctAnswer: git.correctAnswer,
          acceptedCommands: git.acceptedCommands,
          explanation: git.explanation,
          isActive: true,
          updatedAt: new Date()
        }
      },
      { upsert: true }
    );
  }
  console.log('Updated all 60 individual question records in "dv_answers" with option numbers and command mappings.');

  // -------------------------------------------------------------
  // 2. UPDATE 'assessments' COLLECTION
  // -------------------------------------------------------------
  const assessmentsCol = db.collection('assessments');
  console.log('\n--- UPDATING "assessments" COLLECTION ---');

  const assessmentUpdate = {
    $set: {
      title: 'DataValley Engineering Assessment',
      totalQuestions: 60,
      totalMcqQuestions: mcqQuestions.length,
      totalGitQuestions: gitWrittenQuestions.length,
      durationMinutes: 60,
      mcqQuestions: mcqQuestions,               // 55 MCQs in one array with correctOptionNumber
      gitWrittenQuestions: gitWrittenQuestions, // 5 Git written questions in separate array
      updatedAt: new Date()
    },
    $setOnInsert: {
      createdAt: new Date()
    }
  };

  await assessmentsCol.updateOne(
    { title: { $regex: /DataValley|Assessment/i } },
    assessmentUpdate,
    { upsert: true }
  );
  console.log('Updated "assessments" document with separated mcqQuestions (55) & gitWrittenQuestions (5).');

  // -------------------------------------------------------------
  // 3. VERIFICATION
  // -------------------------------------------------------------
  console.log('\n================ VERIFICATION ================');
  const verifiedAssessment = await assessmentsCol.findOne({ title: { $regex: /DataValley|Assessment/i } });
  console.log('Assessments Document:');
  console.log('  Total MCQ Questions in Array 1:', verifiedAssessment.mcqQuestions?.length);
  console.log('  Total Git Written Questions in Array 2:', verifiedAssessment.gitWrittenQuestions?.length);

  const sampleMcq = verifiedAssessment.mcqQuestions[0];
  console.log('\nSample MCQ (Question 1):', {
    questionNumber: sampleMcq.questionNumber,
    question: sampleMcq.question,
    options: sampleMcq.options,
    correctOptionNumber: sampleMcq.correctOptionNumber,
    correctOptionLetter: sampleMcq.correctOptionLetter,
    correctAnswer: sampleMcq.correctAnswer
  });

  const sampleGit = verifiedAssessment.gitWrittenQuestions[0];
  console.log('\nSample Git Written Question (Question 21):', {
    questionNumber: sampleGit.questionNumber,
    question: sampleGit.question,
    correctCommand: sampleGit.correctCommand,
    acceptedCommands: sampleGit.acceptedCommands
  });

  const lastGit = verifiedAssessment.gitWrittenQuestions[4];
  console.log('\nLast Git Written Question (Question 25):', {
    questionNumber: lastGit.questionNumber,
    question: lastGit.question,
    correctCommand: lastGit.correctCommand,
    acceptedCommands: lastGit.acceptedCommands
  });

  console.log('\n==============================================');
  console.log('SUCCESS: All 55 MCQs and 5 Git written questions are separated and stored in MongoDB cluster!');

  await mongoose.disconnect();
}

saveToCluster().catch(err => {
  console.error('Error saving to cluster:', err);
  process.exit(1);
});
