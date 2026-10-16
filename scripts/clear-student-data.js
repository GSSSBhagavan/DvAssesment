const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const COLLECTIONS_TO_CLEAR = [
  'candidates',
  'student_results',
  'student_answers',
  'assessmentsessions',
  'proctoringevents',
  'proctoring_events',
  'ratelimitrecords'
];

async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error('MONGODB_URI is not set in environment.');
  }

  console.log('Connecting to MongoDB...');
  await mongoose.connect(uri);
  const db = mongoose.connection.db;
  console.log(`Connected to database: ${mongoose.connection.name}`);

  // Create timestamped backup folder
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupDir = path.join(__dirname, '..', 'backups', `student_data_backup_${timestamp}`);
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }

  console.log(`\n--- Step 1: Backing up collections to ${backupDir} ---`);
  for (const collName of COLLECTIONS_TO_CLEAR) {
    try {
      const docs = await db.collection(collName).find({}).toArray();
      const filePath = path.join(backupDir, `${collName}.json`);
      fs.writeFileSync(filePath, JSON.stringify(docs, null, 2), 'utf-8');
      console.log(`[BACKUP] Saved ${docs.length} documents from "${collName}" to ${filePath}`);
    } catch (err) {
      console.warn(`[BACKUP WARNING] Could not backup "${collName}": ${err.message}`);
    }
  }

  console.log(`\n--- Step 2: Deleting student documents from collections ---`);
  const deletionSummary = {};
  for (const collName of COLLECTIONS_TO_CLEAR) {
    try {
      const result = await db.collection(collName).deleteMany({});
      deletionSummary[collName] = result.deletedCount;
      console.log(`[DELETED] Cleared ${result.deletedCount} documents from "${collName}"`);
    } catch (err) {
      console.error(`[ERROR] Failed to clear "${collName}": ${err.message}`);
    }
  }

  console.log(`\n--- Step 3: Verifying final collection counts ---`);
  const collections = await db.listCollections().toArray();
  for (const c of collections) {
    const count = await db.collection(c.name).countDocuments();
    console.log(`[VERIFY] ${c.name}: ${count} document(s) remaining`);
  }

  await mongoose.disconnect();
  console.log('\nAll student collections successfully cleared and verified.');
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
