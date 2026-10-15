'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

export type CameraStatus =
  | 'idle'
  | 'requesting'
  | 'active'
  | 'denied'
  | 'not_found'
  | 'in_use'
  | 'unsupported'
  | 'error';

export interface UseCameraReturn {
  stream: MediaStream | null;
  status: CameraStatus;
  error: string | null;
  deviceLabel: string | null;
  startCamera: () => Promise<MediaStream | null>;
  stopCamera: () => void;
  attachVideo: (videoElement: HTMLVideoElement | null) => void;
}

// Global active stream reference and comprehensive active track registry
let activeGlobalStream: MediaStream | null = null;
let activeStreamUsers = 0;

const globalTrackedStreams = new Set<MediaStream>();
const globalTrackedTracks = new Set<MediaStreamTrack>();

// Automatically intercept and track all getUserMedia streams in browser so no track can ever leak
if (typeof window !== 'undefined' && navigator.mediaDevices && typeof navigator.mediaDevices.getUserMedia === 'function') {
  const mediaDevices = navigator.mediaDevices as any;
  if (!mediaDevices.__isDvCameraTracked) {
    const originalGetUserMedia = mediaDevices.getUserMedia.bind(mediaDevices);
    mediaDevices.getUserMedia = async function (constraints: MediaStreamConstraints) {
      const stream: MediaStream = await originalGetUserMedia(constraints);
      try {
        if (stream) {
          globalTrackedStreams.add(stream);
          stream.getTracks().forEach((track) => {
            globalTrackedTracks.add(track);
            track.addEventListener('ended', () => {
              globalTrackedTracks.delete(track);
            });
          });
        }
      } catch (err) {
        // ignore
      }
      return stream;
    };
    mediaDevices.__isDvCameraTracked = true;
    window.addEventListener('beforeunload', () => stopAllCameraStreams());
    window.addEventListener('pagehide', () => stopAllCameraStreams());
  }
}

/**
 * Unconditionally and forcefully terminates all active camera tracks and releases webcam hardware.
 * Invoked immediately upon assessment submission, time expiration, and navigation to the completion screen.
 */
export function stopAllCameraStreams(): void {
  activeStreamUsers = 0;

  // 1. Forcefully stop activeGlobalStream
  if (activeGlobalStream) {
    try {
      activeGlobalStream.getTracks().forEach((track) => {
        try {
          track.enabled = false;
          track.stop();
        } catch {
          // ignore
        }
      });
    } catch {
      // ignore
    }
    activeGlobalStream = null;
  }

  // 2. Forcefully stop all streams recorded in global registry
  globalTrackedStreams.forEach((stream) => {
    try {
      stream.getTracks().forEach((track) => {
        try {
          track.enabled = false;
          track.stop();
        } catch {
          // ignore
        }
      });
    } catch {
      // ignore
    }
  });
  globalTrackedStreams.clear();

  // 3. Forcefully stop every individual tracked MediaStreamTrack
  globalTrackedTracks.forEach((track) => {
    try {
      track.enabled = false;
      track.stop();
    } catch {
      // ignore
    }
  });
  globalTrackedTracks.clear();

  // 4. Sweep any mounted <video> elements in DOM to release hardware
  if (typeof document !== 'undefined') {
    try {
      const videoElements = document.querySelectorAll('video');
      videoElements.forEach((video) => {
        try {
          if (video.srcObject && 'getTracks' in (video.srcObject as any)) {
            (video.srcObject as MediaStream).getTracks().forEach((t) => {
              try {
                t.enabled = false;
                t.stop();
              } catch {
                // ignore
              }
            });
            video.srcObject = null;
          }
          video.pause();
          video.removeAttribute('src');
          video.load();
        } catch {
          // ignore
        }
      });
    } catch {
      // ignore
    }
  }

  // 5. Broadcast custom event to notify all useCamera hook instances to reset state to idle
  if (typeof window !== 'undefined') {
    try {
      window.dispatchEvent(new CustomEvent('dv:stop-all-cameras'));
    } catch {
      // ignore
    }
  }
}

/**
 * Exits fullscreen mode safely if currently active in document.
 * Invoked upon assessment submission to restore standard browser viewport.
 */
export async function exitFullscreenSafely(): Promise<void> {
  if (typeof document === 'undefined') return;
  if (document.fullscreenElement && document.exitFullscreen) {
    try {
      await document.exitFullscreen();
    } catch (err) {
      console.warn('Exit fullscreen skipped or rejected:', err);
    }
  }
}

export function getActiveGlobalStream(): MediaStream | null {
  return activeGlobalStream;
}

