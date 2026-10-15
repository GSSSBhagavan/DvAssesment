import mongoose, { Schema, Document, Types } from 'mongoose';

export type EventType =
  | 'TAB_SWITCH'
  | 'FULLSCREEN_EXIT'
  | 'WINDOW_BLUR'
  | 'FACE_LOST'
  | 'FACE_RECOVERED'
  | 'MULTIPLE_FACES'
  | 'HEAD_POSE_DEVIATION'
  | 'GAZE_DEVIATION'
  | 'FACE_PARTIALLY_OUT_OF_FRAME'
  | 'COPY_PASTE_ATTEMPT'
  | 'RESTRICTED_KEY_COMBO'
  | 'CAMERA_DISCONNECTED'
  | 'CAMERA_REVOKED'
  | 'DETECTION_UNAVAILABLE'
  | 'CONNECTION_LOST'
  | 'PAGE_LEAVE_ATTEMPT';

export type RiskSeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export interface IProctoringEvent extends Document {
  sessionId: Types.ObjectId;
  candidateId: Types.ObjectId;
  eventType: EventType;
  serverTimestamp: Date;
  clientTimestamp?: Date;
  severity: RiskSeverity;
  strikeAssigned: boolean;
  metadata?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

const proctoringEventSchema = new Schema<IProctoringEvent>({
  sessionId: { 
    type: Schema.Types.ObjectId, 
    ref: 'AssessmentSession', 
    required: true,
    index: true 
  },
  candidateId: { 
    type: Schema.Types.ObjectId, 
    ref: 'Candidate', 
    required: true,
    index: true 
  },
  eventType: { 
    type: String, 
    enum: [
      'TAB_SWITCH',
      'FULLSCREEN_EXIT',
      'WINDOW_BLUR',
      'FACE_LOST',
      'FACE_RECOVERED',
      'MULTIPLE_FACES',
      'HEAD_POSE_DEVIATION',
      'GAZE_DEVIATION',
      'FACE_PARTIALLY_OUT_OF_FRAME',
      'COPY_PASTE_ATTEMPT',
      'RESTRICTED_KEY_COMBO',
      'CAMERA_DISCONNECTED',
      'CAMERA_REVOKED',
      'DETECTION_UNAVAILABLE',
      'CONNECTION_LOST',
      'PAGE_LEAVE_ATTEMPT'
    ],
    required: true,
    index: true 
  },
  serverTimestamp: { type: Date, default: Date.now, required: true },
  clientTimestamp: { type: Date },
  severity: { 
    type: String, 
    enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'], 
    default: 'LOW', 
    required: true 
  },
  strikeAssigned: { 
    type: Boolean, 
    default: false, 
    required: true 
  },
  metadata: { type: Schema.Types.Mixed }
}, { timestamps: true });

// Compound index for querying session timeline and duplicate event detection
proctoringEventSchema.index({ sessionId: 1, eventType: 1, serverTimestamp: -1 });

export const ProctoringEvent = mongoose.models.ProctoringEvent || mongoose.model<IProctoringEvent>('ProctoringEvent', proctoringEventSchema);
