import { NextResponse } from 'next/server';
import { requireAuth, JwtPayload } from '@/server/utils/auth';
import connectToDatabase from '@/config/database';
import { AssessmentSession } from '@/server/models/AssessmentSession';

export const GET = requireAuth(async (req: Request, session: JwtPayload) => {
  if (session.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  await connectToDatabase();

  const url = new URL(req.url);
  const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10));
  const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get('limit') || '50', 10)));

  const total = await AssessmentSession.countDocuments();
  const sessions = await AssessmentSession.find()
    .populate('candidateId', 'email fullName')
    .sort({ createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(limit)
    .lean();

  const formattedResults = sessions.map((s: any) => {
    const candidate = s.candidateId;
    const summary = s.scoreSummary || {};
    const totalQuestions = summary.totalQuestions || 60;
    const correctAnswers = typeof summary.correctAnswers === 'number' 
      ? summary.correctAnswers 
      : (summary.total || 0);
    const wrongAnswers = typeof summary.wrongAnswers === 'number'
      ? summary.wrongAnswers
      : Math.max(0, (summary.answeredQuestions || 0) - correctAnswers);
    const unansweredQuestions = typeof summary.unansweredQuestions === 'number'
      ? summary.unansweredQuestions
      : Math.max(0, totalQuestions - (correctAnswers + wrongAnswers));
    const answeredQuestions = typeof summary.answeredQuestions === 'number'
      ? summary.answeredQuestions
      : (correctAnswers + wrongAnswers);

    const timeTakenSeconds = summary.timeTakenSeconds || (
      s.submittedAt
        ? Math.max(0, Math.floor((new Date(s.submittedAt).getTime() - new Date(s.startedAt).getTime()) / 1000))
        : null
    );

    return {
      _id: s._id.toString(),
      sessionId: s._id.toString(),
      candidateId: candidate ? {
        _id: candidate._id?.toString(),
        email: candidate.email,
        fullName: candidate.fullName
      } : null,
      candidateEmail: candidate?.email || 'Unknown',
      candidateName: candidate?.fullName || 'Candidate',
      status: s.status,
      shortlistStatus: s.shortlistStatus || 'PENDING',
      totalQuestions,
      answeredQuestions,
      correctAnswers,
      wrongAnswers,
      unansweredQuestions,
      totalScore: summary.totalScore || correctAnswers,
      maximumScore: summary.maximumScore || 60,
      percentage: summary.percentage || Math.round((correctAnswers / 60) * 1000) / 10,
      scoreSummary: s.scoreSummary,
      sectionBreakdown: summary.sectionBreakdown || [],
      startedAt: s.startedAt,
      submittedAt: s.submittedAt || null,
      timeTakenSeconds,
      strikeCount: s.strikeCount || 0,
      integrityStatus: s.integrityStatus || 'CLEAN',
      createdAt: s.createdAt
    };
  });

  return NextResponse.json({
    results: formattedResults,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit)
    }
  });
});
