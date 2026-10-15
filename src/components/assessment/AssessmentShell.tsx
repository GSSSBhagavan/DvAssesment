'use client';
import { useEffect, useState, useRef } from 'react';
import { useAssessmentState } from '@/hooks/useAssessmentState';
import { useRouter } from 'next/navigation';
import AssessmentHeader from './AssessmentHeader';
import AssessmentSidebar from './AssessmentSidebar';
import QuestionRenderer from './QuestionRenderer';
import AntiCheatMonitor from '@/components/integrity/AntiCheatMonitor';
import ReviewPanel from '@/components/review/ReviewPanel';
import SubmitConfirmationModal from './SubmitConfirmationModal';
import { AnimatePresence, motion } from 'framer-motion';
import assessmentData, { getOrderedQuestions } from '@/lib/safe-questions';
import { WifiOff, CheckCircle2, RefreshCw } from 'lucide-react';
import { useDebounce } from 'use-debounce';

export default function AssessmentShell() {
  const {
    status,
    currentIndex,
    setShowSubmitModal,
    isSubmitting,
    answers,
    flags,
    visited,
    questionOrder,
    setSaveStatus,
    resumeNotification,
    setResumeNotification
  } = useAssessmentState();

  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [isOffline, setIsOffline] = useState(false);
  const [isReconnecting, setIsReconnecting] = useState(false);

  const [debouncedAnswers] = useDebounce(answers, 2000); // 2 second debounce for network sync
  const latestReqIdRef = useRef(0);

  // Autosave: Persist answers, current question index, flags and navigation checkpoints
  useEffect(() => {
    if (status === 'IN_PROGRESS' && Object.keys(debouncedAnswers).length > 0) {
      if (!navigator.onLine) {
        setSaveStatus('OFFLINE');
        return;
      }

      const currentReqId = ++latestReqIdRef.current;
      setSaveStatus('SAVING');

      const answersPayload = Object.entries(debouncedAnswers).map(([id, val]) => ({
        questionId: Number(id),
        value: val as string
      }));

      const questions = getOrderedQuestions(questionOrder);
      const currentQ = questions[currentIndex];
      const flagsArray = Object.entries(flags)
        .filter(([_, v]) => v)
        .map(([k]) => Number(k));
      const visitedArray = Object.entries(visited)
        .filter(([_, v]) => v)
        .map(([k]) => Number(k));

      fetch('/api/assessment/sync', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          answers: answersPayload,
          currentIndex,
          currentQuestionId: currentQ ? currentQ.id : undefined,
          currentSection: currentQ ? currentQ.category : undefined,
          flags: flagsArray,
          visited: visitedArray
        })
      })
        .then(async (res) => {
          if (currentReqId !== latestReqIdRef.current) return;
          if (res.ok) {
            const data = await res.json();
            if (data.success) {
              setSaveStatus('SAVED');
            } else {
              setSaveStatus('ERROR');
            }
          } else {
            setSaveStatus('ERROR');
          }
        })
        .catch((err) => {
          if (currentReqId !== latestReqIdRef.current) return;
          console.error('Autosave network error:', err);
          setSaveStatus(navigator.onLine ? 'ERROR' : 'OFFLINE');
        });
    }
  }, [debouncedAnswers, status, currentIndex, flags, visited, questionOrder, setSaveStatus]);

  // Session Recovery & Reconnection on mount or page load
  useEffect(() => {
    setMounted(true);
    if (status === 'SUBMITTED') {
      router.replace('/results');
      return;
    }

    // Always fetch authoritative server session on mount to guarantee exact timer and question recovery
    fetch('/api/assessment/current')
      .then(r => r.json())
      .then(curr => {
        if (curr.session) {
          if (curr.session.status === 'SUBMITTED' || curr.session.status === 'EXPIRED') {
            useAssessmentState.setState({
              status: curr.session.status,
              assessmentId: curr.session.id,
              startTime: new Date(curr.session.startedAt).getTime(),
              endTime: new Date(curr.session.expiresAt).getTime(),
              questionOrder: curr.session.questionOrder || null,
              submittedAt: curr.session.submittedAt ? new Date(curr.session.submittedAt).getTime() : Date.now()
            });
            router.replace('/results');
          } else if (curr.session.status === 'IN_PROGRESS') {
            // Reconcile server authoritative answers
            const serverAnswers: Record<number, string> = {};
            if (Array.isArray(curr.session.answers)) {
              for (const a of curr.session.answers) {
                if (a && typeof a.questionId === 'number' && typeof a.value === 'string') {
                  serverAnswers[a.questionId] = a.value;
                }
              }
            }

            // Restore flags
            const serverFlags: Record<number, boolean> = {};
            if (Array.isArray(curr.session.flags)) {
              for (const fid of curr.session.flags) {
                if (typeof fid === 'number') serverFlags[fid] = true;
              }
            }

            // Restore visited
            const serverVisited: Record<number, boolean> = { 0: true };
            if (Array.isArray(curr.session.visited)) {
              for (const vid of curr.session.visited) {
                if (typeof vid === 'number') serverVisited[vid] = true;
              }
            }

            const targetIndex = typeof curr.session.currentIndex === 'number' ? curr.session.currentIndex : 0;
            serverVisited[targetIndex] = true;

            const currentLocal = useAssessmentState.getState().answers || {};
            const currentStatus = useAssessmentState.getState().status;
            const targetStatus = currentStatus === 'REVIEW' ? 'REVIEW' : 'IN_PROGRESS';

            useAssessmentState.setState({
              status: targetStatus,
              startTime: new Date(curr.session.startedAt).getTime(),
              endTime: new Date(curr.session.expiresAt).getTime(),
              assessmentId: curr.session.id,
              questionOrder: curr.session.questionOrder || null,
              currentIndex: targetIndex,
              currentQuestionId: curr.session.currentQuestionId || null,
              currentSection: curr.session.currentSection || null,
              answers: { ...serverAnswers, ...currentLocal },
              flags: serverFlags,
              visited: serverVisited,
              strikeCount: curr.session.strikeCount || 0,
              proctoringStatus: curr.session.integrityStatus === 'REVIEW_REQUIRED'
                ? 'REVIEW_REQUIRED'
                : curr.session.integrityStatus === 'WARNING'
                ? 'WARNING'
                : 'NORMAL',
              resumeNotification: (targetIndex > 0 || Object.keys(serverAnswers).length > 0)
                ? `Assessment resumed. Restored to Question ${targetIndex + 1} with ${Object.keys(serverAnswers).length} saved answers.`
                : null
            });
          }
        } else {
          router.replace('/');
        }
      })
      .catch(() => {
        router.replace('/');
      });
  }, [router]);

  // Network Offline & Online Event Handling with Auto-Reconnection
  useEffect(() => {
    const handleOffline = () => {
      setIsOffline(true);
      setSaveStatus('OFFLINE');
    };

    const handleOnline = async () => {
      setIsReconnecting(true);
      try {
        // Validate actual backend reachability
        const res = await fetch('/api/assessment/current');
        if (res.ok) {
          setIsOffline(false);
          setSaveStatus('SAVING');
          // Flush answers to sync endpoint
          const currentAnswers = useAssessmentState.getState().answers;
          const answersPayload = Object.entries(currentAnswers).map(([id, val]) => ({
            questionId: Number(id),
            value: val as string
          }));
          await fetch('/api/assessment/sync', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ answers: answersPayload })
          });
          setSaveStatus('SAVED');
          setResumeNotification('Connection restored. All progress synchronized with server.');
        }
      } catch (e) {
        console.warn('Reconnection ping failed:', e);
      } finally {
        setIsReconnecting(false);
      }
    };

    window.addEventListener('offline', handleOffline);
    window.addEventListener('online', handleOnline);

    return () => {
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('online', handleOnline);
    };
  }, [setSaveStatus, setResumeNotification]);

  // Flush answers on window beforeunload
  useEffect(() => {
    const handleBeforeUnload = () => {
      const currentAnswers = useAssessmentState.getState().answers;
      const answersPayload = Object.entries(currentAnswers).map(([id, val]) => ({
        questionId: Number(id),
        value: val as string
      }));
      if (answersPayload.length > 0) {
        fetch('/api/assessment/sync', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ answers: answersPayload }),
          keepalive: true
        }).catch(() => {});
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, []);

  // Keyboard shortcut for submit modal: Ctrl+Enter
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        if (status === 'IN_PROGRESS' || status === 'REVIEW') {
          e.preventDefault();
          setShowSubmitModal(true);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [status, setShowSubmitModal]);

  // Auto-dismiss resume notification toast after 6 seconds
  useEffect(() => {
    if (resumeNotification) {
      const timer = setTimeout(() => {
        setResumeNotification(null);
      }, 6000);
      return () => clearTimeout(timer);
    }
  }, [resumeNotification, setResumeNotification]);

  if (!mounted) return null;

  if (status === 'SUBMITTED') {
    return (
      <div className="h-screen w-full flex flex-col items-center justify-center bg-slate-50">
        <h1 className="text-2xl font-bold text-slate-800 tracking-tight">ASSESSMENT ALREADY SUBMITTED</h1>
        <p className="text-slate-500 mt-2 mb-8">This attempt is finalized and locked.</p>
        <button 
          onClick={() => router.push('/results')} 
          className="px-6 py-3 bg-slate-900 text-white rounded-lg font-bold text-sm cursor-pointer"
        >
          Return to Submission Status
        </button>
      </div>
    );
  }

  if (status === 'EXPIRED') {
    return (
      <div className="h-screen w-full flex flex-col items-center justify-center bg-slate-50">
        <div className="w-16 h-16 border-4 border-slate-200 border-t-[#DC2626] rounded-full animate-spin mb-6"></div>
        <h1 className="text-3xl font-bold text-slate-900 tracking-tight mb-2 uppercase">Time is up</h1>
        <p className="text-slate-500 font-bold tracking-widest text-sm uppercase">FINALIZING YOUR RESPONSES...</p>
      </div>
    );
  }

  if (status !== 'IN_PROGRESS' && status !== 'REVIEW' && status !== 'SUBMITTING') return null;

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-white text-slate-900 relative">
      <AntiCheatMonitor />
      <AssessmentHeader />

      {/* Network Disconnection Banner */}
      {isOffline && (
        <div className="bg-amber-600 text-white text-xs px-4 py-2 flex items-center justify-between shadow-sm z-40 transition-colors">
          <div className="flex items-center gap-2">
            <WifiOff size={14} className="animate-pulse" />
            <span className="font-medium">
              Internet connection lost. Your answers are preserved locally. Please stay on this page while we reconnect.
            </span>
          </div>
          {isReconnecting && (
            <span className="flex items-center gap-1 font-mono text-[11px] bg-black/20 px-2 py-0.5 rounded">
              <RefreshCw size={11} className="animate-spin" /> Reconnecting...
            </span>
          )}
        </div>
      )}

      {/* Resume Success Toast */}
      <AnimatePresence>
        {resumeNotification && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="absolute top-16 left-1/2 -translate-x-1/2 z-50 bg-slate-900 text-white text-xs px-4 py-2.5 rounded-full shadow-lg border border-white/10 flex items-center gap-2"
          >
            <CheckCircle2 size={14} className="text-emerald-400 shrink-0" />
            <span className="font-medium text-slate-100">{resumeNotification}</span>
            <button
              onClick={() => setResumeNotification(null)}
              className="ml-2 text-slate-400 hover:text-white text-xs font-bold cursor-pointer"
            >
              ✕
            </button>
          </motion.div>
        )}
      </AnimatePresence>
      
      <div className="flex flex-1 overflow-hidden">
        <main className="flex-1 overflow-hidden relative flex flex-col">
          <AnimatePresence mode="wait">
            {status === 'REVIEW' ? (
              <ReviewPanel key="review" />
            ) : (
              <QuestionRenderer key="questions" />
            )}
          </AnimatePresence>
        </main>
        
        {status !== 'REVIEW' && <AssessmentSidebar />}
      </div>

      {/* Mobile Sticky Bottom Action Bar */}
      <div className="lg:hidden border-t border-slate-200 bg-white shadow-[0_-4px_20px_rgba(0,0,0,0.05)] z-50 p-3 flex items-center justify-between gap-3 shrink-0">
        <div className="flex flex-col">
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none mb-1">Status</div>
          <div className="text-[12px] font-bold text-slate-700">
            {Object.keys(answers).filter(id => {
              const numId = Number(id);
              const qData = assessmentData.find(q => q.id === numId);
              if (!answers[numId]) return false;
              if (qData?.type === 'EMAIL_COMPOSE') {
                try {
                  const parsed = JSON.parse(answers[numId]);
                  return !!(parsed.subject?.trim() && parsed.body?.trim());
                } catch {
                  return false;
                }
              }
              return true;
            }).length} <span className="font-normal text-slate-500">answered</span>
          </div>
        </div>
        <button
          onClick={() => setShowSubmitModal(true)}
          disabled={isSubmitting}
          className="px-6 py-3 bg-[#DC2626] text-white text-[12px] font-bold uppercase tracking-widest rounded shadow-sm hover:bg-[#B91C1C] transition-all flex items-center gap-2 flex-1 justify-center disabled:opacity-80 disabled:pointer-events-none cursor-pointer"
        >
          {isSubmitting ? 'SUBMITTING...' : 'SUBMIT EXAM →'}
        </button>
      </div>

      <SubmitConfirmationModal />
    </div>
  );
}
