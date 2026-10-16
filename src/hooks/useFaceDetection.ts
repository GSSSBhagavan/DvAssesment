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

export interface FaceBoundingBox {
  originX: number;
  originY: number;
  width: number;
  height: number;
}

export interface FaceStateInfo {
  state: FaceDetectionState;
  faceCount: number;
  isModelLoaded: boolean;
  isLoadingModel: boolean;
  error: string | null;
  orientation?: HeadOrientation;
  boundingBox?: FaceBoundingBox | null;
}

export interface UseFaceDetectionOptions {
  videoElement: HTMLVideoElement | null;
  enabled?: boolean;
  intervalMs?: number;
  minDetectionConfidence?: number;
  consecutiveDeviationThreshold?: number; // Number of consecutive frames needed before sustained deviation
  onStateChange?: (state: FaceDetectionState, faceCount: number) => void;
  onOrientationChange?: (orientation: HeadOrientation) => void;
  onFaceInfoChange?: (info: FaceStateInfo) => void;
}

export interface UseFaceDetectionReturn {
  detectionState: FaceDetectionState;
  faceCount: number;
  orientation: HeadOrientation;
  boundingBox: FaceBoundingBox | null;
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

      // 1. Resolve WASM assets: try local /wasm first, fallback to reliable CDN
      let vision;
      try {
        vision = await FilesetResolver.forVisionTasks('/wasm');
      } catch (localWasmErr) {
        console.warn('Local WASM fileset failed, falling back to CDN:', localWasmErr);
        vision = await FilesetResolver.forVisionTasks(
          'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.18/wasm'
        );
      }

      const localModelPath = '/models/blaze_face_short_range.tflite';
      const cdnModelPath =
        'https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite';

