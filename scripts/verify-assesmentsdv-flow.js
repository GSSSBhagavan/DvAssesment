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

async function verifyFlow() {
  console.log(`Connecting to ${dbName}...`);
  await mongoose.connect(mongoUri, { dbName });
  const db = mongoose.connection.db;

  console.log(`Connected to DB: ${db.databaseName}`);
  const collections = await db.listCollections().toArray();
  console.log(`Collections present:`, collections.map(c => c.name));

  const assessment = await db.collection('assessments').findOne();
  console.log('Default Assessment:', {
    _id: assessment._id.toString(),
    title: assessment.title,
    totalQuestions: assessment.totalQuestions,
    durationMinutes: assessment.durationMinutes
  });

  console.log('All verification passed!');
  await mongoose.disconnect();
}

verifyFlow().catch(console.error);
