'use client';
import React from 'react';
import { motion } from 'framer-motion';
import { 
  Clock, 
  CheckSquare, 
  ShieldCheck, 
  ArrowRight, 
  Code2, 
  Sparkles, 
  Award,
  Zap,
  CheckCircle2,
  Terminal
} from 'lucide-react';

interface AssessmentWelcomeProps {
  onGetReady: () => void;
  candidateName?: string | null;
  hasCompletedSession?: boolean;
  onViewResults?: () => void;
}

export default function AssessmentWelcome({ 
  onGetReady, 
  candidateName,
  hasCompletedSession = false,
  onViewResults
}: AssessmentWelcomeProps) {
  const firstName = candidateName ? candidateName.trim().split(' ')[0] : 'Candidate';

  return (
    <div className="w-full max-w-6xl mx-auto flex flex-col justify-center py-2 sm:py-4 px-4 font-sans selection:bg-[#0071E3]/15 selection:text-[#0071E3] relative">
      
      {/* Apple Cinematic Ambient Glow Orbs behind card */}
      <div className="absolute -top-10 left-10 w-[450px] h-[450px] bg-gradient-to-br from-blue-200/25 via-indigo-100/20 to-transparent rounded-full blur-[100px] pointer-events-none -z-10" />
      <div className="absolute -bottom-10 right-10 w-[450px] h-[450px] bg-gradient-to-tl from-emerald-100/25 via-sky-100/20 to-transparent rounded-full blur-[110px] pointer-events-none -z-10" />

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
        className="w-full bg-white/95 backdrop-blur-3xl rounded-[32px] p-6 sm:p-9 lg:p-10 shadow-[0_24px_70px_rgba(0,0,0,0.06)] border border-black/[0.06] relative overflow-hidden"
      >
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
          
          {/* LEFT COLUMN: Editorial & Welcome Story */}
          <div className="lg:col-span-7 flex flex-col justify-center space-y-4 sm:space-y-5 text-left">
            
            {/* Pill Eyebrow with radiant live beacon */}
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#F5F5F7] border border-black/[0.06] shadow-2xs w-fit">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
              </span>
              <span className="text-[11px] font-semibold text-[#6E6E73] tracking-[0.18em] uppercase font-mono">
                ENGINEERING ASSESSMENT · 2026
              </span>
            </div>

            {/* Apple Headline */}
            <div className="space-y-2">
              <h1 className="text-2xl sm:text-3xl lg:text-[40px] font-semibold tracking-tight text-[#1D1D1F] leading-[1.14]">
                Your next chapter starts with <br className="hidden sm:inline" />
                <span className="bg-gradient-to-r from-[#0071E3] via-[#4338CA] to-[#6366F1] bg-clip-text text-transparent">
                  what you know.
                </span>
              </h1>
              <p className="text-[14.5px] sm:text-[15.5px] text-[#6E6E73] leading-relaxed max-w-xl font-normal">
                Welcome, <strong className="text-[#1D1D1F] font-semibold">{firstName}</strong>. A focused technical environment crafted to evaluate your computer science foundations, system understanding, and real-world engineering mindset.
              </p>
            </div>

            {/* Editorial Quotation strip */}
            <div className="flex items-center gap-2 text-xs sm:text-[13px] font-medium text-[#86868B] italic pl-3 border-l-2 border-[#0071E3]/50">
              Think clearly. Work independently. Build with precision.
            </div>

            {/* Action Area: Get Ready / Retake & View Score */}
            <div className="pt-2 flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
              <button
                onClick={onGetReady}
                className="inline-flex items-center justify-center gap-2 px-8 py-3.5 rounded-full bg-[#0071E3] hover:bg-[#0077ED] active:scale-[0.98] text-white font-medium text-[14.5px] shadow-sm transition-all cursor-pointer group"
              >
                <span>{hasCompletedSession ? 'Retake Assessment' : 'Get Ready & Begin'}</span>
                <ArrowRight size={16} className="group-hover:translate-x-0.5 transition-transform" />
              </button>

              {hasCompletedSession && onViewResults && (
                <button
                  type="button"
                  onClick={onViewResults}
                  className="inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-full bg-[#F5F5F7] hover:bg-[#E8E8ED] active:scale-[0.98] text-[#1D1D1F] font-medium text-[13.5px] border border-black/[0.06] transition-all cursor-pointer"
                >
                  <Award size={15} className="text-[#0071E3]" />
                  <span>View My Score Report</span>
                </button>
              )}
            </div>

            {/* Trust Footnote */}
            <div className="flex flex-wrap items-center gap-2.5 text-[11.5px] text-[#86868B] pt-1">
              <div className="flex items-center gap-1 text-emerald-600 font-medium">
                <CheckCircle2 size={13} />
                <span>Webcam & Window Monitored</span>
              </div>
              <span className="text-black/20">·</span>
              <span>Cloud Autosave</span>
              <span className="text-black/20">·</span>
              <span>Data Valley Certified</span>
            </div>

          </div>

          {/* RIGHT COLUMN: 3 Apple Interactive Blueprint Cards */}
          <div className="lg:col-span-5 flex flex-col gap-3">
            
            {/* Blueprint 1: 60-Minute Countdown */}
            <div className="p-4 sm:p-4.5 rounded-2xl bg-[#F5F5F7] hover:bg-[#EBEBEF] border border-black/[0.04] transition-all text-left flex items-start gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-white border border-black/[0.06] flex items-center justify-center text-violet-600 shadow-2xs shrink-0 mt-0.5">
                <Clock size={20} strokeWidth={1.8} />
              </div>
              <div>
                <div className="text-[14px] font-semibold text-[#1D1D1F] tracking-tight mb-0.5">
                  60-Minute Authoritative Timer
                </div>
                <p className="text-[12px] text-[#86868B] leading-relaxed">
                  Synchronized countdown with automatic final submission when time expires.
                </p>
              </div>
            </div>

            {/* Blueprint 2: 60 Curated Questions */}
            <div className="p-4 sm:p-4.5 rounded-2xl bg-[#F5F5F7] hover:bg-[#EBEBEF] border border-black/[0.04] transition-all text-left flex items-start gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-white border border-black/[0.06] flex items-center justify-center text-[#0071E3] shadow-2xs shrink-0 mt-0.5">
                <Code2 size={20} strokeWidth={1.8} />
              </div>
              <div>
                <div className="text-[14px] font-semibold text-[#1D1D1F] tracking-tight mb-0.5">
                  60 Curated Engineering Questions
                </div>
                <p className="text-[12px] text-[#86868B] leading-relaxed">
                  55 Core MCQs (Algorithms, Web, Systems) plus 5 hands-on Git scenarios.
                </p>
              </div>
            </div>

            {/* Blueprint 3: Proctored Integrity */}
            <div className="p-4 sm:p-4.5 rounded-2xl bg-[#F5F5F7] hover:bg-[#EBEBEF] border border-black/[0.04] transition-all text-left flex items-start gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-white border border-black/[0.06] flex items-center justify-center text-emerald-600 shadow-2xs shrink-0 mt-0.5">
                <ShieldCheck size={20} strokeWidth={1.8} />
              </div>
              <div>
                <div className="text-[14px] font-semibold text-[#1D1D1F] tracking-tight mb-0.5">
                  Proctored Candidate Integrity
                </div>
                <p className="text-[12px] text-[#86868B] leading-relaxed">
                  Full-screen proctored session with window change and camera diagnostics.
                </p>
              </div>
            </div>

          </div>

        </div>
      </motion.div>

      {/* Screen Footer */}
      <footer className="mt-3 text-center text-[11px] text-[#86868B]">
        <span>DV Labs · An assessment platform by Data Valley</span>
      </footer>
    </div>
  );
}
