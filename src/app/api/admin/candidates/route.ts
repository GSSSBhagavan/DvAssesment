import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import connectToDatabase from '@/config/database';
import { Candidate } from '@/server/models/Candidate';
import { requireAuth, JwtPayload } from '@/server/utils/auth';
import { z } from 'zod';

import { validatePassword } from '@/lib/validation/password';

const provisionCandidateSchema = z.object({
  email: z.preprocess(
    (val) => (typeof val === 'string' ? val.trim().toLowerCase() : val),
    z.string().email('A valid email address is required')
  ),
  fullName: z.string().trim().min(2, 'Full name must be at least 2 characters'),
  password: z.string()
    .min(8, 'Password must be at least 8 characters long')
    .max(128, 'Password must not exceed 128 characters')
    .refine((pw) => validatePassword(pw).isValid, {
      message: 'Password must satisfy all complexity requirements (uppercase, lowercase, number, special character, min 8 chars)'
    })
});

export const POST = requireAuth(async (req: Request, session: JwtPayload) => {
  // Enforce strict Admin authorization
  if (session.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
  }

  try {
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }

    const result = provisionCandidateSchema.safeParse(body);
    if (!result.success) {
      const message = result.error.issues[0]?.message || 'Invalid candidate data';
      return NextResponse.json({ error: message }, { status: 400 });
    }

    const { email, fullName, password } = result.data;
    const normalizedEmail = email.trim().toLowerCase();

    await connectToDatabase();

    // Check if candidate already exists
    const existing = await Candidate.findOne({ email: normalizedEmail });
    if (existing) {
      return NextResponse.json(
        { error: 'A candidate with this email address already exists' },
        { status: 409 }
      );
    }

    // Hash the password with bcrypt (10 rounds)
    const passwordHash = await bcrypt.hash(password, 10);

    // Create candidate - populate both password and passwordHash for full backwards compatibility
    const newCandidate = await Candidate.create({
      email: normalizedEmail,
      fullName: fullName.trim(),
      password: passwordHash,
      passwordHash: passwordHash,
      role: 'CANDIDATE'
    });

    return NextResponse.json(
      {
        success: true,
        candidate: {
          id: newCandidate._id.toString(),
          email: newCandidate.email,
          fullName: newCandidate.fullName,
          role: newCandidate.role,
          createdAt: newCandidate.createdAt
        }
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Candidate provisioning error');
    return NextResponse.json({ error: 'Failed to provision candidate' }, { status: 500 });
  }
});

export const GET = requireAuth(async (req: Request, session: JwtPayload) => {
  if (session.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
  }

  try {
    await connectToDatabase();

    const candidates = await Candidate.find({ role: 'CANDIDATE' })
      .select('email fullName role createdAt updatedAt')
      .sort({ createdAt: -1 })
      .lean();

    return NextResponse.json({
      candidates: candidates.map((c) => ({
        id: c._id.toString(),
        email: c.email,
        fullName: c.fullName,
        role: c.role,
        createdAt: c.createdAt
      }))
    });
  } catch (error) {
    console.error('Candidate listing error');
    return NextResponse.json({ error: 'Failed to retrieve candidates' }, { status: 500 });
  }
});
