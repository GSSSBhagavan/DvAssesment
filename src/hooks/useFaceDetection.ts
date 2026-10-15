'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

export type FaceDetectionState =
  | 'FACE_PRESENT'
  | 'NO_FACE'
  | 'MULTIPLE_FACES'
  | 'LOOKING_AWAY'
  | 'PARTIALLY_OUT_OF_FRAME'
  | 'DETECTION_UNAVAILABLE';

export interface HeadOrientation {
  yaw: 'CENTER' | 'LEFT' | 'RIGHT';
  pitch: 'CENTER' | 'DOWN' | 'UP';
  isLookingAway: boolean;
  isPartiallyOutOfFrame: boolean;
  confidence: number;
}

export interface UseFaceDetectionOptions {
  videoElement: HTMLVideoElement | null;
  enabled?: boolean;
  intervalMs?: number;
  minDetectionConfidence?: number;
  consecutiveDeviationThreshold?: number; // Number of consecutive frames needed before sustained deviation
  onStateChange?: (state: FaceDetectionState, faceCount: number) => void;
  onOrientationChange?: (orientation: HeadOrientation) => void;
}

export interface UseFaceDetectionReturn {
  detectionState: FaceDetectionState;
  faceCount: number;
  orientation: HeadOrientation;
  isModelLoaded: boolean;
  isLoadingModel: boolean;
  error: string | null;
  lastProcessedTimestamp: number | null;
}

// Cached detector instance to avoid expensive reinitialization
let cachedDetector: any = null;
let cachedDetectorPromise: Promise<any> | null = null;

async function getOrInitFaceDetector(minDetectionConfidence = 0.5) {
  if (cachedDetector) return cachedDetector;
  if (cachedDetectorPromise) return cachedDetectorPromise;

  cachedDetectorPromise = (async () => {
    try {
      const { FilesetResolver, FaceDetector } = await import('@mediapipe/tasks-vision');

      // Load WASM fileset from CDN
      const vision = await FilesetResolver.forVisionTasks(
        'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.18/wasm'
      );

      // Attempt GPU delegate first, fallback to CPU
      try {
        cachedDetector = await FaceDetector.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath:
              'https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite',
            delegate: 'GPU'
          },
          runningMode: 'IMAGE',
          minDetectionConfidence
        });
      } catch (gpuError) {
        console.warn('GPU delegate failed for face detector, falling back to CPU:', gpuError);
        cachedDetector = await FaceDetector.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath:
              'https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite',
            delegate: 'CPU'
          },
          runningMode: 'IMAGE',
          minDetectionConfidence
        });
      }

      return cachedDetector;
    } catch (err) {
      cachedDetectorPromise = null;
      throw err;
    }
  })();

  return cachedDetectorPromise;
}

