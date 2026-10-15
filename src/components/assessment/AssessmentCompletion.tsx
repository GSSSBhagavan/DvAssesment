'use client';
import React, { useEffect } from 'react';
import { motion } from 'framer-motion';
import { LogOut } from 'lucide-react';
import { stopAllCameraStreams, exitFullscreenSafely } from '@/hooks/useCamera';

interface AssessmentCompletionProps {
  sessionId?: string | null;
  submittedAt?: number | string | null;
  candidateName?: string | null;
  onFinish: () => void;
  onHome?: () => void;
  scoreData?: any;
}

export default function AssessmentCompletion({
  sessionId,
  submittedAt,
  candidateName,
  onFinish,
  onHome,
  scoreData,
}: AssessmentCompletionProps) {
  // Ensure fullscreen is immediately exited and all camera hardware is turned off on final screen
  useEffect(() => {
    exitFullscreenSafely();
    stopAllCameraStreams();
    const t1 = setTimeout(stopAllCameraStreams, 150);
    const t2 = setTimeout(stopAllCameraStreams, 600);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      stopAllCameraStreams();
    };
  }, []);

  // Extract candidate's real display name
  const studentName = candidateName && candidateName.trim()
    ? candidateName.trim().split(' ')[0]
    : null;

  return (
    <div className="w-full max-w-[840px] mx-auto px-6 sm:px-8 py-4 sm:py-6 flex flex-col justify-between font-sans selection:bg-[#2563EB]/15 selection:text-[#2563EB]">
      {/* Top Brand Lockup & Subtle Submission Status */}
      <div className="flex items-center justify-between w-full mb-6 sm:mb-8 shrink-0">
        <img 
          src="/datavalley-logo.png" 
          alt="Data Valley" 
          className="h-8 sm:h-9 w-auto object-contain mix-blend-multiply" 
        />
        <div className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-emerald-50 border border-emerald-200/50 text-[11.5px] font-medium text-emerald-700">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
          <span>Submitted successfully</span>
        </div>
      </div>

      {/* Main Narrative Area */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
        className="space-y-5 sm:space-y-6 text-left shrink-0"
      >
        {/* Eyebrow */}
        <div className="text-[10.5px] sm:text-[11px] font-bold tracking-[0.24em] text-[#71717A] uppercase font-sans">
          ASSESSMENT COMPLETED
        </div>

        {/* Headings */}
        <div className="space-y-2">
          <h1 className="text-3xl sm:text-4xl lg:text-[40px] font-extrabold text-[#121214] tracking-[-0.035em] leading-[1.14] font-sans">
            {studentName ? `Well done, ${studentName}.` : 'Well done.'}
          </h1>
          <p className="text-lg sm:text-xl font-semibold text-[#2563EB] tracking-tight">
            You&apos;ve taken an important step forward.
          </p>
        </div>

        {/* Appreciation Message */}
        <p className="text-[15px] sm:text-[16px] text-[#52525B] leading-[1.65] font-normal max-w-2xl">
          Thank you for completing your engineering assessment. We appreciate the time and effort you put into demonstrating your technical skills. Your submission has been securely recorded.
        </p>

        {/* Subtle Divider */}
        <div className="w-full border-t border-black/[0.07] pt-5 sm:pt-6" />

        {/* What's next? Section */}
        <div className="space-y-2 max-w-2xl">
          <h2 className="text-[17px] sm:text-[18px] font-bold text-[#121214] tracking-tight font-sans">
            What&apos;s next?
          </h2>
          <p className="text-[14px] sm:text-[15px] text-[#52525B] leading-[1.6] font-normal">
            Our Data Valley team will review your assessment results and contact you through your registered email address with an update on the next steps.
          </p>
        </div>
      </motion.div>

      {/* Actions Footer */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.12, ease: [0.16, 1, 0.3, 1] }}
        className="mt-8 sm:mt-10 pt-5 border-t border-black/[0.07] flex items-center justify-between gap-4 shrink-0"
      >
        <div className="pl-12 sm:pl-14 text-xs text-[#71717A]">
          Data Valley · DV Labs Assessment System
        </div>

        <div className="flex items-center gap-3 justify-end">
          {onHome && (
            <button
              type="button"
              onClick={onHome}
              className="px-4 py-2.5 rounded-full text-[13px] font-medium text-[#71717A] hover:text-[#121214] transition-colors cursor-pointer"
            >
              Return to Home
            </button>
          )}

          <button
            type="button"
            onClick={onFinish}
            className="px-7 py-3 rounded-full bg-[#DC2626] hover:bg-[#B91C1C] active:bg-[#991B1B] active:scale-[0.985] text-white font-medium text-[14.5px] shadow-sm hover:shadow transition-all flex items-center justify-center gap-2 cursor-pointer group"
          >
            <span>Finish & Sign Out</span>
            <LogOut size={15} className="transition-transform duration-200 group-hover:translate-x-0.5" />
          </button>
        </div>
      </motion.div>
    </div>
  );
}
