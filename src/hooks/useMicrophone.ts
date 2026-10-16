'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

export type MicrophoneStatus =
  | 'idle'
  | 'requesting'
  | 'active'
  | 'denied'
  | 'not_found'
  | 'in_use'
  | 'unsupported'
  | 'error';

export interface UseMicrophoneReturn {
  stream: MediaStream | null;
  status: MicrophoneStatus;
  audioLevel: number; // 0 to 100%
  error: string | null;
  deviceLabel: string | null;
  startMicrophone: () => Promise<MediaStream | null>;
  stopMicrophone: () => void;
}

// Global active audio stream reference to avoid duplicate hardware locks
let activeGlobalAudioStream: MediaStream | null = null;
let activeAudioUsers = 0;

export function stopAllMicrophoneStreams(): void {
  activeAudioUsers = 0;
  if (activeGlobalAudioStream) {
    try {
      activeGlobalAudioStream.getTracks().forEach((track) => {
        try {
          track.enabled = false;
          track.stop();
        } catch {}
      });
    } catch {}
    activeGlobalAudioStream = null;
  }
}

export function useMicrophone(autoStart = false): UseMicrophoneReturn {
  const [stream, setStream] = useState<MediaStream | null>(autoStart ? activeGlobalAudioStream : null);
  const [status, setStatus] = useState<MicrophoneStatus>(
    autoStart && activeGlobalAudioStream?.active ? 'active' : 'idle'
  );
  const [audioLevel, setAudioLevel] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);
  const [deviceLabel, setDeviceLabel] = useState<string | null>(
    autoStart && activeGlobalAudioStream ? activeGlobalAudioStream.getAudioTracks()[0]?.label || null : null
  );

  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const mountedRef = useRef(true);

  // Stop microphone hardware and audio context cleanly
  const stopMicrophone = useCallback(() => {
    activeAudioUsers = Math.max(0, activeAudioUsers - 1);

    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }

    if (sourceRef.current) {
      try {
        sourceRef.current.disconnect();
      } catch {}
      sourceRef.current = null;
    }

    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      try {
        audioContextRef.current.close().catch(() => {});
      } catch {}
      audioContextRef.current = null;
    }

    if (stream) {
      try {
        stream.getTracks().forEach((track) => {
          try {
            track.enabled = false;
            track.stop();
          } catch {}
        });
      } catch {}
    }

    if (activeAudioUsers === 0 && activeGlobalAudioStream) {
      try {
        activeGlobalAudioStream.getTracks().forEach((track) => {
          try {
            track.enabled = false;
            track.stop();
          } catch {}
        });
      } catch {}
      activeGlobalAudioStream = null;
    }

    if (mountedRef.current) {
      setStream(null);
      setStatus('idle');
      setAudioLevel(0);
      setError(null);
      setDeviceLabel(null);
    }
  }, [stream]);

  // Real-time audio volume analyzer loop
  const setupAudioAnalyzer = useCallback((mediaStream: MediaStream) => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;

      const audioCtx = new AudioCtx();
      audioContextRef.current = audioCtx;

      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.5;
      analyserRef.current = analyser;

      const source = audioCtx.createMediaStreamSource(mediaStream);
      sourceRef.current = source;
      source.connect(analyser);

      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);

      const updateLevel = () => {
        if (!mountedRef.current || !analyserRef.current) return;

        analyserRef.current.getByteFrequencyData(dataArray);

        let sum = 0;
        for (let i = 0; i < bufferLength; i++) {
          sum += dataArray[i];
        }

        const average = sum / bufferLength;
        // Natural calibration: amplify lower speaking signals for clear UI feedback (5% min ambient floor)
        const computedPercent = Math.min(100, Math.round((average / 80) * 100));
        
        // Add subtle natural idle jitter between 5-12% when live so candidate sees mic is sensing sound
        const displayLevel = computedPercent > 5 ? computedPercent : (computedPercent > 0 ? computedPercent + 4 : 8);

        setAudioLevel(displayLevel);
        animFrameRef.current = requestAnimationFrame(updateLevel);
      };

      updateLevel();
    } catch (e) {
      console.warn('AudioContext volume measurement skipped:', e);
      // Fallback display level
      setAudioLevel(12);
    }
  }, []);

  const startMicrophone = useCallback(async (): Promise<MediaStream | null> => {
    if (typeof window === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      setStatus('unsupported');
      setError('Microphone API is not supported in this browser.');
      return null;
    }

    // Reuse existing live stream if active
    if (
      activeGlobalAudioStream &&
      activeGlobalAudioStream.active &&
      activeGlobalAudioStream.getAudioTracks().some((t) => t.readyState === 'live')
    ) {
      activeAudioUsers += 1;
      setStream(activeGlobalAudioStream);
      setStatus('active');
      const label = activeGlobalAudioStream.getAudioTracks()[0]?.label || 'Active Microphone';
      setDeviceLabel(label);
      setupAudioAnalyzer(activeGlobalAudioStream);
      return activeGlobalAudioStream;
    }

    setStatus('requesting');
    setError(null);

    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        },
        video: false
      });

      if (!mountedRef.current) {
        mediaStream.getTracks().forEach((t) => t.stop());
        return null;
      }

      const audioTrack = mediaStream.getAudioTracks()[0];
      if (!audioTrack) {
        throw new Error('No audio track found in microphone stream');
      }

      audioTrack.addEventListener('ended', () => {
        if (mountedRef.current) {
          setStatus('error');
          setError('Microphone was disconnected.');
          setStream(null);
          setAudioLevel(0);
        }
      });

      activeGlobalAudioStream = mediaStream;
      activeAudioUsers += 1;

      setStream(mediaStream);
      setStatus('active');
      const label = audioTrack.label || 'Default Microphone';
      setDeviceLabel(label);

      setupAudioAnalyzer(mediaStream);

      return mediaStream;
    } catch (err: any) {
      if (!mountedRef.current) return null;

      let statusReason: MicrophoneStatus = 'error';
      let message = 'Unable to access microphone.';

      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        statusReason = 'denied';
        message = 'Microphone permission was denied. Please allow microphone access in browser settings.';
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        statusReason = 'not_found';
        message = 'No microphone device detected. Please connect a microphone.';
      } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
        statusReason = 'in_use';
        message = 'Microphone is already in use by another application.';
      } else {
        message = err.message || 'Microphone acquisition failed.';
      }

      setStatus(statusReason);
      setError(message);
      setAudioLevel(0);
      return null;
    }
  }, [setupAudioAnalyzer]);

  useEffect(() => {
    mountedRef.current = true;
    if (autoStart) {
      startMicrophone();
    }
    return () => {
      mountedRef.current = false;
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
      }
      if (sourceRef.current) {
        try {
          sourceRef.current.disconnect();
        } catch {}
      }
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        try {
          audioContextRef.current.close().catch(() => {});
        } catch {}
      }
    };
  }, [autoStart, startMicrophone]);

  return {
    stream,
    status,
    audioLevel,
    error,
    deviceLabel,
    startMicrophone,
    stopMicrophone
  };
}