      // 2. Initialize FaceDetector: try GPU with local model, then CPU, then CDN model
      const initDetector = async (modelPath: string, delegate: 'GPU' | 'CPU') => {
        return await FaceDetector.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: modelPath,
            delegate
          },
          runningMode: 'IMAGE',
          minDetectionConfidence
        });
      };

      try {
        cachedDetector = await initDetector(localModelPath, 'GPU');
      } catch (errGpuLocal) {
        try {
          cachedDetector = await initDetector(localModelPath, 'CPU');
        } catch (errCpuLocal) {
          try {
            cachedDetector = await initDetector(cdnModelPath, 'GPU');
          } catch (errGpuCdn) {
            cachedDetector = await initDetector(cdnModelPath, 'CPU');
          }
        }
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
  intervalMs = 500, // Responsive sampling: ~0.5s for fast verification & low CPU
  minDetectionConfidence = 0.45,
  consecutiveDeviationThreshold = 3,
  onStateChange,
  onOrientationChange,
  onFaceInfoChange
}: UseFaceDetectionOptions): UseFaceDetectionReturn {
  const [detectionState, setDetectionState] = useState<FaceDetectionState>('DETECTION_UNAVAILABLE');
  const [faceCount, setFaceCount] = useState<number>(0);
  const [boundingBox, setBoundingBox] = useState<FaceBoundingBox | null>(null);
  const [orientation, setOrientation] = useState<HeadOrientation>({
    yaw: 'CENTER',
    pitch: 'CENTER',
    isLookingAway: false,
    isPartiallyOutOfFrame: false,
    confidence: 0
  });
  const [isModelLoaded, setIsModelLoaded] = useState<boolean>(Boolean(cachedDetector));
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

  const onFaceInfoChangeRef = useRef(onFaceInfoChange);
  onFaceInfoChangeRef.current = onFaceInfoChange;

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
          setError(null);
        })
        .catch((err) => {
          if (isDestroyedRef.current) return;
          console.error('Face detector initialization error:', err);
          setError('Failed to initialize local face detection model');
          setIsLoadingModel(false);
          setDetectionState('DETECTION_UNAVAILABLE');
        });
    } else {
      setIsModelLoaded(true);
    }

    return () => {
      isDestroyedRef.current = true;
    };
  }, [enabled, minDetectionConfidence]);

  const updateState = useCallback((
    newState: FaceDetectionState, 
    count: number, 
    box: FaceBoundingBox | null = null,
    orient?: HeadOrientation
  ) => {
    setDetectionState(newState);
    setFaceCount(count);
    setBoundingBox(box);

    if (onFaceInfoChangeRef.current) {
      onFaceInfoChangeRef.current({
        state: newState,
        faceCount: count,
        isModelLoaded: Boolean(detectorRef.current),
        isLoadingModel: false,
        error: null,
        orientation: orient,
        boundingBox: box
      });
    }

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

      // Ensure video is playing and ready
      if (videoElement.paused && videoElement.srcObject) {
        videoElement.play().catch(() => {});
      }

      // Ensure video is ready with valid dimensions
      if (
        !videoElement ||
        videoElement.readyState < 2 || // HAVE_CURRENT_DATA
        videoElement.videoWidth === 0 ||
        videoElement.videoHeight === 0 ||
        videoElement.ended
      ) {
        loopTimeoutRef.current = setTimeout(processFrame, 150);
        return;
      }

      const detector = detectorRef.current;
      if (!detector) {
        updateState('DETECTION_UNAVAILABLE', 0, null);
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
          updateState('NO_FACE', 0, null);
        } else if (count > 1) {
          consecutiveLookingAwayRef.current = 0;
          consecutiveOutOfFrameRef.current = 0;
          updateState('MULTIPLE_FACES', count, null);
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

          let parsedBox: FaceBoundingBox | null = null;
          if (bbox) {
            parsedBox = {
              originX: bbox.originX,
              originY: bbox.originY,
              width: bbox.width,
              height: bbox.height
            };

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

            const rx = rightEye.x * vWidth;
            const lx = leftEye.x * vWidth;
            const nx = noseTip.x * vWidth;
            const ny = noseTip.y * vHeight;
            const eyeMidY = ((rightEye.y + leftEye.y) / 2) * vHeight;
            const eyeDist = Math.abs(lx - rx);

            if (eyeDist > 10) {
              const distToRight = Math.abs(nx - rx);
              const distToLeft = Math.abs(lx - nx);
              const yawRatio = distToRight / Math.max(1, distToLeft);

              if (yawRatio > 2.8) {
                yaw = 'LEFT';
              } else if (yawRatio < 0.35) {
                yaw = 'RIGHT';
              }

              const noseDrop = ny - eyeMidY;
              const pitchRatio = noseDrop / Math.max(1, eyeDist);

              if (pitchRatio > 0.95) {
                pitch = 'DOWN';
              } else if (pitchRatio < 0.15) {
                pitch = 'UP';
              }
            }
          }

          const rawLookingAway = yaw !== 'CENTER' || pitch === 'DOWN';

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
            updateState('PARTIALLY_OUT_OF_FRAME', 1, parsedBox, currentOrientation);
          } else if (isSustainedLookingAway) {
            updateState('LOOKING_AWAY', 1, parsedBox, currentOrientation);
          } else {
            updateState('FACE_PRESENT', 1, parsedBox, currentOrientation);
          }
        }

        setLastProcessedTimestamp(Date.now());
      } catch (inferenceErr) {
        console.warn('Face inference error on sampled frame:', inferenceErr);
        updateState('DETECTION_UNAVAILABLE', 0, null);
      }

      if (isRunning && !isDestroyedRef.current) {
        loopTimeoutRef.current = setTimeout(processFrame, intervalMs);
      }
    };

    // Kick off inference loop promptly
    loopTimeoutRef.current = setTimeout(processFrame, 200);

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
    boundingBox,
    isModelLoaded,
    isLoadingModel,
    error,
    lastProcessedTimestamp
  };
}
