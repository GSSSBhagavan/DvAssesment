import { NextResponse } from 'next/server';
import { requireAuth, JwtPayload } from '@/server/utils/auth';
import connectToDatabase from '@/config/database';
import { AssessmentSession } from '@/server/models/AssessmentSession';

export const POST = requireAuth(async (req: Request, session: JwtPayload) => {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Assessment reset is only available in development' }, { status: 403 });
  }

  try {
    await connectToDatabase();

    await AssessmentSession.deleteMany({
      candidateId: session.candidateId
    });

    return NextResponse.json({
      success: true,
      message: 'Assessment session reset successfully for development'
    });
  } catch (error: any) {
    console.error('Reset assessment error:', error);
    return NextResponse.json({ error: error.message || 'Failed to reset assessment' }, { status: 500 });
  }
});
