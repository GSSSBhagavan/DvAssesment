import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

// 1. Read .env without logging secrets
const envPath = path.join(rootDir, '.env');
if (!fs.existsSync(envPath)) {
  console.error('Error: .env file not found at', envPath);
  process.exit(1);
}

const envContent = fs.readFileSync(envPath, 'utf8');
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

if (!mongoUri) {
  console.error('Error: MONGODB_URI not found in .env');
  process.exit(1);
}

// 2. Load safeQuestions and answerKeys to ensure perfect synchronization
const safeQuestionsCode = fs.readFileSync(path.join(rootDir, 'src', 'lib', 'safe-questions.ts'), 'utf8');
const dataMatch = safeQuestionsCode.match(/export const assessmentData = (\[[\s\S]*?\n\]);/);
if (!dataMatch) {
  throw new Error('Failed to parse assessmentData from safe-questions.ts');
}
const allQuestions = JSON.parse(dataMatch[1]);

const keysCode = fs.readFileSync(path.join(rootDir, 'src', 'server', 'assessment-keys.ts'), 'utf8');
const keysMatch = keysCode.match(/export const answerKeys = (\[[\s\S]*?\n\]);/);
if (!keysMatch) {
  throw new Error('Failed to parse answerKeys from assessment-keys.ts');
}
const allKeys = JSON.parse(keysMatch[1]);

const questionMap = new Map();
for (const q of allQuestions) {
  questionMap.set(q.id, q);
}

const keysMap = new Map();
for (const k of allKeys) {
  keysMap.set(k.id, k);
}

// 3. Define the 20 technical questions (IDs 31-50) with their module distributions
const targetIds = Array.from({ length: 20 }, (_, i) => 31 + i);

const newTechnicalRecords = targetIds.map(qId => {
  const q = questionMap.get(qId);
  const k = keysMap.get(qId);
  if (!q) throw new Error(`Missing safe question definition for Q${qId}`);
  if (!k) throw new Error(`Missing answer key definition for Q${qId}`);

  const correctIndex = q.options.indexOf(k.correctAnswer);
  if (correctIndex === -1) {
    throw new Error(`Mismatch: Q${qId} correctAnswer "${k.correctAnswer}" not in options [${q.options.join(', ')}]`);
  }
  const optionLetter = String.fromCharCode(65 + correctIndex);
  const optionNumber = correctIndex + 1;

  let topic = '';
  if (qId <= 35) topic = 'Python Programming';
  else if (qId <= 40) topic = 'Java Programming';
  else if (qId <= 45) topic = 'Frontend & Backend Development';
  else topic = 'Database & Deployment';

  return {
    questionId: qId,
    questionNumber: qId,
    topic,
    category: 'Code Snapshots & Output Analysis',
    type: 'MULTIPLE_CHOICE',
    correctAnswer: k.correctAnswer,
    options: q.options,
    correctOptionNumber: optionNumber,
    correctOptionLetter: optionLetter,
    explanation: k.explanation,
    scoreWeight: 1,
    sectionIndex: 3,
    isActive: true,
    updatedAt: new Date()
  };
});

