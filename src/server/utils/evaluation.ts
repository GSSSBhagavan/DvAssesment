import 'server-only';
import { answerKeys } from '@/server/assessment-keys';
import { SECTION_CONFIG } from '@/server/utils/randomization';
import { assessmentData } from '@/server/data/assessmentQuestions';
import { getDvAnswerKeysFromDb, IDvAnswer } from '@/server/models/DvAnswer';

export interface SectionBreakdownItem {
  sectionId: string;
  sectionName: string;
  totalQuestions: number;
  answeredQuestions: number;
  correctAnswers: number;
  wrongAnswers: number;
  unansweredQuestions: number;
  score: number;
  maximumScore: number;
}

export interface EvaluationResult {
  total: number;
  mcq: number;
  git: number;
  maxTotal: number;
  maxMcq: number;
  maxGit: number;
  totalQuestions: number;
  answeredQuestions: number;
  correctAnswers: number;
  wrongAnswers: number;
  unansweredQuestions: number;
  totalScore: number;
  maximumScore: number;
  percentage: number;
  shortlistStatus: 'SHORTLISTED' | 'NOT_SHORTLISTED';
  sectionBreakdown: SectionBreakdownItem[];
  breakdown: Array<{
    questionId: number;
    type: 'MULTIPLE_CHOICE' | 'GIT_COMMAND';
    isCorrect: boolean;
    isAnswered: boolean;
  }>;
}

/**
 * Safely extracts the candidate's typed command from raw input.
 * Handles both plain strings and the serialized JSON payload produced by GitWorkspace.
 * Client-provided metadata/normalizedValue is never trusted.
 */
export function extractRawCommand(rawInput: unknown): string {
  if (typeof rawInput !== 'string') return '';
  const trimmed = rawInput.trim();
  if (!trimmed) return '';

  if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
    try {
      const parsed = JSON.parse(trimmed);
      if (typeof parsed.rawValue === 'string') {
        return parsed.rawValue.trim();
      }
      if (typeof parsed.value === 'string') {
        return parsed.value.trim();
      }
    } catch {
      // If JSON parse fails, fall through and use the raw string
    }
  }
  return trimmed;
}

/**
 * Normalizes a git command string by trimming and collapsing multiple spaces.
 */
export function normalizeGitCommand(cmd: string): string {
  return cmd.trim().replace(/\s+/g, ' ');
}

/**
 * Evaluates a git command for questions 21-25 using semantic validation and regex matching.
 * Commands are NEVER executed in a shell or invoked via Git.
 */
