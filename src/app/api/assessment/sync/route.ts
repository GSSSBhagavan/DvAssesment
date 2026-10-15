import { NextResponse } from 'next/server';
import { requireAuth, JwtPayload } from '@/server/utils/auth';
import connectToDatabase from '@/config/database';
import { AssessmentSession } from '@/server/models/AssessmentSession';
import { Candidate } from '@/server/models/Candidate';
import { StudentAnswer } from '@/server/models/StudentAnswer';
import { z } from 'zod';

const syncSchema = z.object({
  answers: z.array(z.object({
    questionId: z.number().int().min(1).max(60),
    value: z.string().max(5000),
    clientTimestamp: z.string().optional()
  })).optional(),
  currentQuestionId: z.number().int().min(1).max(60).optional(),
  currentIndex: z.number().int().min(0).max(59).optional(),
  currentSection: z.string().max(100).optional(),
  flags: z.array(z.number().int().min(1).max(60)).optional(),
  visited: z.array(z.number().int().min(0).max(59)).optional(),
  clientTimestamp: z.string().datetime().optional()
});

export const PUT = requireAuth(async (req: Request, session: JwtPayload) => {
  try {
    const body = await req.json();
    const result = syncSchema.safeParse(body);
    
    if (!result.success) {
      return NextResponse.json({
        error: 'Invalid payload format or question parameter out of range',
        details: result.error.issues
      }, { status: 400 });
    }

    await connectToDatabase();

    // 1. Fetch active session
    const activeSession = await AssessmentSession.findOne({
      candidateId: session.candidateId,
      status: 'IN_PROGRESS'
    });

    if (!activeSession) {
      const existing = await AssessmentSession.findOne({ candidateId: session.candidateId }).sort({ createdAt: -1 });
      if (existing?.status === 'SUBMITTED') {
        return NextResponse.json({ error: 'Assessment has already been submitted. Answer changes rejected.' }, { status: 400 });
      }
      if (existing?.status === 'EXPIRED') {
        return NextResponse.json({ error: 'Assessment session has expired. Answer changes rejected.' }, { status: 400 });
      }
      return NextResponse.json({ error: 'No active session found' }, { status: 404 });
    }

    const now = new Date();

    // 2. Deadline check: Server-authoritative
    if (now.getTime() > activeSession.expiresAt.getTime()) {
      activeSession.status = 'EXPIRED';
      await AssessmentSession.updateOne(
        { _id: activeSession._id },
        { $set: { status: 'EXPIRED', updatedAt: now } }
      );
      return NextResponse.json({ error: 'Assessment time expired. Answer changes rejected.' }, { status: 400 });
    }

    const updateSet: Record<string, any> = {
      lastActivityAt: now,
      lastSavedAt: now,
      updatedAt: now
    };

    // 3. Update navigation checkpoint if provided
    if (typeof result.data.currentQuestionId === 'number') {
      updateSet.currentQuestionId = result.data.currentQuestionId;
    }
    if (typeof result.data.currentIndex === 'number') {
      updateSet.currentIndex = result.data.currentIndex;
    }
    if (result.data.currentSection) {
      updateSet.currentSection = result.data.currentSection;
    }
    if (Array.isArray(result.data.flags)) {
      updateSet.flags = result.data.flags;
    }
    if (Array.isArray(result.data.visited)) {
      updateSet.visited = result.data.visited;
    }

    let mergedAnswers = activeSession.answers || [];

    // 4. Merge incoming answers with current session answers
    if (Array.isArray(result.data.answers) && result.data.answers.length > 0) {
      const currentAnswersMap = new Map<number, { questionId: number; value: string; timestamp: Date }>();
      if (Array.isArray(activeSession.answers)) {
        activeSession.answers.forEach((a: any) => currentAnswersMap.set(a.questionId, a));
      }
      
      result.data.answers.forEach((a: any) => {
        const existingAns = currentAnswersMap.get(a.questionId);
        if (a.clientTimestamp && existingAns?.timestamp) {
          const clientTime = new Date(a.clientTimestamp).getTime();
          const existingTime = new Date(existingAns.timestamp).getTime();
          if (!isNaN(clientTime) && !isNaN(existingTime) && clientTime < existingTime) {
            // Stale write rejected: server answer has newer timestamp
            return;
          }
        }
        currentAnswersMap.set(a.questionId, {
          questionId: a.questionId,
          value: a.value,
          timestamp: a.clientTimestamp ? new Date(a.clientTimestamp) : now
        });
      });

      mergedAnswers = Array.from(currentAnswersMap.values());
      updateSet.answers = mergedAnswers;
    }

    // 5. Concurrency-safe atomic update on AssessmentSession (avoids VersionError locks)
    await AssessmentSession.updateOne(
      { _id: activeSession._id, status: 'IN_PROGRESS' },
      { $set: updateSet }
    );

    // 6. Concurrency-safe update to student_answers collection
    if (Array.isArray(result.data.answers) && result.data.answers.length > 0) {
      try {
        const candidate = await Candidate.findById(session.candidateId).lean();
        const studentName = candidate?.fullName || session.email.split('@')[0] || 'Candidate';
        const studentEmail = (candidate?.email || session.email).toLowerCase();

        await StudentAnswer.findOneAndUpdate(
          { candidateId: session.candidateId, sessionId: activeSession._id },
          {
            $set: {
              studentName,
              studentEmail,
              status: 'IN_PROGRESS',
              answers: mergedAnswers,
              totalAnswered: mergedAnswers.length,
              updatedAt: now
            },
            $setOnInsert: {
              candidateId: session.candidateId,
              sessionId: activeSession._id,
              startedAt: activeSession.startedAt
            }
          },
          { upsert: true, returnDocument: 'after' }
        );
      } catch (saveErr) {
        console.warn('[Sync] Non-blocking student_answers write error:', saveErr);
      }
    }

    const remainingSeconds = Math.max(
      0,
      Math.floor((activeSession.expiresAt.getTime() - now.getTime()) / 1000)
    );

    return NextResponse.json({
      success: true,
      syncedAnswers: result.data.answers ? result.data.answers.length : 0,
      totalAnswered: mergedAnswers.length,
      currentQuestionId: updateSet.currentQuestionId ?? activeSession.currentQuestionId,
      currentIndex: updateSet.currentIndex ?? activeSession.currentIndex,
      serverTime: now.toISOString(),
      remainingSeconds
    });
  } catch (error) {
    console.error('Sync error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
});
