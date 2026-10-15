import { NextResponse } from 'next/server';
import { requireAuth, JwtPayload } from '@/server/utils/auth';
import connectToDatabase from '@/config/database';
import { Candidate } from '@/server/models/Candidate';

export const GET = requireAuth(async (req: Request, session: JwtPayload) => {
  await connectToDatabase();
  
  const candidate = await Candidate.findById(session.candidateId);
  if (!candidate) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  return NextResponse.json({
    user: {
      id: candidate._id,
      email: candidate.email,
      fullName: candidate.fullName,
      role: candidate.role
    }
  });
});
