'use client';
import { useAssessmentState } from '@/hooks/useAssessmentState';
import { getOrderedQuestions } from '@/lib/safe-questions';
import { motion, AnimatePresence } from 'framer-motion';
import { Flag, Search, ChevronRight, Check, ArrowRight, ChevronDown, ChevronUp, AlertCircle } from 'lucide-react';
import { useState, useMemo } from 'react';

const MODULE_DISPLAY_NAMES: Record<string, string> = {
  'Workplace Communication': 'Communication',
  'Email Correspondence & Professional Etiquette': 'Email Writing',
  'Code Snapshots & Output Analysis': 'Programming',
  'GitHub & Version Control': 'Git',
  'Technical Aptitude & Engineering Reasoning': 'Aptitude'
};

function isQuestionAnswered(q: any, rawAnswer: string | undefined): boolean {
  if (!rawAnswer || typeof rawAnswer !== 'string' || rawAnswer.trim().length === 0) {
    return false;
  }
  if (q?.type === 'EMAIL_COMPOSE') {
    try {
      const parsed = JSON.parse(rawAnswer);
      return !!(parsed.subject?.trim() && parsed.body?.trim());
    } catch {
      return false;
    }
  }
  return true;
}

function getAnswerPreview(q: any, rawAnswer: string | undefined): string | null {
  if (!isQuestionAnswered(q, rawAnswer) || !rawAnswer) return null;
  if (q?.type === 'EMAIL_COMPOSE') {
    try {
      const parsed = JSON.parse(rawAnswer);
      return parsed.subject ? `Subject: ${parsed.subject}` : 'Draft composed';
    } catch {
      return null;
    }
  }
  if (q?.type === 'GIT_COMMAND') {
    try {
      const parsed = JSON.parse(rawAnswer);
      return `$ ${parsed.value || parsed.rawValue || rawAnswer}`;
    } catch {
      return `$ ${rawAnswer}`;
    }
  }
  if (q?.type === 'MULTIPLE_CHOICE') {
    return `Option ${rawAnswer}`;
  }
  if (q?.type === 'FREE_TEXT') {
    try {
      const parsed = JSON.parse(rawAnswer);
      return parsed.text ? `"${parsed.text}"` : null;
    } catch {
      return `"${rawAnswer}"`;
    }
  }
  return null;
}

