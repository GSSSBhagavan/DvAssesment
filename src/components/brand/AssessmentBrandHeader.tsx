'use client';
import React from 'react';
import { Home } from 'lucide-react';

interface AssessmentBrandHeaderProps {
  candidateName?: string | null;
  stepLabel?: string;
  onSignOut?: () => void;
  showSignOut?: boolean;
  onHome?: () => void;
  showHome?: boolean;
}

export default function AssessmentBrandHeader({
  candidateName,
  stepLabel = '02 · Readiness',
  onSignOut,
  showSignOut = true,
  onHome,
  showHome = true,
}: AssessmentBrandHeaderProps) {
  const displayName = candidateName ? candidateName.trim().split(' ')[0] : null;

  return (
    <header className="w-full bg-[#FAF8F5]/95 backdrop-blur-md border-b border-black/[0.06] sticky top-0 z-40 transition-all">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
        {/* Left: Official Data Valley Brand Lockup */}
        <div className="flex items-center">
          <img 
            src="/datavalley-logo.png" 
            alt="Data Valley" 
            className="h-8 sm:h-9 w-auto object-contain mix-blend-multiply" 
          />
        </div>

        {/* Center: Understated Progress Indicator */}
        <div className="hidden md:flex items-center gap-2 text-[12.5px] font-medium text-[#71717A]">
          <span className="text-[#A1A1AA]">01 Welcome</span>
          <span className="text-black/20">—</span>
          <span className="text-[#121214] font-semibold flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-[#DC2626]" />
            02 Readiness
          </span>
          <span className="text-black/20">—</span>
          <span className="text-[#A1A1AA]">03 Assessment</span>
        </div>

        {/* Right: Authenticated Identity & Controls */}
        <div className="flex items-center gap-3">
          {showHome && onHome && (
            <button
              onClick={onHome}
              title="Return to Welcome"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium text-[#121214] bg-black/[0.03] hover:bg-black/[0.06] transition-all cursor-pointer"
            >
              <Home size={13} className="text-[#71717A]" />
              <span className="hidden sm:inline">Home</span>
            </button>
          )}

          {displayName && (
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-black/[0.04] border border-black/[0.06] text-xs font-medium text-[#121214]">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              <span className="truncate max-w-[120px]">{displayName}</span>
            </div>
          )}

          {showSignOut && onSignOut && (
            <button
              onClick={onSignOut}
              className="text-xs font-medium text-[#71717A] hover:text-[#DC2626] transition-colors cursor-pointer ml-1"
            >
              Sign out
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
