import 'server-only';
import { assessmentData } from '@/server/data/assessmentQuestions';
import { answerKeys } from '@/server/assessment-keys';
import { getDvAnswerKeysFromDb, IDvAnswer } from '@/server/models/DvAnswer';
import { 
  evaluateMcqAnswer, 
  evaluateGitCommand, 
  extractRawCommand,
  SectionBreakdownItem 
} from '@/server/utils/evaluation';
import { SECTION_CONFIG } from '@/server/utils/randomization';
import { IStudentQuestionAudit } from '@/server/models/StudentAnswer';

export interface StudentAuditResult {
  questionAudits: IStudentQuestionAudit[];
  marksObtained: number;
  totalMarks: number;
  percentage: number;
  correctAnswers: number;
  wrongAnswers: number;
  unansweredQuestions: number;
  cutoffMarks: number;
  shortlistStatus: 'SHORTLISTED' | 'NOT_SHORTLISTED';
  isPassed: boolean;
  whyFailedReason: string;
  sectionBreakdown: SectionBreakdownItem[];
  evaluatedAt: Date;
}

/**
 * Parses candidate's raw MCQ answer to resolve option letter, option text, and human-readable label.
 */
function resolveCandidateMcqChoice(
  rawInput: unknown,
  options: string[]
): { optionLetter?: string; optionText?: string; readableAnswer: string } {
  if (rawInput === null || rawInput === undefined) {
    return { readableAnswer: 'Not Attempted' };
  }
  const str = String(rawInput).trim();
  if (!str) {
    return { readableAnswer: 'Not Attempted' };
  }

  // 1. JSON payload from custom workspace
  if (str.startsWith('{') && str.endsWith('}')) {
    try {
      const parsed = JSON.parse(str);
      const letter = typeof parsed.selectedOption === 'string'
        ? parsed.selectedOption.trim().toUpperCase()
        : typeof parsed.letter === 'string' ? parsed.letter.trim().toUpperCase() : '';
      const text = typeof parsed.optionText === 'string'
        ? parsed.optionText.trim()
        : typeof parsed.value === 'string' ? parsed.value.trim() : '';

      if (letter && /^[A-E]$/.test(letter)) {
        const idx = letter.charCodeAt(0) - 65;
        const optText = text || options[idx] || '';
        return {
          optionLetter: letter,
          optionText: optText,
          readableAnswer: `Option ${letter}${optText ? `: ${optText}` : ''}`
        };
      }
      if (text) {
        const matchIdx = options.findIndex(o => o.trim().toLowerCase() === text.toLowerCase());
        const letterFromIdx = matchIdx >= 0 ? String.fromCharCode(65 + matchIdx) : undefined;
        return {
          optionLetter: letterFromIdx,
          optionText: text,
          readableAnswer: letterFromIdx ? `Option ${letterFromIdx}: ${text}` : text
        };
      }
    } catch {
      // Fall through to plain text checks
    }
  }

  // 2. Direct Option Letter: "A", "B", "C", "D", "E"
  if (/^[A-E]$/i.test(str)) {
    const letter = str.toUpperCase();
    const idx = letter.charCodeAt(0) - 65;
    const optText = options[idx] || '';
    return {
      optionLetter: letter,
      optionText: optText,
      readableAnswer: `Option ${letter}${optText ? `: ${optText}` : ''}`
    };
  }

  // 3. Option Number: "1", "2", "3", "4", "5"
  if (/^[1-5]$/.test(str)) {
    const num = parseInt(str, 10);
    const idx = num - 1;
    const letter = String.fromCharCode(65 + idx);
    const optText = options[idx] || '';
    return {
      optionLetter: letter,
      optionText: optText,
      readableAnswer: `Option ${letter}${optText ? `: ${optText}` : ''}`
    };
  }

  // 4. Prefixed format: "A) ...", "A. ...", "Option B: ..."
  const prefixMatch = str.match(/^(?:Option\s+)?([A-E])[\.\)\:\-\s]\s*(.*)$/i);
  if (prefixMatch) {
    const letter = prefixMatch[1].toUpperCase();
    const idx = letter.charCodeAt(0) - 65;
    const textRemainder = prefixMatch[2]?.trim();
    const optText = textRemainder || options[idx] || '';
    return {
      optionLetter: letter,
      optionText: optText,
      readableAnswer: `Option ${letter}${optText ? `: ${optText}` : ''}`
    };
  }

  // 5. Full Option Text Match
  if (options.length > 0) {
    const matchIdx = options.findIndex(opt => opt.trim().toLowerCase() === str.toLowerCase());
    if (matchIdx >= 0) {
      const letter = String.fromCharCode(65 + matchIdx);
      return {
        optionLetter: letter,
        optionText: options[matchIdx],
        readableAnswer: `Option ${letter}: ${options[matchIdx]}`
      };
    }
  }

  // Fallback as raw string
  return {
    readableAnswer: str
  };
}

