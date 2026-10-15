import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IStudentAnswerItem {
  questionId: number;
  value: string;
  category?: string;
  sectionIndex?: number;
  timestamp: Date;
}

export interface IStudentAnswer extends Document {
  candidateId: Types.ObjectId;
  sessionId: Types.ObjectId;
  studentName: string;
  studentEmail: string;
  status: 'IN_PROGRESS' | 'SUBMITTED' | 'EXPIRED';
  answers: IStudentAnswerItem[];
  totalAnswered: number;
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

export const StudentAnswer = mongoose.models.StudentAnswer || mongoose.model<IStudentAnswer>('StudentAnswer', studentAnswerSchema, 'student_answers');
