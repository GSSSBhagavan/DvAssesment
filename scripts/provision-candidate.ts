import bcrypt from 'bcryptjs';
import connectToDatabase from '../src/config/database';
import { Candidate } from '../src/server/models/Candidate';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

async function provisionCandidate() {
  const args = process.argv.slice(2);
  const getArg = (name: string): string | null => {
    const idx = args.indexOf(`--${name}`);
    if (idx !== -1 && idx + 1 < args.length) return args[idx + 1];
    return null;
  };

  const email = getArg('email');
  const fullName = getArg('name');
  const password = getArg('password');

  if (!email || !fullName || !password) {
    console.error('Usage: npx tsx scripts/provision-candidate.ts --email <email> --name "<name>" --password <password>');
    process.exit(1);
  }

  const normalizedEmail = email.trim().toLowerCase();
  if (!normalizedEmail.includes('@') || !normalizedEmail.includes('.')) {
    console.error('Error: Invalid email format.');
    process.exit(1);
  }

  if (password.length < 8) {
    console.error('Error: Password must be at least 8 characters long.');
    process.exit(1);
  }

  await connectToDatabase();

  const existing = await Candidate.findOne({ email: normalizedEmail });
  if (existing) {
    console.error(`Error: A candidate with email already exists in the database.`);
    process.exit(1);
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const candidate = await Candidate.create({
    email: normalizedEmail,
    fullName: fullName.trim(),
    password: passwordHash,
    passwordHash: passwordHash,
    role: 'CANDIDATE'
  });

  console.log('Candidate provisioned successfully:');
  console.log(`  ID: ${candidate._id}`);
  console.log(`  Role: ${candidate.role}`);
  console.log(`  Created At: ${candidate.createdAt}`);
  process.exit(0);
}

provisionCandidate().catch((err) => {
  console.error('Provisioning failed:', err.message);
  process.exit(1);
});
