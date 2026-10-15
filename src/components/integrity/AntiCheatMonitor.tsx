'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useAssessmentState } from '@/hooks/useAssessmentState';
import { useCamera, stopAllCameraStreams } from '@/hooks/useCamera';
import { useFaceDetection, FaceDetectionState, HeadOrientation } from '@/hooks/useFaceDetection';
import ProctoringStatusBar from './ProctoringStatusBar';
import { AlertTriangle, Maximize } from 'lucide-react';

export default function AntiCheatMonitor() {
  const { recordIntegrityEvent, status, setProctoringMessage } = useAssessmentState();
  const [isFullscreenExit, setIsFullscreenExit] = useState(false);
  const [currentFaceState, setCurrentFaceState] = useState<FaceDetectionState>('FACE_PRESENT');
  const [currentOrientation, setCurrentOrientation] = useState<HeadOrientation | null>(null);

  const isExamActive = status === 'IN_PROGRESS' || status === 'REVIEW';

  // Continuous Camera and Face Detection (only active during actual exam)
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const { attachVideo, status: cameraStatus, error: cameraError, stopCamera } = useCamera(isExamActive);
  
  const faceAbsentStartRef = useRef<number | null>(null);
  const lastLookingAwayReportedRef = useRef<number>(0);
  const lastOutOfFrameReportedRef = useRef<number>(0);

  // Stop camera hardware immediately when submitted or expired, or when component unmounts
  useEffect(() => {
    if (!isExamActive) {
      setIsFullscreenExit(false);
      stopCamera();
      stopAllCameraStreams();
    }
    return () => {
      stopCamera();
      stopAllCameraStreams();
    };
  }, [isExamActive, stopCamera]);

  useEffect(() => {
    if (videoRef.current && isExamActive) {
      attachVideo(videoRef.current);
    }
  }, [attachVideo, cameraStatus, isExamActive]);

  // Handle camera permission and device telemetry
  useEffect(() => {
    if (cameraStatus === 'denied') {
      setProctoringMessage('Camera permission was denied. Please allow camera access in browser settings.');
      recordIntegrityEvent('CAMERA_REVOKED', { reason: cameraError || 'Permission denied' });
    } else if (cameraStatus === 'error' || cameraStatus === 'not_found') {
      setProctoringMessage('Your camera connection was interrupted. Please restore it.');
      recordIntegrityEvent('CAMERA_DISCONNECTED', { reason: cameraError || 'Camera unavailable' });
    } else if (cameraStatus === 'active') {
      // Camera healthy
    }
  }, [cameraStatus, cameraError, recordIntegrityEvent, setProctoringMessage]);

  const handleFaceStateChange = useCallback((detectionState: FaceDetectionState, faceCount: number) => {
    setCurrentFaceState(detectionState);

    if (detectionState === 'NO_FACE') {
      const now = Date.now();
      if (!faceAbsentStartRef.current) {
        faceAbsentStartRef.current = now;
      }
      const durationMs = now - faceAbsentStartRef.current;
      setProctoringMessage('Please keep your face visible in the camera.');
      recordIntegrityEvent('FACE_LOST', { durationMs, faceCount: 0 });
    } else if (detectionState === 'FACE_PRESENT') {
      if (faceAbsentStartRef.current) {
        const durationMs = Date.now() - faceAbsentStartRef.current;
        faceAbsentStartRef.current = null;
        recordIntegrityEvent('FACE_RECOVERED', { totalAbsenceMs: durationMs });
      }
      setProctoringMessage(null);
    } else if (detectionState === 'MULTIPLE_FACES') {
      setProctoringMessage('Multiple people detected. Only the candidate should be visible.');
      recordIntegrityEvent('MULTIPLE_FACES', { faceCount });
    } else if (detectionState === 'LOOKING_AWAY') {
      const now = Date.now();
      if (now - lastLookingAwayReportedRef.current > 12000) {
        lastLookingAwayReportedRef.current = now;
        setProctoringMessage('Please maintain focus on your assessment screen.');
        recordIntegrityEvent('HEAD_POSE_DEVIATION', { reason: 'Sustained head orientation away from screen' });
      }
    } else if (detectionState === 'PARTIALLY_OUT_OF_FRAME') {
      const now = Date.now();
      if (now - lastOutOfFrameReportedRef.current > 12000) {
        lastOutOfFrameReportedRef.current = now;
        setProctoringMessage('Please center your face inside the camera frame.');
        recordIntegrityEvent('FACE_PARTIALLY_OUT_OF_FRAME', { reason: 'Face touching camera border' });
      }
    } else if (detectionState === 'DETECTION_UNAVAILABLE') {
      recordIntegrityEvent('DETECTION_UNAVAILABLE', { reason: 'Vision detector initializing or unavailable' });
    }
  }, [recordIntegrityEvent, setProctoringMessage]);

  const handleOrientationChange = useCallback((orient: HeadOrientation) => {
    setCurrentOrientation(orient);
  }, []);

  useFaceDetection({
    videoElement: videoRef.current,
    enabled: status === 'IN_PROGRESS' || status === 'REVIEW',
    onStateChange: handleFaceStateChange,
    onOrientationChange: handleOrientationChange
  });

  // Check on mount if we are not in fullscreen but should be
  useEffect(() => {
    if (
      typeof document !== 'undefined' && 
      !document.fullscreenElement && 
      (status === 'IN_PROGRESS' || status === 'REVIEW')
    ) {
      setIsFullscreenExit(true);
    }
  }, [status]);

  // Browser Integrity Event Listeners
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        setProctoringMessage('Assessment tab lost focus. Please return to your exam.');
        recordIntegrityEvent('TAB_SWITCH');
      }
    };

    const handleWindowBlur = () => {
      recordIntegrityEvent('WINDOW_BLUR');
    };

    const handleFullscreenChange = () => {
      if (status !== 'IN_PROGRESS' && status !== 'REVIEW') {
        setIsFullscreenExit(false);
        return;
      }
      if (!document.fullscreenElement) {
        recordIntegrityEvent('FULLSCREEN_EXIT');
        setIsFullscreenExit(true);
      } else {
        setIsFullscreenExit(false);
      }
    };

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      recordIntegrityEvent('PAGE_LEAVE_ATTEMPT');
      e.preventDefault();
      e.returnValue = '';
    };

    const handleCopyPaste = (e: ClipboardEvent) => {
      // Prevent copy/paste of assessment questions and record event
      const target = e.target as HTMLElement;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) {
        // Allow typing within text input if needed, but flag clipboard manipulation
        recordIntegrityEvent('COPY_PASTE_ATTEMPT', { type: e.type });
      } else {
        e.preventDefault();
        recordIntegrityEvent('COPY_PASTE_ATTEMPT', { type: e.type });
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      // Detect prohibited shortcuts: Ctrl+C, Ctrl+V, F12 (DevTools), Ctrl+Shift+I
      if (
        (e.ctrlKey || e.metaKey) && 
        (e.key === 'c' || e.key === 'v' || e.key === 'u' || e.key === 's')
      ) {
        recordIntegrityEvent('RESTRICTED_KEY_COMBO', { key: e.key });
      } else if (e.key === 'F12' || ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'I')) {
        e.preventDefault();
        recordIntegrityEvent('RESTRICTED_KEY_COMBO', { key: 'DevTools' });
      }
    };

    const handleOffline = () => {
      setProctoringMessage('Internet connection lost. Reconnecting...');
      recordIntegrityEvent('CONNECTION_LOST');
    };

    const handleOnline = () => {
      setProctoringMessage(null);
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('blur', handleWindowBlur);
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    window.addEventListener('beforeunload', handleBeforeUnload);
    document.addEventListener('copy', handleCopyPaste);
    document.addEventListener('cut', handleCopyPaste);
    document.addEventListener('paste', handleCopyPaste);
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('offline', handleOffline);
    window.addEventListener('online', handleOnline);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('blur', handleWindowBlur);
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      window.removeEventListener('beforeunload', handleBeforeUnload);
      document.removeEventListener('copy', handleCopyPaste);
      document.removeEventListener('cut', handleCopyPaste);
      document.removeEventListener('paste', handleCopyPaste);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('online', handleOnline);
    };
  }, [recordIntegrityEvent, setProctoringMessage]);

  const requestFullscreen = async () => {
    try {
      if (document.documentElement.requestFullscreen) {
        await document.documentElement.requestFullscreen();
        setIsFullscreenExit(false);
      }
    } catch (e) {
      console.error('Failed to re-enter fullscreen:', e);
    }
  };

  return (
    <>
      {/* Hidden local video element feeding MediaPipe vision pipeline */}
      <video ref={videoRef} autoPlay playsInline muted className="hidden" aria-hidden="true" />

      {/* Top Proctoring Status Indicator */}
      <ProctoringStatusBar
        cameraStatus={cameraStatus}
        faceState={currentFaceState}
        isLookingAway={currentOrientation?.isLookingAway}
      />

      {/* Fullscreen Required Modal */}
      {isFullscreenExit && (
        <div className="fixed inset-0 z-[9999] bg-slate-900/95 backdrop-blur-sm flex items-center justify-center p-6 font-sans">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-10 flex flex-col items-center text-center border border-slate-200">
            <div className="w-16 h-16 bg-[#FEF2F2] rounded-full flex items-center justify-center mb-6 shadow-inner">
              <AlertTriangle className="text-[#DC2626]" size={32} />
            </div>
            <h2 className="text-2xl font-bold text-slate-900 mb-3 tracking-tight">Fullscreen Required</h2>
            <p className="text-slate-600 mb-8 leading-relaxed text-[15px]">
              You have exited fullscreen mode. This has been recorded by the proctoring engine. The assessment is paused and you must return to fullscreen to continue.
            </p>
            <button 
              onClick={requestFullscreen}
              className="bg-[#DC2626] hover:bg-[#B91C1C] text-white px-8 py-4 rounded-xl font-bold text-[13px] uppercase tracking-widest transition-all flex items-center gap-3 shadow-lg hover:shadow-xl hover:-translate-y-0.5 active:translate-y-0 cursor-pointer"
            >
              <Maximize size={18} /> Return to Fullscreen
            </button>
          </div>
        </div>
      )}
    </>
  );
}
