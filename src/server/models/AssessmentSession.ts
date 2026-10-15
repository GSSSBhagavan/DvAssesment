import mongoose, { Schema, Document, Types } from 'mongoose';

export type AssessmentStatus = 'IN_PROGRESS' | 'SUBMITTED' | 'EXPIRED';
export type IntegrityStatus = 'CLEAN' | 'WARNING' | 'REVIEW_REQUIRED';
export type ShortlistStatus = 'SHORTLISTED' | 'NOT_SHORTLISTED' | 'PENDING';

export interface IAnswer {
  questionId: number;
  value: string;
  timestamp: Date;
}

export interface IProctoringSummary {
  faceMissingStrikes: number;
  multipleFaceEvents: number;
  tabSwitches: number;
  fullscreenExits: number;
  technicalFailures: number;
  lastMissingFaceStartedAt?: Date | null;
  lastMissingFaceStrikeAt?: Date | null;
  lastFacePresentAt?: Date | null;
  inMissingEpisode?: boolean;
}

export interface IAssessmentSession extends Document {
  candidateId: Types.ObjectId;
  assessmentId: Types.ObjectId;
  status: AssessmentStatus;
  startedAt: Date;
  expiresAt: Date;
  submittedAt?: Date;
  answers: IAnswer[];
  currentQuestionId: number;
  currentIndex: number;
  currentSection: string;
  flags: number[];
  visited: number[];
  lastActivityAt: Date;
  lastSavedAt: Date;
  interruptionCount: number;
  lastInterruptionAt?: Date;
  scoreSummary?: {
    total: number;
    mcq: number;
    git: number;
    percentage?: number;
    correctAnswers?: number;
    wrongAnswers?: number;
    unansweredQuestions?: number;
    answeredQuestions?: number;
    totalQuestions?: number;
    totalScore?: number;
    maximumScore?: number;
    timeTakenSeconds?: number;
    sectionBreakdown?: any[];
    breakdown?: any[];
  };
  questionOrder?: number[];
  questionOrderBySection?: Record<string, number[]>;
  integrityStatus: IntegrityStatus;
  strikeCount: number;
  shortlistStatus: ShortlistStatus;
  proctoringSummary: IProctoringSummary;
  createdAt: Date;
  updatedAt: Date;
}

const answerSchema = new Schema<IAnswer>({
  questionId: { type: Number, required: true },
  value: { type: String, required: true },
  timestamp: { type: Date, default: Date.now }
}, { _id: false });

const assessmentSessionSchema = new Schema<IAssessmentSession>({
  candidateId: { 
    type: Schema.Types.ObjectId, 
    ref: 'Candidate', 
    required: true, 
    index: true 
  },
  assessmentId: { 
    type: Schema.Types.ObjectId, 
    ref: 'Assessment', 
    required: true 
  },
  status: { 
    type: String, 
    enum: ['IN_PROGRESS', 'SUBMITTED', 'EXPIRED'], 
    default: 'IN_PROGRESS',
    required: true
  },
  startedAt: { type: Date, required: true, default: Date.now },
  expiresAt: { type: Date, required: true },
  submittedAt: { type: Date },
  answers: { 
    type: [answerSchema],
    default: []
  },
  // Auto-recovery & resume navigation state
  currentQuestionId: {
    type: Number,
    default: 1
  },
  currentIndex: {
    type: Number,
    default: 0
  },
  currentSection: {
    type: String,
    default: 'Workplace Communication'
  },
  flags: {
    type: [Number],
    default: []
  },
  visited: {
    type: [Number],
    default: [0]
  },
  lastActivityAt: {
    type: Date,
    default: Date.now
  },
  lastSavedAt: {
    type: Date,
    default: Date.now
  },
  interruptionCount: {
    type: Number,
    default: 0
  },
  lastInterruptionAt: {
    type: Date
  },
  scoreSummary: {
    total: { type: Number },
    mcq: { type: Number },
    git: { type: Number },
    percentage: { type: Number },
    correctAnswers: { type: Number },
    wrongAnswers: { type: Number },
    unansweredQuestions: { type: Number },
    answeredQuestions: { type: Number },
    totalQuestions: { type: Number },
    totalScore: { type: Number },
    maximumScore: { type: Number },
    timeTakenSeconds: { type: Number },
    sectionBreakdown: { type: [Schema.Types.Mixed], default: [] },
    breakdown: { type: [Schema.Types.Mixed], default: [] }
  },
  questionOrder: {
    type: [Number],
    default: undefined
  },
  questionOrderBySection: {
    type: Schema.Types.Mixed,
    default: undefined
  },
  integrityStatus: {
    type: String,
    enum: ['CLEAN', 'WARNING', 'REVIEW_REQUIRED'],
    default: 'CLEAN',
    required: true,
    index: true
  },
  strikeCount: {
    type: Number,
    default: 0,
    required: true
  },
  shortlistStatus: {
    type: String,
    enum: ['SHORTLISTED', 'NOT_SHORTLISTED', 'PENDING'],
    default: 'PENDING',
    required: true,
    index: true
  },
  proctoringSummary: {
    faceMissingStrikes: { type: Number, default: 0 },
    multipleFaceEvents: { type: Number, default: 0 },
    tabSwitches: { type: Number, default: 0 },
    fullscreenExits: { type: Number, default: 0 },
    technicalFailures: { type: Number, default: 0 },
    lastMissingFaceStartedAt: { type: Date, default: null },
    lastMissingFaceStrikeAt: { type: Date, default: null },
    lastFacePresentAt: { type: Date, default: null },
    inMissingEpisode: { type: Boolean, default: false }
  }
}, { 
  timestamps: true,
  strict: false
});

assessmentSessionSchema.index(
  { candidateId: 1, assessmentId: 1, status: 1 }, 
  { 
    unique: true, 
    partialFilterExpression: { status: 'IN_PROGRESS' } 
  }
);

if (mongoose.models && mongoose.models.AssessmentSession) {
  delete mongoose.models.AssessmentSession;
}
export const AssessmentSession = mongoose.model<IAssessmentSession>('AssessmentSession', assessmentSessionSchema);
