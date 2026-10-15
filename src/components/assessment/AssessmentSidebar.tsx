'use client';
import { useAssessmentState } from '@/hooks/useAssessmentState';
import { getOrderedQuestions } from '@/lib/safe-questions';
import { useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, Flag, Circle, Mic, FileText, Image as ImageIcon, Terminal, Mail, MailPen } from 'lucide-react';

const MODULE_DISPLAY_NAMES: Record<string, string> = {
  'Workplace Communication': 'Communication',
  'Email Correspondence & Professional Etiquette': 'Email Writing',
  'Code Snapshots & Output Analysis': 'Programming',
  'GitHub & Version Control': 'Git',
  'Technical Aptitude & Engineering Reasoning': 'Aptitude'
};

export default function AssessmentSidebar() {
  const { currentIndex, answers, flags, jumpToQuestion, isNavigationLocked, setShowSubmitModal, questionOrder } = useAssessmentState();
  const questions = useMemo(() => getOrderedQuestions(questionOrder), [questionOrder]);
  const currentQuestion = questions[currentIndex];

  const { sections, currentSectionIndex, currentSection } = useMemo(() => {
    const groups: { name: string, questions: { id: number, index: number }[], total: number, answered: number }[] = [];
    let lastCategory = '';
    
    questions.forEach((q, index) => {
      if (q.category !== lastCategory) {
        groups.push({ name: q.category, questions: [], total: 0, answered: 0 });
        lastCategory = q.category;
      }
      groups[groups.length - 1].questions.push({ id: q.id, index });
      groups[groups.length - 1].total++;
    });

    const activeIndex = groups.findIndex(g => g.name === currentQuestion?.category);
    return { 
      sections: groups, 
      currentSectionIndex: activeIndex,
      currentSection: groups[activeIndex] 
    };
  }, [currentQuestion?.category, questions]);

  const currentSectionStats = useMemo(() => {
    if (!currentSection) return { answered: 0, flagged: 0, remaining: 0, total: 0 };
    let answeredCount = 0;
    let flaggedCount = 0;
    currentSection.questions.forEach(q => {
      const qData = questions.find(a => a.id === q.id);
      let isAnswered = false;
      if (answers[q.id]) {
        if (qData?.type === 'EMAIL_COMPOSE') {
          try {
            const parsed = JSON.parse(answers[q.id]);
            if (parsed.subject?.trim() && parsed.body?.trim()) {
              isAnswered = true;
            }
          } catch {
            isAnswered = false;
          }
        } else {
          isAnswered = true;
        }
      }
      if (isAnswered) answeredCount++;
      if (flags[q.id]) flaggedCount++;
    });
    return {
      answered: answeredCount,
      flagged: flaggedCount,
      remaining: currentSection.total - answeredCount,
      total: currentSection.total
    };
  }, [currentSection, answers, flags]);

  if (!currentSection) return null;

  return (
    <aside className="w-[240px] bg-white border-l border-slate-200 flex flex-col h-full shrink-0 relative font-sans z-40">
      
      <div className="p-4 border-b border-slate-100">
        <h2 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">Assessment</h2>
        
        <AnimatePresence mode="wait">
          <motion.div 
            key={currentSection.name}
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -5 }}
            transition={{ duration: 0.3 }}
            className="flex flex-col gap-1.5"
          >
            <div className="flex items-center gap-1.5 text-[11px] font-mono font-medium text-slate-500">
              <span>{String(currentSectionIndex + 1).padStart(2, '0')} / {String(sections.length).padStart(2, '0')}</span>
              {MODULE_DISPLAY_NAMES[currentSection.name] && (
                <>
                  <span className="text-slate-300">·</span>
                  <span className="text-slate-700 font-bold uppercase tracking-wider text-[10px]">
                    {MODULE_DISPLAY_NAMES[currentSection.name]}
                  </span>
                </>
              )}
            </div>
            <div className="text-[12px] font-bold uppercase leading-tight text-slate-900 tracking-wide">
              {currentSection.name}
            </div>
            
            <div className="mt-1 flex items-center justify-between text-[10px] font-medium text-slate-500 uppercase tracking-wider">
              <span>Progress</span>
              <span>{currentSectionStats.answered} / {currentSectionStats.total}</span>
            </div>
            <div className="w-full h-[3px] bg-slate-100 overflow-hidden mt-0.5">
              <motion.div 
                initial={false}
                animate={{ width: `${(currentSectionStats.answered / currentSectionStats.total) * 100}%` }}
                className="h-full bg-slate-400"
              />
            </div>
          </motion.div>
        </AnimatePresence>
      </div>
      
      <div className="flex-1 overflow-y-auto px-3 py-4 custom-scrollbar">
        <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3 px-1">Questions</h3>
        
        <AnimatePresence mode="wait">
          <motion.div 
            key={currentSection.name}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="flex flex-col gap-1"
          >
            {currentSection.questions.map((q) => {
              const questionObj = questions.find((a) => a.id === q.id);
              let isAnswered = !!answers[q.id];
              if (isAnswered && questionObj?.type === 'EMAIL_COMPOSE') {
                try {
                  const parsed = JSON.parse(answers[q.id]);
                  isAnswered = !!(parsed.subject?.trim() && parsed.body?.trim());
                } catch {
                  isAnswered = false;
                }
              }
              const isFlagged = flags[q.id];
              const isCurrent = currentIndex === q.index;
              
              const isVoice = questionObj?.type === 'VOICE_RESPONSE';
              const isText = questionObj?.type === 'FREE_TEXT';
              const isEmailAnalysis = false;
              const isEmailCompose = questionObj?.type === 'EMAIL_COMPOSE';
              const isGitCommand = questionObj?.type === 'GIT_COMMAND';
              const isImage = questionObj?.type === 'MULTIPLE_CHOICE' && !isEmailAnalysis;

              let className = 'text-slate-500 hover:text-slate-900 border-transparent hover:bg-slate-50';
              let indicator = <div className="w-1.5 h-1.5 rounded-full bg-slate-300" />;
              
              if (isCurrent) {
                className = 'text-slate-900 bg-slate-50 border-slate-200 font-bold';
                indicator = <div className="w-1.5 h-1.5 rounded-full bg-slate-900" />;
              } else if (isFlagged && isAnswered) {
                className = 'text-amber-700 bg-amber-50/50 border-amber-100';
                indicator = <Flag size={10} className="text-amber-500 fill-amber-500" />;
              } else if (isFlagged) {
                className = 'text-amber-700 border-transparent hover:bg-amber-50/50';
                indicator = <Flag size={10} className="text-amber-500" />;
              } else if (isAnswered) {
                className = 'text-slate-700 border-transparent';
                indicator = <Check size={12} strokeWidth={3} className="text-slate-400" />;
              }

              return (
                <button
                  key={q.id}
                  disabled={isNavigationLocked}
                  onClick={() => jumpToQuestion(q.index)}
                  className={`w-full px-2.5 py-1.5 rounded flex items-center justify-between text-[12px] border transition-all disabled:opacity-50 disabled:cursor-not-allowed ${className}`}
                  aria-label={`Question ${q.index + 1}`}
                >
                  <div className="flex items-center gap-2">
                    <span className="w-4 text-left opacity-60 text-[11px] font-mono">{q.index + 1}</span>
                    <span className="opacity-50">
                      {isVoice && <Mic size={12} />}
                      {isText && <FileText size={12} />}
                      {isEmailAnalysis && <Mail size={12} />}
                      {isEmailCompose && <MailPen size={12} />}
                      {isGitCommand && <Terminal size={12} />}
                      {isImage && <ImageIcon size={12} />}
                    </span>
                  </div>
                  <div className="flex items-center justify-center w-4 h-4">
                    {indicator}
                  </div>
                </button>
              );
            })}
          </motion.div>
        </AnimatePresence>

        <div className="mt-6 border-t border-slate-100 pt-4 px-1">
          <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">Section Status</h3>
          <div className="space-y-1.5">
            <div className="flex justify-between items-center text-[11px] font-medium text-slate-500">
              <span>Answered</span>
              <span className="text-slate-700 font-bold">{currentSectionStats.answered}</span>
            </div>
            <div className="flex justify-between items-center text-[11px] font-medium text-slate-500">
              <span>Remaining</span>
              <span className="text-slate-700 font-bold">{currentSectionStats.remaining}</span>
            </div>
            <div className="flex justify-between items-center text-[11px] font-medium text-slate-500">
              <span>Flagged</span>
              <span className={currentSectionStats.flagged > 0 ? "text-amber-600 font-bold" : "text-slate-700 font-bold"}>{currentSectionStats.flagged}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="p-4 border-t border-slate-100 bg-slate-50 shrink-0 space-y-2">
        <button 
          disabled={isNavigationLocked}
          onClick={() => useAssessmentState.getState().setStatus('REVIEW')}
          className="w-full bg-white hover:bg-slate-100 disabled:opacity-50 text-slate-700 border border-slate-200 font-bold py-2 rounded text-[11px] uppercase tracking-widest transition-colors cursor-pointer"
        >
          Review Questions
        </button>
        <button 
          disabled={isNavigationLocked}
          onClick={() => setShowSubmitModal(true)}
          className="w-full bg-[#DC2626] hover:bg-[#B91C1C] disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed text-white font-bold py-2.5 rounded text-[11px] uppercase tracking-widest transition-colors shadow-sm cursor-pointer"
        >
          Submit Exam
        </button>
      </div>
    </aside>
  );
}
