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

// Load backup for verification and restoring preserved questions
const backupPath = path.join(process.cwd(), 'backups', 'dv_answers_backup_q31_q50_1792064131939.json');
const backupQuestions = JSON.parse(fs.readFileSync(backupPath, 'utf8'));
const backupMap = new Map(backupQuestions.map(q => [q.questionId, q]));

// Define the 3 new Java questions
const newJavaQuestions = {
  33: {
    questionId: 33,
    questionNumber: 33,
    category: 'Code Snapshots & Output Analysis',
    type: 'MULTIPLE_CHOICE',
    question: 'What will be the output of the following Java program?',
    image: '/q33-java-conditional.svg',
    options: [
      'HIGH: 6',
      'LOW: 6',
      'HIGH: 6.75',
      'LOW: 7'
    ],
    correctOptionNumber: 1,
    correctOptionLetter: 'A',
    correctAnswer: 'HIGH: 6',
    explanation: 'In Java integer arithmetic, 15 % 4 evaluates to remainder 3, and 15 / 4 evaluates to integer quotient 3. Therefore, result = 3 + 3 = 6. Since 6 > 5 is true, the if branch executes and prints "HIGH: 6".',
    scoreWeight: 1,
    sectionIndex: 3,
    isActive: true
  },
  34: {
    questionId: 34,
    questionNumber: 34,
    category: 'Code Snapshots & Output Analysis',
    type: 'MULTIPLE_CHOICE',
    question: 'What will be the output of the following Java program?',
    image: '/q34-java-loop-method.svg',
    options: [
      '10',
      '15',
      '18',
      '30'
    ],
    correctOptionNumber: 3,
    correctOptionLetter: 'C',
    correctAnswer: '18',
    explanation: 'The process method iterates i from 1 to 5. The condition (i % 2 != 0) selects odd numbers: i = 1 (adds 1 * 2 = 2), i = 3 (adds 3 * 2 = 6), and i = 5 (adds 5 * 2 = 10). The final accumulated sum is 2 + 6 + 10 = 18.',
    scoreWeight: 1,
    sectionIndex: 3,
    isActive: true
  },
  35: {
    questionId: 35,
    questionNumber: 35,
    category: 'Code Snapshots & Output Analysis',
    type: 'MULTIPLE_CHOICE',
    question: 'What will be the output of the following Java program?',
    image: '/q35-java-oop-constructor.svg',
    options: [
      'Untitled - 100',
      'Untitled - 120',
      'null - 120',
      'Compilation error: constructor chaining not supported'
    ],
    correctOptionNumber: 2,
    correctOptionLetter: 'B',
    correctAnswer: 'Untitled - 120',
    explanation: 'Instantiating \'new Book()\' invokes the no-argument constructor, which uses constructor chaining this("Untitled", 100) to call the parameterized constructor. There, title is assigned "Untitled" and pages is calculated as 100 + 20 = 120. Calling b.display() prints "Untitled - 120".',
    scoreWeight: 1,
    sectionIndex: 3,
    isActive: true
  }
};

const preservedIds = [31, 32, 36, 37, 38, 39, 40, 41, 42, 43, 44, 45, 46, 47, 48, 49, 50];
const replacedIds = [33, 34, 35];

