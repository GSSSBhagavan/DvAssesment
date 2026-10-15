export type ReadinessStatus = 'idle' | 'checking' | 'passed' | 'warning' | 'failed' | 'blocked' | 'requesting';

export type ReadinessCheck = {
  id: string;
  label: string;
  status: ReadinessStatus;
  message: string;
  blocking: boolean;
  canRetry: boolean;
};

// Advanced Browser Check
export const checkBrowser = async (): Promise<{ status: ReadinessStatus; message: string }> => {
  return new Promise((resolve) => {
    if (typeof window === 'undefined' || typeof navigator === 'undefined') {
      return resolve({ status: 'failed', message: 'Browser API not available.' });
    }

    const ua = navigator.userAgent;
    let browserName = "Unknown Browser";
    let browserVersion = 0;
    let isSupported = true;
    let missingApis = [];

    // Basic UA parsing
    if (/Chrome|CriOS/.test(ua) && !/Edg|OPR/.test(ua)) {
      browserName = "Chrome";
      browserVersion = parseInt((ua.match(/(?:Chrome|CriOS)\/(\d+)/) || [])[1], 10);
      if (browserVersion < 90) isSupported = false;
    } else if (/Firefox|FxiOS/.test(ua)) {
      browserName = "Firefox";
      browserVersion = parseInt((ua.match(/(?:Firefox|FxiOS)\/(\d+)/) || [])[1], 10);
      if (browserVersion < 85) isSupported = false;
    } else if (/Safari/.test(ua) && !/Chrome|CriOS|Edg|OPR/.test(ua)) {
      browserName = "Safari";
      browserVersion = parseInt((ua.match(/Version\/(\d+)/) || [])[1], 10);
      if (browserVersion < 14) isSupported = false;
    } else if (/Edg/.test(ua)) {
      browserName = "Edge";
      browserVersion = parseInt((ua.match(/Edg\/(\d+)/) || [])[1], 10);
      if (browserVersion < 90) isSupported = false;
    } else {
      isSupported = false;
    }

    // Required Modern APIs
    if (!window.MediaRecorder) missingApis.push("MediaRecorder");
    if (!window.indexedDB) missingApis.push("IndexedDB");
    if (!window.WebSocket) missingApis.push("WebSocket");
    if (!window.customElements) missingApis.push("WebComponents");

    // Headless / Anti-cheat simple check
    const isHeadless = navigator.webdriver || /HeadlessChrome/.test(ua) || window.outerWidth === 0;

    if (isHeadless) {
      return resolve({ status: 'failed', message: 'Automated or headless browsers are not permitted.' });
    }

    if (missingApis.length > 0) {
      return resolve({ status: 'warning', message: `Missing APIs: ${missingApis.join(", ")}. Test might be unstable.` });
    }

    if (!isSupported) {
      return resolve({ status: 'warning', message: `${browserName} ${browserVersion || ''} is outdated. Please update for best experience.` });
    }

    resolve({ status: 'passed', message: `${browserName} ${browserVersion} fully supported.` });
  });
};

// Advanced Network Check (Latency & Stability)
export const checkNetwork = async (): Promise<{ status: ReadinessStatus; message: string }> => {
  const { measureRealtimeNetwork } = await import('@/lib/readiness/networkDiagnostics');
  const metrics = await measureRealtimeNetwork();
  return { status: metrics.status, message: metrics.summary };
};

// Advanced Storage Check (LocalStorage, SessionStorage, IndexedDB)
export const checkStorage = async (): Promise<{ status: ReadinessStatus; message: string }> => {
  return new Promise(async (resolve) => {
    let lsWorking = false;
    let ssWorking = false;

    // 1. Check LocalStorage with a substantial payload (1KB)
    try {
      const payload = new Array(1024).join('x');
      localStorage.setItem('dv_storage_test', payload);
      const retrieved = localStorage.getItem('dv_storage_test');
      if (retrieved === payload) lsWorking = true;
      localStorage.removeItem('dv_storage_test');
    } catch (e) {
      // Ignored
    }

    // 2. Check SessionStorage
    try {
      sessionStorage.setItem('dv_session_test', '1');
      sessionStorage.removeItem('dv_session_test');
      ssWorking = true;
    } catch (e) {
      // Ignored
    }

    if (!lsWorking) {
      return resolve({ status: 'failed', message: 'Browser storage blocked. Please disable Incognito/Private mode.' });
    }

    // 3. Check IndexedDB
    if (window.indexedDB) {
      resolve({ status: 'passed', message: 'Local & IndexedDB storage fully available.' });
    } else {
      resolve({ status: 'warning', message: 'Local storage works, but IndexedDB is missing.' });
    }
  });
};

