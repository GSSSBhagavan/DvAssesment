import { useState, useCallback, useEffect, useRef } from 'react';
import { 
  ReadinessCheck, 
  ReadinessStatus, 
  checkBrowser, 
  checkNetwork, 
  checkFullscreenSupport, 
  checkCameraSupport,
  requestCameraPermission,
  checkMicrophoneSupport,
  requestMicrophonePermission
} from '@/lib/readiness/readinessEngine';
import { measureRealtimeNetwork, NetworkMetrics } from '@/lib/readiness/networkDiagnostics';
import { CameraStatus } from '@/hooks/useCamera';
import { MicrophoneStatus } from '@/hooks/useMicrophone';
import { FaceStateInfo } from '@/hooks/useFaceDetection';

export const useSystemReadiness = (
  cameraStatus?: CameraStatus, 
  cameraLabel?: string | null,
  faceState?: FaceStateInfo,
  microphoneStatus?: MicrophoneStatus,
  microphoneLabel?: string | null,
  faceSnapshotCaptured?: boolean
) => {
  const [checks, setChecks] = useState<Record<string, ReadinessCheck>>({
    camera: { id: 'camera', label: 'Camera & Biometric Verification', status: 'requesting', message: 'Click "Enable Camera" to verify webcam.', blocking: true, canRetry: true },
    microphone: { id: 'microphone', label: 'Microphone access', status: 'requesting', message: 'Click "Enable Mic" to verify audio.', blocking: true, canRetry: true },
    browser: { id: 'browser', label: 'Browser Compatibility', status: 'idle', message: 'Waiting to check...', blocking: true, canRetry: true },
    network: { id: 'network', label: 'Network connection', status: 'idle', message: 'Measuring real-time connection...', blocking: true, canRetry: true },
    fullscreen: { id: 'fullscreen', label: 'Fullscreen Support', status: 'idle', message: 'Waiting to check...', blocking: true, canRetry: false },
  });

  const [networkMetrics, setNetworkMetrics] = useState<NetworkMetrics | null>(null);
  const [isOverallReady, setIsOverallReady] = useState(false);
  const [isChecking, setIsChecking] = useState(false);

  const mountedRef = useRef(true);

  const updateCheck = useCallback((id: string, updates: Partial<ReadinessCheck>) => {
    setChecks(prev => ({
      ...prev,
      [id]: { ...prev[id], ...updates }
    }));
  }, []);

  // Synchronize camera state & real-time face verification with readiness checklist
  useEffect(() => {
    if (!cameraStatus) return;

    if (cameraStatus === 'active') {
      if (faceState) {
        if (faceState.isLoadingModel || (!faceState.isModelLoaded && faceState.state === 'DETECTION_UNAVAILABLE')) {
          updateCheck('camera', {
            status: 'checking',
            message: 'Camera active · Initializing face detection model...'
          });
        } else if (faceState.state === 'FACE_PRESENT') {
          if (faceSnapshotCaptured) {
            updateCheck('camera', {
              status: 'passed',
              message: cameraLabel ? `Face snapshot verified · ${cameraLabel}` : 'Face snapshot verified · Proctoring active'
            });
          } else {
            updateCheck('camera', {
              status: 'failed',
              message: 'Face centered. Click "Capture Face Snapshot & Verify Identity" below to complete.'
            });
          }
        } else if (faceState.state === 'NO_FACE') {
          updateCheck('camera', {
            status: 'failed',
            message: 'No face detected. Please ensure your webcam is uncovered and face is centered.'
          });
        } else if (faceState.state === 'MULTIPLE_FACES') {
          updateCheck('camera', {
            status: 'failed',
            message: `Multiple faces detected (${faceState.faceCount}). Only the candidate must be present.`
          });
        } else if (faceState.state === 'LOOKING_AWAY') {
          updateCheck('camera', {
            status: 'failed',
            message: 'Face detected. Please look directly into the camera to verify.'
          });
        } else if (faceState.state === 'PARTIALLY_OUT_OF_FRAME') {
          updateCheck('camera', {
            status: 'failed',
            message: 'Face partially out of frame. Please center your face inside the camera.'
          });
        } else {
          updateCheck('camera', {
            status: 'checking',
            message: 'Camera active · Scanning for face in frame...'
          });
        }
      } else {
        updateCheck('camera', {
          status: 'checking',
          message: 'Camera active · Waiting for face detection...'
        });
      }
    } else if (cameraStatus === 'denied') {
      updateCheck('camera', {
        status: 'failed',
        message: 'Camera permission denied. Please allow camera access in browser address bar.'
      });
    } else if (cameraStatus === 'not_found') {
      updateCheck('camera', {
        status: 'failed',
        message: 'No physical webcam detected. Please connect a camera.'
      });
    } else if (cameraStatus === 'in_use') {
      updateCheck('camera', {
        status: 'failed',
        message: 'Camera is currently in use by another application.'
      });
    } else if (cameraStatus === 'requesting') {
      updateCheck('camera', {
        status: 'checking',
        message: 'Initializing camera preview...'
      });
    } else if (cameraStatus === 'idle') {
      updateCheck('camera', {
        status: 'requesting',
        message: 'Click "Enable Camera" to verify webcam.'
      });
    }
  }, [cameraStatus, cameraLabel, faceState, faceSnapshotCaptured, updateCheck]);

  // Synchronize microphone permission with readiness checklist
  useEffect(() => {
    if (!microphoneStatus) return;

    if (microphoneStatus === 'active') {
      updateCheck('microphone', {
        status: 'passed',
        message: microphoneLabel ? `Microphone active: ${microphoneLabel}` : 'Microphone active · Audio proctoring ready'
      });
    } else if (microphoneStatus === 'denied') {
      updateCheck('microphone', {
        status: 'failed',
        message: 'Microphone permission denied. Please allow microphone in browser address bar.'
      });
    } else if (microphoneStatus === 'not_found') {
      updateCheck('microphone', {
        status: 'failed',
        message: 'No microphone hardware detected. Please connect a microphone.'
      });
    } else if (microphoneStatus === 'in_use') {
      updateCheck('microphone', {
        status: 'failed',
        message: 'Microphone is currently in use by another application.'
      });
    } else if (microphoneStatus === 'requesting') {
      updateCheck('microphone', {
        status: 'checking',
        message: 'Testing microphone access...'
      });
    } else if (microphoneStatus === 'idle') {
      updateCheck('microphone', {
        status: 'requesting',
        message: 'Click "Enable Mic" to verify microphone.'
      });
    }
  }, [microphoneStatus, microphoneLabel, updateCheck]);

  // Run the full diagnostics suite
  const runBasicChecks = useCallback(async () => {
    setIsChecking(true);
    
    updateCheck('browser', { status: 'checking', message: 'Checking browser capabilities...' });
    updateCheck('network', { status: 'checking', message: 'Measuring real-time latency...' });
    updateCheck('fullscreen', { status: 'checking', message: 'Verifying fullscreen API...' });
    updateCheck('camera', { status: 'requesting', message: 'Click "Enable Camera" to verify webcam.' });
    updateCheck('microphone', { status: 'requesting', message: 'Click "Enable Mic" to verify microphone.' });

    const [browserRes, netMetrics, fullscreenRes] = await Promise.all([
      checkBrowser(),
      measureRealtimeNetwork(),
      checkFullscreenSupport()
    ]);

    if (!mountedRef.current) return;

    setNetworkMetrics(netMetrics);
    updateCheck('browser', browserRes);
    updateCheck('network', { status: netMetrics.status, message: netMetrics.summary });
    updateCheck('fullscreen', fullscreenRes);

    setIsChecking(false);
  }, [updateCheck]);

  const retryCheck = async (id: string) => {
    updateCheck(id, { status: 'checking', message: 'Retrying...' });
    
    let res: { status: ReadinessStatus; message: string };
    switch (id) {
      case 'browser': res = await checkBrowser(); break;
      case 'network': {
        const m = await measureRealtimeNetwork();
        setNetworkMetrics(m);
        res = { status: m.status, message: m.summary };
        break;
      }
      case 'fullscreen': res = await checkFullscreenSupport(); break;
      case 'camera': res = await requestCameraPermission(); break;
      case 'microphone': res = await requestMicrophonePermission(); break;
      default: return;
    }
    
    updateCheck(id, res);
  };

  const requestCamera = async () => {
    updateCheck('camera', { status: 'checking', message: 'Requesting camera permission...' });
    const res = await requestCameraPermission();
    updateCheck('camera', res);
  };

  const requestMicrophone = async () => {
    if (checks['microphone']) {
      updateCheck('microphone', { status: 'checking', message: 'Requesting microphone permission...' });
      const res = await requestMicrophonePermission();
      updateCheck('microphone', res);
    }
  };

  // Overall readiness validation: ALL blocking items must be 'passed'
  useEffect(() => {
    const allRequiredPassed = Object.values(checks).every(
      check => !check.blocking || check.status === 'passed'
    );
    setIsOverallReady(allRequiredPassed);
  }, [checks]);

  // Real-time network monitoring loop (polling every 3.5s with non-blocking pings)
  useEffect(() => {
    mountedRef.current = true;

    const performNetworkPulse = async () => {
      if (document.hidden) return; // Save bandwidth when tab is backgrounded
      try {
        const metrics = await measureRealtimeNetwork();
        if (mountedRef.current) {
          setNetworkMetrics(metrics);
          updateCheck('network', {
            status: metrics.status,
            message: metrics.summary
          });
        }
      } catch {
        // Handled within measureRealtimeNetwork
      }
    };

    performNetworkPulse();
    const interval = setInterval(performNetworkPulse, 3500);

    const handleOnline = () => performNetworkPulse();
    const handleOffline = () => {
      if (mountedRef.current) {
        setNetworkMetrics({
          latencyMs: 0,
          jitterMs: 0,
          quality: 'offline',
          effectiveType: 'None',
          downlinkMbps: 0,
          status: 'failed',
          summary: 'No internet connection detected.',
          realtimePillText: 'Offline',
          timestamp: Date.now()
        });
        updateCheck('network', { status: 'failed', message: 'No internet connection detected.' });
      }
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    const connection = (navigator as any).connection || (navigator as any).mozConnection || (navigator as any).webkitConnection;
    if (connection && connection.addEventListener) {
      connection.addEventListener('change', performNetworkPulse);
    }

    return () => {
      mountedRef.current = false;
      clearInterval(interval);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      if (connection && connection.removeEventListener) {
        connection.removeEventListener('change', performNetworkPulse);
      }
    };
  }, [updateCheck]);

  return {
    checks: Object.values(checks),
    networkMetrics,
    isOverallReady,
    isChecking,
    runBasicChecks,
    retryCheck,
    requestCamera,
    requestMicrophone,
    updateCheck
  };
};
