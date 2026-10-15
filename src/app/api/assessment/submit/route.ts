import { NextResponse } from 'next/server';
import { requireAuth, JwtPayload } from '@/server/utils/auth';
import connectToDatabase from '@/config/database';
import { AssessmentSession } from '@/server/models/AssessmentSession';
import { Candidate } from '@/server/models/Candidate';
import { StudentAnswer } from '@/server/models/StudentAnswer';
import { recordStudentEvaluationResult } from '@/server/models/StudentResult';
import { evaluateAssessmentWithDb } from '@/server/utils/evaluation';
import { ProctoringRecord } from '@/server/models/ProctoringRecord';

export const POST = requireAuth(async (req: Request, session: JwtPayload) => {
  try {
    await connectToDatabase();

    // 1. Fetch candidate profile for authoritative studentName and studentEmail
    const candidate = await Candidate.findById(session.candidateId).lean();
    const studentName = candidate?.fullName || session.email.split('@')[0] || 'Candidate';
    const studentEmail = (candidate?.email || session.email).toLowerCase();

    // 2. Idempotency check: Return existing result safely if already finalized
    const existingSubmitted = await AssessmentSession.findOne({
      candidateId: session.candidateId,
      status: 'SUBMITTED'
    });
    if (existingSubmitted) {
      return NextResponse.json({
        success: true,
        alreadySubmitted: true,
        message: 'Assessment has already been submitted',
        submittedAt: existingSubmitted.submittedAt ? existingSubmitted.submittedAt.toISOString() : null
      });
    }

    // 3. Fetch active session strictly with IN_PROGRESS status
    const activeSession = await AssessmentSession.findOne({
      candidateId: session.candidateId,
      status: 'IN_PROGRESS'
    });

    if (!activeSession) {
      const expiredSession = await AssessmentSession.findOne({
        candidateId: session.candidateId,
        status: 'EXPIRED'
      });
      if (expiredSession) {
        return NextResponse.json(
          { error: 'Assessment session has expired and cannot be submitted.' },
          { status: 400 }
        );
      }
      return NextResponse.json({ error: 'No active assessment session found' }, { status: 404 });
    }

    // 4. Enforce server-authoritative deadline (with 10-second network flight grace window)
    const now = new Date();
    const SUBMISSION_GRACE_PERIOD_MS = 10000;
    if (now.getTime() > activeSession.expiresAt.getTime() + SUBMISSION_GRACE_PERIOD_MS) {
      activeSession.status = 'EXPIRED';
      await activeSession.save();
      return NextResponse.json(
        { error: 'Assessment time has expired. Submission rejected.' },
        { status: 400 }
      );
    }

    // 5. Safely merge any answers from the submit payload (if provided) before evaluation
    try {
      const cloned = req.clone();
      const body = await cloned.json().catch(() => null);
      if (body && Array.isArray(body.answers) && body.answers.length > 0) {
        const answersMap = new Map();
        activeSession.answers.forEach((a: any) => answersMap.set(a.questionId, a));
        for (const a of body.answers) {
          if (a && typeof a.questionId === 'number' && a.value !== undefined) {
            answersMap.set(a.questionId, {
              questionId: a.questionId,
              value: String(a.value),
              timestamp: new Date()
            });
          }
        }
        activeSession.answers = Array.from(answersMap.values());
      }
    } catch {
      // Body was empty or not JSON, evaluate existing activeSession.answers from MongoDB
    }

    // 6. Save final candidate answers to student_answers collection
    try {
      await StudentAnswer.findOneAndUpdate(
        { candidateId: session.candidateId, sessionId: activeSession._id },
        {
          $set: {
            studentName,
            studentEmail,
            status: 'SUBMITTED',
            submittedAt: now,
            answers: activeSession.answers,
            totalAnswered: activeSession.answers.length,
            updatedAt: now
          },
          $setOnInsert: {
            startedAt: activeSession.startedAt
          }
        },
        { upsert: true, returnDocument: 'after' }
      );
    } catch (saveAnswerErr) {
      console.warn('[Submit] Error saving to student_answers:', saveAnswerErr);
    }

    // 7. Calculate score using realtime authoritative dv_answers collection from MongoDB
    // MCQ: +1 for correct option, 0 for wrong (no negative marking)
    // Git: +1 for regex match, 0 for wrong
    const evaluation = await evaluateAssessmentWithDb(activeSession.answers);
    const shortlistStatus = evaluation.shortlistStatus;
    const timeTakenSeconds = Math.max(
      0,
      Math.floor((now.getTime() - activeSession.startedAt.getTime()) / 1000)
    );

    const fullScoreSummary = {
      ...evaluation,
      timeTakenSeconds
    };

    // 8. Save evaluation result into student_results collection in MongoDB (both individual doc & master all-students array)
    try {
      await recordStudentEvaluationResult({
        candidateId: session.candidateId,
        sessionId: activeSession._id,
        studentName,
        studentEmail,
        marksObtained: evaluation.totalScore,
        totalMarks: 60,
        percentage: evaluation.percentage,
        mcqMarks: evaluation.mcq,
        gitMarks: evaluation.git,
        correctAnswers: evaluation.correctAnswers,
        wrongAnswers: evaluation.wrongAnswers,
        unansweredQuestions: evaluation.unansweredQuestions,
        shortlistStatus: evaluation.shortlistStatus,
        sectionBreakdown: evaluation.sectionBreakdown,
        detailedBreakdown: evaluation.breakdown,
        timeTakenSeconds,
        submittedAt: now
      });
    } catch (saveResultErr) {
      console.error('[Submit] Error recording to student_results:', saveResultErr);
    }

    // 9. Concurrency control: Atomically transition status from IN_PROGRESS to SUBMITTED
    const finalizedSession = await AssessmentSession.findOneAndUpdate(
      { _id: activeSession._id, status: 'IN_PROGRESS' },
      {
        $set: {
          status: 'SUBMITTED',
          submittedAt: now,
          shortlistStatus,
          scoreSummary: fullScoreSummary
        }
      },
      { returnDocument: 'after' }
    );

    if (!finalizedSession) {
      // Check if a concurrent request already submitted the session
      const concurrentSession = await AssessmentSession.findOne({
        candidateId: session.candidateId,
        status: 'SUBMITTED'
      });
      if (concurrentSession) {
        return NextResponse.json({
          success: true,
          alreadySubmitted: true,
          message: 'Assessment has already been submitted',
          submittedAt: concurrentSession.submittedAt ? concurrentSession.submittedAt.toISOString() : now.toISOString()
        });
      }
      return NextResponse.json({ error: 'Concurrent submission conflict' }, { status: 409 });
    }

    // 10. Update ProctoringRecord final status safely
    try {
      const finalProctoringStatus = (finalizedSession.strikeCount || 0) >= 6 ? 'REVIEW_REQUIRED' : 'COMPLETED';
      await ProctoringRecord.findOneAndUpdate(
        { sessionId: finalizedSession._id },
        {
          $set: {
            status: finalProctoringStatus,
            updatedAt: now
          }
        }
      );
    } catch (procErr) {
      console.warn('[Submit] Notice updating ProctoringRecord status:', procErr);
    }

    // Return safe confirmation to candidate frontend (scores stored only in MongoDB)
    return NextResponse.json({
      success: true,
      message: 'Assessment submitted successfully',
      submittedAt: (finalizedSession.submittedAt || now).toISOString()
    });
  } catch (error) {
    console.error('Submission route error:', error);
    return NextResponse.json({ error: 'Internal server error during submission' }, { status: 500 });
  }
});
