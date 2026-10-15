'use client';
import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowRight, Loader2, ShieldCheck } from 'lucide-react';
import CandidateLoginForm, { CandidateUser } from '@/components/auth/CandidateLoginForm';

interface DVWelcomeScreenProps {
  onLoginClick?: () => void;
  isAuthenticated?: boolean;
  candidateName?: string | null;
  onContinueToReadiness?: () => void;
  onSignOut?: () => void;
  onLoginSuccess?: (user: CandidateUser) => void;
  showLogin?: boolean;
  onToggleLogin?: (show: boolean) => void;
  initialLoginView?: boolean;
}

export default function DVWelcomeScreen({
  onLoginClick,
  isAuthenticated = false,
  candidateName,
  onContinueToReadiness,
  onSignOut,
  onLoginSuccess,
  showLogin,
  onToggleLogin,
  initialLoginView = false,
}: DVWelcomeScreenProps) {
  const router = useRouter();
  const [navigating, setNavigating] = useState(false);
  const [internalLoginView, setInternalLoginView] = useState(initialLoginView);

  const isLoginView = showLogin !== undefined ? showLogin : internalLoginView;
  const setIsLoginView = (open: boolean) => {
    setInternalLoginView(open);
    onToggleLogin?.(open);
  };

  const handleAction = () => {
    if (navigating) return;

    if (isAuthenticated && onContinueToReadiness) {
      setNavigating(true);
      onContinueToReadiness();
      return;
    }

    if (onLoginClick) {
      onLoginClick();
    }
    setIsLoginView(true);
  };

  return (
    <div className="min-h-screen lg:h-screen w-full bg-[#FAF8F5] text-[#121214] flex flex-col lg:flex-row overflow-x-hidden font-sans selection:bg-[#2563EB]/15 selection:text-[#2563EB] relative">

      {/* ======================================================== */}
      {/* SVG CLIP-PATH DEFINITION: REFINED ARCHITECTURAL CURVE    */}
      {/* Gentle, controlled organic sweep along the 50% boundary  */}
      {/* ======================================================== */}
      <svg className="absolute w-0 h-0 pointer-events-none" aria-hidden="true">
        <defs>
          <clipPath id="hero-architectural-curve" clipPathUnits="objectBoundingBox">
            <path d="M 0.05,0 C 0.00,0.30 0.00,0.70 0.05,1 L 1,1 L 1,0 Z" />
          </clipPath>
          <clipPath id="hero-mobile-curve" clipPathUnits="objectBoundingBox">
            <path d="M 0,0.05 C 0.30,0.00 0.70,0.00 1,0.05 L 1,1 L 0,1 Z" />
          </clipPath>
        </defs>
      </svg>

      {/* ======================================================== */}
      {/* LEFT COLUMN: EDITORIAL CONTENT (50% DESKTOP EQUAL SPLIT) */}
      {/* Balanced, generous negative space, uncrowded layout       */}
      {/* ======================================================== */}
      <div className="w-full lg:w-1/2 min-h-screen lg:h-full flex flex-col justify-between p-6 sm:p-8 lg:py-8 lg:px-10 xl:px-12 z-20 shrink-0">

        {/* Top: Official Data Valley Brand Lockup */}
        <header className="flex items-center justify-between w-full">
          <div className="flex items-center">
            <img
              src="/datavalley-logo.png"
              alt="Data Valley"
              className="h-8 sm:h-10 md:h-11 w-auto object-contain mix-blend-multiply transition-all"
            />
          </div>

          {/* Authenticated Candidate Status Pill */}
          {isAuthenticated && candidateName && (
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-black/[0.04] border border-black/[0.06] text-xs font-medium text-[#121214]">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              <span className="truncate max-w-[120px]">{candidateName.split(' ')[0]}</span>
              {onSignOut && (
                <button
                  type="button"
                  onClick={onSignOut}
                  className="text-[11px] text-[#0071E3] hover:underline font-semibold ml-1 cursor-pointer"
                >
                  Sign out
                </button>
              )}
            </div>
          )}
        </header>

        {/* Middle: Editorial Narrative OR Same-Page Login Form */}
        <AnimatePresence mode="wait">
          {!isLoginView ? (
            <motion.div
              key="welcome_minimal"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
              className="my-auto py-2 sm:py-3 max-w-xl w-full space-y-4 sm:space-y-4.5"
            >

              {/* Uppercase Eyebrow */}
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.08 }}
                className="text-[10.5px] sm:text-[11px] font-bold tracking-[0.24em] text-[#71717A] uppercase font-sans"
              >
                ENGINEERING ASSESSMENT
              </motion.div>

              {/* Powerful, Short Headline */}
              <motion.h1
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.15, ease: [0.16, 1, 0.3, 1] }}
                className="text-4xl sm:text-5xl lg:text-[44px] xl:text-[50px] font-bold text-[#121214] tracking-[-0.035em] leading-[1.08] font-sans"
              >
                Think clearly.<br />
                Build <span className="text-[#2563EB]">confidently.</span>
              </motion.h1>

              {/* Premium Editorial Assessment Overview */}
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.45, delay: 0.22 }}
                className="space-y-4 max-w-xl"
              >
                {/* Refined fresh lead paragraph */}
                <p className="text-[14px] sm:text-[15px] text-[#52525B] leading-[1.6] font-normal tracking-[-0.01em]">
                  Demonstrate your technical excellence through real-world challenges designed to evaluate{' '}
                  <span className="text-[#18181B] font-medium">practical coding</span>,{' '}
                  <span className="text-[#18181B] font-medium">analytical thinking</span>, and{' '}
                  <span className="text-[#18181B] font-medium">system design capabilities</span>.
                </p>

                {/* Separate Evaluation Module Cards with Blue Accent and Hover */}
                <div className="pt-1 max-w-lg">
                  <div className="grid grid-cols-3 gap-3 sm:gap-3.5">
                    <div className="py-2.5 px-3 rounded-2xl bg-white border border-black/[0.08] shadow-[0_1px_4px_rgba(0,0,0,0.04)] text-center transition-all duration-200 hover:-translate-y-1 hover:border-[#2563EB] hover:shadow-[0_8px_20px_rgba(37,99,235,0.12)] cursor-default group">
                      <span className="inline-block text-[10.5px] font-mono font-bold text-[#2563EB] bg-[#EFF6FF] px-2 py-0.5 rounded-md uppercase tracking-wider mb-1.5 transition-colors group-hover:bg-[#2563EB] group-hover:text-white">
                        01
                      </span>
                      <span className="block text-[12px] sm:text-[12.5px] font-bold text-[#18181B] tracking-tight group-hover:text-[#2563EB] transition-colors">
                        Problem Solving
                      </span>
                    </div>

                    <div className="py-2.5 px-3 rounded-2xl bg-white border border-black/[0.08] shadow-[0_1px_4px_rgba(0,0,0,0.04)] text-center transition-all duration-200 hover:-translate-y-1 hover:border-[#2563EB] hover:shadow-[0_8px_20px_rgba(37,99,235,0.12)] cursor-default group">
                      <span className="inline-block text-[10.5px] font-mono font-bold text-[#2563EB] bg-[#EFF6FF] px-2 py-0.5 rounded-md uppercase tracking-wider mb-1.5 transition-colors group-hover:bg-[#2563EB] group-hover:text-white">
                        02
                      </span>
                      <span className="block text-[12px] sm:text-[12.5px] font-bold text-[#18181B] tracking-tight group-hover:text-[#2563EB] transition-colors">
                        Programming
                      </span>
                    </div>

                    <div className="py-2.5 px-3 rounded-2xl bg-white border border-black/[0.08] shadow-[0_1px_4px_rgba(0,0,0,0.04)] text-center transition-all duration-200 hover:-translate-y-1 hover:border-[#2563EB] hover:shadow-[0_8px_20px_rgba(37,99,235,0.12)] cursor-default group">
                      <span className="inline-block text-[10.5px] font-mono font-bold text-[#2563EB] bg-[#EFF6FF] px-2 py-0.5 rounded-md uppercase tracking-wider mb-1.5 transition-colors group-hover:bg-[#2563EB] group-hover:text-white">
                        03
                      </span>
                      <span className="block text-[12px] sm:text-[12.5px] font-bold text-[#18181B] tracking-tight group-hover:text-[#2563EB] transition-colors">
                        Fundamentals
                      </span>
                    </div>
                  </div>
                </div>
              </motion.div>

            </motion.div>
          ) : (
            <motion.div
              key="samepage_login_form"
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
              className="my-auto py-4 sm:py-6 max-w-md w-full"
            >
              <CandidateLoginForm
                accentColor="blue"
                showHeaderLogo={false}
                title="Candidate Sign In"
                subtitle="Enter your registered credentials to continue."
                onBackToWelcome={() => setIsLoginView(false)}
                onSuccess={(user) => {
                  if (onLoginSuccess) {
                    onLoginSuccess(user);
                  } else {
                    router.replace('/');
                  }
                }}
              />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Slot 3: Anchored at bottom of page */}
        {!isLoginView ? (
          <footer className="pt-4 pb-1 space-y-2.5 w-full shrink-0">
            <button
              type="button"
              onClick={handleAction}
              disabled={navigating}
              className="inline-flex items-center justify-center gap-2.5 px-8 py-3.5 rounded-full bg-[#2563EB] hover:bg-white active:bg-slate-100 active:scale-[0.985] text-white hover:text-[#121214] border-2 border-[#2563EB] hover:border-[#121214] font-semibold text-[15px] shadow-sm hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563EB] focus-visible:ring-offset-2 focus-visible:ring-offset-[#FAF8F5] transition-all duration-200 cursor-pointer disabled:opacity-75 group"
            >
              {navigating ? (
                <>
                  <Loader2 size={16} className="animate-spin text-current" />
                  <span>Loading...</span>
                </>
              ) : isAuthenticated ? (
                <>
                  <span>Resume Assessment</span>
                  <ArrowRight size={16} className="transition-transform duration-200 group-hover:translate-x-1.5 text-current" />
                </>
              ) : (
                <>
                  <span>Candidate Login</span>
                  <ArrowRight size={16} className="transition-transform duration-200 group-hover:translate-x-1.5 text-current" />
                </>
              )}
            </button>

            {/* Subtle Secure Assessment Environment Trust Badge */}
            <div className="flex items-center gap-1.5 text-[12px] text-[#71717A] pl-1 font-normal">
              <ShieldCheck size={14} className="text-[#71717A] stroke-[1.8]" />
              <span>Secure assessment environment</span>
            </div>
          </footer>
        ) : (
          <footer className="pt-4 pb-1 w-full shrink-0">
            <div className="flex items-center gap-1.5 text-[12px] text-[#71717A] pl-1 font-normal">
              <ShieldCheck size={14} className="text-[#71717A] stroke-[1.8]" />
              <span>Secure assessment environment</span>
            </div>
          </footer>
        )}

      </div>

      {/* ======================================================== */}
      {/* RIGHT HERO REGION: 50% EQUAL SPLIT PHOTOGRAPH            */}
      {/* Carefully composed curved contour, zero content overlap  */}
      {/* ======================================================== */}
      <div className="w-full lg:w-1/2 h-80 sm:h-[460px] lg:h-full relative overflow-hidden shrink-0">

        {/* Subtle Ambient Shadow Inset along the curve on desktop */}
        <div className="hidden lg:block absolute inset-0 [clip-path:url(#hero-architectural-curve)] pointer-events-none z-10 shadow-[inset_12px_0_24px_rgba(0,0,0,0.05)]" />

        <motion.div
          initial={{ opacity: 0, scale: 1.02 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
          className="w-full h-full relative overflow-hidden [clip-path:url(#hero-mobile-curve)] lg:[clip-path:url(#hero-architectural-curve)]"
        >
          <img
            src="/student-assessment-v2.png"
            alt="Student concentrating on an online assessment using a laptop while writing notes"
            className="w-full h-full object-cover object-[30%_52%] transition-transform duration-700 ease-out hover:scale-[1.015]"
          />
        </motion.div>
      </div>

    </div>
  );
}
