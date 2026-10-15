const mongoose = require('mongoose');
const dotenv = require('dotenv');
const bcrypt = require('bcryptjs');
dotenv.config();

async function check() {
  await mongoose.connect(process.env.MONGODB_URI);
  const candidate = await mongoose.connection.db.collection('candidates').findOne({ email: 'candidate@example.com' });
  if (!candidate) {
    console.log('candidate@example.com not found');
    return;
  }
  const match123 = await bcrypt.compare('password123', candidate.password);
  console.log('Does password123 match?', match123);
  await mongoose.disconnect();
}

check();
