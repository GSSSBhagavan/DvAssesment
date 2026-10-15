import { NextResponse } from 'next/server';
import { requireAuth, JwtPayload } from '@/server/utils/auth';
import connectToDatabase from '@/config/database';
import { AssessmentSession } from '@/server/models/AssessmentSession';
import { generateSectionWiseQuestionOrder } from '@/server/utils/randomization';

export const GET = requireAuth(async (req: Request, session: JwtPayload) => {
  await connectToDatabase();

  const activeSession = await AssessmentSession.findOne({
    candidateId: session.candidateId
  }).sort({ createdAt: -1 });

  if (!activeSession) {
    return NextResponse.json({ session: null });
  }

  const now = new Date();

  // Authoritative deadline evaluation: If active session is past its deadline, transition to EXPIRED
  if (activeSession.status === 'IN_PROGRESS' && now.getTime() > activeSession.expiresAt.getTime()) {
    activeSession.status = 'EXPIRED';
    await AssessmentSession.updateOne(
      { _id: activeSession._id },
      { $set: { status: 'EXPIRED', updatedAt: now } }
    );
  }

  // Backward compatibility migration: If session lacks questionOrder, persist one once
  if (activeSession.status === 'IN_PROGRESS' && (!activeSession.questionOrder || activeSession.questionOrder.length !== 60)) {
    const { questionOrder, questionOrderBySection } = generateSectionWiseQuestionOrder();
    activeSession.questionOrder = questionOrder;
    activeSession.questionOrderBySection = questionOrderBySection;
    await AssessmentSession.updateOne(
      { _id: activeSession._id },
      { $set: { questionOrder, questionOrderBySection } }
    );
  }

  const remainingSeconds = Math.max(
    0,
    Math.floor((activeSession.expiresAt.getTime() - now.getTime()) / 1000)
  );

  return NextResponse.json({
    session: {
      id: activeSession._id.toString(),
      assessmentId: activeSession.assessmentId?.toString(),
      status: activeSession.status,
      startedAt: activeSession.startedAt.toISOString(),
      expiresAt: activeSession.expiresAt.toISOString(),
      serverTime: now.toISOString(),
      remainingSeconds,
      currentQuestionId: activeSession.currentQuestionId || 1,
      currentIndex: activeSession.currentIndex || 0,
      currentSection: activeSession.currentSection || 'Workplace Communication',
      answers: activeSession.answers || [],
      flags: activeSession.flags || [],
      visited: activeSession.visited || [0],
      questionOrder: activeSession.questionOrder,
      questionOrderBySection: activeSession.questionOrderBySection,
      strikeCount: activeSession.strikeCount || 0,
      integrityStatus: activeSession.integrityStatus || 'CLEAN',
      submittedAt: activeSession.submittedAt ? activeSession.submittedAt.toISOString() : null
    }
  });
});
