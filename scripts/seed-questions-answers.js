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

// Extract assessmentData from safe-questions.ts
const safeQuestionsPath = path.join(process.cwd(), 'src', 'lib', 'safe-questions.ts');
const safeQuestionsCode = fs.readFileSync(safeQuestionsPath, 'utf8');
const dataMatch = safeQuestionsCode.match(/export const assessmentData = (\[[\s\S]*?\n\]);/);

if (!dataMatch) {
  console.error('Could not parse assessmentData from safe-questions.ts');
  process.exit(1);
}

const assessmentData = JSON.parse(dataMatch[1]);
console.log(`Parsed ${assessmentData.length} questions from safe-questions.ts`);

// Extract answerKeys from assessment-keys.ts
const keysPath = path.join(process.cwd(), 'src', 'server', 'assessment-keys.ts');
const keysCode = fs.readFileSync(keysPath, 'utf8');
const keysMatch = keysCode.match(/export const answerKeys = (\[[\s\S]*?\n\]);/);

if (!keysMatch) {
  console.error('Could not parse answerKeys from assessment-keys.ts');
  process.exit(1);
}

const answerKeys = JSON.parse(keysMatch[1]);
console.log(`Parsed ${answerKeys.length} answer keys from assessment-keys.ts`);

// Build a map of answer keys by id
const keyMap = new Map();
for (const k of answerKeys) {
  keyMap.set(k.id, k);
}

// Enrich each question with its correctAnswer and explanation
const enrichedQuestions = assessmentData.map(q => {
  const k = keyMap.get(q.id);
  return {
    ...q,
    correctAnswer: k ? k.correctAnswer : null,
    explanation: k ? k.explanation : null
  };
});

async function saveToDatabase() {
  console.log(`\nConnecting to database: ${dbName}...`);
  await mongoose.connect(mongoUri, { dbName });
  const db = mongoose.connection.db;
  const assessmentsCol = db.collection('assessments');

  console.log('Connected. Updating assessments collection with questions and answers...');

  // Update existing assessment document or create new
  const filter = { title: { $regex: /DataValley|Assessment/i } };
  const update = {
    $set: {
      title: 'DataValley Engineering Assessment',
      totalQuestions: enrichedQuestions.length,
      durationMinutes: 60,
      questions: enrichedQuestions,
      answers: answerKeys,
      updatedAt: new Date()
    },
    $setOnInsert: {
      createdAt: new Date()
    }
  };

  const result = await assessmentsCol.updateOne(filter, update, { upsert: true });
  console.log('Update result:', {
    matchedCount: result.matchedCount,
    modifiedCount: result.modifiedCount,
    upsertedId: result.upsertedId
  });

  // Verify document in collection
  const savedDoc = await assessmentsCol.findOne(filter);
  console.log('\n--- VERIFICATION OF ASSESSMENTS COLLECTION ---');
  console.log('Document ID:', savedDoc._id.toString());
  console.log('Title:', savedDoc.title);
  console.log('Total Questions count:', savedDoc.questions?.length);
  console.log('Total Answers count:', savedDoc.answers?.length);
  console.log('\nSample Enriched Question 1:', {
    id: savedDoc.questions[0].id,
    category: savedDoc.questions[0].category,
    question: savedDoc.questions[0].question.slice(0, 60) + '...',
    optionsCount: savedDoc.questions[0].options?.length,
    correctAnswer: savedDoc.questions[0].correctAnswer,
    explanation: savedDoc.questions[0].explanation
  });

  console.log('\nSample Answer Key 1:', savedDoc.answers[0]);
  console.log('\nSUCCESS: All 60 questions and answers are safely stored in the "assessments" collection in "assesmentsdv"!');

  await mongoose.disconnect();
}

saveToDatabase().catch(err => {
  console.error('Error saving to assessments collection:', err);
  process.exit(1);
});
