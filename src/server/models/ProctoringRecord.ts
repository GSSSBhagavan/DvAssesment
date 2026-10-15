import mongoose, { Schema, Document, Types } from 'mongoose';
import { EventCategory, RiskSeverity, ProctoringStatus } from '@/server/utils/proctoringPolicy';

export interface IProctoringEventItem {
  eventId: string;
  idempotencyKey: string;
  eventType: string;
  category: EventCategory;
  serverTimestamp: Date;
  clientTimestamp?: Date;
  strikePoints: number;
  severity: RiskSeverity;
  accepted: boolean;
  isDuplicate: boolean;
  flaggedForReview: boolean;
  reason: string;
  metadata?: Record<string, any>;
}

export interface IProctoringRecord extends Document {
  studentName: string;
  studentEmail: string;
  candidateId: Types.ObjectId;
  sessionId: Types.ObjectId;
  assessmentId?: Types.ObjectId;
  totalStrikes: number;
  status: ProctoringStatus;
  lastEventType?: string;
  lastEventAt?: Date;
  events: IProctoringEventItem[];
  createdAt: Date;
  updatedAt: Date;
}

const proctoringEventItemSchema = new Schema<IProctoringEventItem>({
  eventId: { type: String, required: true },
  idempotencyKey: { type: String, required: true, index: true },
  eventType: { type: String, required: true },
  category: { 
    type: String, 
    enum: ['VISION', 'BROWSER', 'TECHNICAL', 'SYSTEM'], 
    required: true 
  },
  serverTimestamp: { type: Date, default: Date.now, required: true },
  clientTimestamp: { type: Date },
  strikePoints: { type: Number, default: 0, required: true },
  severity: { 
    type: String, 
    enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'], 
    default: 'LOW', 
    required: true 
  },
  accepted: { type: Boolean, default: true, required: true },
  isDuplicate: { type: Boolean, default: false, required: true },
  flaggedForReview: { type: Boolean, default: false, required: true },
  reason: { type: String, required: true },
  metadata: { type: Schema.Types.Mixed }
}, { _id: false });

const proctoringRecordSchema = new Schema<IProctoringRecord>({
  studentName: { type: String, required: true, trim: true },
  studentEmail: { type: String, required: true, trim: true, lowercase: true, index: true },
  candidateId: { type: Schema.Types.ObjectId, ref: 'Candidate', required: true, index: true },
  sessionId: { type: Schema.Types.ObjectId, ref: 'AssessmentSession', required: true, index: true, unique: true },
  assessmentId: { type: Schema.Types.ObjectId, ref: 'Assessment' },
  totalStrikes: { type: Number, default: 0, required: true, min: 0 },
  status: { 
    type: String, 
    enum: ['NORMAL', 'WARNING', 'REVIEW_REQUIRED', 'COMPLETED'], 
    default: 'NORMAL', 
    required: true,
    index: true 
  },
  lastEventType: { type: String },
  lastEventAt: { type: Date },
  events: { type: [proctoringEventItemSchema], default: [] }
}, { 
  timestamps: true,
  collection: 'proctoring_events' // Matches user explicit requirement: collection name proctoring_events
});

// Indexes for fast lookup and integrity checking
proctoringRecordSchema.index({ sessionId: 1 }, { unique: true });
proctoringRecordSchema.index({ studentEmail: 1, createdAt: -1 });
proctoringRecordSchema.index({ 'events.idempotencyKey': 1 });

export const ProctoringRecord = mongoose.models.ProctoringRecord || mongoose.model<IProctoringRecord>('ProctoringRecord', proctoringRecordSchema);
