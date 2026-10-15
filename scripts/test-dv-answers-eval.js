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

async function verify() {
  await mongoose.connect(mongoUri, { dbName });
  const db = mongoose.connection.db;

  const col = db.collection('dv_answers');
  const count = await col.countDocuments();
  console.log(`Verified collection "dv_answers" count in ${dbName}: ${count} documents.`);

  const indexes = await col.indexes();
  console.log('Indexes on dv_answers:', indexes.map(i => i.name));

  // Query by questionId
  const q21 = await col.findOne({ questionId: 21 });
  console.log('Query result for questionId 21 (Git):', {
    questionId: q21.questionId,
    category: q21.category,
    type: q21.type,
    correctAnswer: q21.correctAnswer,
    sectionIndex: q21.sectionIndex,
    isActive: q21.isActive
  });

  const q1 = await col.findOne({ questionId: 1 });
  console.log('Query result for questionId 1 (Email):', {
    questionId: q1.questionId,
    category: q1.category,
    correctAnswer: q1.correctAnswer,
    options: q1.options
  });

  await mongoose.disconnect();
}

verify().catch(console.error);
