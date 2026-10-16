'use client';
import { useAssessmentState } from '@/hooks/useAssessmentState';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useCallback } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useSystemReadiness } from '@/hooks/useSystemReadiness';
import { useCamera, stopAllCameraStreams, exitFullscreenSafely } from '@/hooks/useCamera';
import { FaceStateInfo } from '@/hooks/useFaceDetection';
import AssessmentBrandHeader from '@/components/brand/AssessmentBrandHeader';
import AssessmentReadiness from '@/components/assessment/AssessmentReadiness';
import AssessmentCompletion from '@/components/assessment/AssessmentCompletion';
import DVWelcomeScreen from '@/components/welcome/DVWelcomeScreen';

interface CandidateProfile {
  id?: string;
  email?: string;
  fullName?: string;
  role?: string;
}

export default function LandingPage() {
  const { status, setStatus, startAssessment, submittedAt, assessmentId } = useAssessmentState();
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [candidateUser, setCandidateUser] = useState<CandidateProfile | null>(null);
  const [fullscreenError, setFullscreenError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const [viewMode, setViewMode] = useState<'AUTO' | 'HOME' | 'COMPLETION'>('AUTO');

  // Real-time face detection telemetry
  const [faceState, setFaceState] = useState<FaceStateInfo>({
    state: 'DETECTION_UNAVAILABLE',
    faceCount: 0,
    isModelLoaded: false,
    isLoadingModel: false,
    error: null
  });

  // Camera controller (explicit user action required; no autoStart on refresh)
  const camera = useCamera(false);

  // System readiness diagnostics synced with camera state and face verification
  const {
    checks,
    networkMetrics,
    isOverallReady,
    isChecking,
    runBasicChecks,
    retryCheck,
    requestCamera
  } = useSystemReadiness(camera.status, camera.deviceLabel, faceState);

  // Auth and session validation
  const checkUserAndSession = useCallback(async () => {
    try {
      const meRes = await fetch('/api/auth/me');
      if (!meRes.ok) {
        setCandidateUser(null);
        setCheckingAuth(false);
        return;
      }

      const data = await meRes.json();

      if (data.user) {
        if (data.user.role === 'ADMIN') {
          router.replace('/admin');
          return;
        }
        setCandidateUser(data.user);
      } else {
        setCandidateUser(null);
        setCheckingAuth(false);
        return;
      }

      try {
        const currRes = await fetch('/api/assessment/current');
        const curr = await currRes.json();

        if (curr.session) {
          if (curr.session.status === 'IN_PROGRESS' || curr.session.status === 'REVIEW') {
            useAssessmentState.setState({
              status: 'IN_PROGRESS',
              assessmentId: curr.session.id,
              startTime: new Date(curr.session.startedAt).getTime(),
              endTime: new Date(curr.session.expiresAt).getTime()
            });
            router.replace('/assessment');
            return;
          } else if (curr.session.status === 'SUBMITTED' || curr.session.status === 'EXPIRED') {
            useAssessmentState.setState({
              status: curr.session.status,
              assessmentId: curr.session.id,
              startTime: new Date(curr.session.startedAt).getTime(),
              endTime: new Date(curr.session.expiresAt).getTime(),
              submittedAt: curr.session.submittedAt ? new Date(curr.session.submittedAt).getTime() : Date.now()
            });
          } else {
            // Not started yet - initialize to SYSTEM_CHECK for readiness flow
            setStatus('SYSTEM_CHECK');
          }
        } else {
          // No session yet - set to SYSTEM_CHECK so candidate enters readiness
          setStatus('SYSTEM_CHECK');
        }
      } catch (e) {
        console.error('Error checking active session:', e);
      }

      setCheckingAuth(false);
    } catch (err) {
      setCandidateUser(null);
      setCheckingAuth(false);
    }
  }, [router, setStatus]);

  useEffect(() => {
    checkUserAndSession();
  }, [checkUserAndSession]);

  const handleLoginSuccess = useCallback(async (user?: CandidateProfile) => {
    if (user) {
      if (user.role === 'ADMIN') {
        router.replace('/admin');
        return;
      }
      setCandidateUser(user);
    }
    await checkUserAndSession();
  }, [checkUserAndSession, router]);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Run checks automatically when entering SYSTEM_CHECK state
  useEffect(() => {
    if (candidateUser && (status === 'SYSTEM_CHECK' || status === 'NOT_STARTED')) {
      const t = setTimeout(() => runBasicChecks(), 300);
      return () => clearTimeout(t);
    }
  }, [status, candidateUser, runBasicChecks]);

  // Ensure camera hardware is stopped and fullscreen exited on completion screen
  useEffect(() => {
    if (status === 'SUBMITTED' || status === 'EXPIRED') {
      exitFullscreenSafely();
      stopAllCameraStreams();
      const t1 = setTimeout(stopAllCameraStreams, 200);
      const t2 = setTimeout(stopAllCameraStreams, 800);
      return () => {
        clearTimeout(t1);
        clearTimeout(t2);
        stopAllCameraStreams();
      };
    }
  }, [status]);

  const handleHome = () => {
    setViewMode('HOME');
  };

  const handleSignOut = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch (e) {
      console.error(e);
    }
    useAssessmentState.getState().resetState();
    setCandidateUser(null);
    setViewMode('AUTO');
    setStatus('NOT_STARTED');
  };

  const handleStart = async () => {
    setFullscreenError(null);

    // 1. Verify camera availability
    let isCameraActive = camera.status === 'active' || (camera.stream && camera.stream.active);
    if (!isCameraActive) {
      const camCheck = checks.find(c => c.id === 'camera');
      if (camCheck && camCheck.status === 'passed') {
        isCameraActive = true;
      }
    }

    if (!isCameraActive) {
      try {
        const stream = await camera.startCamera();
        if (stream && stream.active) {
          isCameraActive = true;
        }
      } catch (camErr) {
        console.warn('Camera verification check:', camErr);
      }
    }

    if (!isCameraActive) {
      setFullscreenError("Webcam verification is required for proctored examination. Please grant camera permission in your browser to proceed.");
      return;
    }

    // 2. Strict Face Verification Gate: Real-time face must be actively detected and centered
    if (faceState.state !== 'FACE_PRESENT' || faceState.faceCount !== 1) {
      if (faceState.state === 'MULTIPLE_FACES' || faceState.faceCount > 1) {
        setFullscreenError("Proctoring security alert: Multiple faces detected in camera. Only the candidate may be visible.");
      } else {
        setFullscreenError("Face verification failed: No face detected. Please ensure your webcam shutter is open and your face is centered in the camera to begin.");
      }
      return;
    }

    // 3. Strict Biometric Snapshot Gate: Zero-DB local snapshot verification
    const snapshot = typeof window !== 'undefined' ? sessionStorage.getItem('dv_candidate_face_snapshot') : null;
    if (!snapshot) {
      setFullscreenError("Biometric face snapshot required before starting exam. Please click 'Capture Face Snapshot & Verify Identity'.");
      return;
    }

    setStarting(true);
    try {
      if (document.documentElement.requestFullscreen) {
        await document.documentElement.requestFullscreen().catch(() => {});
      }
      await startAssessment(60); // 60 minutes server authoritative
      router.push('/assessment');
    } catch (err: any) {
      console.error('Assessment launch failed:', err);
      setFullscreenError("Unable to initialize assessment session. Please retry.");
      setStarting(false);
    }
  };

  // Initial loading state while verifying mount & auth
  if (!mounted || checkingAuth) {
    return (
      <div className="min-h-screen bg-[#FAF8F5] text-[#18181B] flex flex-col items-center justify-center font-sans">
        <div className="w-8 h-8 rounded-full border-2 border-slate-200 border-t-[#0071E3] animate-spin mb-3" />
        <span className="text-xs font-mono font-medium text-slate-500 uppercase tracking-widest">
          DV Labs · Initializing...
        </span>
      </div>
    );
  }

  // ========================================================
  // STAGE 1: UNAUTHENTICATED CANDIDATE ENTRY
  // Premium two-column DV Labs welcome screen (NO navbar, pure focus)
  // ========================================================
  if (!candidateUser) {
    return (
      <DVWelcomeScreen
        isAuthenticated={false}
        onLoginSuccess={handleLoginSuccess}
      />
    );
  }

  // ========================================================
  // STAGE 1.1: AUTHENTICATED USER IN 'HOME' VIEW MODE
  // ========================================================
  if (viewMode === 'HOME') {
    return (
      <DVWelcomeScreen
        isAuthenticated={true}
        candidateName={candidateUser.fullName}
        onContinueToReadiness={() => {
          setViewMode('AUTO');
          setStatus('SYSTEM_CHECK');
        }}
        onSignOut={handleSignOut}
      />
    );
  }

  // ========================================================
  // STAGE 2: AUTHENTICATED CANDIDATE ASSESSMENT FLOW
  // (Readiness Studio & System Checks, Completion Results)
  // ========================================================
  const stepLabel = (status === 'SUBMITTED' || status === 'EXPIRED')
    ? 'Completed'
    : '02 · Readiness';

  const isReadinessScreen = status === 'SYSTEM_CHECK' || status === 'RULES' || status === 'NOT_STARTED';

  return (
    <div className="h-screen w-full bg-[#FAF8F5] text-[#121214] flex flex-col font-sans relative overflow-hidden selection:bg-[#DC2626]/15 selection:text-[#DC2626]">
      {/* Main Content Viewport */}
      <main className="flex-1 w-full h-full flex flex-col items-center justify-center overflow-hidden">
        <AnimatePresence mode="wait">
          
          {/* SCREEN TWO: READINESS & INSTRUCTIONS */}
          {isReadinessScreen && (
            <motion.div
              key="readiness_screen"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              className="w-full h-full flex items-center justify-center overflow-hidden"
            >
              <AssessmentReadiness
                checks={checks}
                networkMetrics={networkMetrics}
                isOverallReady={isOverallReady}
                isChecking={isChecking}
                runBasicChecks={runBasicChecks}
                retryCheck={retryCheck}
                requestCamera={camera.startCamera}
                camera={camera}
                onBack={handleHome}
                onStartAssessment={handleStart}
                isStarting={starting}
                fullscreenError={fullscreenError}
                candidateName={candidateUser?.fullName}
                isResumable={Boolean(assessmentId)}
                onSignOut={handleSignOut}
                faceState={faceState}
                onFaceDetectionChange={setFaceState}
              />
            </motion.div>
          )}

          {/* SCREEN THREE: COMPLETION EXPERIENCE (FOR SUBMITTED SESSIONS) */}
          {(status === 'SUBMITTED' || status === 'EXPIRED') && (
            <motion.div
              key="completion_screen"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              className="w-full flex justify-center"
            >
              <AssessmentCompletion
                sessionId={assessmentId}
                submittedAt={submittedAt}
                candidateName={candidateUser?.fullName}
                onHome={handleHome}
                onFinish={handleSignOut}
              />
            </motion.div>
          )}

        </AnimatePresence>
      </main>
    </div>
  );
}
