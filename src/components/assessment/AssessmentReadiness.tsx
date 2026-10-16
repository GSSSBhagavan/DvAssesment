'use client';
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Check, 
  AlertTriangle, 
  RefreshCw, 
  Camera, 
  ArrowRight, 
  ArrowLeft, 
  Loader2, 
  Cpu, 
  Maximize,
  Wifi
} from 'lucide-react';
import CameraPreview from '@/components/integrity/CameraPreview';
import { ReadinessCheck } from '@/lib/readiness/readinessEngine';
import { NetworkMetrics } from '@/lib/readiness/networkDiagnostics';
import { UseCameraReturn } from '@/hooks/useCamera';
import { FaceStateInfo } from '@/hooks/useFaceDetection';

interface AssessmentReadinessProps {
  checks: ReadinessCheck[];
  networkMetrics?: NetworkMetrics | null;
  isOverallReady: boolean;
  isChecking: boolean;
  runBasicChecks: () => void;
  retryCheck: (id: string) => void;
  requestCamera: () => void;
  camera?: UseCameraReturn;
  onBack: () => void;
  onStartAssessment: () => Promise<void>;
  isStarting: boolean;
  fullscreenError: string | null;
  candidateName?: string | null;
  isResumable?: boolean;
  onSignOut?: () => void;
  faceState?: FaceStateInfo;
  onFaceDetectionChange?: (info: FaceStateInfo) => void;
}

const checkIcons: Record<string, React.ReactNode> = {
  camera: <Camera size={13} />,
  browser: <Cpu size={13} />,
  network: <Wifi size={13} />,
  fullscreen: <Maximize size={13} />,
};

const checkDisplayNames: Record<string, string> = {
  camera: 'Camera and proctoring',
  browser: 'Browser compatibility',
  network: 'Network connection',
  fullscreen: 'Fullscreen support',
};

