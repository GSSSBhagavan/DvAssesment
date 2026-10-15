export type EventCategory = 'VISION' | 'BROWSER' | 'TECHNICAL' | 'SYSTEM';

export type RiskSeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export type ProctoringStatus = 'NORMAL' | 'WARNING' | 'REVIEW_REQUIRED' | 'COMPLETED';

export interface PolicyRule {
  category: EventCategory;
  defaultSeverity: RiskSeverity;
  strikePoints: number; // Max strike points assigned (0 for technical/diagnostic)
  gracePeriodMs: number; // Minimum sustained duration before strike is considered
  cooldownMs: number; // Minimum time between consecutive strikes for same event type
  requiresConsecutiveObservations?: number;
  description: string;
}

export const PROCTORING_CONFIG = {
  // Thresholds for overall session status escalation
  STRIKE_THRESHOLD_WARNING: 3,
  STRIKE_THRESHOLD_REVIEW: 6,
  
  // Rate limiting
  MAX_EVENTS_PER_MINUTE: 60,
  
  // Deduplication window for identical consecutive events
  DUPLICATE_WINDOW_MS: 3000,
  
  // Max strikes that can ever be assigned by a single event
  MAX_STRIKE_WEIGHT_PER_EVENT: 1,

  // Fullscreen requirement flag
  FULLSCREEN_REQUIRED: true,

  // Event specific policies
  RULES: {
    FACE_LOST: {
      category: 'VISION',
      defaultSeverity: 'MEDIUM',
      strikePoints: 1,
      gracePeriodMs: 5000, // 5s grace period before strike
      cooldownMs: 10000,   // 10s cooldown
      description: 'Candidate face absent from camera feed'
    },
    FACE_RECOVERED: {
      category: 'VISION',
      defaultSeverity: 'LOW',
      strikePoints: 0,
      gracePeriodMs: 0,
      cooldownMs: 0,
      description: 'Candidate face returned to camera feed'
    },
    MULTIPLE_FACES: {
      category: 'VISION',
      defaultSeverity: 'HIGH',
      strikePoints: 1,
      gracePeriodMs: 2000, // 2s grace period
      cooldownMs: 10000,
      description: 'Multiple faces detected in camera feed'
    },
    HEAD_POSE_DEVIATION: {
      category: 'VISION',
      defaultSeverity: 'MEDIUM',
      strikePoints: 1,
      gracePeriodMs: 4000, // 4s sustained head turn
      cooldownMs: 15000,
      description: 'Sustained head orientation away from screen'
    },
    GAZE_DEVIATION: {
      category: 'VISION',
      defaultSeverity: 'LOW',
      strikePoints: 0, // Coarse gaze is diagnostic; strikes only when combined with high confidence
      gracePeriodMs: 5000,
      cooldownMs: 15000,
      description: 'Coarse gaze deviation away from assessment area'
    },
    FACE_PARTIALLY_OUT_OF_FRAME: {
      category: 'VISION',
      defaultSeverity: 'LOW',
      strikePoints: 0, // Diagnostic warning
      gracePeriodMs: 4000,
      cooldownMs: 10000,
      description: 'Face partially outside camera boundary'
    },
    TAB_SWITCH: {
      category: 'BROWSER',
      defaultSeverity: 'MEDIUM',
      strikePoints: 1,
      gracePeriodMs: 0,
      cooldownMs: 4000, // 4s debounce
      description: 'Candidate switched browser tab or minimized window'
    },
    WINDOW_BLUR: {
      category: 'BROWSER',
      defaultSeverity: 'MEDIUM',
      strikePoints: 1,
      gracePeriodMs: 0,
      cooldownMs: 4000,
      description: 'Assessment window lost focus'
    },
    FULLSCREEN_EXIT: {
      category: 'BROWSER',
      defaultSeverity: 'HIGH',
      strikePoints: 1,
      gracePeriodMs: 0,
      cooldownMs: 5000,
      description: 'Candidate exited required fullscreen mode'
    },
    PAGE_LEAVE_ATTEMPT: {
      category: 'BROWSER',
      defaultSeverity: 'HIGH',
      strikePoints: 1,
      gracePeriodMs: 0,
      cooldownMs: 5000,
      description: 'Candidate attempted to navigate away or close exam'
    },
    COPY_PASTE_ATTEMPT: {
      category: 'BROWSER',
      defaultSeverity: 'MEDIUM',
      strikePoints: 1,
      gracePeriodMs: 0,
      cooldownMs: 3000,
      description: 'Attempted copy, cut, or paste in restricted assessment area'
    },
    RESTRICTED_KEY_COMBO: {
      category: 'BROWSER',
      defaultSeverity: 'MEDIUM',
      strikePoints: 1,
      gracePeriodMs: 0,
      cooldownMs: 3000,
      description: 'Attempted prohibited keyboard shortcut'
    },
    CAMERA_DISCONNECTED: {
      category: 'TECHNICAL',
      defaultSeverity: 'HIGH',
      strikePoints: 0, // Technical incidents do NOT penalize with strikes
      gracePeriodMs: 0,
      cooldownMs: 5000,
      description: 'Webcam feed disconnected or interrupted'
    },
    CAMERA_REVOKED: {
      category: 'TECHNICAL',
      defaultSeverity: 'HIGH',
      strikePoints: 0, // Technical issue, ask to re-enable
      gracePeriodMs: 0,
      cooldownMs: 5000,
      description: 'Camera permission denied or revoked by candidate/browser'
    },
    DETECTION_UNAVAILABLE: {
      category: 'TECHNICAL',
      defaultSeverity: 'LOW',
      strikePoints: 0,
      gracePeriodMs: 0,
      cooldownMs: 5000,
      description: 'Browser computer vision detector temporarily unavailable'
    },
    CONNECTION_LOST: {
      category: 'TECHNICAL',
      defaultSeverity: 'LOW',
      strikePoints: 0,
      gracePeriodMs: 0,
      cooldownMs: 5000,
      description: 'Network connectivity lost during assessment'
    }
  } as Record<string, PolicyRule>
};

