const path = require('path');
const fs = require('fs');
const mongoose = require(path.join(process.cwd(), 'node_modules', 'mongoose'));

// Read env
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

// 1. Parse safe-questions.ts
const safeQuestionsPath = path.join(process.cwd(), 'src', 'lib', 'safe-questions.ts');
const safeQuestionsCode = fs.readFileSync(safeQuestionsPath, 'utf8');
const dataMatch = safeQuestionsCode.match(/export const assessmentData = (\[[\s\S]*?\n\]);/);
if (!dataMatch) {
  console.error('Failed to parse assessmentData');
  process.exit(1);
}
const questions = JSON.parse(dataMatch[1]);

// 2. Parse assessment-keys.ts
const keysPath = path.join(process.cwd(), 'src', 'server', 'assessment-keys.ts');
const keysCode = fs.readFileSync(keysPath, 'utf8');
const keysMatch = keysCode.match(/export const answerKeys = (\[[\s\S]*?\n\]);/);
if (!keysMatch) {
  console.error('Failed to parse answerKeys');
  process.exit(1);
}
const answerKeys = JSON.parse(keysMatch[1]);

const qMap = new Map();
for (const q of questions) {
  qMap.set(q.id, q);
}

function getSectionIndex(qId) {
  if (qId >= 11 && qId <= 20) return 1; // Workplace Communication
  if (qId >= 1 && qId <= 10) return 2;  // Email Correspondence
  if (qId >= 31 && qId <= 50) return 3; // Programming
  if (qId >= 21 && qId <= 30) return 4; // Git
  if (qId >= 51 && qId <= 60) return 5; // Technical Aptitude
  return 1;
}

const records = answerKeys.map(k => {
  const q = qMap.get(k.id) || {};
  const isGit = k.id >= 21 && k.id <= 25;
  return {
    questionId: k.id,
    category: q.category || 'General Assessment',
    type: isGit ? 'GIT_COMMAND' : (q.type || 'MULTIPLE_CHOICE'),
    correctAnswer: k.correctAnswer,
    options: q.options || [],
    explanation: k.explanation || '',
    scoreWeight: 1,
    sectionIndex: getSectionIndex(k.id),
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date()
  };
});

async function run() {
  console.log(`\nConnecting to MongoDB Atlas database "${dbName}"...`);
  await mongoose.connect(mongoUri, { dbName });
  const db = mongoose.connection.db;

  // dv_answers collection
  const collectionName = 'dv_answers';
  console.log(`Ensuring collection "${collectionName}" exists in "${db.databaseName}"...`);
  
  const existingCollections = (await db.listCollections().toArray()).map(c => c.name);
  if (!existingCollections.includes(collectionName)) {
    await db.createCollection(collectionName);
    console.log(`Created collection "${collectionName}"`);
  }

  const col = db.collection(collectionName);

  // Ensure unique index on questionId
  await col.createIndex({ questionId: 1 }, { unique: true });
  await col.createIndex({ isActive: 1 });
  console.log('Created index: questionId (unique), isActive');

  // Bulk upsert all 60 answer keys
  const bulkOps = records.map(rec => ({
    updateOne: {
      filter: { questionId: rec.questionId },
      update: { $set: rec },
      upsert: true
    }
  }));

  const res = await col.bulkWrite(bulkOps);
  console.log('Bulk write completed:', {
    matchedCount: res.matchedCount,
    modifiedCount: res.modifiedCount,
    upsertedCount: res.upsertedCount
  });

  const totalCount = await col.countDocuments();
  console.log(`\nTotal answer key documents in "${collectionName}": ${totalCount}`);

  // Fetch samples across modules
  const sample1 = await col.findOne({ questionId: 1 });
  const sample11 = await col.findOne({ questionId: 11 });
  const sample21 = await col.findOne({ questionId: 21 });
  const sample31 = await col.findOne({ questionId: 31 });
  const sample51 = await col.findOne({ questionId: 51 });

  console.log('\n--- SAMPLE STORED ANSWER KEYS IN "dv_answers" ---');
  console.log('Sample Q1 (Email):', {
    qId: sample1.questionId,
    category: sample1.category,
    answer: sample1.correctAnswer
  });
  console.log('Sample Q11 (Communication):', {
    qId: sample11.questionId,
    category: sample11.category,
    answer: sample11.correctAnswer
  });
  console.log('Sample Q21 (Git):', {
    qId: sample21.questionId,
    category: sample21.category,
    answer: sample21.correctAnswer
  });
  console.log('Sample Q31 (Programming):', {
    qId: sample31.questionId,
    category: sample31.category,
    answer: sample31.correctAnswer
  });
  console.log('Sample Q51 (Aptitude):', {
    qId: sample51.questionId,
    category: sample51.category,
    answer: sample51.correctAnswer
  });

  console.log(`\nSUCCESS: All 60 official answer keys are permanently stored in "${collectionName}"!`);
  await mongoose.disconnect();
}

run().catch(err => {
  console.error('Error in seed-dv-answers:', err);
  process.exit(1);
});