/**
 * Resolves Data Valley's exact authoritative answer key for a question.
 */
function resolveAuthoritativeAnswer(
  qId: number,
  isGit: boolean,
  options: string[],
  keyObj: { correctAnswer: string; explanation?: string } | undefined,
  dvKey?: IDvAnswer
): { actualAnswer: string; actualOptionLetter?: string; actualOptionText?: string; explanation: string } {
  const explanation = (dvKey?.explanation || keyObj?.explanation || 'Authoritative evaluation standard based on assessment key.').trim();

  if (isGit) {
    const actualCmd = (dvKey?.correctCommand || keyObj?.correctAnswer || 'git status').trim();
    return {
      actualAnswer: actualCmd,
      explanation
    };
  }

  // Resolve correct option index
  let correctIdx = -1;
  let correctLetter: string | undefined = undefined;

  if (dvKey && typeof dvKey.correctOptionNumber === 'number' && dvKey.correctOptionNumber >= 1) {
    correctIdx = dvKey.correctOptionNumber - 1;
    correctLetter = String.fromCharCode(65 + correctIdx);
  } else if (dvKey && dvKey.correctOptionLetter && /^[A-E]$/i.test(dvKey.correctOptionLetter)) {
    correctLetter = dvKey.correctOptionLetter.toUpperCase();
    correctIdx = correctLetter.charCodeAt(0) - 65;
  } else if (keyObj && /^[A-E]$/i.test(keyObj.correctAnswer.trim())) {
    correctLetter = keyObj.correctAnswer.trim().toUpperCase();
    correctIdx = correctLetter.charCodeAt(0) - 65;
  } else if (options.length > 0 && keyObj) {
    const matchIdx = options.findIndex(opt => opt.trim().toLowerCase() === keyObj.correctAnswer.trim().toLowerCase());
    if (matchIdx >= 0) {
      correctIdx = matchIdx;
      correctLetter = String.fromCharCode(65 + matchIdx);
    }
  }

  const optText = correctIdx >= 0 && correctIdx < options.length
    ? options[correctIdx]
    : (dvKey?.correctAnswer || keyObj?.correctAnswer || '');

  const actualAnswer = correctLetter
    ? `Option ${correctLetter}${optText ? `: ${optText}` : ''}`
    : optText;

  return {
    actualAnswer,
    actualOptionLetter: correctLetter,
    actualOptionText: optText,
    explanation
  };
}

/**
 * Builds the comprehensive 60-question comparative audit comparing student submitted answers
 * against exact authoritative Data Valley answer keys, with full faculty resolution narrative.
 */
