import mongoose, { Schema, Document } from 'mongoose';

export interface IAssessmentQuestion {
  id: number;
  type: string;
  category: string;
  question: string;
  options: string[];
  assets?: Record<string, unknown>;
  correctAnswer?: string;
  explanation?: string;
}

export interface IAssessmentAnswerKey {
  id: number;
  correctAnswer: string;
  explanation?: string;
}

export interface IMcqQuestionItem {
  questionNumber: number;
  questionId: number;
  category: string;
  type: string;
  question: string;
  options: string[];
  correctOptionNumber: number;
  correctOptionLetter: string;
  correctAnswer: string;
  explanation: string;
  assets?: Record<string, unknown>;
  image?: string;
}

export interface IGitWrittenQuestionItem {
  questionNumber: number;
  questionId: number;
  category: string;
  type: string;
  question: string;
  passage?: string;
  correctCommand: string;
  correctAnswer: string;
  acceptedCommands: string[];
  explanation: string;
  assets?: Record<string, unknown>;
}

export interface IAssessment extends Document {
  title: string;
  totalQuestions: number;
  totalMcqQuestions?: number;
  totalGitQuestions?: number;
  durationMinutes: number;
  mcqQuestions?: IMcqQuestionItem[];
  gitWrittenQuestions?: IGitWrittenQuestionItem[];
  questions?: IAssessmentQuestion[];
  answers?: IAssessmentAnswerKey[];
  createdAt: Date;
  updatedAt: Date;
}

const assessmentSchema = new Schema<IAssessment>({
  title: { type: String, required: true },
  totalQuestions: { type: Number, required: true },
  totalMcqQuestions: { type: Number, default: 55 },
  totalGitQuestions: { type: Number, default: 5 },
  durationMinutes: { type: Number, required: true },
  mcqQuestions: { type: [Schema.Types.Mixed], default: [] },
  gitWrittenQuestions: { type: [Schema.Types.Mixed], default: [] },
  questions: { type: [Schema.Types.Mixed], default: [] },
  answers: { type: [Schema.Types.Mixed], default: [] }
}, { timestamps: true });

export const Assessment = mongoose.models.Assessment || mongoose.model<IAssessment>('Assessment', assessmentSchema);

