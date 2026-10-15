import mongoose, { Schema, Document } from 'mongoose';

export interface IDvAnswer extends Document {
  questionId: number;
  questionNumber?: number;
  category: string;
  type: string;
  correctAnswer: string;
  options?: string[];
  correctOptionNumber?: number;
  correctOptionLetter?: string;
  correctCommand?: string;
  acceptedCommands?: string[];
  passage?: string;
  explanation: string;
  scoreWeight: number;
  sectionIndex: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const dvAnswerSchema = new Schema<IDvAnswer>({
  questionId: { 
    type: Number, 
    required: true, 
    unique: true, 
    index: true 
  },
  questionNumber: {
    type: Number
  },
  category: { 
    type: String, 
    required: true 
  },
  type: { 
    type: String, 
    default: 'MULTIPLE_CHOICE' 
  },
  correctAnswer: { 
    type: String, 
    required: true 
  },
  options: { 
    type: [String], 
    default: [] 
  },
  correctOptionNumber: {
    type: Number
  },
  correctOptionLetter: {
    type: String
  },
  correctCommand: {
    type: String
  },
  acceptedCommands: {
    type: [String]
  },
  passage: {
    type: String
  },
  explanation: { 
    type: String, 
    default: '' 
  },
  scoreWeight: { 
    type: Number, 
    default: 1 
  },
  sectionIndex: { 
    type: Number, 
    default: 1 
  },
  isActive: { 
    type: Boolean, 
    default: true,
    index: true 
  }
}, { 
  timestamps: true,
  collection: 'dv_answers'
});

// Cache for high-performance realtime evaluation
let cachedKeysMap: Map<number, IDvAnswer> | null = null;
let lastCacheTime = 0;
const CACHE_TTL_MS = 60 * 1000; // 60 seconds TTL

export async function getDvAnswerKeysFromDb(): Promise<Map<number, IDvAnswer>> {
  const now = Date.now();
  if (cachedKeysMap && (now - lastCacheTime < CACHE_TTL_MS)) {
    return cachedKeysMap;
  }

  const DvAnswerModel = (mongoose.models.DvAnswer as mongoose.Model<IDvAnswer>) || 
    mongoose.model<IDvAnswer>('DvAnswer', dvAnswerSchema, 'dv_answers');

  const answers = await DvAnswerModel.find({ isActive: true }).lean().exec();
  const map = new Map<number, IDvAnswer>();
  for (const item of answers) {
    map.set(item.questionId, item as unknown as IDvAnswer);
  }

  if (map.size > 0) {
    cachedKeysMap = map;
    lastCacheTime = now;
  }

  return map;
}

export function clearDvAnswerCache() {
  cachedKeysMap = null;
  lastCacheTime = 0;
}

export const DvAnswer = mongoose.models.DvAnswer || mongoose.model<IDvAnswer>('DvAnswer', dvAnswerSchema, 'dv_answers');
