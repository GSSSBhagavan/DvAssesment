import { assessmentSessionSchema, candidateSchema, proctoringEventSchema } from '../src/server/validation/data.schema';

console.log('--- Running Schema Validation Tests ---');

// Test 1: Candidate Validation
const validCandidate = { email: 'test@example.com', fullName: 'John Doe' };
const invalidCandidate = { email: 'not-an-email', fullName: 'J' };

console.log('Test Candidate valid:', candidateSchema.safeParse(validCandidate).success === true ? 'PASSED' : 'FAILED');
console.log('Test Candidate invalid (email):', candidateSchema.safeParse(invalidCandidate).success === false ? 'PASSED' : 'FAILED');

// Test 2: Assessment Session
const validSession = {
  candidateId: '507f1f77bcf86cd799439011',
  assessmentId: '507f1f77bcf86cd799439012',
  expiresAt: new Date(Date.now() + 3600000), // 1 hour
  answers: [{ questionId: 1, value: 'A', timestamp: new Date() }]
};
console.log('Test Session valid:', assessmentSessionSchema.safeParse(validSession).success === true ? 'PASSED' : 'FAILED');

const invalidSession = {
  ...validSession,
  status: 'INVALID_STATUS'
};
console.log('Test Session invalid status:', assessmentSessionSchema.safeParse(invalidSession).success === false ? 'PASSED' : 'FAILED');

// Test 3: Proctoring Event
const validEvent = {
  sessionId: '507f1f77bcf86cd799439011',
  eventType: 'TAB_SWITCH',
  severity: 'MEDIUM'
};
console.log('Test Proctoring Event valid:', proctoringEventSchema.safeParse(validEvent).success === true ? 'PASSED' : 'FAILED');
