import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IStudentAnswerItem {
  questionId: number;
  value: string;
  category?: string;
  sectionIndex?: number;
  timestamp: Date;
}

export interface IStudentQuestionAudit {
  questionId: number;
  questionNumber: number;
  questionText: string;
  category: string;
  type: 'MULTIPLE_CHOICE' | 'GIT_COMMAND';
  options?: string[];
  
  // Student's placed answer
  studentAnswer: string;
  studentOptionLetter?: string;
  studentOptionText?: string;
  isAnswered: boolean;
  
  // Exact actual authoritative answer
  actualAnswer: string;
  actualOptionLetter?: string;
  actualOptionText?: string;
  
  // Comparative evaluation
  isCorrect: boolean;
  status: 'CORRECT' | 'WRONG' | 'UNANSWERED';
  marksAwarded: number;
  maxMarks: number;
  explanation: string;
}

export interface IStudentAnswer extends Document {
  candidateId: Types.ObjectId;
  sessionId: Types.ObjectId;
  studentName: string;
  studentEmail: string;
  status: 'IN_PROGRESS' | 'SUBMITTED' | 'EXPIRED';
  answers: IStudentAnswerItem[];
  totalAnswered: number;

  // Real-time Faculty Audit & Exact Answer Storage
  questionAudits?: IStudentQuestionAudit[];
  marksObtained?: number;
  totalMarks?: number;
  percentage?: number;
  correctAnswers?: number;
  wrongAnswers?: number;
  unansweredQuestions?: number;
  cutoffMarks?: number;
  shortlistStatus?: 'SHORTLISTED' | 'NOT_SHORTLISTED';
  isPassed?: boolean;
  whyFailedReason?: string;
  sectionBreakdown?: any[];
  evaluatedAt?: Date;

  startedAt: Date;
  submittedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const studentAnswerItemSchema = new Schema<IStudentAnswerItem>({
  questionId: { type: Number, required: true },
  value: { type: String, required: true, default: '' },
  category: { type: String },
  sectionIndex: { type: Number },
  timestamp: { type: Date, default: Date.now }
}, { _id: false });

const studentQuestionAuditSchema = new Schema<IStudentQuestionAudit>({
  questionId: { type: Number, required: true },
  questionNumber: { type: Number, required: true },
  questionText: { type: String, required: true },
  category: { type: String, required: true },
  type: { type: String, enum: ['MULTIPLE_CHOICE', 'GIT_COMMAND'], default: 'MULTIPLE_CHOICE' },
  options: { type: [String], default: [] },
  
  studentAnswer: { type: String, default: '' },
  studentOptionLetter: { type: String, default: '' },
  studentOptionText: { type: String, default: '' },
  isAnswered: { type: Boolean, default: false },
  
  actualAnswer: { type: String, required: true },
  actualOptionLetter: { type: String, default: '' },
  actualOptionText: { type: String, default: '' },
  
  isCorrect: { type: Boolean, default: false },
  status: { type: String, enum: ['CORRECT', 'WRONG', 'UNANSWERED'], default: 'UNANSWERED' },
  marksAwarded: { type: Number, default: 0 },
  maxMarks: { type: Number, default: 1 },
  explanation: { type: String, default: '' }
}, { _id: false });

const studentAnswerSchema = new Schema<IStudentAnswer>({
  candidateId: {
    type: Schema.Types.ObjectId,
    ref: 'Candidate',
    required: true,
    index: true
  },
  sessionId: {
    type: Schema.Types.ObjectId,
    ref: 'AssessmentSession',
    required: true,
    index: true
  },
  studentName: {
    type: String,
    required: true,
    trim: true,
    index: true
  },
  studentEmail: {
    type: String,
    required: true,
    trim: true,
    lowercase: true,
    index: true
  },
  status: {
    type: String,
    enum: ['IN_PROGRESS', 'SUBMITTED', 'EXPIRED'],
    default: 'IN_PROGRESS',
    index: true
  },
  answers: {
    type: [studentAnswerItemSchema],
    default: []
  },
  totalAnswered: {
    type: Number,
    default: 0
  },

  // Faculty comparative audit fields
  questionAudits: {
    type: [studentQuestionAuditSchema],
    default: []
  },
  marksObtained: {
    type: Number
  },
  totalMarks: {
    type: Number,
    default: 60
  },
  percentage: {
    type: Number
  },
  correctAnswers: {
    type: Number
  },
  wrongAnswers: {
    type: Number
  },
  unansweredQuestions: {
    type: Number
  },
  cutoffMarks: {
    type: Number,
    default: 35
  },
  shortlistStatus: {
    type: String,
    enum: ['SHORTLISTED', 'NOT_SHORTLISTED']
  },
  isPassed: {
    type: Boolean
  },
  whyFailedReason: {
    type: String
  },
  sectionBreakdown: {
    type: [Schema.Types.Mixed],
    default: []
  },
  evaluatedAt: {
    type: Date
  },

  startedAt: {
    type: Date,
    default: Date.now
  },
  submittedAt: {
    type: Date
  }
}, {
  timestamps: true,
  collection: 'student_answers'
});

// Indexes for high concurrency & real-time lookups
studentAnswerSchema.index({ candidateId: 1, sessionId: 1 }, { unique: true });
studentAnswerSchema.index({ studentEmail: 1, status: 1 });
studentAnswerSchema.index({ updatedAt: -1 });

// Ensure schema is updated even during Next.js dev reload
if (process.env.NODE_ENV !== 'production' && mongoose.models.StudentAnswer) {
  delete (mongoose.models as any).StudentAnswer;
}

export const StudentAnswer = mongoose.models.StudentAnswer || mongoose.model<IStudentAnswer>('StudentAnswer', studentAnswerSchema, 'student_answers');

