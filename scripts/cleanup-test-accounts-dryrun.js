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

// EXACT 5 CANDIDATE IDs IDENTIFIED FROM OCT 13 TEST RUN
const APPROVED_TEST_CANDIDATE_IDS = [
  '6acdef02a9d23d626cfdc919',
  '6acdef5043e6bda24099b255',
  '6acdefa20713d230ff6b2182',
  '6acdefe6bbc371f5dac1cc7d',
  '6acdeff4ad2b7872c21069f0'
];

// Check command line arguments: defaults strictly to DRY RUN mode
const isExecuteMode = process.argv.includes('--execute') && process.argv.includes('--confirm-delete-test-accounts');

async function run() {
  console.log('\n========================================================================');
  console.log('   SAFETY CLEANUP PROTOCOL: LEFTOVER TEST ACCOUNTS IN DVLABS            ');
  console.log('========================================================================\n');
  console.log(`Execution Mode: ${isExecuteMode ? '⚠️ LIVE EXECUTION' : '🛡️ DRY RUN (Read-Only Preview)'}\n`);

  await mongoose.connect(mongoUri, { dbName: 'dvlabs' });
  const db = mongoose.connection.db;

  const candidatesCol = db.collection('candidates');
  const sessionsCol = db.collection('assessmentsessions');

  const targetObjectIds = APPROVED_TEST_CANDIDATE_IDS.map(id => new mongoose.Types.ObjectId(id));

  // 1. Fetch matching candidate records from the explicit allowlist
  const matchingCandidates = await candidatesCol.find({
    _id: { $in: targetObjectIds }
  }).toArray();

  console.log(`Target Allowlist Count:   ${APPROVED_TEST_CANDIDATE_IDS.length}`);
  console.log(`Matching Records in DB:   ${matchingCandidates.length}\n`);

  if (matchingCandidates.length !== APPROVED_TEST_CANDIDATE_IDS.length) {
    console.error('❌ SAFETY ABORT: Number of matching records does not equal expected count (5). Refusing to proceed.');
    await mongoose.disconnect();
    process.exit(1);
  }

  // 2. Validate safety invariants on each candidate
  for (const c of matchingCandidates) {
    const isDomainTest = c.email && c.email.endsWith('@test.com');
    const isTestFullName = c.fullName === 'Test Automation Candidate';
    const isCreatedOct13 = c.createdAt && new Date(c.createdAt).toISOString().startsWith('2026-10-13');

    if (!isDomainTest || !isTestFullName || !isCreatedOct13) {
      console.error(`❌ SAFETY ABORT: Candidate ${c._id} fails test identity validation criteria!`);
      await mongoose.disconnect();
      process.exit(1);
    }

    const linkedSessions = await sessionsCol.find({ candidateId: c._id }).toArray();
    console.log(`Verified Test Record: ${c._id}`);
    console.log(`  FullName:       ${c.fullName}`);
    console.log(`  Domain:         @${c.email.split('@')[1]}`);
    console.log(`  CreatedAt:      ${new Date(c.createdAt).toISOString()}`);
    console.log(`  LinkedSessions: ${linkedSessions.length} (all IN_PROGRESS: ${linkedSessions.every(s => s.status === 'IN_PROGRESS')})`);
  }

  // 3. Execution or Dry Run
  if (!isExecuteMode) {
    console.log('\n------------------------------------------------------------------------');
    console.log('DRY RUN SUMMARY:');
    console.log(`- 5 candidate accounts verified as automated test residue.`);
    console.log(`- ZERO changes were made to the database.`);
    console.log(`- To execute deletion, explicit human confirmation and arguments:`);
    console.log(`  node scripts/cleanup-test-accounts-dryrun.js --execute --confirm-delete-test-accounts`);
    console.log('------------------------------------------------------------------------\n');
  } else {
    console.log('\n⚠️ Executing deletion of 5 approved test accounts and their test sessions...');
    const delSessions = await sessionsCol.deleteMany({ candidateId: { $in: targetObjectIds } });
    const delCandidates = await candidatesCol.deleteMany({ _id: { $in: targetObjectIds } });

    console.log(`✅ Deleted ${delCandidates.deletedCount} candidate records.`);
    console.log(`✅ Deleted ${delSessions.deletedCount} orphaned test sessions.`);
  }

  await mongoose.disconnect();
}

run().catch(err => {
  console.error('Cleanup protocol error:', err);
  process.exit(1);
});
