import { NextResponse } from 'next/server';
import { requireAuth, JwtPayload } from '@/server/utils/auth';
import connectToDatabase from '@/config/database';
import { AssessmentSession } from '@/server/models/AssessmentSession';

export const GET = requireAuth(async (req: Request, session: JwtPayload) => {
  await connectToDatabase();

  // Candidate results are strictly restricted to the authenticated candidate
  const submittedSession = await AssessmentSession.findOne({
    candidateId: session.candidateId,
    status: 'SUBMITTED'
  }).sort({ submittedAt: -1 });

  if (!submittedSession) {
    return NextResponse.json(
      { error: 'No finalized assessment result found for this candidate' },
      { status: 404 }
    );
  }

  // Scores are stored only in MongoDB (not exposed to candidate frontend)
  return NextResponse.json({
    success: true,
    result: {
      sessionId: submittedSession._id.toString(),
      status: submittedSession.status,
      startedAt: submittedSession.startedAt.toISOString(),
      submittedAt: submittedSession.submittedAt ? submittedSession.submittedAt.toISOString() : null
    }
  });
});
