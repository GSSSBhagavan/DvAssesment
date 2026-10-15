'use client';
import { useAssessmentState } from '@/hooks/useAssessmentState';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import AssessmentCompletion from '@/components/assessment/AssessmentCompletion';
import { stopAllCameraStreams, exitFullscreenSafely } from '@/hooks/useCamera';

interface SectionBreakdownItem {
  sectionId: string;
  sectionName: string;
  totalQuestions: number;
  answeredQuestions: number;
  correctAnswers: number;
  wrongAnswers: number;
  unansweredQuestions: number;
  score: number;
  maximumScore: number;
}

interface DetailedResult {
  sessionId: string;
  status: string;
  shortlistStatus: 'SHORTLISTED' | 'NOT_SHORTLISTED' | 'PENDING';
  totalQuestions: number;
  answeredQuestions: number;
  correctAnswers: number;
  wrongAnswers: number;
  unansweredQuestions: number;
  totalScore: number;
  maximumScore: number;
  percentage: number;
  sectionBreakdown: SectionBreakdownItem[];
  startedAt?: string;
  submittedAt?: string;
  timeTakenSeconds?: number;
}

export default function ResultsPage() {
  const { 
    status, 
    submittedAt, 
    assessmentId,
    resetState 
  } = useAssessmentState();
  
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [isVerifying, setIsVerifying] = useState(true);
  const [isValidSubmission, setIsValidSubmission] = useState(false);
  const [result, setResult] = useState<DetailedResult | null>(null);
  const [candidateName, setCandidateName] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
    let isCancelled = false;

    // Immediately exit fullscreen and release camera hardware on final screen
    exitFullscreenSafely();
    stopAllCameraStreams();
    const t1 = setTimeout(stopAllCameraStreams, 150);
    const t2 = setTimeout(stopAllCameraStreams, 600);

    async function fetchResults() {
      try {
        // 1. Verify user authentication
        let meRes = await fetch('/api/auth/me');
        if (!meRes.ok) {
          if (!isCancelled) {
            router.replace('/login');
          }
          return;
        }

        const meData = await meRes.json().catch(() => ({}));
        if (meData?.user?.fullName) {
          setCandidateName(meData.user.fullName);
        }

        // 2. Fetch server-authoritative finalized assessment result
        const res = await fetch('/api/assessment/results');
        if (res.ok) {
          const data = await res.json();
          if (data.success && data.result) {
            if (!isCancelled) {
              setResult(data.result);
              setIsValidSubmission(true);
              setIsVerifying(false);
            }
            return;
          }
        }

        // 3. Fallback: check session status through /api/assessment/current
        const currentRes = await fetch('/api/assessment/current');
        if (currentRes.ok) {
          const currentData = await currentRes.json();
          if (currentData.session) {
            if (currentData.session.status === 'IN_PROGRESS' || currentData.session.status === 'REVIEW') {
              router.replace('/assessment');
              return;
            } else if (currentData.session.status === 'SUBMITTED' || currentData.session.status === 'EXPIRED') {
              const retryRes = await fetch('/api/assessment/results');
              if (retryRes.ok) {
                const retryData = await retryRes.json();
                if (retryData.result && !isCancelled) {
                  setResult(retryData.result);
                  setIsValidSubmission(true);
                  setIsVerifying(false);
                  return;
                }
              }
            }
          }
        }

        // 4. Check local persisted state
        if (!isCancelled) {
          const local = useAssessmentState.getState();
          if (local.status === 'SUBMITTED' || local.status === 'EXPIRED') {
            setIsValidSubmission(true);
            setIsVerifying(false);
          } else {
            router.replace('/');
          }
        }
      } catch (err) {
        console.error('Error fetching results:', err);
        if (!isCancelled) {
          setIsVerifying(false);
        }
      }
    }

    fetchResults();

    return () => {
      isCancelled = true;
      clearTimeout(t1);
      clearTimeout(t2);
      stopAllCameraStreams();
    };
  }, [router]);

  const handleFinish = async () => {
    resetState();
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch (e) {
      console.error(e);
    }
    if (process.env.NODE_ENV === 'production') {
      router.replace('/login');
    } else {
      router.replace('/');
    }
  };

  if (!mounted || (isVerifying && !isValidSubmission)) {
    return (
      <div className="min-h-screen bg-[#FBFBFD] flex flex-col items-center justify-center p-6 font-sans">
        <div className="w-8 h-8 rounded-full border-2 border-slate-200 border-t-emerald-600 animate-spin mb-3" />
        <p className="text-xs font-mono font-medium uppercase tracking-widest text-slate-500">
          DV Labs · Verifying Submission Status...
        </p>
      </div>
    );
  }

  if (!isValidSubmission && status !== 'SUBMITTED' && status !== 'EXPIRED') {
    return null;
  }

  const effectiveSubmittedAt = result?.submittedAt ? new Date(result.submittedAt).getTime() : (submittedAt || Date.now());
  const effectiveSessionId = result?.sessionId || assessmentId;

  return (
    <div className="min-h-screen bg-[#FAF8F5] text-[#121214] flex flex-col font-sans relative selection:bg-[#2563EB]/15 selection:text-[#2563EB]">
      {/* Main Completion Screen (No Navbar) */}
      <main className="flex-1 flex flex-col items-center justify-center px-4 py-2 sm:py-3 overflow-hidden">
        <AssessmentCompletion
          sessionId={effectiveSessionId}
          submittedAt={effectiveSubmittedAt}
          candidateName={candidateName}
          onHome={() => {
            resetState();
            router.replace('/');
          }}
          onFinish={handleFinish}
        />
      </main>
    </div>
  );
}
