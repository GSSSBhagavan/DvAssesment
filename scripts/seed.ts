import bcrypt from 'bcryptjs';
import connectToDatabase from '../src/config/database';
import { Candidate } from '../src/server/models/Candidate';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

async function seed() {
  await connectToDatabase();
  
  const adminEmail = 'bhagavan@datavalley.ai'; // Or any specific email
  const adminPass = 'bhagavan123';
  const hashedPassword = await bcrypt.hash(adminPass, 10);
  
  const existing = await Candidate.findOne({ email: adminEmail });
  if (!existing) {
    await Candidate.create({
      email: adminEmail,
      fullName: 'bhagavan',
      password: hashedPassword,
      role: 'ADMIN'
    });
    console.log('Admin user created successfully.');
  } else {
    console.log('Admin user already exists.');
  }
  
  // Create a test candidate as well
  const candidateEmail = 'candidate@example.com';
  const candPass = 'password123';
  if (!(await Candidate.findOne({ email: candidateEmail }))) {
    await Candidate.create({
      email: candidateEmail,
      fullName: 'Test Candidate',
      password: await bcrypt.hash(candPass, 10),
      role: 'CANDIDATE'
    });
    console.log('Test candidate created successfully.');
  }
  
  process.exit(0);
}

seed().catch(console.error);
