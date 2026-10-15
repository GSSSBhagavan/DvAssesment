import mongoose, { Schema, Document } from 'mongoose';

export interface ICandidate extends Document {
  email: string;
  fullName: string;
  password?: string;
  passwordHash?: string;
  role: 'CANDIDATE' | 'ADMIN';
  createdAt: Date;
  updatedAt: Date;
}

const candidateSchema = new Schema<ICandidate>({
  email: { 
    type: String, 
    required: true, 
    unique: true, 
    index: true,
    trim: true,
    lowercase: true
  },
  fullName: { 
    type: String, 
    required: true, 
    trim: true
  },
  password: {
    type: String,
    select: false // legacy field
  },
  passwordHash: {
    type: String,
    select: false // standard field
  },
  role: {
    type: String,
    enum: ['CANDIDATE', 'ADMIN'],
    default: 'CANDIDATE'
  }
}, { timestamps: true });

// Prevent duplicate model compilation during Next.js hot reloads
export const Candidate = mongoose.models.Candidate || mongoose.model<ICandidate>('Candidate', candidateSchema);
