'use client';
import { useAssessmentState } from '@/hooks/useAssessmentState';
import { Clock, Loader2, Check, AlertTriangle } from 'lucide-react';
import assessmentData from '@/lib/safe-questions';
import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';

export default function AssessmentHeader() {
  const { currentIndex, answers, endTime, expireAssessment, status, saveStatus } = useAssessmentState();
  const [timeLeft, setTimeLeft] = useState<number>(0);

  const total = assessmentData.length;
  const answered = Object.keys(answers).length;
  const progress = Math.round((answered / total) * 100);

  useEffect(() => {
    if (!endTime) return;
    const tick = () => {
      const remaining = Math.max(0, endTime - Date.now());
      setTimeLeft(remaining);
      if (remaining === 0 && status === 'IN_PROGRESS') {
        expireAssessment();
      }
    };
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [endTime, status, expireAssessment]);

  const h = Math.floor(timeLeft / 3600000);
  const m = Math.floor((timeLeft % 3600000) / 60000);
  const s = Math.floor((timeLeft % 60000) / 1000);

  let timerClass = 'text-slate-700 font-mono';
  let pulseClass = '';
  if (h === 0 && m < 5) {
    timerClass = 'text-[#DC2626] font-bold font-mono';
    pulseClass = 'animate-pulse';
  } else if (h === 0 && m < 15) {
    timerClass = 'text-amber-600 font-semibold font-mono';
  }

  return (
    <div className="flex flex-col z-50 shrink-0">
      <header className="h-[52px] bg-white flex items-center justify-between px-4 sm:px-6 font-sans relative border-b border-slate-200/90 shadow-2xs">
        
        {/* Left Side: DV Labs × Data Valley Brand */}
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 rounded-lg bg-white border border-slate-200 flex items-center justify-center p-0.5 shrink-0 overflow-hidden shadow-2xs">
            <img src="/logo.png" alt="Data Valley Logo" className="w-full h-full object-contain" />
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-[13px] font-semibold text-slate-900 tracking-tight">DV Labs</span>
            <span className="text-[10px] text-slate-400">·</span>
            <span className="text-[11px] font-normal text-slate-500 hidden sm:inline">Data Valley</span>
          </div>
        </div>

        {/* Center: Question Indicator & Honest Save Status */}
        <div className="flex items-center gap-4">
          {status !== 'REVIEW' && (
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-mono font-medium text-slate-600 bg-slate-100 px-2.5 py-0.5 rounded-full border border-slate-200/60">
                Question {String(currentIndex + 1).padStart(2, '0')} / {String(total).padStart(2, '0')}
              </span>
            </div>
          )}

          {/* Honest Autosave Status Indicator */}
          <div className="hidden md:flex items-center">
            {saveStatus === 'SAVING' && (
              <span className="inline-flex items-center gap-1.5 text-[11px] font-mono text-amber-700 bg-amber-50 px-2.5 py-0.5 rounded-full border border-amber-200/80">
                <Loader2 size={10} className="animate-spin text-amber-600" />
                <span>Saving…</span>
              </span>
            )}
            {saveStatus === 'SAVED' && (
              <span className="inline-flex items-center gap-1 text-[11px] font-mono text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200/80">
                <Check size={10} strokeWidth={2.5} className="text-emerald-600" />
                <span>Saved</span>
              </span>
            )}
            {saveStatus === 'ERROR' && (
              <span className="inline-flex items-center gap-1 text-[11px] font-mono text-rose-700 bg-rose-50 px-2.5 py-0.5 rounded-full border border-rose-200/80">
                <AlertTriangle size={10} className="text-rose-600" />
                <span>Unable to save — retrying</span>
              </span>
            )}
            {saveStatus === 'OFFLINE' && (
              <span className="inline-flex items-center gap-1 text-[11px] font-mono text-amber-700 bg-amber-50 px-2.5 py-0.5 rounded-full border border-amber-200/80">
                <AlertTriangle size={10} className="text-amber-600" />
                <span>Offline — local cache active</span>
              </span>
            )}
          </div>
        </div>

        {/* Right Side: Timer & Actions */}
        <div className="flex items-center gap-3 sm:gap-4">
          <div className={`flex items-center gap-1.5 text-[12px] tracking-tight bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-200/60 ${timerClass} ${pulseClass}`}>
            <Clock size={12} className="text-slate-400" />
            <span>{String(h).padStart(2, '0')}:{String(m).padStart(2, '0')}:{String(s).padStart(2, '0')}</span>
          </div>

          {status !== 'REVIEW' && (
            <button 
              onClick={() => useAssessmentState.getState().setStatus('REVIEW')}
              className="text-xs font-semibold text-slate-700 hover:text-slate-900 bg-slate-100 hover:bg-slate-200/80 px-3 py-1.5 rounded-lg border border-slate-200 transition-colors cursor-pointer"
            >
              Review
            </button>
          )}
          
          <button 
            onClick={() => useAssessmentState.getState().setShowSubmitModal(true)}
            className="text-xs font-semibold text-white bg-[#DC2626] hover:bg-[#B91C1C] px-3.5 py-1.5 rounded-lg shadow-2xs transition-colors cursor-pointer"
          >
            Submit Assessment
          </button>
        </div>
      </header>
      
      {/* Progress Bar Line */}
      <div className="h-[2px] w-full bg-slate-100 overflow-hidden">
        <motion.div 
          initial={false}
          animate={{ width: `${progress}%` }}
          transition={{ duration: 0.4, ease: "easeOut" }}
          className="h-full bg-red-600"
        />
      </div>
    </div>
  );
}
