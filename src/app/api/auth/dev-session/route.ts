import { NextResponse } from 'next/server';
import connectToDatabase from '@/config/database';
import { Candidate } from '@/server/models/Candidate';
import { setSessionCookie } from '@/server/utils/auth';

export async function POST(req: Request) {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Dev auth disabled in production' }, { status: 403 });
  }

  try {
    await connectToDatabase();

    // Prefer existing candidate in the database
    let candidate = await Candidate.findOne({ role: 'CANDIDATE' });

    if (!candidate) {
      candidate = await Candidate.create({
        email: 'dev@datavalley.ai',
        fullName: 'Developer Candidate',
        role: 'CANDIDATE'
      });
    }

    await setSessionCookie({
      candidateId: candidate._id.toString(),
      role: candidate.role,
      email: candidate.email
    });

    return NextResponse.json({
      success: true,
      user: {
        id: candidate._id.toString(),
        email: candidate.email,
        fullName: candidate.fullName,
        role: candidate.role
      }
    });
  } catch (error: any) {
    console.error('Dev session error:', error);
    return NextResponse.json({ error: error.message || 'Failed to create dev session' }, { status: 500 });
  }
}

export async function GET(req: Request) {
  return POST(req);
}
