const path = require('path');
const fs = require('fs');
const mongoose = require(path.join(process.cwd(), 'node_modules', 'mongoose'));

// Read env safely
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

async function initDatabase() {
  console.log(`Connecting to MongoDB Atlas cluster for database: "${dbName}"...`);
  
  await mongoose.connect(mongoUri, {
    dbName: dbName,
    bufferCommands: false,
  });

  const db = mongoose.connection.db;
  console.log(`Successfully connected to database: ${db.databaseName}`);

  // Create/Ensure collections exist
  const existingCollections = (await db.listCollections().toArray()).map(c => c.name);
  console.log('Existing collections before initialization:', existingCollections);

  const targetCollections = ['candidates', 'assessments', 'assessmentsessions', 'proctoringevents'];

  for (const colName of targetCollections) {
    if (!existingCollections.includes(colName)) {
      await db.createCollection(colName);
      console.log(`Created collection: "${colName}"`);
    } else {
      console.log(`Collection already exists: "${colName}"`);
    }
  }

  // Ensure default Assessment document exists in 'assessments'
  const assessmentsCol = db.collection('assessments');
  const existingAssessment = await assessmentsCol.findOne();
  if (!existingAssessment) {
    const defaultAssessment = {
      title: 'DataValley Engineering Assessment',
      totalQuestions: 60,
      durationMinutes: 60,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    const res = await assessmentsCol.insertOne(defaultAssessment);
    console.log(`Initialized default Assessment document: ${res.insertedId}`);
  } else {
    console.log(`Assessment document already configured: "${existingAssessment.title}"`);
  }

  // Check indexes
  const candidatesCol = db.collection('candidates');
  await candidatesCol.createIndex({ email: 1 }, { unique: true });
  console.log('Verified index: candidates.email (unique)');

  const sessionsCol = db.collection('assessmentsessions');
  await sessionsCol.createIndex({ candidateId: 1, assessmentId: 1, status: 1 });
  console.log('Verified index: assessmentsessions (candidateId, assessmentId, status)');

  const proctorCol = db.collection('proctoringevents');
  await proctorCol.createIndex({ sessionId: 1, eventType: 1, serverTimestamp: -1 });
  console.log('Verified index: proctoringevents (sessionId, eventType, serverTimestamp)');

  // Final check
  const finalCollections = (await db.listCollections().toArray()).map(c => c.name);
  console.log(`\nFinal collections in "${db.databaseName}":`, finalCollections);
  console.log('Database initialization completed successfully.');

  await mongoose.disconnect();
}

initDatabase().catch(err => {
  console.error('Initialization error:', err);
  process.exit(1);
});