async function runMigration() {
  console.log(`Connecting to MongoDB Atlas database "${dbName}"...`);
  await mongoose.connect(mongoUri, { dbName });
  const db = mongoose.connection.db;

  // 1. Check for live active candidates
  const sessionsCol = db.collection('assessmentsessions');
  const now = new Date();
  const activeSessions = await sessionsCol.find({
    status: { $in: ['in_progress', 'active', 'STARTED'] },
    expiresAt: { $gt: now }
  }).toArray();
  console.log(`\nActive unexpired candidate sessions found: ${activeSessions.length}`);

  // 2. Update dv_answers individual question records
  const dvAnswersCol = db.collection('dv_answers');
  console.log('\n--- TARGETED UPDATE: dv_answers 3 Java documents ---');

  for (const qId of replacedIds) {
    const qData = newJavaQuestions[qId];
    await dvAnswersCol.updateOne(
      { questionId: qId },
      {
        $set: {
          questionNumber: qData.questionNumber,
          category: qData.category,
          type: qData.type,
          question: qData.question,
          image: qData.image,
          options: qData.options,
          correctOptionNumber: qData.correctOptionNumber,
          correctOptionLetter: qData.correctOptionLetter,
          correctAnswer: qData.correctAnswer,
          explanation: qData.explanation,
          scoreWeight: qData.scoreWeight,
          sectionIndex: qData.sectionIndex,
          isActive: true,
          updatedAt: new Date()
        }
      },
      { upsert: true }
    );
    console.log(`Updated Java MCQ Q${qId} in dv_answers.`);
  }

  // Restore/confirm 17 preserved questions in dv_answers to original state
  console.log('\n--- CONFIRM / RESTORE 17 PRESERVED QUESTIONS IN dv_answers ---');
  for (const qId of preservedIds) {
    const orig = backupMap.get(qId);
    if (!orig) continue;
    await dvAnswersCol.updateOne(
      { questionId: qId },
      {
        $set: {
          questionNumber: orig.questionNumber || orig.questionId,
          category: orig.category,
          type: orig.type || 'MULTIPLE_CHOICE',
          question: orig.question,
          options: orig.options,
          correctOptionNumber: orig.correctOptionNumber,
          correctOptionLetter: orig.correctOptionLetter,
          correctAnswer: orig.correctAnswer,
          explanation: orig.explanation,
          scoreWeight: orig.scoreWeight || 1,
          sectionIndex: orig.sectionIndex || 3,
          isActive: true
        }
      },
      { upsert: true }
    );
  }
  console.log('Confirmed 17 preserved questions match baseline in dv_answers.');

  // 3. Update master doc in dv_answers if it exists
  const masterDoc = await dvAnswersCol.findOne({ docType: 'MASTER_QUESTION_ANSWER_BANK' });
  if (masterDoc && masterDoc.mcqQuestions) {
    console.log('\n--- TARGETED UPDATE: MASTER_QUESTION_ANSWER_BANK in dv_answers ---');
    const updatedMcqs = masterDoc.mcqQuestions.map(mcq => {
      const qId = mcq.questionId || mcq.questionNumber;
      if (replacedIds.includes(qId)) {
        const javaQ = newJavaQuestions[qId];
        return {
          ...mcq,
          questionNumber: javaQ.questionNumber,
          questionId: javaQ.questionId,
          category: javaQ.category,
          type: javaQ.type,
          question: javaQ.question,
          image: javaQ.image,
          options: javaQ.options,
          correctOptionNumber: javaQ.correctOptionNumber,
          correctOptionLetter: javaQ.correctOptionLetter,
          correctAnswer: javaQ.correctAnswer,
          explanation: javaQ.explanation,
          scoreWeight: javaQ.scoreWeight,
          sectionIndex: javaQ.sectionIndex
        };
      }
      if (preservedIds.includes(qId)) {
        const orig = backupMap.get(qId);
        return {
          ...mcq,
          questionNumber: orig.questionNumber || orig.questionId,
          questionId: orig.questionId,
          category: orig.category,
          type: orig.type || 'MULTIPLE_CHOICE',
          question: orig.question,
          options: orig.options,
          correctOptionNumber: orig.correctOptionNumber,
          correctOptionLetter: orig.correctOptionLetter,
          correctAnswer: orig.correctAnswer,
          explanation: orig.explanation,
          scoreWeight: orig.scoreWeight || 1,
          sectionIndex: orig.sectionIndex || 3
        };
      }
      return mcq;
    });

    await dvAnswersCol.updateOne(
      { docType: 'MASTER_QUESTION_ANSWER_BANK' },
      {
        $set: {
          mcqQuestions: updatedMcqs,
          updatedAt: new Date()
        }
      }
    );
    console.log('Updated MASTER_QUESTION_ANSWER_BANK in dv_answers.');
  }

  // 4. Update assessments collection
  const assessmentsCol = db.collection('assessments');
  const assessmentDoc = await assessmentsCol.findOne({ title: { $regex: /DataValley|Assessment/i } });
  if (assessmentDoc && assessmentDoc.mcqQuestions) {
    console.log('\n--- TARGETED UPDATE: assessments collection ---');
    const updatedAssessmentMcqs = assessmentDoc.mcqQuestions.map(mcq => {
      const qId = mcq.questionId || mcq.questionNumber;
      if (replacedIds.includes(qId)) {
        const javaQ = newJavaQuestions[qId];
        return {
          ...mcq,
          questionNumber: javaQ.questionNumber,
          questionId: javaQ.questionId,
          category: javaQ.category,
          type: javaQ.type,
          question: javaQ.question,
          image: javaQ.image,
          options: javaQ.options,
          correctOptionNumber: javaQ.correctOptionNumber,
          correctOptionLetter: javaQ.correctOptionLetter,
          correctAnswer: javaQ.correctAnswer,
          explanation: javaQ.explanation,
          scoreWeight: javaQ.scoreWeight,
          sectionIndex: javaQ.sectionIndex
        };
      }
      if (preservedIds.includes(qId)) {
        const orig = backupMap.get(qId);
        return {
          ...mcq,
          questionNumber: orig.questionNumber || orig.questionId,
          questionId: orig.questionId,
          category: orig.category,
          type: orig.type || 'MULTIPLE_CHOICE',
          question: orig.question,
          options: orig.options,
          correctOptionNumber: orig.correctOptionNumber,
          correctOptionLetter: orig.correctOptionLetter,
          correctAnswer: orig.correctAnswer,
          explanation: orig.explanation,
          scoreWeight: orig.scoreWeight || 1,
          sectionIndex: orig.sectionIndex || 3
        };
      }
      return mcq;
    });

    await assessmentsCol.updateOne(
      { _id: assessmentDoc._id },
      {
        $set: {
          mcqQuestions: updatedAssessmentMcqs,
          updatedAt: new Date()
        }
      }
    );
    console.log('Updated assessments collection mcqQuestions array.');
  }

  // 5. Verification: Read back all 20 technical questions (Q31-Q50)
  console.log('\n================ FINAL VERIFICATION: dv_answers ================');
  const technicalRecords = await dvAnswersCol.find({
    questionId: { $gte: 31, $lte: 50 }
  }).sort({ questionId: 1 }).toArray();

  console.log(`Total Technical Questions in dv_answers: ${technicalRecords.length} (Expected: 20)`);
  if (technicalRecords.length !== 20) {
    console.error(`ERROR: Expected exactly 20 technical questions, but found ${technicalRecords.length}`);
  }

  // Verify the 3 Java questions
  let javaCount = 0;
  for (const qId of replacedIds) {
    const rec = technicalRecords.find(r => r.questionId === qId);
    if (!rec) {
      console.error(`ERROR: Record for Q${qId} not found!`);
      continue;
    }
    const expected = newJavaQuestions[qId];
    const isMatch = rec.question === expected.question &&
                    rec.correctAnswer === expected.correctAnswer &&
                    rec.correctOptionNumber === expected.correctOptionNumber &&
                    rec.correctOptionLetter === expected.correctOptionLetter &&
                    rec.image === expected.image &&
                    JSON.stringify(rec.options) === JSON.stringify(expected.options);
    if (isMatch) {
      javaCount++;
      console.log(`✓ Q${qId} Java MCQ Verified: Answer="${rec.correctAnswer}" (Option ${rec.correctOptionLetter}/${rec.correctOptionNumber}), Image="${rec.image}"`);
    } else {
      console.error(`✗ Q${qId} MISMATCH:`, rec);
    }
  }

  // Verify the 17 preserved questions
  let preservedMatchCount = 0;
  for (const qId of preservedIds) {
    const rec = technicalRecords.find(r => r.questionId === qId);
    const original = backupMap.get(qId);
    if (!rec || !original) {
      console.error(`ERROR: Q${qId} missing in record or backup!`);
      continue;
    }
    const isUnchanged = rec.correctAnswer === original.correctAnswer &&
                        rec.explanation === original.explanation &&
                        JSON.stringify(rec.options) === JSON.stringify(original.options) &&
                        rec.correctOptionLetter === original.correctOptionLetter &&
                        rec.correctOptionNumber === original.correctOptionNumber;
    if (isUnchanged) {
      preservedMatchCount++;
      console.log(`✓ Q${qId} Preserved: "${rec.correctAnswer}" (Option ${rec.correctOptionLetter}/${rec.correctOptionNumber})`);
    } else {
      console.error(`✗ Q${qId} was unexpectedly altered! Current:`, rec, 'Original:', original);
    }
  }

  console.log(`\n================ SUMMARY ================`);
  console.log(`Technical section total: ${technicalRecords.length} / 20`);
  console.log(`Java questions: ${javaCount} / 3`);
  console.log(`Preserved questions: ${preservedMatchCount} / 17`);

  if (technicalRecords.length === 20 && javaCount === 3 && preservedMatchCount === 17) {
    console.log(`\n>>> ALL 20 TECHNICAL QUESTIONS VERIFIED SUCCESSFULLY! <<<`);
  } else {
    throw new Error('Verification failed.');
  }

  await mongoose.disconnect();
}

runMigration().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
