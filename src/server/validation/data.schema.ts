import { z } from 'zod';

export const candidateSchema = z.object({
  email: z.string().email('Invalid email address'),
  fullName: z.string().min(2, 'Full name must be at least 2 characters')
});

export const assessmentSchema = z.object({
  title: z.string().min(3),
  totalQuestions: z.number().int().positive(),
  durationMinutes: z.number().int().positive()
});

export const answerSchema = z.object({
  questionId: z.number().int().positive(),
  value: z.string(),
  timestamp: z.date().optional()
});

export const assessmentSessionSchema = z.object({
  candidateId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid ObjectId'),
  assessmentId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid ObjectId'),
  status: z.enum(['IN_PROGRESS', 'SUBMITTED', 'EXPIRED']).default('IN_PROGRESS'),
  startedAt: z.date().optional(),
  expiresAt: z.date(),
  answers: z.array(answerSchema).default([])
});

export const proctoringEventSchema = z.object({
  sessionId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid ObjectId'),
  eventType: z.enum(['TAB_SWITCH', 'FULLSCREEN_EXIT', 'FACE_LOST', 'MULTIPLE_FACES', 'CONNECTION_LOST']),
  clientTimestamp: z.date().optional(),
  severity: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).default('LOW'),
  metadata: z.record(z.string(), z.unknown()).optional()
});
