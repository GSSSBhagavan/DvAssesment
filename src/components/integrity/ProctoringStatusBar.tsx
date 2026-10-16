'use client';

import React from 'react';
import { useAssessmentState } from '@/hooks/useAssessmentState';
import { Camera, ShieldCheck, AlertTriangle, VideoOff, Eye } from 'lucide-react';

interface ProctoringStatusBarProps {
  cameraStatus: string;
  faceState: string;
  isLookingAway?: boolean;
}

export default function ProctoringStatusBar({
  cameraStatus,
  faceState,
  isLookingAway = false
}: ProctoringStatusBarProps) {
  const { strikeCount, proctoringStatus, proctoringMessage } = useAssessmentState();
  const [biometricSnapshot, setBiometricSnapshot] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        const snap = sessionStorage.getItem('dv_candidate_face_snapshot');
        if (snap) setBiometricSnapshot(snap);
      } catch {}
    }
  }, []);

  const isCameraActive = cameraStatus === 'active';
  const isFaceOk = faceState === 'FACE_PRESENT' && !isLookingAway;

  return (
    <div className="w-full bg-slate-900 text-white border-b border-slate-800 text-xs px-4 py-1.5 flex flex-wrap items-center justify-between gap-2 select-none font-sans transition-colors">
      {/* Left side: Telemetry Status Indicators */}
      <div className="flex items-center gap-3">
        {/* Biometric ID Badge if captured */}
        {biometricSnapshot && (
          <>
            <div className="flex items-center gap-1.5 bg-emerald-500/10 text-emerald-300 border border-emerald-500/30 px-2 py-0.5 rounded-full shadow-xs">
              <img src={biometricSnapshot} alt="Biometric ID" className="w-4 h-4 rounded-full object-cover border border-emerald-400" />
              <span className="text-[11px] font-mono font-medium">Biometric ID: Verified</span>
            </div>
            <span className="text-slate-600">|</span>
          </>
        )}

        {/* Camera indicator */}
        <div className="flex items-center gap-1.5">
          {isCameraActive ? (
            <span className="flex items-center gap-1 text-emerald-400 font-medium">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <Camera size={13} />
              <span>Camera Active</span>
            </span>
          ) : cameraStatus === 'denied' || cameraStatus === 'error' ? (
            <span className="flex items-center gap-1 text-rose-400 font-medium">
              <span className="w-2 h-2 rounded-full bg-rose-400" />
              <VideoOff size={13} />
              <span>Camera Offline</span>
            </span>
          ) : (
            <span className="flex items-center gap-1 text-amber-400 font-medium">
              <span className="w-2 h-2 rounded-full bg-amber-400" />
              <Camera size={13} />
              <span>Connecting Camera...</span>
            </span>
          )}
        </div>

        <span className="text-slate-600">|</span>

        {/* Face tracking indicator */}
        <div className="flex items-center gap-1.5">
          {faceState === 'NO_FACE' ? (
            <span className="flex items-center gap-1 text-amber-400 font-medium">
              <AlertTriangle size={13} />
              <span>Face Absent</span>
            </span>
          ) : faceState === 'MULTIPLE_FACES' ? (
            <span className="flex items-center gap-1 text-rose-400 font-medium">
              <AlertTriangle size={13} />
              <span>Multiple Faces</span>
            </span>
          ) : isLookingAway ? (
            <span className="flex items-center gap-1 text-amber-300 font-medium">
              <Eye size={13} />
              <span>Attention Diverted</span>
            </span>
          ) : isFaceOk ? (
            <span className="flex items-center gap-1 text-emerald-400 font-medium">
              <ShieldCheck size={13} />
              <span>Proctored & Focused</span>
            </span>
          ) : (
            <span className="flex items-center gap-1 text-slate-400 font-medium">
              <span>Checking Feed...</span>
            </span>
          )}
        </div>

        {/* Actionable Notice for candidate */}
        {proctoringMessage && (
          <>
            <span className="text-slate-600 hidden sm:inline">|</span>
            <div className="hidden sm:flex items-center gap-1.5 text-amber-300 font-medium bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
              <AlertTriangle size={12} />
              <span>{proctoringMessage}</span>
            </div>
          </>
        )}
      </div>

      {/* Right side: Authoritative Integrity Status Badge */}
      <div className="flex items-center gap-2">
        {proctoringStatus === 'REVIEW_REQUIRED' ? (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-rose-500/20 text-rose-300 border border-rose-500/30 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-400 animate-ping" />
            Integrity Review Triggered ({strikeCount} Strikes)
          </span>
        ) : proctoringStatus === 'WARNING' ? (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center gap-1">
            <AlertTriangle size={11} />
            Integrity Notice ({strikeCount} Strikes)
          </span>
        ) : (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 flex items-center gap-1">
            <ShieldCheck size={11} />
            Secure Session Active
          </span>
        )}
      </div>
    </div>
  );
}
