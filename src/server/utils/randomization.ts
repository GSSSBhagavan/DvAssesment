import 'server-only';
import crypto from 'crypto';

export interface SectionDefinition {
  sectionId: string;
  name: string;
  questionIds: number[];
}

export const SECTION_CONFIG: SectionDefinition[] = [
  {
    sectionId: 'section-1',
    name: 'Workplace Communication',
    questionIds: [11, 12, 13, 14, 15, 16, 17, 18, 19, 20]
  },
  {
    sectionId: 'section-2',
    name: 'Email Correspondence & Professional Etiquette',
    questionIds: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
  },
  {
    sectionId: 'section-3',
    name: 'Code Snapshots & Output Analysis',
    questionIds: [31, 32, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 44, 45, 46, 47, 48, 49, 50]
  },
  {
    sectionId: 'section-4',
    name: 'GitHub & Version Control',
    questionIds: [21, 22, 23, 24, 25, 26, 27, 28, 29, 30]
  },
  {
    sectionId: 'section-5',
    name: 'Technical Aptitude & Engineering Reasoning',
    questionIds: [51, 52, 53, 54, 55, 56, 57, 58, 59, 60]
  }
];

/**
 * Unbiased Fisher-Yates (Knuth) Shuffle algorithm.
 * Uses crypto.randomInt for cryptographically secure uniform distribution.
 * Supports an optional deterministic PRNG for test reproducibility.
 */
export function fisherYatesShuffle<T>(items: T[], rng?: () => number): T[] {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i--) {
    let j: number;
    if (rng) {
      j = Math.floor(rng() * (i + 1));
    } else {
      j = crypto.randomInt(0, i + 1);
    }
    const temp = arr[i];
    arr[i] = arr[j];
    arr[j] = temp;
  }
  return arr;
}

export interface GeneratedQuestionOrder {
  questionOrder: number[];
  questionOrderBySection: Record<string, number[]>;
}

/**
 * Shuffles question IDs independently within each section.
 * Preserves section sequence and section membership.
 * Guarantees exactly 60 unique question IDs with 0 duplicates or omissions.
 */
export function generateSectionWiseQuestionOrder(rng?: () => number): GeneratedQuestionOrder {
  const questionOrderBySection: Record<string, number[]> = {};
  const fullOrder: number[] = [];

  for (const section of SECTION_CONFIG) {
    const shuffledSection = fisherYatesShuffle(section.questionIds, rng);
    questionOrderBySection[section.name] = shuffledSection;
    fullOrder.push(...shuffledSection);
  }

  // Sanity check: must be exactly 60 unique questions
  if (fullOrder.length !== 60) {
    throw new Error(`Invalid question order length: expected 60, got ${fullOrder.length}`);
  }
  const uniqueSet = new Set(fullOrder);
  if (uniqueSet.size !== 60) {
    throw new Error(`Duplicate question IDs found in generated order: ${uniqueSet.size} unique`);
  }

  return {
    questionOrder: fullOrder,
    questionOrderBySection
  };
}

/**
 * Validates that an existing order is a valid 60-question section-wise permutation.
 */
export function isValidQuestionOrder(order: unknown): order is number[] {
  if (!Array.isArray(order) || order.length !== 60) return false;
  const set = new Set(order);
  if (set.size !== 60) return false;
  for (let id = 1; id <= 60; id++) {
    if (!set.has(id)) return false;
  }
  return true;
}
