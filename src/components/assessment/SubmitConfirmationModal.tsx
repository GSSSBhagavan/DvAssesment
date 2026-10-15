'use client';
import { useAssessmentState } from '@/hooks/useAssessmentState';
import { getOrderedQuestions } from '@/lib/safe-questions';
import { motion } from 'framer-motion';
import { AlertCircle, Loader2, ArrowRight, X, Mic } from 'lucide-react';
import { useMemo, useState } from 'react';

export default function SubmitConfirmationModal() {
  const { 
    showSubmitModal, 
    setShowSubmitModal, 
    answers, 
    flags, 
    isSubmitting, 
    executeSubmission,
    isRecordingVoice,
    questionOrder
  } = useAssessmentState();

  const [error, setError] = useState<string | null>(null);
  const questions = useMemo(() => getOrderedQuestions(questionOrder), [questionOrder]);

  const { total, answered, unanswered, flagged } = useMemo(() => {
    let answeredCount = 0;
    let flaggedCount = 0;
    
    questions.forEach(q => {
      if (answers[q.id]) answeredCount++;
      if (flags[q.id]) flaggedCount++;
    });

    return {
      total: questions.length,
      answered: answeredCount,
      unanswered: questions.length - answeredCount,
      flagged: flaggedCount
    };
  }, [answers, flags, questions]);

  const handleSubmit = async () => {
    try {
      setError(null);
      await executeSubmission();
    } catch (e) {
      setError("Connection interrupted. Your responses are saved in browser cache. Please verify your network and retry.");
    }
  };

  if (!showSubmitModal) return null;

  return (
    <div className="fixed inset-0 z-[999] flex items-center justify-center p-4 selection:bg-[#DC2626]/15 selection:text-[#DC2626]">
      {/* Restrained Dimmed Backdrop */}
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 bg-black/40 backdrop-blur-xs" 
        onClick={() => !isSubmitting && setShowSubmitModal(false)}
      />
      
      {/* Premium DV Labs Confirmation Modal */}
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 8 }}
        transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
        className="bg-white rounded-2xl border border-black/[0.08] shadow-[0_20px_50px_rgba(0,0,0,0.14)] w-full max-w-[430px] overflow-hidden flex flex-col font-sans relative z-10 p-6 sm:p-7 text-left"
        role="dialog"
        aria-modal="true"
        aria-labelledby="submit-modal-title"
      >
        {/* Header: DV Labs Logo + Understated Label + Safe Dismiss */}
        <div className="flex items-center justify-between w-full mb-3.5">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-[#FAF8F5] border border-black/[0.08] flex items-center justify-center p-1 shrink-0 shadow-2xs">
              <img src="/logo.png" alt="Data Valley" className="w-full h-full object-contain" />
            </div>
            <span className="text-[10.5px] font-bold tracking-[0.18em] text-[#71717A] uppercase font-sans">
              SUBMIT ASSESSMENT
            </span>
          </div>

          {!isSubmitting && (
            <button
              type="button"
              onClick={() => setShowSubmitModal(false)}
              className="w-7 h-7 rounded-full flex items-center justify-center text-[#71717A] hover:text-[#121214] hover:bg-black/[0.05] transition-colors cursor-pointer"
              aria-label="Return to questions"
            >
              <X size={15} />
            </button>
          )}
        </div>

        {/* Main Heading & Concise Supporting Text */}
        <h2 id="submit-modal-title" className="text-xl sm:text-[22px] font-bold text-[#121214] tracking-[-0.025em] leading-snug mb-1">
          Ready to submit?
        </h2>
        <p className="text-[13px] text-[#71717A] mb-4.5 leading-relaxed font-normal">
          Review your progress before submitting your assessment.
        </p>

        {/* Compact Progress Information Row (Single Horizontal Bar, No Nested Cards) */}
        <div className="py-2.5 px-3.5 rounded-xl bg-[#FAF8F5] border border-black/[0.06] flex items-center justify-between text-xs text-[#121214] mb-3.5">
          <div className="flex items-center gap-1.5">
            <span className="text-[#71717A]">Answered:</span>
            <span className="font-semibold text-[#121214]">{answered}<span className="text-[#A1A1AA] font-normal">/{total}</span></span>
          </div>
          <span className="text-black/15">·</span>
          <div className="flex items-center gap-1.5">
            <span className="text-[#71717A]">Unanswered:</span>
            <span className={`font-semibold ${unanswered > 0 ? 'text-[#DC2626]' : 'text-emerald-600'}`}>{unanswered}</span>
          </div>
          <span className="text-black/15">·</span>
          <div className="flex items-center gap-1.5">
            <span className="text-[#71717A]">Flagged:</span>
            <span className="font-semibold text-[#121214]">{flagged}</span>
          </div>
        </div>

        {/* Contextual Unanswered Notice OR Completion Summary */}
        {unanswered > 0 ? (
          <div className="mb-5 p-3 rounded-xl bg-amber-500/[0.07] border border-amber-500/20 flex items-start gap-2.5 text-left">
            <div className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0 mt-1.5" />
            <div className="text-[12px] leading-snug">
              <span className="font-semibold text-amber-950">{unanswered} questions remain unanswered.</span>
              <p className="text-amber-800 mt-0.5 text-[11.5px]">
                You can return to review them or submit your current responses.
              </p>
            </div>
          </div>
        ) : (
          <div className="mb-5 p-3 rounded-xl bg-emerald-500/[0.06] border border-emerald-500/15 flex items-center gap-2 text-[12px] text-emerald-800">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
            <span>All questions completed. Your answers are ready for final scoring.</span>
          </div>
        )}

        {/* Subtle Voice Recording Indicator if active */}
        {isRecordingVoice && (
          <div className="mb-4 flex items-center gap-2 text-[11.5px] text-[#71717A]">
            <Mic size={12} className="text-[#DC2626]" />
            <span>Voice response recording will be finalized with submission.</span>
          </div>
        )}

        {/* Accessible Submission Error Alert */}
        {error && (
          <div className="mb-4 p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
            <AlertCircle size={14} className="shrink-0 text-rose-600" />
            <span>{error}</span>
          </div>
        )}

        {/* Action Controls: Secondary & Data Valley Red Primary CTA */}
        <div className="flex flex-col-reverse sm:flex-row items-center gap-2.5 justify-end pt-3 border-t border-black/[0.06]">
          <button 
            type="button"
            onClick={() => setShowSubmitModal(false)}
            disabled={isSubmitting}
            className="w-full sm:w-auto px-4 py-2.5 text-xs font-medium text-[#52525B] hover:text-[#121214] hover:bg-black/[0.04] rounded-full transition-colors cursor-pointer disabled:opacity-50"
          >
            Return to Questions
          </button>
          
          <button 
            type="button"
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="w-full sm:w-auto px-5 py-2.5 bg-[#DC2626] hover:bg-[#B91C1C] active:bg-[#991B1B] active:scale-[0.985] text-white text-xs font-medium rounded-full shadow-xs hover:shadow transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed disabled:active:scale-100"
          >
            {isSubmitting ? (
              <>
                <Loader2 size={13} className="animate-spin text-white" />
                <span>Submitting...</span>
              </>
            ) : (
              <>
                <span>Submit Assessment</span>
                <ArrowRight size={13} />
              </>
            )}
          </button>
        </div>

      </motion.div>
    </div>
  );
}
