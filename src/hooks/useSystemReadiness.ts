import { useState, useCallback, useEffect } from 'react';
import { 
  ReadinessCheck, 
  ReadinessStatus, 
  checkBrowser, 
  checkNetwork, 
  checkStorage, 
  checkFullscreenSupport, 
  checkCameraSupport,
  requestCameraPermission,
  checkMicrophoneSupport,
  requestMicrophonePermission
} from '@/lib/readiness/readinessEngine';

export const useSystemReadiness = () => {
  const [checks, setChecks] = useState<Record<string, ReadinessCheck>>({
    browser: { id: 'browser', label: 'Browser Compatibility', status: 'idle', message: 'Waiting to check...', blocking: true, canRetry: true },
    network: { id: 'network', label: 'Network Connection', status: 'idle', message: 'Waiting to check...', blocking: true, canRetry: true },
    storage: { id: 'storage', label: 'Local Storage', status: 'idle', message: 'Waiting to check...', blocking: true, canRetry: true },
    fullscreen: { id: 'fullscreen', label: 'Fullscreen Support', status: 'idle', message: 'Waiting to check...', blocking: true, canRetry: false },
    camera: { id: 'camera', label: 'Webcam Proctoring', status: 'idle', message: 'Waiting to check...', blocking: true, canRetry: true },
  });

  const [isOverallReady, setIsOverallReady] = useState(false);
  const [isChecking, setIsChecking] = useState(false);

  const updateCheck = (id: string, updates: Partial<ReadinessCheck>) => {
    setChecks(prev => ({
      ...prev,
      [id]: { ...prev[id], ...updates }
    }));
  };

  const runBasicChecks = useCallback(async () => {
    setIsChecking(true);
    
    // Set to checking
    updateCheck('browser', { status: 'checking', message: 'Checking browser capabilities...' });
    updateCheck('network', { status: 'checking', message: 'Pinging assessment servers...' });
    updateCheck('storage', { status: 'checking', message: 'Verifying local storage...' });
    updateCheck('fullscreen', { status: 'checking', message: 'Verifying fullscreen API...' });
    updateCheck('camera', { status: 'checking', message: 'Checking webcam availability...' });

    // Run parallel
    const [browserRes, networkRes, storageRes, fullscreenRes, cameraRes] = await Promise.all([
      checkBrowser(),
      checkNetwork(),
      checkStorage(),
      checkFullscreenSupport(),
      checkCameraSupport(),
    ]);

    updateCheck('browser', browserRes);
    updateCheck('network', networkRes);
    updateCheck('storage', storageRes);
    updateCheck('fullscreen', fullscreenRes);
    updateCheck('camera', cameraRes);

    setIsChecking(false);
  }, []);

  const retryCheck = async (id: string) => {
    updateCheck(id, { status: 'checking', message: 'Retrying...' });
    
    let res: { status: ReadinessStatus; message: string };
    switch (id) {
      case 'browser': res = await checkBrowser(); break;
      case 'network': res = await checkNetwork(); break;
      case 'storage': res = await checkStorage(); break;
      case 'fullscreen': res = await checkFullscreenSupport(); break;
      case 'camera': res = await checkCameraSupport(); break;
      case 'microphone': res = await checkMicrophoneSupport(); break;
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
      updateCheck('microphone', { status: 'checking', message: 'Requesting permission...' });
      const res = await requestMicrophonePermission();
      updateCheck('microphone', res);
    }
  };

  useEffect(() => {
    const allRequiredPassed = Object.values(checks).every(
      check => !check.blocking || check.status === 'passed'
    );
    setIsOverallReady(allRequiredPassed);
  }, [checks]);

  // Network listener
  useEffect(() => {
    const handleOnline = () => retryCheck('network');
    const handleOffline = () => updateCheck('network', { status: 'failed', message: 'Connection lost.' });
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return {
    checks: Object.values(checks),
    isOverallReady,
    isChecking,
    runBasicChecks,
    retryCheck,
    requestCamera,
    requestMicrophone
  };
};