export default function ReviewPanel() {
  const { answers, flags, jumpToQuestion, setStatus, questionOrder } = useAssessmentState();

  const [activeTab, setActiveTab] = useState<'ALL' | 'UNANSWERED' | 'FLAGGED'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedSectionIdx, setExpandedSectionIdx] = useState<number | null>(null);

  const questionsList = useMemo(() => getOrderedQuestions(questionOrder), [questionOrder]);
  const totalQuestions = questionsList.length;

  // Answer counts based on actual response validity
  const answeredQuestionsCount = useMemo(() => {
    return questionsList.filter(q => isQuestionAnswered(q, answers[q.id])).length;
  }, [answers, questionsList]);

  const unansweredQuestionsCount = totalQuestions - answeredQuestionsCount;
  const flaggedQuestionsCount = useMemo(() => {
    return Object.keys(flags).filter(k => flags[k as unknown as number]).length;
  }, [flags]);

  const completionPercentage = totalQuestions > 0 ? (answeredQuestionsCount / totalQuestions) * 100 : 0;

  // Module Breakdown grouped in exact sequence: Communication -> Email Writing -> Programming -> Git -> Aptitude
  const categories = useMemo(() => {
    const cats: {
      name: string;
      moduleLabel: string;
      total: number;
      answered: number;
      questions: Array<any & { index: number }>;
    }[] = [];

    questionsList.forEach((q, index) => {
      let cat = cats.find(c => c.name === q.category);
      if (!cat) {
        cat = {
          name: q.category,
          moduleLabel: MODULE_DISPLAY_NAMES[q.category] || q.category,
          total: 0,
          answered: 0,
          questions: []
        };
        cats.push(cat);
      }
      cat.total++;
      if (isQuestionAnswered(q, answers[q.id])) {
        cat.answered++;
      }
      cat.questions.push({ ...q, index });
    });

    return cats;
  }, [answers, questionsList]);

  // Questions filtered by Tab + Search
  const filteredQuestions = useMemo(() => {
    const list = questionsList.map((q, index) => ({ ...q, index }));

    let result = list;
    if (activeTab === 'UNANSWERED') {
      result = list.filter(q => !isQuestionAnswered(q, answers[q.id]));
    } else if (activeTab === 'FLAGGED') {
      result = list.filter(q => !!flags[q.id]);
    }

    if (searchQuery.trim()) {
      const qLower = searchQuery.toLowerCase().trim();
      result = result.filter(q => {
        const qNumberStr = `q${String(q.index + 1).padStart(2, '0')}`.toLowerCase();
        const numStr = String(q.index + 1);
        const moduleName = (MODULE_DISPLAY_NAMES[q.category] || '').toLowerCase();
        return (
          q.question.toLowerCase().includes(qLower) ||
          q.category.toLowerCase().includes(qLower) ||
          moduleName.includes(qLower) ||
          qNumberStr.includes(qLower) ||
          numStr === qLower
        );
      });
    }

    return result;
  }, [answers, flags, activeTab, searchQuery, questionsList]);

  const handleReturnToAssessment = () => {
    // Jump to first unanswered question if any, else index 0
    const firstUnanswered = questionsList.findIndex(q => !isQuestionAnswered(q, answers[q.id]));
    jumpToQuestion(firstUnanswered >= 0 ? firstUnanswered : 0);
    setStatus('IN_PROGRESS');
  };

  const handleSelectQuestion = (index: number) => {
    jumpToQuestion(index);
    setStatus('IN_PROGRESS');
  };

  return (
    <div className="h-full w-full bg-[#FAF8F5] flex flex-col font-sans overflow-y-auto pb-32 text-[#121214]">
      <div className="max-w-[1280px] w-full mx-auto px-4 sm:px-8 lg:px-12 pt-8 sm:pt-10 flex-1 flex flex-col">
        
        {/* COMPACT CORPORATE HEADING BLOCK */}
        <div className="mb-8">
          <div className="flex flex-col sm:flex-row sm:items-baseline sm:justify-between gap-4 pb-6 border-b border-black/[0.08]">
            <div>
              <h1 className="text-2xl sm:text-[28px] font-bold text-[#121214] tracking-tight">
                Review your assessment
              </h1>
              <p className="text-[14px] text-[#71717A] mt-1 font-normal">
                Check your responses before final submission.
              </p>
            </div>

            {/* Simple Progress Summary */}
            <div className="flex items-center gap-3 self-start sm:self-auto">
              <div className="text-left sm:text-right">
                <div className="text-sm font-semibold text-[#121214]">
                  {answeredQuestionsCount} of {totalQuestions} answered
                </div>
                <div className="text-xs text-[#71717A] mt-0.5">
                  {unansweredQuestionsCount > 0 ? (
                    <span>{unansweredQuestionsCount} unanswered</span>
                  ) : (
                    <span className="text-emerald-700 font-medium">All questions answered</span>
                  )}
                  {flaggedQuestionsCount > 0 && (
                    <span> · {flaggedQuestionsCount} flagged</span>
                  )}
                </div>
              </div>

              {/* Restrained Progress Indicator */}
              <div className="w-24 sm:w-28 h-1.5 bg-black/[0.06] rounded-full overflow-hidden shrink-0">
                <motion.div
                  initial={false}
                  animate={{ width: `${completionPercentage}%` }}
                  transition={{ duration: 0.3 }}
                  className="h-full bg-[#DC2626] rounded-full"
                />
              </div>
            </div>
          </div>
        </div>

        {/* MAIN BALANCED WORKSPACE */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          
          {/* LEFT: ASSESSMENT BREAKDOWN (lg:col-span-5) */}
          <section className="lg:col-span-5 flex flex-col gap-3" aria-label="Assessment Module Breakdown">
            <div className="flex items-baseline justify-between px-1">
              <h2 className="text-[11px] font-bold text-[#71717A] uppercase tracking-wider">
                Module Breakdown
              </h2>
              <span className="text-[11px] text-[#71717A]">
                5 modules · {totalQuestions} questions
              </span>
            </div>

            {/* Single Cohesive List with Subtle Dividers */}
            <div className="bg-white rounded-2xl border border-black/[0.08] divide-y divide-black/[0.06] shadow-2xs overflow-hidden">
              {categories.map((cat, idx) => {
                const isExpanded = expandedSectionIdx === idx;
                const isComplete = cat.answered === cat.total;
                const catProgress = cat.total > 0 ? (cat.answered / cat.total) * 100 : 0;

                return (
                  <div key={cat.name} className="transition-colors">
                    {/* Header Row */}
                    <button
                      type="button"
                      onClick={() => setExpandedSectionIdx(isExpanded ? null : idx)}
                      className="w-full px-4 sm:px-5 py-3.5 flex items-center justify-between text-left hover:bg-black/[0.02] transition-colors focus:outline-none cursor-pointer"
                      aria-expanded={isExpanded}
                      aria-label={`${cat.name}: ${cat.answered} of ${cat.total} answered`}
                    >
                      <div className="flex items-center gap-3 min-w-0 flex-1 pr-3">
                        <span className="text-[11px] font-mono text-[#71717A] shrink-0 font-medium">
                          0{idx + 1}
                        </span>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-xs font-semibold text-[#121214] truncate">
                              {cat.name}
                            </span>
                            <span className="text-[10px] text-[#71717A] font-mono uppercase bg-black/[0.04] px-1.5 py-0.5 rounded">
                              {cat.moduleLabel}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 shrink-0">
                        <div className="text-right">
                          <div className="text-[11px] font-mono font-medium text-[#121214]">
                            {cat.answered} / {cat.total}
                          </div>
                          <div className="w-16 h-1 bg-black/[0.06] rounded-full overflow-hidden mt-1">
                            <div
                              className={`h-full rounded-full transition-all ${
                                isComplete ? 'bg-emerald-600' : 'bg-[#DC2626]'
                              }`}
                              style={{ width: `${catProgress}%` }}
                            />
                          </div>
                        </div>
                        <div className="w-5 h-5 flex items-center justify-center text-[#71717A]">
                          {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                        </div>
                      </div>
                    </button>

                    {/* Expandable Question Chips Drawer */}
                    <AnimatePresence>
                      {isExpanded && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.2 }}
                          className="border-t border-black/[0.06] bg-[#FAF8F5]/60 px-4 py-3 overflow-hidden"
                        >
                          <div className="grid grid-cols-5 gap-1.5">
                            {cat.questions.map((q) => {
                              const isAns = isQuestionAnswered(q, answers[q.id]);
                              const isFlag = !!flags[q.id];

                              return (
                                <button
                                  key={q.id}
                                  type="button"
                                  onClick={() => handleSelectQuestion(q.index)}
                                  className={`flex items-center justify-between px-2 py-1.5 rounded-lg border text-[11px] font-mono transition-all cursor-pointer ${
                                    isAns
                                      ? 'bg-white border-black/[0.08] text-[#121214] hover:border-black/30'
                                      : 'bg-white/80 border-dashed border-black/20 text-[#71717A] hover:border-[#DC2626]/50'
                                  }`}
                                  title={`Go to Question ${q.index + 1}`}
                                >
                                  <span className="font-medium">
                                    Q{String(q.index + 1).padStart(2, '0')}
                                  </span>
                                  <div className="flex items-center gap-0.5">
                                    {isFlag && (
                                      <Flag size={9} className="text-[#DC2626] fill-[#DC2626]" />
                                    )}
                                    {isAns ? (
                                      <Check size={11} className="text-emerald-600 stroke-[2.5]" />
                                    ) : (
                                      <span className="w-1 h-1 rounded-full bg-black/25" />
                                    )}
                                  </div>
                                </button>
                              );
                            })}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                );
              })}
            </div>
          </section>

          {/* RIGHT: QUESTION REVIEW LIST (lg:col-span-7) */}
          <section className="lg:col-span-7 flex flex-col gap-3" aria-label="Question Review Area">
            <div className="flex items-baseline justify-between px-1">
              <h2 className="text-[11px] font-bold text-[#71717A] uppercase tracking-wider">
                Question Review
              </h2>
              <span className="text-[11px] text-[#71717A]">
                Click any question to return and edit
              </span>
            </div>

            {/* Question Review Container */}
            <div className="bg-white rounded-2xl border border-black/[0.08] shadow-2xs overflow-hidden flex flex-col">
              
              {/* Filter Tabs + Search Controls */}
              <div className="p-3 sm:p-4 border-b border-black/[0.06] flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between bg-white">
                {/* Segmented Filter Pills */}
                <div className="flex bg-[#FAF8F5] p-1 rounded-xl border border-black/[0.05] shrink-0">
                  <button
                    type="button"
                    onClick={() => setActiveTab('ALL')}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                      activeTab === 'ALL'
                        ? 'bg-white text-[#121214] shadow-2xs'
                        : 'text-[#71717A] hover:text-[#121214]'
                    }`}
                  >
                    All ({totalQuestions})
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab('UNANSWERED')}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                      activeTab === 'UNANSWERED'
                        ? 'bg-white text-[#DC2626] shadow-2xs'
                        : 'text-[#71717A] hover:text-[#121214]'
                    }`}
                  >
                    Unanswered ({unansweredQuestionsCount})
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab('FLAGGED')}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                      activeTab === 'FLAGGED'
                        ? 'bg-white text-[#121214] shadow-2xs'
                        : 'text-[#71717A] hover:text-[#121214]'
                    }`}
                  >
                    Flagged ({flaggedQuestionsCount})
                  </button>
                </div>

                {/* Search Input */}
                <div className="relative flex-1 sm:max-w-[240px]">
                  <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#71717A]" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search questions..."
                    className="w-full bg-[#FAF8F5] border border-black/[0.06] rounded-xl py-1.5 pl-8 pr-3 text-xs text-[#121214] placeholder:text-[#71717A] focus:outline-none focus:border-black/30 focus:bg-white transition-all"
                  />
                </div>
              </div>

              {/* Clean List Rows */}
              <div className="divide-y divide-black/[0.05] max-h-[560px] overflow-y-auto">
                {filteredQuestions.length === 0 ? (
                  <div className="py-12 px-4 flex flex-col items-center justify-center text-center">
                    <div className="w-9 h-9 rounded-full bg-black/[0.03] flex items-center justify-center text-[#71717A] mb-2">
                      <Check size={16} />
                    </div>
                    <p className="text-xs font-semibold text-[#121214]">
                      {activeTab === 'UNANSWERED'
                        ? 'All questions are answered!'
                        : activeTab === 'FLAGGED'
                        ? 'No flagged questions.'
                        : 'No matching questions found.'}
                    </p>
                    <p className="text-[11px] text-[#71717A] mt-0.5">
                      {activeTab === 'UNANSWERED'
                        ? 'You are ready to submit your assessment.'
                        : 'Try adjusting your search query or active filter.'}
                    </p>
                  </div>
                ) : (
                  filteredQuestions.map((q) => {
                    const isAns = isQuestionAnswered(q, answers[q.id]);
                    const isFlag = !!flags[q.id];
                    const preview = getAnswerPreview(q, answers[q.id]);
                    const moduleLabel = MODULE_DISPLAY_NAMES[q.category] || q.category;

                    return (
                      <button
                        key={q.id}
                        type="button"
                        onClick={() => handleSelectQuestion(q.index)}
                        className="w-full p-3.5 sm:px-5 sm:py-3.5 flex items-start sm:items-center justify-between gap-4 text-left hover:bg-[#FAF8F5] transition-colors focus:outline-none group cursor-pointer"
                      >
                        <div className="flex items-start gap-3 min-w-0 flex-1">
                          <span className="text-[11px] font-mono font-medium text-[#71717A] bg-black/[0.04] px-1.5 py-0.5 rounded shrink-0 mt-0.5 sm:mt-0">
                            Q{String(q.index + 1).padStart(2, '0')}
                          </span>
                          
                          <div className="min-w-0 flex-1">
                            <p className="text-[13px] font-medium text-[#121214] line-clamp-1 leading-snug group-hover:text-[#DC2626] transition-colors">
                              {q.question}
                            </p>
                            <div className="flex items-center gap-2 mt-0.5 text-[11px] text-[#71717A]">
                              <span className="truncate">{moduleLabel}</span>
                              {preview && (
                                <>
                                  <span className="text-black/20">·</span>
                                  <span className="text-[#121214] font-mono text-[10.5px] truncate">
                                    {preview}
                                  </span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Status + Navigation Hint */}
                        <div className="flex items-center gap-2.5 shrink-0 self-center">
                          {isFlag && (
                            <span className="inline-flex items-center gap-1 text-[10.5px] font-medium text-[#DC2626] bg-[#DC2626]/10 px-2 py-0.5 rounded-full">
                              <Flag size={9} className="fill-[#DC2626]" />
                              <span>Flagged</span>
                            </span>
                          )}

                          {isAns ? (
                            <span className="inline-flex items-center gap-1 text-[10.5px] font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
                              <Check size={10} className="stroke-[2.5]" />
                              <span>Answered</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center text-[10.5px] font-medium text-[#DC2626] bg-[#DC2626]/10 px-2 py-0.5 rounded-full">
                              Unanswered
                            </span>
                          )}

                          <ChevronRight
                            size={14}
                            className="text-[#71717A] group-hover:text-[#121214] group-hover:translate-x-0.5 transition-all"
                          />
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          </section>

        </div>
      </div>

      {/* SLIM REFINED BOTTOM ACTION BAR */}
      <footer className="fixed bottom-0 left-0 right-0 border-t border-black/[0.08] bg-white/95 backdrop-blur-md z-40 px-4 sm:px-8 py-3.5 shadow-[0_-4px_24px_rgba(0,0,0,0.04)] font-sans">
        <div className="max-w-[1280px] mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 sm:gap-4">
          
          {/* Left: Autosaved status + concise summary */}
          <div className="flex items-center gap-2 text-xs text-[#71717A] flex-wrap justify-center sm:justify-start">
            <span className="inline-flex items-center gap-1.5 text-emerald-700 font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              Autosaved
            </span>
            <span className="text-black/20">·</span>
            <span className="text-[#121214] font-medium">
              {answeredQuestionsCount} of {totalQuestions} answered
            </span>
            {unansweredQuestionsCount > 0 && (
              <>
                <span className="text-black/20">·</span>
                <span className="text-[#DC2626] font-medium">
                  {unansweredQuestionsCount} unanswered
                </span>
              </>
            )}
            {flaggedQuestionsCount > 0 && (
              <>
                <span className="text-black/20">·</span>
                <span className="inline-flex items-center gap-1 text-amber-700 font-medium">
                  <Flag size={11} className="text-amber-500 fill-amber-500" />
                  {flaggedQuestionsCount} flagged
                </span>
              </>
            )}
          </div>

          {/* Right: Actions */}
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <button
              type="button"
              onClick={handleReturnToAssessment}
              className="flex-1 sm:flex-none px-4 py-2.5 rounded-xl border border-black/[0.1] text-xs font-semibold text-[#121214] hover:bg-black/[0.03] transition-colors cursor-pointer text-center"
            >
              ← Back to Assessment
            </button>
            <button
              type="button"
              onClick={() => useAssessmentState.getState().setShowSubmitModal(true)}
              className="flex-1 sm:flex-none px-5 py-2.5 rounded-xl bg-[#DC2626] hover:bg-[#B91C1C] text-xs font-semibold text-white tracking-wide transition-colors shadow-xs flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <span>Submit Assessment</span>
              <ArrowRight size={13} />
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
}
