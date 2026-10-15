const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config();

function maskEmail(email) {
  if (!email || typeof email !== 'string') return 'none';
  const parts = email.split('@');
  if (parts.length !== 2) return 'invalid';
  const name = parts[0];
  const domain = parts[1];
  const maskedName = name.length > 2 ? name[0] + '***' + name[name.length - 1] : '***';
  return maskedName + '@' + domain;
}

async function check() {
  await mongoose.connect(process.env.MONGODB_URI);
  const candidates = await mongoose.connection.db.collection('candidates').find({}).toArray();
  console.log('Total candidates:', candidates.length);
  for (const [idx, c] of candidates.entries()) {
    console.log(`Candidate #${idx + 1}:`, {
      id: c._id.toString(),
      maskedEmail: maskEmail(c.email),
      role: c.role,
      hasPassword: !!c.password,
      isBcryptHash: c.password ? c.password.startsWith('$2') : false
    });
  }
  await mongoose.disconnect();
}

check();
