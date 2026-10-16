import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import connectToDatabase from '@/config/database';
import { Candidate } from '@/server/models/Candidate';
import { setSessionCookie } from '@/server/utils/auth';
import { checkRateLimit } from '@/server/utils/rateLimiter';
import { validateEmail, normalizeEmail } from '@/lib/validation/email';
import { validatePassword, getPasswordPolicyErrorMessage, MAX_PASSWORD_LENGTH } from '@/lib/validation/password';

export async function POST(req: Request) {
  try {
    let body: any;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }

    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'Invalid request payload' }, { status: 400 });
    }

    const rawFullName = typeof body.fullName === 'string' ? body.fullName.trim() : '';
    const rawEmail = typeof body.email === 'string' ? body.email.trim() : '';
    const rawPassword = typeof body.password === 'string' ? body.password : '';

    // 1. Full Name validation
    if (!rawFullName || rawFullName.length < 2) {
      return NextResponse.json({ error: 'Please enter your full name (at least 2 characters).' }, { status: 400 });
    }

    // 2. Email validation
    if (!rawEmail) {
      return NextResponse.json({ error: 'Please enter your email address.' }, { status: 400 });
    }

    if (!validateEmail(rawEmail)) {
      return NextResponse.json({ 
        error: 'Enter a valid email address, such as student@gmail.com.' 
      }, { status: 400 });
    }

    // 3. Password presence and length check
    if (!rawPassword || rawPassword.length === 0) {
      return NextResponse.json({ error: 'Please enter your password.' }, { status: 400 });
    }

    if (rawPassword.length > MAX_PASSWORD_LENGTH) {
      return NextResponse.json({ error: `Password cannot exceed ${MAX_PASSWORD_LENGTH} characters.` }, { status: 400 });
    }

    const normalizedEmail = normalizeEmail(rawEmail);

    // 4. Rate limiting per IP + normalized email (prevents brute force)
    const clientIp = req.headers.get('x-forwarded-for')?.split(',')[0].trim() || '127.0.0.1';
    const rateLimitKey = `login:${clientIp}:${normalizedEmail}`;
    const rateLimitRes = await checkRateLimit(rateLimitKey, 30, 60 * 1000); // 30 attempts per minute
    if (rateLimitRes.isLimited) {
      return NextResponse.json(
        { error: 'Too many login attempts. Please wait a moment and try again.' },
        { status: 429 }
      );
    }

    // 5. Connect to database
    await connectToDatabase();

    // 6. Look up existing candidate record
    let candidate = await Candidate.findOne({ email: normalizedEmail })
      .select('+password +passwordHash');

    if (!candidate) {
      // --- NEW CANDIDATE REGISTRATION ---
      // Enforce the new password complexity policy
      const passwordValidation = validatePassword(rawPassword);
      if (!passwordValidation.isValid) {
        const errorMsg = getPasswordPolicyErrorMessage(rawPassword) || 'Password does not meet complexity requirements.';
        return NextResponse.json({ error: errorMsg }, { status: 400 });
      }

      const passwordHash = await bcrypt.hash(rawPassword, 10);

      try {
        candidate = await Candidate.create({
          email: normalizedEmail,
          fullName: rawFullName,
          passwordHash,
          role: 'CANDIDATE'
        });
      } catch (createErr: any) {
        // Handle race condition: simultaneous creation attempt with the same email
        if (createErr?.code === 11000 || createErr?.name === 'MongoServerError') {
          candidate = await Candidate.findOne({ email: normalizedEmail })
            .select('+password +passwordHash');
          if (!candidate) {
            return NextResponse.json({ error: 'Registration conflict occurred. Please retry.' }, { status: 409 });
          }
          let isMatch = false;
          if (candidate.passwordHash) {
            isMatch = await bcrypt.compare(rawPassword, candidate.passwordHash);
          } else if (candidate.password) {
            isMatch = candidate.password === rawPassword;
          }
          if (!isMatch) {
            return NextResponse.json({ error: 'Invalid email or password.' }, { status: 401 });
          }
        } else {
          throw createErr;
        }
      }
    } else {
      // --- EXISTING CANDIDATE SIGN IN ---
      // Verify existing password (does NOT block existing passwords from logging in)
      let isMatch = false;
      if (candidate.passwordHash) {
        isMatch = await bcrypt.compare(rawPassword, candidate.passwordHash);
      } else if (candidate.password) {
        // Legacy plaintext migration check
        isMatch = candidate.password === rawPassword;
        if (isMatch) {
          candidate.passwordHash = await bcrypt.hash(rawPassword, 10);
          candidate.password = undefined;
          await candidate.save();
        }
      }

      if (!isMatch) {
        return NextResponse.json({ error: 'Invalid email or password.' }, { status: 401 });
      }

      // Update full name if the candidate updated their name
      if (rawFullName && rawFullName.length >= 2 && candidate.fullName !== rawFullName) {
        candidate.fullName = rawFullName;
        await candidate.save();
      }
    }

    // 7. Set authoritative HTTP-only session cookie
    await setSessionCookie({
      candidateId: candidate._id.toString(),
      role: candidate.role || 'CANDIDATE',
      email: candidate.email
    });

    // 8. Return safe candidate profile without sensitive fields
    return NextResponse.json({
      success: true,
      user: {
        id: candidate._id.toString(),
        email: candidate.email,
        fullName: candidate.fullName,
        role: candidate.role || 'CANDIDATE'
      }
    });
  } catch (error) {
    console.error('Authentication error occurred during sign in:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