export function useCamera(autoStart = false): UseCameraReturn {
  const [stream, setStream] = useState<MediaStream | null>(autoStart ? activeGlobalStream : null);
  const [status, setStatus] = useState<CameraStatus>(
    autoStart && activeGlobalStream?.active ? 'active' : 'idle'
  );
  const [error, setError] = useState<string | null>(null);
  const [deviceLabel, setDeviceLabel] = useState<string | null>(
    autoStart && activeGlobalStream ? activeGlobalStream.getVideoTracks()[0]?.label || null : null
  );

  const videoElementRef = useRef<HTMLVideoElement | null>(null);
  const mountedRef = useRef(true);

  // Stop camera tracks safely and forcefully
  const stopCamera = useCallback(() => {
    activeStreamUsers = Math.max(0, activeStreamUsers - 1);

    // Stop current local stream tracks immediately
    if (stream) {
      try {
        stream.getTracks().forEach((track) => {
          try {
            track.enabled = false;
            track.stop();
          } catch {
            // ignore
          }
        });
      } catch {
        // ignore
      }
    }

    // Stop active global stream if no active consumers or forced
    if (activeStreamUsers === 0 && activeGlobalStream) {
      try {
        activeGlobalStream.getTracks().forEach((track) => {
          try {
            track.enabled = false;
            track.stop();
          } catch {
            // ignore
          }
        });
      } catch {
        // ignore
      }
      activeGlobalStream = null;
    }

    if (mountedRef.current) {
      setStream(null);
      setStatus('idle');
      setError(null);
      setDeviceLabel(null);
      if (videoElementRef.current) {
        try {
          videoElementRef.current.srcObject = null;
          videoElementRef.current.pause();
        } catch {
          // ignore
        }
      }
    }
  }, [stream]);

  const attachVideo = useCallback((videoElement: HTMLVideoElement | null) => {
    videoElementRef.current = videoElement;
    const currentStream = activeGlobalStream;
    if (videoElement && currentStream && currentStream.active) {
      if (videoElement.srcObject !== currentStream) {
        videoElement.srcObject = currentStream;
      }
      videoElement.muted = true;
      videoElement.defaultMuted = true;
      videoElement.playsInline = true;
      videoElement.play().catch(() => {});
    }
  }, []);

  const startCamera = useCallback(async (): Promise<MediaStream | null> => {
    if (typeof window === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      setStatus('unsupported');
      setError('Webcam API is not supported in this browser.');
      return null;
    }

    // Reuse existing live stream if still active
    if (activeGlobalStream && activeGlobalStream.active && activeGlobalStream.getVideoTracks().some(t => t.readyState === 'live')) {
      activeStreamUsers += 1;
      setStream(activeGlobalStream);
      setStatus('active');
      const label = activeGlobalStream.getVideoTracks()[0]?.label || 'Active Camera';
      setDeviceLabel(label);
      if (videoElementRef.current) {
        if (videoElementRef.current.srcObject !== activeGlobalStream) {
          videoElementRef.current.srcObject = activeGlobalStream;
        }
        videoElementRef.current.muted = true;
        videoElementRef.current.defaultMuted = true;
        videoElementRef.current.playsInline = true;
        videoElementRef.current.play().catch(() => {});
      }
      return activeGlobalStream;
    }

    setStatus('requesting');
    setError(null);

    try {
      let mediaStream: MediaStream | null = null;
      try {
        mediaStream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: { ideal: 1280 },
            height: { ideal: 720 },
            facingMode: 'user'
          },
          audio: false
        });
      } catch (firstErr) {
        // Fallback to basic video constraint if laptop driver requires default resolution
        mediaStream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: false
        });
      }

      if (!mountedRef.current) {
        mediaStream.getTracks().forEach((t) => {
          try {
            t.enabled = false;
            t.stop();
          } catch {}
        });
        return null;
      }

      const videoTrack = mediaStream.getVideoTracks()[0];
      if (!videoTrack) {
        throw new Error('No video track found in camera stream');
      }

      // Register tracks into global tracked set
      globalTrackedStreams.add(mediaStream);
      mediaStream.getTracks().forEach((t) => globalTrackedTracks.add(t));

      // Handle track disconnection (e.g. unplugged webcam)
      videoTrack.addEventListener('ended', () => {
        globalTrackedTracks.delete(videoTrack);
        if (mountedRef.current) {
          setStatus('error');
          setError('Camera was disconnected.');
          setStream(null);
        }
      });

      activeGlobalStream = mediaStream;
      activeStreamUsers += 1;

      setStream(mediaStream);
      setStatus('active');
      const label = videoTrack.label || 'Default Camera';
      setDeviceLabel(label);

      if (videoElementRef.current) {
        videoElementRef.current.srcObject = mediaStream;
        videoElementRef.current.muted = true;
        videoElementRef.current.defaultMuted = true;
        videoElementRef.current.playsInline = true;
        videoElementRef.current.play().catch(() => {});
      }

      return mediaStream;
    } catch (err: any) {
      if (!mountedRef.current) return null;

      let statusReason: CameraStatus = 'error';
      let message = 'Unable to access camera.';

      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        statusReason = 'denied';
        message = 'Camera permission was denied. Please allow camera access in browser settings.';
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        statusReason = 'not_found';
        message = 'No camera device detected. Please connect a webcam.';
      } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
        statusReason = 'in_use';
        message = 'Camera is already in use by another application.';
      } else {
        message = err.message || 'Camera acquisition failed.';
      }

      setStatus(statusReason);
      setError(message);
      return null;
    }
  }, []);

  // Listen to application-wide stop event
  useEffect(() => {
    const handleGlobalStop = () => {
      if (mountedRef.current) {
        setStream(null);
        setStatus('idle');
        setError(null);
        setDeviceLabel(null);
        if (videoElementRef.current) {
          try {
            videoElementRef.current.srcObject = null;
            videoElementRef.current.pause();
          } catch {}
        }
      }
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('dv:stop-all-cameras', handleGlobalStop);
      return () => {
        window.removeEventListener('dv:stop-all-cameras', handleGlobalStop);
      };
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;

    if (autoStart) {
      startCamera();
    }

    return () => {
      mountedRef.current = false;
    };
  }, [autoStart, startCamera]);

  return {
    stream,
    status,
    error,
    deviceLabel,
    startCamera,
    stopCamera,
    attachVideo
  };
}
