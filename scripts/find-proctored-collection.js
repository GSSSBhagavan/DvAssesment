const path = require('path');
const fs = require('fs');
const mongoose = require(path.join(process.cwd(), 'node_modules', 'mongoose'));

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

async function findProctored() {
  await mongoose.connect(mongoUri);
  const adminDb = mongoose.connection.db.admin();
  const dbs = await adminDb.listDatabases();
  console.log('Available databases on cluster:');
  for (const d of dbs.databases) {
    console.log(`- ${d.name} (${d.sizeOnDisk} bytes)`);
    const dbInstance = mongoose.connection.client.db(d.name);
    const cols = await dbInstance.listCollections().toArray();
    for (const c of cols) {
      if (c.name.includes('proctor') || c.name.includes('strike')) {
        const count = await dbInstance.collection(c.name).countDocuments();
        console.log(`  * Collection ${d.name}.${c.name}: ${count} docs`);
        if (count > 0) {
          const sample = await dbInstance.collection(c.name).findOne();
          console.log(`    Sample:`, JSON.stringify(sample, null, 2));
        }
      }
    }
  }
  await mongoose.disconnect();
}

findProctored().catch(console.error);
