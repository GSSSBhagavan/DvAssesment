import { NextResponse } from 'next/server';
import { requireAuth, JwtPayload } from '@/server/utils/auth';
import connectToDatabase from '@/config/database';
import { AssessmentSession } from '@/server/models/AssessmentSession';
import { Assessment } from '@/server/models/Assessment';
import { generateSectionWiseQuestionOrder } from '@/server/utils/randomization';
import { assessmentData } from '@/lib/safe-questions';
import { answerKeys } from '@/server/assessment-keys';
import { Candidate } from '@/server/models/Candidate';
import { StudentAnswer } from '@/server/models/StudentAnswer';

const ASSESSMENT_DURATION_MINUTES = 60;

export const POST = requireAuth(async (req: Request, session: JwtPayload) => {
  if (session.role !== 'CANDIDATE') {
    return NextResponse.json({ error: 'Admins cannot take assessments' }, { status: 403 });
  }

  await connectToDatabase();

  // Make sure an Assessment document exists with questions and answers
  let assessment = await Assessment.findOne();
  if (!assessment) {
    assessment = await Assessment.create({
      title: 'DataValley Engineering Assessment',
      totalQuestions: assessmentData.length,
      durationMinutes: ASSESSMENT_DURATION_MINUTES,
      questions: assessmentData,
      answers: answerKeys
    });
  } else if (!assessment.questions || assessment.questions.length === 0) {
    assessment.questions = assessmentData;
    assessment.answers = answerKeys;
    await assessment.save();
  }

  const now = new Date();

  // 1. Check for an existing active session for this candidate
  let activeSession = await AssessmentSession.findOne({
    candidateId: session.candidateId,
    assessmentId: assessment._id,
    status: 'IN_PROGRESS'
  });

  if (activeSession) {
    // 2. Exact Timer Check: Has the authoritative deadline passed?
    if (now.getTime() > activeSession.expiresAt.getTime()) {
      activeSession.status = 'EXPIRED';
      await AssessmentSession.updateOne(
        { _id: activeSession._id },
        { $set: { status: 'EXPIRED', updatedAt: now } }
      );
      return NextResponse.json({
        error: 'Assessment time has expired. Attempt finalized.',
        expired: true,
        sessionId: activeSession._id.toString()
      }, { status: 400 });
    }

    // 3. Exact Resume: Candidate is reconnecting to their existing active session!
    // Increment interruption count for auditability without penalizing strikes
    await AssessmentSession.updateOne(
      { _id: activeSession._id },
      { 
        $inc: { interruptionCount: 1 },
        $set: { 
          lastInterruptionAt: now,
          lastActivityAt: now,
          updatedAt: now 
        } 
      }
    );

    const remainingSeconds = Math.max(0, Math.floor((activeSession.expiresAt.getTime() - now.getTime()) / 1000));

    return NextResponse.json({
      success: true,
      resumed: true,
      message: 'Assessment resumed from saved checkpoint',
      assessmentId: activeSession.assessmentId.toString(),
      sessionId: activeSession._id.toString(),
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
      integrityStatus: activeSession.integrityStatus || 'CLEAN'
    });
  }

  // 4. Check if candidate has already submitted this assessment
  const submitted = await AssessmentSession.findOne({
    candidateId: session.candidateId,
    assessmentId: assessment._id,
    status: 'SUBMITTED'
  });

  if (submitted) {
    return NextResponse.json({
      error: 'Assessment has already been submitted',
      alreadySubmitted: true,
      submittedAt: submitted.submittedAt ? submitted.submittedAt.toISOString() : null,
      sessionId: submitted._id.toString()
    }, { status: 400 });
  }

  // 5. Check if an expired session exists
  const expired = await AssessmentSession.findOne({
    candidateId: session.candidateId,
    assessmentId: assessment._id,
    status: 'EXPIRED'
  });

  if (expired) {
    return NextResponse.json({
      error: 'Assessment session has expired and cannot be restarted.',
      expired: true,
      sessionId: expired._id.toString()
    }, { status: 400 });
  }

  // 6. No existing session found: Initialize brand new attempt with section-wise randomized question order
  const expiresAt = new Date(now.getTime() + ASSESSMENT_DURATION_MINUTES * 60000);
  const { questionOrder, questionOrderBySection } = generateSectionWiseQuestionOrder();
  
  const firstQuestionId = questionOrder && questionOrder.length > 0 ? questionOrder[0] : 1;

  try {
    activeSession = await AssessmentSession.create({
      candidateId: session.candidateId,
      assessmentId: assessment._id,
      status: 'IN_PROGRESS',
      startedAt: now,
      expiresAt: expiresAt,
      answers: [],
      currentQuestionId: firstQuestionId,
      currentIndex: 0,
      currentSection: 'Workplace Communication',
      flags: [],
      visited: [0],
      lastActivityAt: now,
      lastSavedAt: now,
      interruptionCount: 0,
      questionOrder,
      questionOrderBySection
    });
  } catch (err: any) {
    if (err.code === 11000) {
      const existing = await AssessmentSession.findOne({
        candidateId: session.candidateId,
        assessmentId: assessment._id,
        status: 'IN_PROGRESS'
      });
      if (existing) {
        const remainingSeconds = Math.max(0, Math.floor((existing.expiresAt.getTime() - now.getTime()) / 1000));
        return NextResponse.json({
          success: true,
          resumed: true,
          message: 'Assessment resumed from saved checkpoint',
          assessmentId: existing.assessmentId.toString(),
          sessionId: existing._id.toString(),
          startedAt: existing.startedAt.toISOString(),
          expiresAt: existing.expiresAt.toISOString(),
          serverTime: now.toISOString(),
          remainingSeconds,
          currentQuestionId: existing.currentQuestionId || 1,
          currentIndex: existing.currentIndex || 0,
          currentSection: existing.currentSection || 'Workplace Communication',
          answers: existing.answers || [],
          flags: existing.flags || [],
          visited: existing.visited || [0],
          questionOrder: existing.questionOrder,
          questionOrderBySection: existing.questionOrderBySection,
          strikeCount: existing.strikeCount || 0,
          integrityStatus: existing.integrityStatus || 'CLEAN'
        });
      }
    }
    throw err;
  }

  // Initialize student record in student_answers collection
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
          startedAt: now,
          updatedAt: now
        },
        $setOnInsert: {
          answers: [],
          totalAnswered: 0
        }
      },
      { upsert: true, returnDocument: 'after' }
    );
  } catch (initErr) {
    console.warn('[Start Assessment] Error initializing student_answers:', initErr);
  }

  const remainingSeconds = ASSESSMENT_DURATION_MINUTES * 60;

  return NextResponse.json({
    success: true,
    resumed: false,
    assessmentId: activeSession.assessmentId.toString(),
    sessionId: activeSession._id.toString(),
    startedAt: activeSession.startedAt.toISOString(),
    expiresAt: activeSession.expiresAt.toISOString(),
    serverTime: now.toISOString(),
    remainingSeconds,
    currentQuestionId: firstQuestionId,
    currentIndex: 0,
    currentSection: 'Workplace Communication',
    answers: [],
    flags: [],
    visited: [0],
    questionOrder: activeSession.questionOrder,
    questionOrderBySection: activeSession.questionOrderBySection,
    strikeCount: 0,
    integrityStatus: 'CLEAN'
  });
});
