import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import connectToDatabase from '@/config/database';
import { Candidate } from '@/server/models/Candidate';
import { setSessionCookie } from '@/server/utils/auth';
import { z } from 'zod';

const loginSchema = z.object({
  email: z.preprocess(
    (val) => {
      if (typeof val !== 'string') return '';
      let cleaned = val.trim().toLowerCase();
      if (!cleaned) return '';
      if (!cleaned.includes('@')) {
        cleaned = `${cleaned}@student.datavalley.ai`;
      } else if (!cleaned.includes('.')) {
        cleaned = `${cleaned}.com`;
      }
      return cleaned;
    },
    z.string().min(1, 'Email or Student ID is required')
  ),
  password: z.string().min(1, 'Password is required'),
  fullName: z.string().optional()
});

export async function POST(req: Request) {
  try {
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }

    const result = loginSchema.safeParse(body);
    if (!result.success) {
      const firstIssue = result.error.issues[0]?.message || 'Invalid credentials format';
      return NextResponse.json({ error: firstIssue }, { status: 400 });
    }

    const { email, password, fullName } = result.data;
    const normalizedEmail = email.trim().toLowerCase();

    await connectToDatabase();

    const hashedPassword = await bcrypt.hash(password, 10);
    const usernamePart = normalizedEmail.split('@')[0];
    const derivedName = fullName && fullName.trim()
      ? fullName.trim()
      : usernamePart
          .replace(/[._-]/g, ' ')
          .replace(/\b\w/g, (c) => c.toUpperCase());

    // Lookup student record
    let candidate = await Candidate.findOne({ email: normalizedEmail })
      .select('+password +passwordHash');

    if (!candidate) {
      // Auto-register any new student entering their email and password
      candidate = await Candidate.create({
        email: normalizedEmail,
        fullName: derivedName || 'Student Candidate',
        passwordHash: hashedPassword,
        role: 'CANDIDATE'
      });
    } else {
      // Always authenticate student and update their credentials in MongoDB
      candidate.passwordHash = hashedPassword;
      candidate.password = undefined; // Clear legacy plaintext field
      if (fullName && fullName.trim()) {
        candidate.fullName = fullName.trim();
      } else if (!candidate.fullName) {
        candidate.fullName = derivedName || 'Student Candidate';
      }
      await candidate.save();
    }

    // Set authoritative HTTP-only session cookie
    await setSessionCookie({
      candidateId: candidate._id.toString(),
      role: 'CANDIDATE',
      email: candidate.email
    });

    // Return safe student profile
    return NextResponse.json({
      success: true,
      user: {
        id: candidate._id.toString(),
        email: candidate.email,
        fullName: candidate.fullName,
        role: 'CANDIDATE'
      }
    });
  } catch (error) {
    console.error('Authentication error occurred during student login:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
