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

async function inspectDb() {
  await mongoose.connect(mongoUri, { dbName });
  const db = mongoose.connection.db;

  const collections = await db.listCollections().toArray();
  console.log('--- ALL COLLECTIONS IN DATABASE:', dbName, '---');
  for (const c of collections) {
    const col = db.collection(c.name);
    const count = await col.countDocuments();
    console.log(`- ${c.name}: ${count} documents`);
    if (count > 0 && (c.name.includes('proctor') || c.name.includes('strike') || c.name.includes('event'))) {
      const sample = await col.find().sort({ _id: -1 }).limit(1).toArray();
      console.log(`  Sample from ${c.name}:`, JSON.stringify(sample[0], null, 2));
    }
  }

  // Specifically check for 'proctored' or 'proctoringevents' or 'proctoring_events'
  const targetNames = ['proctored', 'proctoringevents', 'proctoring_events'];
  for (const t of targetNames) {
    const col = db.collection(t);
    const count = await col.countDocuments().catch(() => 0);
    console.log(`Direct check '${t}': ${count} docs`);
  }

  await mongoose.disconnect();
}

inspectDb().catch(console.error);
