const path = require('path');
const fs = require('fs');
const mongoose = require(path.join(process.cwd(), 'node_modules', 'mongoose'));

// Read env safely without printing
const envContent = fs.readFileSync(path.join(process.cwd(), '.env'), 'utf8');
let targetDb = process.env.MONGODB_DB || 'assesmentsdv';
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
    targetDb = raw;
  }
}

function maskEmail(email) {
  if (!email || typeof email !== 'string') return 'N/A';
  const parts = email.split('@');
  if (parts.length !== 2) return '***';
  const name = parts[0];
  const domain = parts[1];
  const maskedName = name.length > 3 ? name.slice(0, 2) + '***' + name.slice(-1) : name[0] + '***';
  return `${maskedName}@${domain}`;
}

async function run() {
  console.log(`\n--- SAFE READ-ONLY DATABASE AUDIT (${targetDb}) ---`);
  await mongoose.connect(mongoUri, { dbName: targetDb });
  const db = mongoose.connection.db;

  const collections = await db.listCollections().toArray();
  console.log(`Collections in ${targetDb}:`, collections.map(c => c.name));

  const candidatesCol = db.collection('candidates');
  const sessionsCol = db.collection('assessmentsessions');
  const resultsCol = db.collection('assessmentresults');

  const candidateCount = await candidatesCol.countDocuments();
  const sessionCount = sessionsCol ? await sessionsCol.countDocuments() : 0;
  const resultCount = resultsCol ? await resultsCol.countDocuments() : 0;

  console.log(`Total Candidates: ${candidateCount}`);
  console.log(`Total Assessment Sessions: ${sessionCount}`);
  console.log(`Total Assessment Results: ${resultCount}`);

  const candidates = await candidatesCol.find({}, {
    projection: { password: 0, passwordHash: 0, token: 0 }
  }).sort({ createdAt: 1 }).toArray();

  console.log('\nCandidate Record Metadata (Passwords/Hashes Omitted):');
  candidates.forEach((c, idx) => {
    console.log(`[${idx + 1}] ID: ${c._id} | Email: ${maskEmail(c.email)} | Role: ${c.role || 'candidate'} | CreatedAt: ${c.createdAt || 'N/A'}`);
  });

  await mongoose.disconnect();
}

run().catch(err => {
  console.error('Audit inspection error:', err);
  process.exit(1);
});
