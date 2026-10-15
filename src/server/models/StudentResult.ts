import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IStudentResultEntry {
  studentName: string;
  studentEmail: string;
  marksObtained: number;
  totalMarks: number;
  percentage: number;
  shortlistStatus: 'SHORTLISTED' | 'NOT_SHORTLISTED';
  submittedAt: Date;
  candidateId?: string;
  sessionId?: string;
}

export interface IStudentResult extends Document {
  docType: 'STUDENT_RESULT' | 'ALL_STUDENTS_ROSTER';
  rosterKey?: string;
  // Fields for individual student result
  candidateId?: Types.ObjectId;
  sessionId?: Types.ObjectId;
  studentName?: string;
  studentEmail?: string;
  marksObtained?: number;
  totalMarks?: number;
  percentage?: number;
  mcqMarks?: number;
  gitMarks?: number;
  correctAnswers?: number;
  wrongAnswers?: number;
  unansweredQuestions?: number;
  shortlistStatus?: 'SHORTLISTED' | 'NOT_SHORTLISTED';
  sectionBreakdown?: any[];
  detailedBreakdown?: any[];
  timeTakenSeconds?: number;
  submittedAt?: Date;

  // Master roster fields (stores all students results in one array)
  allStudentsResults?: IStudentResultEntry[];
  totalEvaluatedStudents?: number;
  createdAt: Date;
  updatedAt: Date;
}

const studentResultEntrySchema = new Schema<IStudentResultEntry>({
  studentName: { type: String, required: true, trim: true },
  studentEmail: { type: String, required: true, trim: true, lowercase: true },
  marksObtained: { type: Number, required: true },
  totalMarks: { type: Number, default: 60 },
  percentage: { type: Number, required: true },
  shortlistStatus: { type: String, enum: ['SHORTLISTED', 'NOT_SHORTLISTED'], required: true },
  submittedAt: { type: Date, default: Date.now },
  candidateId: { type: String },
  sessionId: { type: String }
}, { _id: false });

