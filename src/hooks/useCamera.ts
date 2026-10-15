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

// Global active stream reference to prevent multiple concurrent camera acquisitions in Strict Mode
let activeGlobalStream: MediaStream | null = null;
let activeStreamUsers = 0;

export function useCamera(autoStart = false): UseCameraReturn {
  const [stream, setStream] = useState<MediaStream | null>(activeGlobalStream);
  const [status, setStatus] = useState<CameraStatus>(activeGlobalStream?.active ? 'active' : 'idle');
  const [error, setError] = useState<string | null>(null);
  const [deviceLabel, setDeviceLabel] = useState<string | null>(
    activeGlobalStream?.getVideoTracks()[0]?.label || null
  );

  const videoElementRef = useRef<HTMLVideoElement | null>(null);
  const mountedRef = useRef(true);

  // Stop camera tracks safely
  const stopCamera = useCallback(() => {
    if (activeStreamUsers > 0) {
      activeStreamUsers = Math.max(0, activeStreamUsers - 1);
    }

    if (activeStreamUsers === 0 && activeGlobalStream) {
      activeGlobalStream.getTracks().forEach((track) => {
        try {
          track.stop();
        } catch {
          // ignore
        }
      });
      activeGlobalStream = null;
    }

    if (mountedRef.current) {
      setStream(null);
      setStatus('idle');
      setError(null);
      setDeviceLabel(null);
      if (videoElementRef.current) {
        videoElementRef.current.srcObject = null;
      }
    }
  }, []);

  const attachVideo = useCallback((videoElement: HTMLVideoElement | null) => {
    videoElementRef.current = videoElement;
    if (videoElement && activeGlobalStream) {
      videoElement.srcObject = activeGlobalStream;
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
        videoElementRef.current.srcObject = activeGlobalStream;
        videoElementRef.current.play().catch(() => {});
      }
      return activeGlobalStream;
    }

    setStatus('requesting');
    setError(null);

    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280, min: 640 },
          height: { ideal: 720, min: 480 },
          frameRate: { ideal: 24, max: 30 }
        },
        audio: false
      });

      if (!mountedRef.current) {
        mediaStream.getTracks().forEach(t => t.stop());
        return null;
      }

      const videoTrack = mediaStream.getVideoTracks()[0];
      if (!videoTrack) {
        throw new Error('No video track found in camera stream');
      }

      // Handle track disconnection (e.g. unplugged webcam)
      videoTrack.addEventListener('ended', () => {
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

  useEffect(() => {
    mountedRef.current = true;

    if (autoStart) {
      startCamera();
    }

    return () => {
      mountedRef.current = false;
      // Decrement reference count on unmount
      if (activeStreamUsers > 0) {
        activeStreamUsers = Math.max(0, activeStreamUsers - 1);
      }
      if (activeStreamUsers === 0 && activeGlobalStream) {
        activeGlobalStream.getTracks().forEach(t => {
          try {
            t.stop();
          } catch {
            // ignore
          }
        });
        activeGlobalStream = null;
      }
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