export function buildStudentQuestionAudits(
  answers: Array<{ questionId: number; value: string }>,
  customKeys?: Map<number, IDvAnswer>
): StudentAuditResult {
  const answersMap = new Map<number, string>();
  for (const a of answers) {
    if (a && typeof a.questionId === 'number' && a.value !== undefined) {
      answersMap.set(a.questionId, String(a.value));
    }
  }

  const questionAudits: IStudentQuestionAudit[] = [];
  let correctCount = 0;
  let wrongCount = 0;
  let unansweredCount = 0;

  // Question-by-question comparative evaluation
  for (let qId = 1; qId <= 60; qId++) {
    const isGit = qId >= 21 && qId <= 25;
    const questionObj = assessmentData.find(q => q.id === qId);
    const customKey = customKeys?.get(qId);
    const keyObj = customKey 
      ? { correctAnswer: customKey.correctAnswer, explanation: customKey.explanation }
      : answerKeys.find(k => k.id === qId);

    const options: string[] = (questionObj?.options && Array.isArray(questionObj.options) && questionObj.options.length > 0)
      ? questionObj.options
      : (customKey?.options && Array.isArray(customKey.options) && customKey.options.length > 0)
        ? customKey.options
        : [];

    const questionText = questionObj?.question || customKey?.passage || `Question ${qId}`;
    const category = questionObj?.category || customKey?.category || 'General Assessment';
    const type: 'MULTIPLE_CHOICE' | 'GIT_COMMAND' = isGit ? 'GIT_COMMAND' : 'MULTIPLE_CHOICE';

    // 1. Resolve student's placed answer
    const rawVal = answersMap.get(qId);
    let isAnswered = false;
    let studentAnswer = 'Not Attempted';
    let studentOptionLetter: string | undefined = undefined;
    let studentOptionText: string | undefined = undefined;

    if (rawVal !== undefined && rawVal !== null && String(rawVal).trim().length > 0) {
      if (isGit) {
        const rawCmd = extractRawCommand(rawVal);
        if (rawCmd.length > 0) {
          isAnswered = true;
          studentAnswer = rawCmd;
        }
      } else {
        const parsed = resolveCandidateMcqChoice(rawVal, options);
        if (parsed.readableAnswer !== 'Not Attempted') {
          isAnswered = true;
          studentAnswer = parsed.readableAnswer;
          studentOptionLetter = parsed.optionLetter;
          studentOptionText = parsed.optionText;
        }
      }
    }

    // 2. Resolve authoritative actual answer
    const authoritative = resolveAuthoritativeAnswer(qId, isGit, options, keyObj, customKey);

    // 3. Evaluate correctness
    let isCorrect = false;
    let status: 'CORRECT' | 'WRONG' | 'UNANSWERED' = 'UNANSWERED';
    let marksAwarded = 0;

    if (!isAnswered) {
      unansweredCount++;
      status = 'UNANSWERED';
      isCorrect = false;
      marksAwarded = 0;
    } else {
      if (isGit) {
        isCorrect = evaluateGitCommand(qId, rawVal, customKey);
      } else {
        isCorrect = evaluateMcqAnswer(
          qId, 
          rawVal, 
          options, 
          keyObj?.correctAnswer || '', 
          customKey
        );
      }

      if (isCorrect) {
        correctCount++;
        status = 'CORRECT';
        marksAwarded = 1;
      } else {
        wrongCount++;
        status = 'WRONG';
        marksAwarded = 0;
      }
    }

    questionAudits.push({
      questionId: qId,
      questionNumber: qId,
      questionText,
      category,
      type,
      options,
      studentAnswer,
      studentOptionLetter,
      studentOptionText,
      isAnswered,
      actualAnswer: authoritative.actualAnswer,
      actualOptionLetter: authoritative.actualOptionLetter,
      actualOptionText: authoritative.actualOptionText,
      isCorrect,
      status,
      marksAwarded,
      maxMarks: 1,
      explanation: authoritative.explanation
    });
  }

  // Section Breakdown calculation
  const sectionBreakdown: SectionBreakdownItem[] = [];
  for (const section of SECTION_CONFIG) {
    let sCorrect = 0;
    let sWrong = 0;
    let sUnanswered = 0;

    for (const qId of section.questionIds) {
      const qAudit = questionAudits.find(q => q.questionId === qId);
      if (qAudit) {
        if (!qAudit.isAnswered) {
          sUnanswered++;
        } else if (qAudit.isCorrect) {
          sCorrect++;
        } else {
          sWrong++;
        }
      } else {
        sUnanswered++;
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

  const marksObtained = correctCount;
  const totalMarks = 60;
  const percentage = Math.round((marksObtained / totalMarks) * 1000) / 10;
  const cutoffMarks = 35;
  const isPassed = marksObtained >= cutoffMarks;
  const shortlistStatus: 'SHORTLISTED' | 'NOT_SHORTLISTED' = isPassed ? 'SHORTLISTED' : 'NOT_SHORTLISTED';

  // Build authoritative Faculty Inquiry Resolution narrative
  let whyFailedReason = '';
  if (!isPassed) {
    const shortfall = cutoffMarks - marksObtained;
    const sectionSummaries = sectionBreakdown
      .map(s => `• ${s.sectionName}: ${s.score}/${s.maximumScore} (${Math.round((s.score / s.maximumScore) * 100)}%) — ${s.wrongAnswers} incorrect, ${s.unansweredQuestions} unattempted`)
      .join('\n');

    whyFailedReason = 
`ACADEMIC JUSTIFICATION & FACULTY RESOLUTION NOTE:
The student secured ${marksObtained} out of 60 marks (${percentage}%), falling short of the standard industry qualification cutoff of ${cutoffMarks}/60 (58.3%) by ${shortfall} mark${shortfall === 1 ? '' : 's'}.

Total Breakdown:
• Correct Answers: ${marksObtained} / 60
• Incorrect Answers: ${wrongCount} / 60
• Unattempted Questions: ${unansweredCount} / 60

Sectional Performance:
${sectionSummaries}

College vs. Industry Gap Analysis:
While the candidate may excel in regular university coursework and rote theory examinations, the Data Valley Assessment is a rigorous, proctored evaluation measuring practical industry readiness, command-line precision (Git workflows), nuanced workplace communication etiquette, and applied technical logic. The detailed question-by-question comparative audit records each specific choice the student made alongside the exact authoritative answer key for full transparency.`;
  } else {
    const surplus = marksObtained - cutoffMarks;
    const sectionSummaries = sectionBreakdown
      .map(s => `• ${s.sectionName}: ${s.score}/${s.maximumScore} (${Math.round((s.score / s.maximumScore) * 100)}%)`)
      .join('\n');

    whyFailedReason = 
`QUALIFICATION CONFIRMATION:
The student secured ${marksObtained} out of 60 marks (${percentage}%), meeting and exceeding the minimum qualification cutoff threshold of ${cutoffMarks}/60 (58.3%) with a surplus of +${surplus} mark${surplus === 1 ? '' : 's'}.

Total Breakdown:
• Correct Answers: ${marksObtained} / 60
• Incorrect Answers: ${wrongCount} / 60
• Unattempted Questions: ${unansweredCount} / 60

Sectional Performance:
${sectionSummaries}

Status: Verified and Shortlisted for technical interview rounds.`;
  }

  return {
    questionAudits,
    marksObtained,
    totalMarks,
    percentage,
    correctAnswers: correctCount,
    wrongAnswers: wrongCount,
    unansweredQuestions: unansweredCount,
    cutoffMarks,
    shortlistStatus,
    isPassed,
    whyFailedReason,
    sectionBreakdown,
    evaluatedAt: new Date()
  };
}

/**
 * Real-time Comparative Audit with MongoDB 'dv_answers' Collection:
 * Fetches the live authoritative answer key from the database and executes a full comparative audit.
 */
export async function auditStudentAnswersWithDb(
  answers: Array<{ questionId: number; value: string }>
): Promise<StudentAuditResult> {
  try {
    const dbKeys = await getDvAnswerKeysFromDb();
    if (dbKeys && dbKeys.size > 0) {
      return buildStudentQuestionAudits(answers, dbKeys);
    }
  } catch (err) {
    console.warn('[StudentAuditor] Could not query dv_answers collection, using local keys:', err);
  }
  return buildStudentQuestionAudits(answers);
}
