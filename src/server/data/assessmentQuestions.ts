import 'server-only';
import { assessmentData, getOrderedQuestions } from '@/lib/safe-questions';

export { assessmentData, getOrderedQuestions };
export const assessmentQuestions = assessmentData;
export default assessmentData;
