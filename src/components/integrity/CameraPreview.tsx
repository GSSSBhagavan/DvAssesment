'use client';

import { useEffect, useRef, useState, useImperativeHandle, forwardRef, useCallback } from 'react';
import { useCamera, UseCameraReturn, getActiveGlobalStream } from '@/hooks/useCamera';
import { useFaceDetection, FaceStateInfo } from '@/hooks/useFaceDetection';
import { Camera, AlertCircle, VideoOff, Loader2, Check, AlertTriangle, ShieldCheck, UserCheck } from 'lucide-react';

export interface CameraPreviewHandle {
  captureSnapshot: () => string | null;
}

export interface CameraPreviewProps {
  className?: string;
  showBadge?: boolean;
  onRequestCamera?: () => void;
  camera?: UseCameraReturn;
  onFaceDetectionChange?: (info: FaceStateInfo) => void;
  enableFaceDetection?: boolean;
  capturedSnapshot?: string | null;
}

const CameraPreview = forwardRef<CameraPreviewHandle, CameraPreviewProps>(function CameraPreview(
  {
    className = '',
    showBadge = true,
    onRequestCamera,
    camera: externalCamera,
    onFaceDetectionChange,
    enableFaceDetection = true,
    capturedSnapshot = null
  },
  ref
) {
  // Use passed camera instance or initialize internal fallback (autoStart=false)
  const internalCamera = useCamera(false);
  const activeCam = externalCamera || internalCamera;
  const { status, error, deviceLabel, attachVideo, startCamera } = activeCam;
  
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [videoElement, setVideoElement] = useState<HTMLVideoElement | null>(null);
  const [isFlashing, setIsFlashing] = useState<boolean>(false);

  const isLive = status === 'active' || Boolean(activeCam.stream?.active);

  // Hook real-time face detection directly to this video element
  const faceInfo = useFaceDetection({
    videoElement,
    enabled: isLive && enableFaceDetection,
    intervalMs: 400, // Snappy verification sampling
    minDetectionConfidence: 0.45,
    onFaceInfoChange: onFaceDetectionChange
  });

  const { detectionState, faceCount, isLoadingModel, isModelLoaded } = faceInfo;

  // Imperative handle for taking a crisp, high-res face snapshot
  useImperativeHandle(ref, () => ({
    captureSnapshot: () => {
      const video = videoRef.current;
      if (!video || video.videoWidth === 0 || video.videoHeight === 0) {
        return null;
      }

      try {
        setIsFlashing(true);
        setTimeout(() => setIsFlashing(false), 300);

        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext('2d');
        if (!ctx) return null;

        // Mirror canvas to match the mirrored camera display
        ctx.translate(canvas.width, 0);
        ctx.scale(-1, 1);
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

        const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
        return dataUrl;
      } catch (err) {
        console.warn('Snapshot capture error:', err);
        return null;
      }
    }
  }), []);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    setVideoElement(video);
    attachVideo(video);

    const stream = activeCam.stream || getActiveGlobalStream();
    if (stream && stream.active) {
      if (video.srcObject !== stream) {
        video.srcObject = stream;
      }
      video.muted = true;
      video.defaultMuted = true;
      video.playsInline = true;
      video.play().catch(() => {});
    }

    return () => {
      // Safely detach video element without destroying active hardware tracks
      if (videoRef.current) {
        try {
          videoRef.current.srcObject = null;
        } catch {}
      }
    };
  }, [attachVideo, activeCam.stream, status]);

  const handleRequest = async () => {
    if (onRequestCamera) {
      onRequestCamera();
    }
    await startCamera();
  };

  const isFaceVerified = isLive && detectionState === 'FACE_PRESENT' && faceCount === 1;
  const isNoFace = isLive && (detectionState === 'NO_FACE' || (isModelLoaded && faceCount === 0));
  const isMultiFace = isLive && (detectionState === 'MULTIPLE_FACES' || faceCount > 1);
  const isLookingAway = isLive && detectionState === 'LOOKING_AWAY';

  return (
    <div className={`relative overflow-hidden rounded-2xl border border-black/[0.08] bg-[#121214] text-white select-none ${className}`}>
      {/* Visual Shutter Flash on Snapshot Capture */}
      {isFlashing && (
        <div className="absolute inset-0 bg-white z-50 pointer-events-none animate-pulse transition-opacity duration-300" />
      )}

      {/* Video element */}
      <video
        ref={(el) => {
          videoRef.current = el;
          if (el && el !== videoElement) setVideoElement(el);
        }}
        autoPlay
        playsInline
        muted
        onLoadedMetadata={(e) => {
          try {
            const vid = e.currentTarget;
            vid.play().catch(() => {});
          } catch {}
        }}
        className={`h-full w-full object-cover -scale-x-100 ${isLive ? 'block' : 'hidden'}`}
      />

      {/* Real-time Dynamic Face Positioning Guide Frame */}
      {isLive && enableFaceDetection && (
        <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
          {/* Centered Guide Oval */}
          <div 
            className={`w-[140px] sm:w-[155px] h-[175px] sm:h-[195px] rounded-[50%] border-2 transition-all duration-300 flex flex-col items-center justify-between py-2.5 relative ${
              capturedSnapshot
                ? 'border-emerald-400 bg-emerald-500/[0.06] shadow-[0_0_24px_rgba(52,211,153,0.4)]'
                : isFaceVerified
                  ? 'border-emerald-400 bg-emerald-500/[0.04] shadow-[0_0_20px_rgba(52,211,153,0.3)]'
                  : isMultiFace
                    ? 'border-rose-500 bg-rose-500/[0.08] shadow-[0_0_24px_rgba(244,63,94,0.35)] animate-pulse'
                    : isLookingAway
                      ? 'border-amber-400 bg-amber-500/[0.06] shadow-[0_0_20px_rgba(251,191,36,0.3)]'
                      : 'border-dashed border-amber-400/90 bg-amber-500/[0.04] shadow-[0_0_20px_rgba(251,191,36,0.25)] animate-pulse'
            }`}
          >
            {/* Top Indicator on Oval */}
            <div className={`px-2 py-0.5 rounded-full text-[9px] font-semibold tracking-wide backdrop-blur-md uppercase transition-colors ${
              capturedSnapshot
                ? 'bg-emerald-950/85 text-emerald-300 border border-emerald-500/50'
                : isFaceVerified
                  ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-500/40'
                  : isMultiFace
                    ? 'bg-rose-950/80 text-rose-300 border border-rose-500/40'
                    : isLookingAway
                      ? 'bg-amber-950/80 text-amber-300 border border-amber-500/40'
                      : 'bg-black/75 text-amber-300 border border-amber-400/50'
            }`}>
              {capturedSnapshot ? (
                <span className="flex items-center gap-1">
                  <Check size={9} strokeWidth={3} />
                  <span>Snapshot Captured</span>
                </span>
              ) : isFaceVerified ? (
                <span className="flex items-center gap-1">
                  <Check size={9} strokeWidth={3} />
                  <span>Face Centered</span>
                </span>
              ) : isMultiFace ? (
                <span>1 Person Only</span>
              ) : isLookingAway ? (
                <span>Look at Screen</span>
              ) : (
                <span>Position Face Here</span>
              )}
            </div>

            {/* Crosshairs inside guide when aligning */}
            {!capturedSnapshot && !isFaceVerified && (
              <div className="w-8 h-8 rounded-full border border-amber-400/30 flex items-center justify-center">
                <div className="w-1.5 h-1.5 rounded-full bg-amber-400/60" />
              </div>
            )}

            {/* Bottom checkmark / lock icon */}
            {(capturedSnapshot || isFaceVerified) && (
              <div className="w-5 h-5 rounded-full bg-emerald-500 text-slate-950 flex items-center justify-center shadow-sm">
                <Check size={11} strokeWidth={3.5} />
              </div>
            )}
          </div>
        </div>
      )}

      {/* Subtle Frame border when camera is active */}
      {isLive && (
        <div className="absolute inset-2.5 pointer-events-none rounded-xl border border-white/10" />
      )}

      {/* Status Overlay when camera is not active */}
      {!isLive && (
        <div className="flex h-full min-h-[220px] w-full flex-col items-center justify-center p-6 text-center select-none">
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
                <p className="text-[12px] text-zinc-400 leading-relaxed">
                  Allow camera access in your browser address bar to proceed with evaluation.
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
              <p className="text-[14px] font-semibold text-white">No Webcam Detected</p>
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
              <p className="text-[13px] text-zinc-300 font-medium">Camera verification required</p>
              <button
                type="button"
                onClick={handleRequest}
                className="mt-1 px-5 py-2 rounded-full text-[12.5px] font-medium bg-[#2563EB] hover:bg-[#1D4ED8] text-white transition-all cursor-pointer shadow-sm"
              >
                Enable Camera
              </button>
            </div>
          )}
        </div>
      )}

      {/* Active Camera Proctoring & Face Status Badge (Top-Left) */}
      {isLive && showBadge && (
        <div className="absolute top-3 left-3 flex items-center gap-2">
          {isLoadingModel || (!isModelLoaded && detectionState === 'DETECTION_UNAVAILABLE') ? (
            <div className="flex items-center gap-1.5 rounded-full bg-blue-950/80 text-blue-300 border border-blue-500/40 px-3 py-1 text-[11px] font-medium backdrop-blur-md shadow-sm">
              <Loader2 size={12} className="animate-spin text-blue-400" />
              <span>Initializing vision detector...</span>
            </div>
          ) : capturedSnapshot ? (
            <div className="flex items-center gap-1.5 rounded-full bg-emerald-950/85 text-emerald-300 border border-emerald-500/40 px-3 py-1 text-[11px] font-semibold backdrop-blur-md shadow-sm">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <ShieldCheck size={12} className="text-emerald-400" />
              <span>Biometric Identity Verified</span>
            </div>
          ) : isFaceVerified ? (
            <div className="flex items-center gap-1.5 rounded-full bg-emerald-950/85 text-emerald-300 border border-emerald-500/40 px-3 py-1 text-[11px] font-medium backdrop-blur-md shadow-sm">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <ShieldCheck size={12} className="text-emerald-400" />
              <span>Face Aligned · Snapshot Ready</span>
            </div>
          ) : isMultiFace ? (
            <div className="flex items-center gap-1.5 rounded-full bg-rose-950/90 text-rose-300 border border-rose-500/50 px-3 py-1 text-[11px] font-semibold backdrop-blur-md shadow-sm animate-pulse">
              <AlertTriangle size={12} className="text-rose-400" />
              <span>Multiple Faces Detected ({faceCount})</span>
            </div>
          ) : isLookingAway ? (
            <div className="flex items-center gap-1.5 rounded-full bg-amber-950/85 text-amber-300 border border-amber-500/40 px-3 py-1 text-[11px] font-medium backdrop-blur-md shadow-sm">
              <AlertCircle size={12} className="text-amber-400" />
              <span>Look Directly at Screen</span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 rounded-full bg-rose-950/90 text-rose-300 border border-rose-500/50 px-3 py-1 text-[11px] font-semibold backdrop-blur-md shadow-sm">
              <AlertTriangle size={12} className="text-rose-400" />
              <span>No Face Detected · Face Required</span>
            </div>
          )}
        </div>
      )}

      {/* Snapshot Thumbnail Preview Badge (Top-Right) */}
      {isLive && capturedSnapshot && (
        <div className="absolute top-3 right-3 flex items-center gap-2 rounded-xl bg-black/75 backdrop-blur-md p-1 border border-emerald-500/40 shadow-md">
          <img 
            src={capturedSnapshot} 
            alt="Captured Snapshot" 
            className="w-7 h-7 rounded-lg object-cover border border-emerald-400"
          />
          <span className="text-[10px] font-semibold text-emerald-400 pr-1.5">
            Face ID Logged
          </span>
        </div>
      )}

      {/* Prominent Actionable Warning Banner (Bottom) when camera is active but face is missing */}
      {isLive && isNoFace && !capturedSnapshot && (
        <div className="absolute bottom-2.5 left-3 right-3 bg-rose-950/90 text-rose-100 border border-rose-500/50 px-3 py-2 rounded-xl text-[11px] flex items-center gap-2 backdrop-blur-md shadow-lg">
          <AlertTriangle size={14} className="text-rose-400 shrink-0" />
          <span className="font-normal leading-tight">
            <strong>Face not detected:</strong> Camera shutter may be closed or face is out of view. Center your face to unlock snapshot.
          </span>
        </div>
      )}

      {/* Warning Banner when multiple faces are detected */}
      {isLive && isMultiFace && (
        <div className="absolute bottom-2.5 left-3 right-3 bg-rose-950/90 text-rose-100 border border-rose-500/50 px-3 py-2 rounded-xl text-[11px] flex items-center gap-2 backdrop-blur-md shadow-lg">
          <AlertTriangle size={14} className="text-rose-400 shrink-0" />
          <span className="font-normal leading-tight">
            <strong>Multiple people detected:</strong> Only the single registered candidate is permitted during this examination.
          </span>
        </div>
      )}

      {/* Device label footer */}
      {isLive && deviceLabel && isFaceVerified && !capturedSnapshot && (
        <div className="absolute bottom-2.5 right-3 text-[10px] font-mono text-zinc-400 truncate max-w-[200px] bg-black/60 backdrop-blur-md px-2.5 py-1 rounded-md border border-white/10">
          {deviceLabel}
        </div>
      )}
    </div>
  );
});

export default CameraPreview;