const studentResultSchema = new Schema<IStudentResult>({
  docType: {
    type: String,
    enum: ['STUDENT_RESULT', 'ALL_STUDENTS_ROSTER'],
    default: 'STUDENT_RESULT',
    required: true,
    index: true
  },
  rosterKey: {
    type: String,
    index: true
  },
  // Individual student result fields
  candidateId: {
    type: Schema.Types.ObjectId,
    ref: 'Candidate',
    index: true
  },
  sessionId: {
    type: Schema.Types.ObjectId,
    ref: 'AssessmentSession',
    index: true
  },
  studentName: {
    type: String,
    trim: true,
    index: true
  },
  studentEmail: {
    type: String,
    trim: true,
    lowercase: true,
    index: true
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
  mcqMarks: {
    type: Number,
    default: 0
  },
  gitMarks: {
    type: Number,
    default: 0
  },
  correctAnswers: {
    type: Number,
    default: 0
  },
  wrongAnswers: {
    type: Number,
    default: 0
  },
  unansweredQuestions: {
    type: Number,
    default: 0
  },
  shortlistStatus: {
    type: String,
    enum: ['SHORTLISTED', 'NOT_SHORTLISTED'],
    index: true
  },
  sectionBreakdown: {
    type: [Schema.Types.Mixed],
    default: []
  },
  detailedBreakdown: {
    type: [Schema.Types.Mixed],
    default: []
  },
  timeTakenSeconds: {
    type: Number,
    default: 0
  },
  submittedAt: {
    type: Date,
    default: Date.now
  },

  // Master roster fields (stores all students results in one array)
  allStudentsResults: {
    type: [studentResultEntrySchema],
    default: []
  },
  totalEvaluatedStudents: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true,
  collection: 'student_results'
});

// Indexes for fast lookup & reporting
studentResultSchema.index({ studentEmail: 1, docType: 1 });
studentResultSchema.index({ candidateId: 1, sessionId: 1 });
studentResultSchema.index({ rosterKey: 1 });

/**
 * Saves a student's evaluation result into MongoDB:
 * 1. Upserts individual result document in 'student_results'
 * 2. Atomically updates the master roster document in 'student_results' containing all students in one array
 */
export async function recordStudentEvaluationResult(data: {
  candidateId: Types.ObjectId | string;
  sessionId: Types.ObjectId | string;
  studentName: string;
  studentEmail: string;
  marksObtained: number;
  totalMarks?: number;
  percentage: number;
  mcqMarks: number;
  gitMarks: number;
  correctAnswers: number;
  wrongAnswers: number;
  unansweredQuestions: number;
  shortlistStatus: 'SHORTLISTED' | 'NOT_SHORTLISTED';
  sectionBreakdown?: any[];
  detailedBreakdown?: any[];
  timeTakenSeconds?: number;
  submittedAt?: Date;
}) {
  const Model = (mongoose.models.StudentResult as mongoose.Model<IStudentResult>) ||
    mongoose.model<IStudentResult>('StudentResult', studentResultSchema, 'student_results');

  const normalizedEmail = data.studentEmail.trim().toLowerCase();
  const submittedAt = data.submittedAt || new Date();
  const totalMarks = data.totalMarks || 60;

  // 1. Atomic upsert of individual student result document
  const studentDoc = await Model.findOneAndUpdate(
    {
      docType: 'STUDENT_RESULT',
      studentEmail: normalizedEmail,
      sessionId: data.sessionId
    },
    {
      $set: {
        docType: 'STUDENT_RESULT',
        candidateId: data.candidateId,
        sessionId: data.sessionId,
        studentName: data.studentName.trim(),
        studentEmail: normalizedEmail,
        marksObtained: data.marksObtained,
        totalMarks: totalMarks,
        percentage: data.percentage,
        mcqMarks: data.mcqMarks,
        gitMarks: data.gitMarks,
        correctAnswers: data.correctAnswers,
        wrongAnswers: data.wrongAnswers,
        unansweredQuestions: data.unansweredQuestions,
        shortlistStatus: data.shortlistStatus,
        sectionBreakdown: data.sectionBreakdown || [],
        detailedBreakdown: data.detailedBreakdown || [],
        timeTakenSeconds: data.timeTakenSeconds || 0,
        submittedAt: submittedAt
      }
    },
    { upsert: true, returnDocument: 'after' }
  );

  // 2. Atomic update of master roster document containing all student results in one array
  const rosterEntry: IStudentResultEntry = {
    studentName: data.studentName.trim(),
    studentEmail: normalizedEmail,
    marksObtained: data.marksObtained,
    totalMarks: totalMarks,
    percentage: data.percentage,
    shortlistStatus: data.shortlistStatus,
    submittedAt: submittedAt,
    candidateId: data.candidateId.toString(),
    sessionId: data.sessionId.toString()
  };

  // Remove previous entry for this student email (if re-submitted)
  await Model.updateOne(
    { docType: 'ALL_STUDENTS_ROSTER', rosterKey: 'ALL_RESULTS' },
    {
      $pull: { allStudentsResults: { studentEmail: normalizedEmail } }
    },
    { upsert: true }
  );

  // Push new result entry to the master array
  const rosterDoc = await Model.findOneAndUpdate(
    { docType: 'ALL_STUDENTS_ROSTER', rosterKey: 'ALL_RESULTS' },
    {
      $push: { allStudentsResults: rosterEntry }
    },
    { returnDocument: 'after', upsert: true }
  );

  // Update total count
  if (rosterDoc && Array.isArray(rosterDoc.allStudentsResults)) {
    await Model.updateOne(
      { _id: rosterDoc._id },
      { $set: { totalEvaluatedStudents: rosterDoc.allStudentsResults.length } }
    );
  }

  return { studentDoc, rosterDoc };
}

export const StudentResult = mongoose.models.StudentResult || mongoose.model<IStudentResult>('StudentResult', studentResultSchema, 'student_results');