export default function AssessmentReadiness({
  checks,
  networkMetrics,
  isOverallReady,
  isChecking,
  runBasicChecks,
  retryCheck,
  requestCamera,
  camera,
  onBack,
  onStartAssessment,
  isStarting,
  fullscreenError,
  candidateName,
  isResumable = false,
  onSignOut,
  faceState,
  onFaceDetectionChange,
}: AssessmentReadinessProps) {
  // Checkbox strictly defaults to FALSE so the student must explicitly confirm
  const [agreed, setAgreed] = useState(false);

  // Extract clean candidate display name (e.g. "Maharshi" from "Maharshi Patel")
  const displayName = candidateName && candidateName.trim()
    ? candidateName.trim().split(' ')[0]
    : null;

  // Order checks logically: camera first, then browser, network, fullscreen
  const orderedCheckIds = ['camera', 'browser', 'network', 'fullscreen'];
  const orderedChecks = orderedCheckIds
    .map(id => checks.find(c => c.id === id))
    .filter((c): c is ReadinessCheck => Boolean(c));

  return (
    <div className="w-full max-w-5xl h-full max-h-screen mx-auto px-6 sm:px-8 py-3 sm:py-4 flex flex-col justify-between overflow-hidden font-sans selection:bg-[#2563EB]/15 selection:text-[#2563EB]">
      
      {/* ======================================================== */}
      {/* BRAND LOCKUP HEADER (NO NAVBAR, CLEAN & MINIMAL)         */}
      {/* ======================================================== */}
      <div className="flex items-center justify-between w-full shrink-0 pt-1 pb-4 sm:pb-5">
        <div className="flex items-center">
          <img 
            src="/datavalley-logo.png" 
            alt="Data Valley" 
            className="h-8 sm:h-8.5 w-auto object-contain mix-blend-multiply" 
          />
        </div>
      </div>

      {/* ======================================================== */}
      {/* 1. PERSONAL POST-LOGIN WELCOME AREA                       */}
      {/* ======================================================== */}
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
        className="w-full text-left space-y-1 mb-3 sm:mb-4 shrink-0"
      >
        <h1 className="text-2xl sm:text-[28px] font-bold text-[#121214] tracking-[-0.03em] leading-tight">
          Welcome back{displayName ? `, ${displayName}` : ''}.
        </h1>
        <p className="text-[13px] sm:text-[13.5px] text-[#52525B] font-normal leading-relaxed">
          Please verify your camera and system readiness before beginning.
        </p>
      </motion.div>

      {/* ======================================================== */}
      {/* 2. TWO-COLUMN SPLIT DIAGNOSTICS DECK                      */}
      {/* ======================================================== */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 items-start my-auto w-full">
        
        {/* LEFT COLUMN: Dedicated Camera Verification Section */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
          className="flex flex-col space-y-2 text-left"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold tracking-[0.16em] text-[#71717A] uppercase font-sans">
              CAMERA VERIFICATION
            </span>
          </div>

          {/* Balanced Camera Card */}
          <div className="w-full aspect-[16/10] sm:aspect-video max-h-[220px] sm:max-h-[235px] rounded-2xl overflow-hidden border border-black/[0.08] bg-[#121214] shadow-xs relative">
            <CameraPreview 
              className="w-full h-full object-cover" 
              showBadge={true}
              camera={camera}
              onRequestCamera={camera ? camera.startCamera : requestCamera}
              onFaceDetectionChange={onFaceDetectionChange}
            />
          </div>

          <p className="text-[11.5px] text-[#71717A] leading-relaxed pl-0.5 font-normal">
            Your face is analyzed locally for proctoring integrity. Raw video is never recorded or stored.
          </p>
        </motion.div>

        {/* RIGHT COLUMN: Clean Single Readiness Checklist Card */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.08, ease: [0.16, 1, 0.3, 1] }}
          className="flex flex-col space-y-2 text-left"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold tracking-[0.16em] text-[#71717A] uppercase font-sans">
              SYSTEM READINESS
            </span>
            <button
              type="button"
              onClick={runBasicChecks}
              disabled={isChecking}
              className="inline-flex items-center gap-1 text-[11px] font-medium text-[#71717A] hover:text-[#121214] transition-colors cursor-pointer disabled:opacity-50"
            >
              <RefreshCw size={10} className={isChecking ? 'animate-spin' : ''} />
              <span>Rerun checks</span>
            </button>
          </div>

          {/* Unified Vertical Checklist Container */}
          <div className="w-full bg-white rounded-2xl border border-black/[0.08] shadow-[0_1px_3px_rgba(0,0,0,0.02)] divide-y divide-black/[0.05] overflow-hidden">
            {orderedChecks.map((check) => {
              const isPassed = check.status === 'passed';
              const isFailed = check.status === 'failed';
              const isRequesting = check.status === 'requesting';
              const isCheckingItem = check.status === 'checking' || check.status === 'idle';
              const checkName = checkDisplayNames[check.id] || check.label;

              return (
                <div
                  key={check.id}
                  className="px-4 py-2 sm:py-2.5 flex items-center justify-between gap-3 transition-colors hover:bg-black/[0.01]"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    {/* Consistent Status Indicator */}
                    <div 
                      className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 ${
                        isPassed 
                          ? 'bg-emerald-50 text-emerald-600' 
                          : isFailed 
                            ? 'bg-rose-50 text-rose-600' 
                            : isRequesting && check.id === 'camera'
                              ? 'bg-blue-50 text-blue-600'
                              : 'bg-black/[0.04] text-[#71717A]'
                      }`}
                    >
                      {isPassed ? (
                        <Check size={11} strokeWidth={2.8} />
                      ) : isFailed ? (
                        <AlertTriangle size={11} strokeWidth={2.4} />
                      ) : isRequesting && check.id === 'camera' ? (
                        <Camera size={11} />
                      ) : (
                        checkIcons[check.id] || <Cpu size={11} />
                      )}
                    </div>

                    <div className="min-w-0">
                      <div className="text-[13px] font-semibold text-[#121214] tracking-tight truncate">
                        {checkName}
                      </div>

                      {/* Real-time Network Subtitle */}
                      {check.id === 'network' && (
                        <div className="text-[11px] text-[#52525B] leading-tight mt-0.5 truncate flex items-center gap-1.5 font-sans">
                          <span className="relative flex h-1.5 w-1.5 shrink-0">
                            {isPassed ? (
                              <>
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500" />
                              </>
                            ) : (
                              <span className="inline-flex rounded-full h-1.5 w-1.5 bg-amber-500" />
                            )}
                          </span>
                          <span>{networkMetrics?.summary || check.message}</span>
                        </div>
                      )}

                      {/* Camera request & face detection hint */}
                      {check.id === 'camera' && (
                        <div className={`text-[11px] leading-tight mt-0.5 truncate ${
                          isPassed ? 'text-emerald-600 font-medium' : isFailed ? 'text-rose-600 font-medium' : 'text-[#71717A]'
                        }`}>
                          {check.message || 'Click "Enable" to verify camera permission'}
                        </div>
                      )}

                      {/* Failure message for others */}
                      {isFailed && check.id !== 'network' && check.id !== 'camera' && check.message && (
                        <div className="text-[11px] text-rose-600 leading-tight mt-0.5 truncate">
                          {check.message}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Right Status Pill or Action Button */}
                  <div className="shrink-0">
                    {isCheckingItem && (
                      <span className="inline-flex items-center gap-1 text-[10.5px] font-mono text-[#71717A]">
                        <Loader2 size={10} className="animate-spin" />
                        <span>Checking</span>
                      </span>
                    )}

                    {/* Camera Action Button or Face Status Pill */}
                    {check.id === 'camera' && !isPassed && (
                      camera?.status === 'active' ? (
                        <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-rose-700 bg-rose-50 px-2.5 py-0.5 rounded-full border border-rose-200/60">
                          <AlertTriangle size={11} className="text-rose-500" />
                          <span>Face Required</span>
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={camera ? camera.startCamera : requestCamera}
                          disabled={camera?.status === 'requesting'}
                          className="px-3.5 py-1 rounded-full text-[11.5px] font-medium bg-[#2563EB] hover:bg-[#1D4ED8] active:bg-[#1E40AF] text-white transition-all shadow-xs cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
                        >
                          {camera?.status === 'requesting' ? (
                            <>
                              <Loader2 size={11} className="animate-spin" />
                              <span>Enabling...</span>
                            </>
                          ) : (
                            <>
                              <Camera size={11} />
                              <span>Enable</span>
                            </>
                          )}
                        </button>
                      )
                    )}

                    {/* Real-time Network Status Pill */}
                    {check.id === 'network' && isPassed && (
                      <span className={`inline-flex items-center gap-1.5 text-[11px] font-mono px-2.5 py-0.5 rounded-full border transition-all ${
                        networkMetrics?.quality === 'optimal' || networkMetrics?.quality === 'good'
                          ? 'text-emerald-700 bg-emerald-50 border-emerald-200/60'
                          : networkMetrics?.quality === 'moderate'
                            ? 'text-amber-700 bg-amber-50 border-amber-200/60'
                            : 'text-rose-700 bg-rose-50 border-rose-200/60'
                      }`}>
                        <span className="relative flex h-1.5 w-1.5 shrink-0">
                          {networkMetrics?.quality === 'optimal' || networkMetrics?.quality === 'good' ? (
                            <>
                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500" />
                            </>
                          ) : networkMetrics?.quality === 'moderate' ? (
                            <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-amber-500" />
                          ) : (
                            <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-rose-500" />
                          )}
                        </span>
                        <span>{networkMetrics?.realtimePillText || 'Ready'}</span>
                      </span>
                    )}

                    {/* Standard Ready Pill for other passed checks */}
                    {isPassed && check.id !== 'network' && (
                      <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200/50">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                        <span>Ready</span>
                      </span>
                    )}

                    {/* Generic retry for non-camera failed items */}
                    {isFailed && check.id !== 'camera' && (
                      check.canRetry ? (
                        <button
                          type="button"
                          onClick={() => retryCheck(check.id)}
                          className="px-3 py-0.5 rounded-full text-[11px] font-medium text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 transition-colors cursor-pointer"
                        >
                          Retry
                        </button>
                      ) : (
                        <span className="text-[11px] font-medium text-rose-600">
                          Action required
                        </span>
                      )
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Calm Environment Acknowledgment Checkbox (Starts strictly UNCHECKED) */}
          <button 
            type="button"
            id="confirm-environment-toggle"
            role="checkbox"
            aria-checked={agreed}
            onClick={() => setAgreed(!agreed)}
            className="flex items-center gap-2.5 px-1 py-1.5 text-[12px] text-[#52525B] select-none cursor-pointer group text-left w-full focus:outline-none"
          >
            <div className={`w-4 h-4 rounded flex items-center justify-center shrink-0 transition-colors ${
              agreed ? 'bg-[#2563EB] text-white' : 'border border-zinc-300 bg-white group-hover:border-[#2563EB]/60'
            }`}>
              {agreed && <Check size={11} strokeWidth={3} />}
            </div>
            <span className="leading-snug">
              I confirm my environment is well-lit, quiet, and ready for evaluation.
            </span>
          </button>
        </motion.div>

      </div>

      {/* Fullscreen Error Alert if any */}
      <AnimatePresence>
        {fullscreenError && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            className="my-1 overflow-hidden text-left shrink-0"
          >
            <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
              <AlertTriangle size={14} className="shrink-0 text-rose-600" />
              <span>{fullscreenError}</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ======================================================== */}
      {/* 3. BOTTOM: MINIMAL INFO LINE & PRIMARY ACTION CTA        */}
      {/* ======================================================== */}
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, delay: 0.12, ease: [0.16, 1, 0.3, 1] }}
        className="pt-3 pb-1 border-t border-black/[0.06] flex items-center justify-between gap-3 shrink-0"
      >
        {/* Minimal Assessment Info Line with pl-12 for dev icon clearance */}
        <div className="pl-12 sm:pl-14 text-[12px] text-[#71717A] font-medium text-left">
          <span>60 minutes</span>
          <span className="mx-2 text-black/20">·</span>
          <span>60 questions</span>
          <span className="mx-2 text-black/20">·</span>
          <span>Autosave enabled</span>
          <span className="mx-2 text-black/20">·</span>
          <span>Fullscreen proctoring</span>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2.5 shrink-0">
          {(!checks.find(c => c.id === 'camera') || checks.find(c => c.id === 'camera')?.status !== 'passed') && agreed && (
            <span className="hidden sm:inline-flex items-center gap-1.5 text-[11px] font-medium text-rose-600 bg-rose-50 px-3 py-1 rounded-full border border-rose-200">
              <AlertTriangle size={12} className="text-rose-500" />
              <span>Face required in camera to start</span>
            </span>
          )}

          <button
            type="button"
            onClick={onBack}
            disabled={isStarting}
            className="px-3.5 py-2 rounded-full text-xs font-medium text-[#71717A] hover:text-[#2563EB] transition-colors flex items-center gap-1 cursor-pointer disabled:opacity-50"
          >
            <ArrowLeft size={13} />
            <span>Welcome</span>
          </button>

          <button
            type="button"
            onClick={onStartAssessment}
            disabled={
              !isOverallReady || 
              !agreed || 
              isStarting || 
              isChecking || 
              checks.find(c => c.id === 'camera')?.status !== 'passed'
            }
            className="px-7 py-2.5 sm:py-3 rounded-full bg-[#2563EB] hover:bg-[#1D4ED8] active:bg-[#1E40AF] active:scale-[0.985] text-white font-medium text-[14px] shadow-sm hover:shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer disabled:bg-black/[0.08] disabled:text-[#A1A1AA] disabled:cursor-not-allowed disabled:shadow-none disabled:active:scale-100 group"
          >
            {isStarting ? (
              <>
                <Loader2 size={15} className="animate-spin text-white" />
                <span>Launching...</span>
              </>
            ) : (
              <>
                <span>{isResumable ? 'Resume Assessment' : 'Continue to Assessment'}</span>
                <ArrowRight size={15} className="transition-transform duration-200 group-hover:translate-x-1" />
              </>
            )}
          </button>
        </div>
      </motion.div>

    </div>
  );
}
