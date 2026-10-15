import { NextResponse } from 'next/server';
import { requireAuth, JwtPayload } from '@/server/utils/auth';
import connectToDatabase from '@/config/database';
import { StudentAnswer } from '@/server/models/StudentAnswer';
import { AssessmentSession } from '@/server/models/AssessmentSession';
import { Candidate } from '@/server/models/Candidate';
import { auditStudentAnswersWithDb } from '@/server/utils/studentAnswerAuditor';
import mongoose from 'mongoose';

export const GET = requireAuth(async (req: Request, session: JwtPayload, context: any) => {
  // STRICT ACCESS CONTROL: Only authorized company personnel with ADMIN role can view answer audits
  if (session.role !== 'ADMIN') {
    return NextResponse.json(
      { error: 'Forbidden. Access restricted to authorized company administrators only.' },
      { status: 403 }
    );
  }

  try {
    await connectToDatabase();

    // Safely extract route param
    const resolvedParams = context?.params ? await Promise.resolve(context.params) : {};
    const id = resolvedParams.id;

    if (!id || typeof id !== 'string') {
      return NextResponse.json({ error: 'Missing or invalid student/session ID parameter' }, { status: 400 });
    }

    const isValidObjectId = mongoose.Types.ObjectId.isValid(id);

    // 1. Search student_answers collection by sessionId, candidateId, or _id
    let studentAnswer: any = null;
    if (isValidObjectId) {
      studentAnswer = await StudentAnswer.findOne({ sessionId: id }).lean();
      if (!studentAnswer) {
        studentAnswer = await StudentAnswer.findOne({ candidateId: id }).lean();
      }
      if (!studentAnswer) {
        studentAnswer = await StudentAnswer.findById(id).lean();
      }
    }

    // 2. If studentAnswer document exists and has questionAudits populated, return immediately
    if (studentAnswer && Array.isArray(studentAnswer.questionAudits) && studentAnswer.questionAudits.length > 0) {
      return NextResponse.json({
        success: true,
        source: 'cached_audit',
        studentAnswer
      });
    }

    // 3. If studentAnswer exists but questionAudits is missing, backfill in real-time
    if (studentAnswer && Array.isArray(studentAnswer.answers)) {
      const auditResult = await auditStudentAnswersWithDb(studentAnswer.answers);
      const updatedDoc = await StudentAnswer.findOneAndUpdate(
        { _id: studentAnswer._id },
        {
          $set: {
            questionAudits: auditResult.questionAudits,
            marksObtained: auditResult.marksObtained,
            totalMarks: auditResult.totalMarks,
            percentage: auditResult.percentage,
            correctAnswers: auditResult.correctAnswers,
            wrongAnswers: auditResult.wrongAnswers,
            unansweredQuestions: auditResult.unansweredQuestions,
            cutoffMarks: auditResult.cutoffMarks,
            shortlistStatus: auditResult.shortlistStatus,
            isPassed: auditResult.isPassed,
            whyFailedReason: auditResult.whyFailedReason,
            sectionBreakdown: auditResult.sectionBreakdown,
            evaluatedAt: auditResult.evaluatedAt,
            updatedAt: new Date()
          }
        },
        { returnDocument: 'after', lean: true }
      );

      return NextResponse.json({
        success: true,
        source: 'dynamically_audited',
        studentAnswer: updatedDoc || studentAnswer
      });
    }

    // 4. Fallback: Lookup AssessmentSession directly if no StudentAnswer record was found
    if (isValidObjectId) {
      const activeSession = await AssessmentSession.findById(id).lean() ||
        await AssessmentSession.findOne({ candidateId: id }).sort({ createdAt: -1 }).lean();

      if (activeSession) {
        const candidate = await Candidate.findById(activeSession.candidateId).lean();
        const studentName = candidate?.fullName || 'Candidate';
        const studentEmail = candidate?.email || 'unknown@example.com';

        const auditResult = await auditStudentAnswersWithDb(activeSession.answers || []);

        const upserted = await StudentAnswer.findOneAndUpdate(
          { candidateId: activeSession.candidateId, sessionId: activeSession._id },
          {
            $set: {
              studentName,
              studentEmail,
              status: activeSession.status || 'SUBMITTED',
              submittedAt: activeSession.submittedAt || new Date(),
              startedAt: activeSession.startedAt || new Date(),
              answers: activeSession.answers || [],
              totalAnswered: (activeSession.answers || []).length,
              questionAudits: auditResult.questionAudits,
              marksObtained: auditResult.marksObtained,
              totalMarks: auditResult.totalMarks,
              percentage: auditResult.percentage,
              correctAnswers: auditResult.correctAnswers,
              wrongAnswers: auditResult.wrongAnswers,
              unansweredQuestions: auditResult.unansweredQuestions,
              cutoffMarks: auditResult.cutoffMarks,
              shortlistStatus: auditResult.shortlistStatus,
              isPassed: auditResult.isPassed,
              whyFailedReason: auditResult.whyFailedReason,
              sectionBreakdown: auditResult.sectionBreakdown,
              evaluatedAt: auditResult.evaluatedAt,
              updatedAt: new Date()
            }
          },
          { upsert: true, returnDocument: 'after', lean: true }
        );

        return NextResponse.json({
          success: true,
          source: 'session_fallback_audited',
          studentAnswer: upserted
        });
      }
    }

    return NextResponse.json(
      { error: 'Student assessment record not found' },
      { status: 404 }
    );
  } catch (error) {
    console.error('[Admin Student Answers API] Error fetching audit:', error);
    return NextResponse.json(
      { error: 'Internal server error while retrieving student answer audit' },
      { status: 500 }
    );
  }
});
