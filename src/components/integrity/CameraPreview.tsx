'use client';

import { useEffect, useRef } from 'react';
import { useCamera } from '@/hooks/useCamera';
import { Camera, AlertCircle, VideoOff, Loader2 } from 'lucide-react';

interface CameraPreviewProps {
  className?: string;
  showBadge?: boolean;
  onRequestCamera?: () => void;
}

export default function CameraPreview({
  className = '',
  showBadge = true,
  onRequestCamera
}: CameraPreviewProps) {
  const { status, error, deviceLabel, attachVideo, startCamera } = useCamera(true);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    if (videoRef.current) {
      attachVideo(videoRef.current);
    }
  }, [attachVideo, status]);

  const handleRequest = () => {
    if (onRequestCamera) {
      onRequestCamera();
    } else {
      startCamera();
    }
  };

  return (
    <div className={`relative overflow-hidden rounded-2xl border border-black/[0.08] bg-[#121214] text-white ${className}`}>
      {/* Video element */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className={`h-full w-full object-cover -scale-x-100 ${status === 'active' ? 'block' : 'hidden'}`}
      />

      {/* Subtle Frame border when camera is active */}
      {status === 'active' && (
        <div className="absolute inset-2.5 pointer-events-none rounded-xl border border-white/10" />
      )}

      {/* Status Overlay when camera is not active */}
      {status !== 'active' && (
        <div className="flex h-full min-h-[240px] w-full flex-col items-center justify-center p-6 text-center select-none">
          {status === 'requesting' ? (
            <div className="flex flex-col items-center gap-3 text-zinc-400">
              <Loader2 size={30} className="animate-spin text-[#2563EB]" />
              <p className="text-[13px] font-medium text-zinc-200">
                Initializing camera preview...
              </p>
            </div>
          ) : status === 'denied' ? (
            <div className="flex flex-col items-center gap-3 text-zinc-300 max-w-sm">
              <div className="w-12 h-12 rounded-2xl bg-white/[0.06] border border-white/10 flex items-center justify-center text-rose-400 shadow-inner">
                <VideoOff size={22} />
              </div>
              <div className="space-y-1">
                <p className="text-[15px] font-bold text-white tracking-tight">
                  Camera access is required
                </p>
                <p className="text-[12.5px] text-zinc-400 leading-relaxed">
                  Allow camera access to continue with your assessment. If blocked in your browser, please enable permissions in the address bar and retry.
                </p>
              </div>
              <button
                type="button"
                onClick={handleRequest}
                className="mt-1 px-5 py-2.5 rounded-full text-[13px] font-medium bg-[#2563EB] hover:bg-[#1D4ED8] active:bg-[#1E40AF] text-white transition-all shadow-sm cursor-pointer"
              >
                Enable Camera
              </button>
            </div>
          ) : status === 'not_found' ? (
            <div className="flex flex-col items-center gap-2.5 text-zinc-300 max-w-xs">
              <AlertCircle size={28} className="text-amber-400" />
              <p className="text-[14px] font-semibold text-white">No Camera Detected</p>
              <p className="text-[12px] text-zinc-400 leading-snug">
                Please connect a functional webcam to proceed with your proctored evaluation.
              </p>
              <button
                type="button"
                onClick={handleRequest}
                className="mt-1 px-4 py-2 rounded-full text-[12px] font-medium bg-white/10 hover:bg-white/15 text-white transition-all cursor-pointer"
              >
                Retry Detection
              </button>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2.5 text-zinc-300">
              <div className="w-11 h-11 rounded-2xl bg-white/[0.06] border border-white/10 flex items-center justify-center text-zinc-400">
                <Camera size={22} />
              </div>
              <p className="text-[13px] text-zinc-300">Camera preview standby</p>
              <button
                type="button"
                onClick={handleRequest}
                className="mt-1 px-4 py-2 rounded-full text-[12.5px] font-medium bg-[#2563EB] hover:bg-[#1D4ED8] text-white transition-all cursor-pointer"
              >
                Enable Camera
              </button>
            </div>
          )}
        </div>
      )}

      {/* Active Camera Proctoring Badge */}
      {status === 'active' && showBadge && (
        <div className="absolute top-3 left-3 flex items-center gap-2 rounded-full bg-black/60 px-3 py-1 text-[11px] font-medium text-emerald-400 backdrop-blur-md border border-white/10">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          <span>Camera active · Proctoring enabled</span>
        </div>
      )}

      {/* Device label footer */}
      {status === 'active' && deviceLabel && (
        <div className="absolute bottom-2.5 right-3 text-[10px] font-mono text-zinc-400 truncate max-w-[220px] bg-black/60 backdrop-blur-md px-2.5 py-1 rounded-md border border-white/10">
          {deviceLabel}
        </div>
      )}
    </div>
  );
}