async function migrate() {
  console.log('====================================================');
  console.log('   MIGRATING TECHNICAL MCQs IN dv_answers COLLECTION');
  console.log('====================================================');
  console.log(`Target database: ${dbName}`);
  console.log(`Total questions to migrate: ${newTechnicalRecords.length} (IDs 31 to 50)`);

  await mongoose.connect(mongoUri, { dbName });
  const db = mongoose.connection.db;
  const col = db.collection('dv_answers');

  // Step A: Backup affected records
  console.log('\n[Step 1] Backing up existing records for Q31-Q50...');
  const existingRecords = await col.find({ questionId: { $in: targetIds } }).toArray();
  console.log(`Found ${existingRecords.length} existing records in MongoDB for IDs 31 to 50.`);

  const backupDir = path.join(rootDir, 'backups');
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }
  const backupFile = path.join(backupDir, `dv_answers_backup_q31_q50_${Date.now()}.json`);
  fs.writeFileSync(backupFile, JSON.stringify(existingRecords, null, 2), 'utf8');
  console.log(`Backup securely written to: ${backupFile}`);

  // Step B: Idempotent upsert of only Q31 to Q50
  console.log('\n[Step 2] Executing idempotent update for Q31-Q50...');
  let updatedCount = 0;
  for (const rec of newTechnicalRecords) {
    const res = await col.updateOne(
      { questionId: rec.questionId },
      { 
        $set: {
          questionId: rec.questionId,
          questionNumber: rec.questionNumber,
          category: rec.category,
          type: rec.type,
          correctAnswer: rec.correctAnswer,
          options: rec.options,
          correctOptionNumber: rec.correctOptionNumber,
          correctOptionLetter: rec.correctOptionLetter,
          explanation: rec.explanation,
          scoreWeight: rec.scoreWeight,
          sectionIndex: rec.sectionIndex,
          isActive: rec.isActive,
          updatedAt: rec.updatedAt
        },
        $setOnInsert: {
          createdAt: new Date()
        }
      },
      { upsert: true }
    );
    if (res.matchedCount > 0 || res.upsertedCount > 0) {
      updatedCount++;
    }
  }
  console.log(`Successfully migrated ${updatedCount} technical questions in dv_answers.`);

  // Step C: Verify persisted records
  console.log('\n[Step 3] Verifying persisted records from MongoDB...');
  const verifiedRecords = await col.find({ questionId: { $in: targetIds } }).sort({ questionId: 1 }).toArray();
  if (verifiedRecords.length !== 20) {
    throw new Error(`Verification failed: Expected 20 records, got ${verifiedRecords.length}`);
  }

  for (const v of verifiedRecords) {
    const expected = newTechnicalRecords.find(r => r.questionId === v.questionId);
    if (!expected) throw new Error(`Unexpected record Q${v.questionId}`);
    if (v.correctAnswer !== expected.correctAnswer) {
      throw new Error(`Q${v.questionId} correctAnswer mismatch! DB: "${v.correctAnswer}", Expected: "${expected.correctAnswer}"`);
    }
    if (v.correctOptionLetter !== expected.correctOptionLetter) {
      throw new Error(`Q${v.questionId} letter mismatch! DB: "${v.correctOptionLetter}", Expected: "${expected.correctOptionLetter}"`);
    }
    if (v.correctOptionNumber !== expected.correctOptionNumber) {
      throw new Error(`Q${v.questionId} number mismatch! DB: ${v.correctOptionNumber}, Expected: ${expected.correctOptionNumber}`);
    }
    if (JSON.stringify(v.options) !== JSON.stringify(expected.options)) {
      throw new Error(`Q${v.questionId} options mismatch!`);
    }
    console.log(`✓ Q${v.questionId} (${expected.topic}): Key "${v.correctOptionLetter}" -> "${v.correctAnswer.slice(0, 35)}..." [OK]`);
  }

  // Step D: Verify non-technical questions remain intact
  console.log('\n[Step 4] Checking total document count and non-technical records...');
  const totalCount = await col.countDocuments();
  console.log(`Total documents in dv_answers: ${totalCount}`);
  if (totalCount !== 60) {
    console.warn(`Warning: Total documents is ${totalCount}, expected 60.`);
  } else {
    console.log('✓ Exactly 60 documents in dv_answers confirmed.');
  }

  const sampleNonTech = await col.findOne({ questionId: 1 });
  console.log(`✓ Sample non-technical record Q1 preserved: "${sampleNonTech?.correctAnswer}"`);

  console.log('\n====================================================');
  console.log('   MIGRATION COMPLETED AND VERIFIED SUCCESSFULLY!');
  console.log('====================================================');

  await mongoose.disconnect();
}

migrate().catch(err => {
  console.error('\nMigration failed with error:', err);
  process.exit(1);
});