export function evaluateGitCommand(questionId: number, rawInput: unknown, dvKey?: IDvAnswer): boolean {
  const raw = extractRawCommand(rawInput);
  if (!raw) return false;

  const normalized = normalizeGitCommand(raw);

  // 1. Regular expression evaluation for Git written commands (questions 21-25)
  let regexMatch = false;
  switch (questionId) {
    case 21: {
      // Question: Check working tree status.
      // Expected: git status (accepts -s / --short flag)
      regexMatch = /^git\s+status(\s+(-s|--short))?$/i.test(normalized);
      break;
    }
    case 22: {
      // Question: Stage app.py.
      // Expected: git add app.py (accepts ./app.py)
      regexMatch = /^git\s+add\s+(\.\/)?app\.py$/i.test(normalized);
      break;
    }
    case 23: {
      // Question: Create a commit with message "Add login feature".
      // Expected: git commit -m "Add login feature"
      // Evaluates commit message with regex, accepting -m, -am, or --message with quotes
      const match = normalized.match(/^git\s+commit\s+(-[a-zA-Z]*m\s*|--message(=|\s+))(["'])(.+?)\3$/i);
      if (match) {
        const message = match[4].trim();
        regexMatch = message.toLowerCase() === 'add login feature';
      }
      break;
    }
    case 24: {
      // Question: View commit history.
      // Expected: git log (accepts --oneline flag)
      regexMatch = /^git\s+log(\s+--oneline)?$/i.test(normalized);
      break;
    }
    case 25: {
      // Question: Push current branch to origin.
      // Expected: git push origin (accepts explicit HEAD, main, master branch or -u flag)
      regexMatch = /^git\s+push(\s+-u)?\s+origin(\s+(HEAD|main|master))?$/i.test(normalized);
      break;
    }
    default:
      regexMatch = false;
  }

  if (regexMatch) return true;

  // 2. Live verification against acceptedCommands in dv_answers collection
  if (dvKey) {
    if (dvKey.correctCommand && normalizeGitCommand(dvKey.correctCommand).toLowerCase() === normalized.toLowerCase()) {
      return true;
    }
    if (Array.isArray(dvKey.acceptedCommands) && dvKey.acceptedCommands.length > 0) {
      const matchFound = dvKey.acceptedCommands.some(cmd => normalizeGitCommand(cmd).toLowerCase() === normalized.toLowerCase());
      if (matchFound) return true;
    }
  }

  return false;
}

/**
 * Evaluates an MCQ answer against the question's options and the authoritative dv_answers key.
 * Supports:
 * - Option Number ("1", "2", "3", "4", "5") mapped to 1-based indexing / correctOptionNumber
 * - Option Letter ("A", "B", "C", "D", "E") mapped to correctOptionLetter
 * - Full option text matching
 * - Prefixed letter ("A) Option text")
 * - Serialized JSON format from workspaces
 * Gives 1 mark if correct, 0 marks if wrong. No negative marking.
 */
export function evaluateMcqAnswer(
  questionId: number,
  candidateValue: unknown,
  options: string[] | null | undefined,
  correctAnswerKey: string,
  dvKey?: IDvAnswer
): boolean {
  if (candidateValue === null || candidateValue === undefined) return false;
  const candVal = String(candidateValue).trim();
  if (!candVal) return false;

  const validOptions = (options && Array.isArray(options) && options.length > 0)
    ? options
    : (dvKey?.options && Array.isArray(dvKey.options) && dvKey.options.length > 0)
      ? dvKey.options
      : [];

  const keyVal = (correctAnswerKey || dvKey?.correctAnswer || dvKey?.correctOptionLetter || '').trim();

  // Resolve correct option index
  let correctOptionIndex = -1;
  if (dvKey && typeof dvKey.correctOptionNumber === 'number' && dvKey.correctOptionNumber >= 1) {
    correctOptionIndex = dvKey.correctOptionNumber - 1;
  } else if (dvKey && dvKey.correctOptionLetter && /^[A-E]$/i.test(dvKey.correctOptionLetter)) {
    correctOptionIndex = dvKey.correctOptionLetter.toUpperCase().charCodeAt(0) - 65;
  } else if (/^[A-E]$/i.test(keyVal)) {
    correctOptionIndex = keyVal.toUpperCase().charCodeAt(0) - 65;
  } else if (validOptions.length > 0) {
    const matchIdx = validOptions.findIndex(opt => opt.trim().toLowerCase() === keyVal.toLowerCase());
    if (matchIdx >= 0) {
      correctOptionIndex = matchIdx;
    }
  }

  const correctOptionLetter = correctOptionIndex >= 0 ? String.fromCharCode(65 + correctOptionIndex) : (dvKey?.correctOptionLetter || keyVal).toUpperCase();

  // 1. Serialized JSON format
  if (candVal.startsWith('{') && candVal.endsWith('}')) {
    try {
      const parsed = JSON.parse(candVal);
      const letterVal = typeof parsed.selectedOption === 'string'
        ? parsed.selectedOption.trim()
        : typeof parsed.letter === 'string' ? parsed.letter.trim() : '';
      const textVal = typeof parsed.optionText === 'string'
        ? parsed.optionText.trim()
        : typeof parsed.value === 'string' ? parsed.value.trim() : '';

      if (letterVal) {
        return evaluateMcqAnswer(questionId, letterVal, validOptions, correctAnswerKey, dvKey);
      }
      if (textVal) {
        return evaluateMcqAnswer(questionId, textVal, validOptions, correctAnswerKey, dvKey);
      }
    } catch {
      // Continue to next checks
    }
  }

  // 2. Numeric Option Number: "1", "2", "3", "4", "5"
  if (/^[1-5]$/.test(candVal)) {
    const num = parseInt(candVal, 10);
    if (dvKey && typeof dvKey.correctOptionNumber === 'number') {
      return num === dvKey.correctOptionNumber;
    }
    if (correctOptionIndex >= 0) {
      return (num - 1) === correctOptionIndex;
    }
  }

  // 3. Option Letter: "A", "B", "C", "D", "E" (case-insensitive)
  if (/^[A-E]$/i.test(candVal)) {
    const upperLetter = candVal.toUpperCase();
    if (dvKey && dvKey.correctOptionLetter) {
      return upperLetter === dvKey.correctOptionLetter.toUpperCase();
    }
    if (correctOptionLetter) {
      return upperLetter === correctOptionLetter;
    }
    if (correctOptionIndex >= 0) {
      return upperLetter.charCodeAt(0) - 65 === correctOptionIndex;
    }
  }

  // 4. Prefixed format: e.g. "A) ...", "A. ...", "A - ..."
  const prefixMatch = candVal.match(/^(?:Option\s+)?([A-E])[\.\)\:\-\s]/i);
  if (prefixMatch) {
    const letter = prefixMatch[1].toUpperCase();
    if (dvKey && dvKey.correctOptionLetter) {
      return letter === dvKey.correctOptionLetter.toUpperCase();
    }
    if (correctOptionLetter) {
      return letter === correctOptionLetter;
    }
  }

  // 5. Full Option Text Match
  if (validOptions.length > 0 && correctOptionIndex >= 0 && correctOptionIndex < validOptions.length) {
    const targetText = validOptions[correctOptionIndex].trim().toLowerCase();
    if (candVal.toLowerCase() === targetText) {
      return true;
    }
  }

  if (keyVal && candVal.toLowerCase() === keyVal.toLowerCase()) {
    return true;
  }

  return false;
}

/**
 * Evaluates all 60 questions of an assessment session.
 * Correct answers and explanations are never returned in candidate-facing output.
 * Enforces:
 * - correctAnswers + wrongAnswers + unansweredQuestions === 60
 * - 34 correct -> NOT_SHORTLISTED
 * - 35 correct -> SHORTLISTED
 * - 36 correct -> SHORTLISTED
 */
export function evaluateAssessment(
  answers: Array<{ questionId: number; value: string }>,
  customKeys?: Map<number, IDvAnswer>
): EvaluationResult {
  let totalCorrect = 0;
  let totalWrong = 0;
  let totalUnanswered = 0;
  let mcqCorrect = 0;
  let gitCorrect = 0;
  const breakdown: EvaluationResult['breakdown'] = [];

  const answersMap = new Map<number, string>();
  for (const a of answers) {
    if (a && typeof a.questionId === 'number' && a.value !== undefined) {
      answersMap.set(a.questionId, String(a.value));
    }
  }

  // Question-level evaluation cache
  const questionResults = new Map<number, { isCorrect: boolean; isAnswered: boolean }>();

  for (let qId = 1; qId <= 60; qId++) {
    const isGit = qId >= 21 && qId <= 25;
    const candidateValue = answersMap.get(qId);
    const question = assessmentData.find(q => q.id === qId);
    const customKey = customKeys?.get(qId);
    const key = customKey 
      ? { correctAnswer: customKey.correctAnswer, explanation: customKey.explanation } 
      : answerKeys.find(k => k.id === qId);
    
    // Non-empty check for valid answer
    let isAnswered = false;
    if (candidateValue !== undefined) {
      const rawCmd = isGit ? extractRawCommand(candidateValue) : String(candidateValue).trim();
      if (rawCmd.length > 0) {
        isAnswered = true;
      }
    }

    let isCorrect = false;
    if (isAnswered) {
      if (isGit) {
        isCorrect = evaluateGitCommand(qId, candidateValue!, customKey);
        if (isCorrect) gitCorrect += 1;
      } else {
        if (key) {
          isCorrect = evaluateMcqAnswer(qId, candidateValue!, question?.options || customKey?.options, key.correctAnswer, customKey);
          if (isCorrect) mcqCorrect += 1;
        }
      }

      if (isCorrect) {
        totalCorrect += 1;
      } else {
        totalWrong += 1;
      }
    } else {
      totalUnanswered += 1;
    }

    questionResults.set(qId, { isCorrect, isAnswered });
    breakdown.push({
      questionId: qId,
      type: isGit ? 'GIT_COMMAND' : 'MULTIPLE_CHOICE',
      isCorrect,
      isAnswered
    });
  }

  // Section-wise breakdown calculation
  const sectionBreakdown: SectionBreakdownItem[] = [];

  for (const section of SECTION_CONFIG) {
    let sCorrect = 0;
    let sWrong = 0;
    let sUnanswered = 0;

    for (const qId of section.questionIds) {
      const qRes = questionResults.get(qId);
      if (qRes) {
        if (!qRes.isAnswered) {
          sUnanswered += 1;
        } else if (qRes.isCorrect) {
          sCorrect += 1;
        } else {
          sWrong += 1;
        }
      } else {
        sUnanswered += 1;
      }
    }

    const sAnswered = sCorrect + sWrong;
    const sTotal = section.questionIds.length;

    sectionBreakdown.push({
      sectionId: section.sectionId,
      sectionName: section.name,
      totalQuestions: sTotal,
      answeredQuestions: sAnswered,
      correctAnswers: sCorrect,
      wrongAnswers: sWrong,
      unansweredQuestions: sUnanswered,
      score: sCorrect,
      maximumScore: sTotal
    });
  }

  const answeredQuestions = totalCorrect + totalWrong;
  const percentage = Math.round((totalCorrect / 60) * 1000) / 10;
  const shortlistStatus: 'SHORTLISTED' | 'NOT_SHORTLISTED' = totalCorrect >= 35 ? 'SHORTLISTED' : 'NOT_SHORTLISTED';

  return {
    total: totalCorrect,
    mcq: mcqCorrect,
    git: gitCorrect,
    maxTotal: 60,
    maxMcq: 55,
    maxGit: 5,
    totalQuestions: 60,
    answeredQuestions,
    correctAnswers: totalCorrect,
    wrongAnswers: totalWrong,
    unansweredQuestions: totalUnanswered,
    totalScore: totalCorrect,
    maximumScore: 60,
    percentage,
    shortlistStatus,
    sectionBreakdown,
    breakdown
  };
}

/**
 * Realtime Evaluation with MongoDB 'dv_answers' Collection:
 * Evaluates candidate responses against live authoritative answer keys stored in MongoDB,
 * with zero-latency cached lookup and instant graceful fallback to canonical keys.
 */
export async function evaluateAssessmentWithDb(
  answers: Array<{ questionId: number; value: string }>
): Promise<EvaluationResult> {
  try {
    const dbKeys = await getDvAnswerKeysFromDb();
    if (dbKeys && dbKeys.size > 0) {
      return evaluateAssessment(answers, dbKeys);
    }
  } catch (err) {
    console.warn('[Evaluation] Could not query dv_answers collection, using local keys:', err);
  }
  return evaluateAssessment(answers);
}