// Advanced Fullscreen & Display Check
export const checkFullscreenSupport = async (): Promise<{ status: ReadinessStatus; message: string }> => {
  return new Promise((resolve) => {
    if (typeof document === 'undefined') {
      return resolve({ status: 'failed', message: 'DOM not ready.' });
    }

    const { width, height } = window.screen;
    const isMobileSize = width < 768 || height < 600;

    if (!document.fullscreenEnabled) {
      return resolve({ status: 'failed', message: 'Fullscreen API is blocked or not supported by browser.' });
    }

    if (isMobileSize) {
      return resolve({ status: 'warning', message: `Small resolution (${width}x${height}). Desktop recommended.` });
    }

    resolve({ status: 'passed', message: `Fullscreen supported. Resolution: ${width}x${height}.` });
  });
};

// Advanced Camera Permissions & Availability
export const checkCameraSupport = async (): Promise<{ status: ReadinessStatus; message: string }> => {
  if (typeof navigator === 'undefined' || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    return { status: 'failed', message: 'Webcam API strictly blocked or unsupported by browser.' };
  }

  // Camera verification must be initiated by student on each page visit/refresh
  return { status: 'requesting', message: 'Click "Enable Camera" to verify webcam.' };
};

// Actual camera hardware enumeration & verification
export const requestCameraPermission = async (): Promise<{ status: ReadinessStatus; message: string }> => {
  if (typeof navigator === 'undefined' || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    return { status: 'failed', message: 'Webcam API not supported in this browser.' };
  }

  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { width: { ideal: 640 }, height: { ideal: 480 } },
      audio: false
    });

    const videoTracks = stream.getVideoTracks();
    if (videoTracks.length > 0) {
      const trackLabel = videoTracks[0].label || 'Default Camera';

      // Stop test stream tracks
      videoTracks.forEach(track => track.stop());

      return {
        status: 'passed',
        message: `Camera active: ${trackLabel.length > 25 ? trackLabel.substring(0, 22) + '...' : trackLabel}`
      };
    } else {
      return { status: 'failed', message: 'Permission granted, but no video tracks found.' };
    }
  } catch (err: any) {
    if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
      return { status: 'failed', message: 'Camera permission denied. Please allow camera access in browser address bar.' };
    }
    if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
      return { status: 'failed', message: 'No physical webcam detected. Please connect a camera.' };
    }
    if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
      return { status: 'failed', message: 'Camera is currently in use by another application.' };
    }
    return { status: 'failed', message: `Camera error: ${err.message}` };
  }
};

// Advanced Microphone Permissions
export const checkMicrophoneSupport = async (): Promise<{ status: ReadinessStatus; message: string }> => {
  if (typeof navigator === 'undefined' || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    return { status: 'failed', message: 'Audio API strictly blocked or unsupported by browser.' };
  }

  // Use permissions API to check without prompting, if supported
  if (navigator.permissions && navigator.permissions.query) {
    try {
      const perm = await navigator.permissions.query({ name: 'microphone' as PermissionName });
      if (perm.state === 'granted') {
        return { status: 'passed', message: 'Microphone permission already granted.' };
      } else if (perm.state === 'denied') {
        return { status: 'failed', message: 'Microphone permission strictly denied in browser settings.' };
      } else {
        return { status: 'requesting', message: 'Microphone permission is required.' };
      }
    } catch (e) {
      // Permissions API might not support 'microphone' (e.g. Safari)
      return { status: 'requesting', message: 'Microphone access needs verification.' };
    }
  }

  // Fallback if permissions API is unsupported
  return { status: 'requesting', message: 'Microphone access needs verification.' };
};

// Actual hardware enumeration & stream request
export const requestMicrophonePermission = async (): Promise<{ status: ReadinessStatus; message: string }> => {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
    
    const audioTracks = stream.getAudioTracks();
    if (audioTracks.length > 0) {
      const trackLabel = audioTracks[0].label || 'Default Audio Device';
      
      // Stop it immediately, we don't want to record yet
      audioTracks.forEach(track => track.stop());
      
      return { 
        status: 'passed', 
        message: `Hardware active: ${trackLabel.length > 25 ? trackLabel.substring(0, 22) + '...' : trackLabel}`
      };
    } else {
      return { status: 'failed', message: 'Permission granted, but no microphone tracks found.' };
    }
  } catch (err: any) {
    if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
      return { status: 'failed', message: 'Microphone permission denied. Please allow it in settings.' };
    }
    if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
      return { status: 'failed', message: 'No physical microphone hardware detected.' };
    }
    if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
      return { status: 'failed', message: 'Microphone is currently in use by another application.' };
    }
    return { status: 'failed', message: `Hardware error: ${err.message}` };
  }
};