export function useFaceDetection({
  videoElement,
  enabled = true,
  intervalMs = 1200, // Balanced sampling: ~1.2s to conserve CPU
  minDetectionConfidence = 0.5,
  consecutiveDeviationThreshold = 3, // Requires 3 consecutive samples (~3.6s) to confirm sustained deviation
  onStateChange,
  onOrientationChange
}: UseFaceDetectionOptions): UseFaceDetectionReturn {
  const [detectionState, setDetectionState] = useState<FaceDetectionState>('DETECTION_UNAVAILABLE');
  const [faceCount, setFaceCount] = useState<number>(0);
  const [orientation, setOrientation] = useState<HeadOrientation>({
    yaw: 'CENTER',
    pitch: 'CENTER',
    isLookingAway: false,
    isPartiallyOutOfFrame: false,
    confidence: 0
  });
  const [isModelLoaded, setIsModelLoaded] = useState<boolean>(!!cachedDetector);
  const [isLoadingModel, setIsLoadingModel] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [lastProcessedTimestamp, setLastProcessedTimestamp] = useState<number | null>(null);

  const detectorRef = useRef<any>(cachedDetector);
  const loopTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isDestroyedRef = useRef<boolean>(false);
  const lastStateRef = useRef<FaceDetectionState>('DETECTION_UNAVAILABLE');

  // Persistence counters for sustained detection
  const consecutiveLookingAwayRef = useRef<number>(0);
  const consecutiveOutOfFrameRef = useRef<number>(0);

  const onStateChangeRef = useRef(onStateChange);
  onStateChangeRef.current = onStateChange;

  const onOrientationChangeRef = useRef(onOrientationChange);
  onOrientationChangeRef.current = onOrientationChange;

  // Initialize model lazily
  useEffect(() => {
    if (!enabled) return;
    isDestroyedRef.current = false;

    if (!detectorRef.current) {
      setIsLoadingModel(true);
      getOrInitFaceDetector(minDetectionConfidence)
        .then((detector) => {
          if (isDestroyedRef.current) return;
          detectorRef.current = detector;
          setIsModelLoaded(true);
          setIsLoadingModel(false);
        })
        .catch((err) => {
          if (isDestroyedRef.current) return;
          console.error('Face detector lazy-load error:', err);
          setError('Failed to initialize local face detection model');
          setIsLoadingModel(false);
          setDetectionState('DETECTION_UNAVAILABLE');
        });
    }

    return () => {
      isDestroyedRef.current = true;
    };
  }, [enabled, minDetectionConfidence]);

  const updateState = useCallback((newState: FaceDetectionState, count: number) => {
    setDetectionState(newState);
    setFaceCount(count);
    if (lastStateRef.current !== newState) {
      lastStateRef.current = newState;
      if (onStateChangeRef.current) {
        onStateChangeRef.current(newState, count);
      }
    }
  }, []);

  // Frame sampling and inference loop
  useEffect(() => {
    if (!enabled || !videoElement || !isModelLoaded) {
      return;
    }

    let isRunning = true;

    const processFrame = async () => {
      if (!isRunning || isDestroyedRef.current) return;

      // Skip inference if tab is hidden (browser throttling & energy saver)
      if (typeof document !== 'undefined' && document.hidden) {
        loopTimeoutRef.current = setTimeout(processFrame, intervalMs);
        return;
      }

      // Ensure video is ready with valid dimensions
      if (
        !videoElement ||
        videoElement.readyState < 2 || // HAVE_CURRENT_DATA
        videoElement.videoWidth === 0 ||
        videoElement.videoHeight === 0 ||
        videoElement.paused ||
        videoElement.ended
      ) {
        loopTimeoutRef.current = setTimeout(processFrame, intervalMs);
        return;
      }

      const detector = detectorRef.current;
      if (!detector) {
        updateState('DETECTION_UNAVAILABLE', 0);
        loopTimeoutRef.current = setTimeout(processFrame, intervalMs);
        return;
      }

      try {
        // Run inference on the current video frame
        const results = detector.detect(videoElement);
        const detections = results.detections || [];
        const count = detections.length;

        if (count === 0) {
          consecutiveLookingAwayRef.current = 0;
          consecutiveOutOfFrameRef.current = 0;
          updateState('NO_FACE', 0);
        } else if (count > 1) {
          consecutiveLookingAwayRef.current = 0;
          consecutiveOutOfFrameRef.current = 0;
          updateState('MULTIPLE_FACES', count);
        } else {
          // Exactly 1 face: inspect bounding box and keypoints for head pose / orientation
          const detection = detections[0];
          const confidence = detection.categories?.[0]?.score || 0.8;
          const keypoints = detection.keypoints || [];
          const bbox = detection.boundingBox;

          let yaw: 'CENTER' | 'LEFT' | 'RIGHT' = 'CENTER';
          let pitch: 'CENTER' | 'DOWN' | 'UP' = 'CENTER';
          let isPartiallyOutOfFrame = false;

          const vWidth = videoElement.videoWidth || 640;
          const vHeight = videoElement.videoHeight || 480;

          // Check if face is on the edge of the camera frame
          if (bbox) {
            const marginX = vWidth * 0.05;
            const marginY = vHeight * 0.05;
            if (
              bbox.originX < marginX ||
              bbox.originX + bbox.width > vWidth - marginX ||
              bbox.originY < marginY ||
              bbox.originY + bbox.height > vHeight - marginY
            ) {
              isPartiallyOutOfFrame = true;
            }
          }

          // BlazeFace 6 keypoints:
          // 0: right eye, 1: left eye, 2: nose tip, 3: mouth center, 4: right ear, 5: left ear
          if (keypoints.length >= 4) {
            const rightEye = keypoints[0];
            const leftEye = keypoints[1];
            const noseTip = keypoints[2];

            // Normalize coordinates
            const rx = rightEye.x * vWidth;
            const lx = leftEye.x * vWidth;
            const nx = noseTip.x * vWidth;
            const ny = noseTip.y * vHeight;
            const eyeMidY = ((rightEye.y + leftEye.y) / 2) * vHeight;
            const eyeDist = Math.abs(lx - rx);

            if (eyeDist > 10) {
              // Ratio of nose distance to right eye vs left eye
              const distToRight = Math.abs(nx - rx);
              const distToLeft = Math.abs(lx - nx);
              const yawRatio = distToRight / Math.max(1, distToLeft);

              // Substantial head turn to sides
              if (yawRatio > 2.8) {
                yaw = 'LEFT';
              } else if (yawRatio < 0.35) {
                yaw = 'RIGHT';
              }

              // Pitch: vertical distance of nose below eyes
              const noseDrop = ny - eyeMidY;
              const pitchRatio = noseDrop / Math.max(1, eyeDist);

              if (pitchRatio > 0.95) {
                pitch = 'DOWN'; // Looking down substantially
              } else if (pitchRatio < 0.15) {
                pitch = 'UP';
              }
            }
          }

          const rawLookingAway = yaw !== 'CENTER' || pitch === 'DOWN';

          // Apply persistence window: treat brief glances or natural movement as NORMAL
          if (rawLookingAway) {
            consecutiveLookingAwayRef.current += 1;
          } else {
            consecutiveLookingAwayRef.current = Math.max(0, consecutiveLookingAwayRef.current - 1);
          }

          if (isPartiallyOutOfFrame) {
            consecutiveOutOfFrameRef.current += 1;
          } else {
            consecutiveOutOfFrameRef.current = 0;
          }

          const isSustainedLookingAway =
            consecutiveLookingAwayRef.current >= consecutiveDeviationThreshold;
          const isSustainedOutOfFrame =
            consecutiveOutOfFrameRef.current >= consecutiveDeviationThreshold;

          const currentOrientation: HeadOrientation = {
            yaw,
            pitch,
            isLookingAway: isSustainedLookingAway,
            isPartiallyOutOfFrame: isSustainedOutOfFrame,
            confidence
          };

          setOrientation(currentOrientation);
          if (onOrientationChangeRef.current) {
            onOrientationChangeRef.current(currentOrientation);
          }

          if (isSustainedOutOfFrame) {
            updateState('PARTIALLY_OUT_OF_FRAME', 1);
          } else if (isSustainedLookingAway) {
            updateState('LOOKING_AWAY', 1);
          } else {
            updateState('FACE_PRESENT', 1);
          }
        }

        setLastProcessedTimestamp(Date.now());
      } catch (inferenceErr) {
        console.warn('Face inference error on sampled frame:', inferenceErr);
        updateState('DETECTION_UNAVAILABLE', 0);
      }

      if (isRunning && !isDestroyedRef.current) {
        loopTimeoutRef.current = setTimeout(processFrame, intervalMs);
      }
    };

    // Kick off the sampled frame loop
    loopTimeoutRef.current = setTimeout(processFrame, 500);

    return () => {
      isRunning = false;
      if (loopTimeoutRef.current) {
        clearTimeout(loopTimeoutRef.current);
        loopTimeoutRef.current = null;
      }
    };
  }, [enabled, videoElement, isModelLoaded, intervalMs, consecutiveDeviationThreshold, updateState]);

  return {
    detectionState,
    faceCount,
    orientation,
    isModelLoaded,
    isLoadingModel,
    error,
    lastProcessedTimestamp
  };
}
