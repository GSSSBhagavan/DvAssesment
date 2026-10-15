const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config();

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  const hash = await bcrypt.hash('password123', 10);
  const res = await mongoose.connection.db.collection('candidates').updateOne(
    { email: 'g.sivasatyasaibhagavan@gmail.com' },
    { $set: { password: hash, passwordHash: hash } }
  );
  console.log('Update result:', res.modifiedCount, 'matched:', res.matchedCount);
  await mongoose.disconnect();
}

run();
