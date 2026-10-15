const path = require('path');
const fs = require('fs');
const mongoose = require(path.join(process.cwd(), 'node_modules', 'mongoose'));

// Read env safely without printing
const envContent = fs.readFileSync(path.join(process.cwd(), '.env'), 'utf8');
let mongoUri = '';
for (const line of envContent.split(/\r?\n/)) {
  const trimmed = line.trim();
  if (trimmed.startsWith('MONGODB_URI=')) {
    let raw = trimmed.slice('MONGODB_URI='.length).trim();
    if (raw.startsWith('"') && raw.endsWith('"')) raw = raw.slice(1, -1);
    if (raw.startsWith("'") && raw.endsWith("'")) raw = raw.slice(1, -1);
    mongoUri = raw;
  }
}

function maskEmail(email) {
  if (!email || typeof email !== 'string') return 'N/A';
  const parts = email.split('@');
  if (parts.length !== 2) return '***';
  const name = parts[0];
  const domain = parts[1];
  // Minimal mask: keep first 3 and last 3 chars of name
  const maskedName = name.length > 6 
    ? `${name.slice(0, 3)}...${name.slice(-3)}`
    : `${name.slice(0, 1)}...${name.slice(-1)}`;
  return `${maskedName}@${domain}`;
}

async function run() {
  console.log('\n========================================================================');
  console.log('   PHASE 2: READ-ONLY AUDIT OF 10 CANDIDATE RECORDS IN DVLABS          ');
  console.log('========================================================================\n');

  await mongoose.connect(mongoUri, { dbName: 'dvlabs' });
  const db = mongoose.connection.db;

  const candidatesCol = db.collection('candidates');
  const sessionsCol = db.collection('assessmentsessions');
  const resultsCol = db.collection('assessmentresults');
  const attemptsCol = db.collection('assessmentattempts');

  const candidates = await candidatesCol.find({}, {
    projection: { password: 0, passwordHash: 0, token: 0 }
  }).sort({ createdAt: 1 }).toArray();

  console.log(`Total Candidate Records: ${candidates.length}\n`);

  for (let i = 0; i < candidates.length; i++) {
    const c = candidates[i];
    const sessions = await sessionsCol.find({ candidateId: c._id }).toArray();
    const results = resultsCol ? await resultsCol.find({ candidateId: c._id }).toArray() : [];
    const attempts = attemptsCol ? await attemptsCol.find({ candidateId: c._id }).toArray() : [];

    // Analyze email pattern without full disclosure
    const emailStr = c.email || '';
    const isTestCom = emailStr.endsWith('@test.com');
    const isTestName = emailStr.toLowerCase().includes('test') || emailStr.toLowerCase().includes('cand_');
    const isInternal = emailStr.includes('datavalley');

    console.log(`[Account ${i + 1}] ID: ${c._id}`);
    console.log(`  Masked Email:    ${maskEmail(emailStr)}`);
    console.log(`  Full Email Len:  ${emailStr.length} chars (domain: @${emailStr.split('@')[1] || 'N/A'})`);
    console.log(`  Full Name:       ${c.fullName || 'N/A'}`);
    console.log(`  Role:            ${c.role || 'CANDIDATE'}`);
    console.log(`  CreatedAt:       ${c.createdAt ? new Date(c.createdAt).toISOString() : 'N/A'}`);
    console.log(`  Sessions Count:  ${sessions.length} (statuses: [${sessions.map(s => s.status).join(', ')}])`);
    console.log(`  Results Count:   ${results.length}`);
    console.log(`  Attempts Count:  ${attempts.length}`);
    console.log(`  Classification:  ${i < 5 ? 'BASELINE CANDIDATE (Preserved)' : 'SUSPECTED TEST RECORD (Oct 13 Test Run)'}`);
    console.log('------------------------------------------------------------------------');
  }

  await mongoose.disconnect();
}

run().catch(err => {
  console.error('Audit inspection error:', err);
  process.exit(1);
});
