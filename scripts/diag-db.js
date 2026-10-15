const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config();

async function check() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.log('STATUS: MONGODB_URI is MISSING from process.env');
    return;
  }
  console.log('STATUS: MONGODB_URI exists (length:', uri.length, ')');
  
  try {
    await mongoose.connect(uri);
    console.log('STATUS: Connected to MongoDB successfully!');
    console.log('STATUS: Database name:', mongoose.connection.name);
    
    const collections = await mongoose.connection.db.listCollections().toArray();
    console.log('STATUS: Collections found:', collections.map(c => c.name));
    
    const candidatesCount = await mongoose.connection.db.collection('candidates').countDocuments();
    console.log('STATUS: Candidates count in candidates collection:', candidatesCount);

    if (candidatesCount > 0) {
      const candidates = await mongoose.connection.db.collection('candidates').find({}).toArray();
      for (const [idx, c] of candidates.entries()) {
        console.log(`STATUS: Candidate #${idx + 1}:`);
        console.log('  Fields present:', Object.keys(c));
        console.log('  Role:', c.role);
        console.log('  Has password field:', typeof c.password, c.password ? `(starts with $2: ${c.password.startsWith('$2')}, len: ${c.password.length})` : '');
        console.log('  Has passwordHash field:', typeof c.passwordHash, c.passwordHash ? `(starts with $2: ${c.passwordHash.startsWith('$2')}, len: ${c.passwordHash.length})` : '');
      }
    } else {
      console.log('STATUS: No candidate records exist in the candidates collection!');
    }

    const usersCount = await mongoose.connection.db.collection('users').countDocuments().catch(() => 0);
    console.log('STATUS: Users count in users collection:', usersCount);

    const assessmentsCount = await mongoose.connection.db.collection('assessmentsessions').countDocuments().catch(() => 0);
    console.log('STATUS: Assessment sessions count:', assessmentsCount);
    
    await mongoose.disconnect();
  } catch (err) {
    console.error('STATUS: Connection or query failed:', err.message);
  }
}

check();