export interface PolicyEvaluationInput {
  eventType: string;
  durationMs?: number;
  metadata?: Record<string, any>;
  lastEventAt?: Date | null;
  lastStrikeAt?: Date | null;
  currentStrikes: number;
}

export interface PolicyEvaluationResult {
  accepted: boolean;
  strikePoints: number;
  severity: RiskSeverity;
  category: EventCategory;
  reason: string;
  flaggedForReview: boolean;
  isDuplicate: boolean;
  status: ProctoringStatus;
}

/**
 * Centralized evaluation engine: evaluates an incoming candidate event
 * against server-authoritative security policy.
 */
export function evaluateEventPolicy(input: PolicyEvaluationInput): PolicyEvaluationResult {
  const { eventType, durationMs = 0, lastEventAt, lastStrikeAt, currentStrikes } = input;
  const now = Date.now();

  const rule = PROCTORING_CONFIG.RULES[eventType];
  if (!rule) {
    // Unknown event type: safe fallback without assigning strike
    return {
      accepted: false,
      strikePoints: 0,
      severity: 'LOW',
      category: 'SYSTEM',
      reason: `Unrecognized event type: ${eventType}`,
      flaggedForReview: false,
      isDuplicate: false,
      status: calculateSessionStatus(currentStrikes)
    };
  }

  // 1. Debounce check: if identical event arrived within DUPLICATE_WINDOW_MS
  if (lastEventAt) {
    const elapsedSinceLast = now - new Date(lastEventAt).getTime();
    if (elapsedSinceLast < PROCTORING_CONFIG.DUPLICATE_WINDOW_MS) {
      return {
        accepted: false,
        strikePoints: 0,
        severity: rule.defaultSeverity,
        category: rule.category,
        reason: `Debounced duplicate event within ${elapsedSinceLast}ms`,
        flaggedForReview: false,
        isDuplicate: true,
        status: calculateSessionStatus(currentStrikes)
      };
    }
  }

  // 2. Technical incidents (camera, connection) do NOT incur strikes
  if (rule.category === 'TECHNICAL') {
    return {
      accepted: true,
      strikePoints: 0,
      severity: rule.defaultSeverity,
      category: rule.category,
      reason: rule.description,
      flaggedForReview: rule.defaultSeverity === 'HIGH',
      isDuplicate: false,
      status: calculateSessionStatus(currentStrikes)
    };
  }

  // 3. Grace period check: if event duration is reported, ensure it exceeds grace period
  if (rule.gracePeriodMs > 0 && durationMs < rule.gracePeriodMs) {
    return {
      accepted: true,
      strikePoints: 0,
      severity: 'LOW',
      category: rule.category,
      reason: `${rule.description} (Duration ${durationMs}ms was within ${rule.gracePeriodMs}ms grace period)`,
      flaggedForReview: false,
      isDuplicate: false,
      status: calculateSessionStatus(currentStrikes)
    };
  }

  // 4. Cooldown check: prevent rapid repeated strikes of the same type
  if (lastStrikeAt && rule.cooldownMs > 0) {
    const elapsedSinceStrike = now - new Date(lastStrikeAt).getTime();
    if (elapsedSinceStrike < rule.cooldownMs) {
      return {
        accepted: true,
        strikePoints: 0,
        severity: rule.defaultSeverity,
        category: rule.category,
        reason: `${rule.description} (Within ${rule.cooldownMs}ms cooldown window)`,
        flaggedForReview: false,
        isDuplicate: false,
        status: calculateSessionStatus(currentStrikes)
      };
    }
  }

  // 5. Calculate strike points (capped by MAX_STRIKE_WEIGHT_PER_EVENT)
  const strikePoints = Math.min(rule.strikePoints, PROCTORING_CONFIG.MAX_STRIKE_WEIGHT_PER_EVENT);
  const newTotalStrikes = currentStrikes + strikePoints;
  const newStatus = calculateSessionStatus(newTotalStrikes);

  return {
    accepted: true,
    strikePoints,
    severity: strikePoints > 0 ? (rule.defaultSeverity === 'LOW' ? 'MEDIUM' : rule.defaultSeverity) : rule.defaultSeverity,
    category: rule.category,
    reason: rule.description,
    flaggedForReview: newStatus === 'REVIEW_REQUIRED',
    isDuplicate: false,
    status: newStatus
  };
}

export function calculateSessionStatus(totalStrikes: number): ProctoringStatus {
  if (totalStrikes >= PROCTORING_CONFIG.STRIKE_THRESHOLD_REVIEW) {
    return 'REVIEW_REQUIRED';
  }
  if (totalStrikes >= PROCTORING_CONFIG.STRIKE_THRESHOLD_WARNING) {
    return 'WARNING';
  }
  return 'NORMAL';
}
