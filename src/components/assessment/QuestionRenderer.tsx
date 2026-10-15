'use client';
import { useAssessmentState } from '@/hooks/useAssessmentState';
import { getOrderedQuestions } from '@/lib/safe-questions';
import { ChevronLeft, ChevronRight, Flag, Check, Loader2, AlertCircle } from 'lucide-react';
import { useEffect, useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

import EmailWorkspace from '@/components/workspaces/EmailWorkspace';
import EmailComposeWorkspace from '@/components/workspaces/EmailComposeWorkspace';
import VoiceWorkspace from '@/components/workspaces/VoiceWorkspace';
import GitWorkspace from '@/components/workspaces/GitWorkspace';
import CodeWorkspace from '@/components/workspaces/CodeWorkspace';
import ArchitectureWorkspace from '@/components/workspaces/ArchitectureWorkspace';
import PassageWorkspace from '@/components/workspaces/PassageWorkspace';
import ImageMCQWorkspace from '@/components/workspaces/ImageMCQWorkspace';

const MODULE_DISPLAY_NAMES: Record<string, string> = {
  'Workplace Communication': 'Communication',
  'Email Correspondence & Professional Etiquette': 'Email Writing',
  'Code Snapshots & Output Analysis': 'Programming',
  'GitHub & Version Control': 'Git',
  'Technical Aptitude & Engineering Reasoning': 'Aptitude'
};

export default function QuestionRenderer() {
  const { currentIndex, jumpToQuestion, toggleFlag, flags, answers, setAnswer, setStatus, isNavigationLocked, saveStatus, questionOrder } = useAssessmentState();
  const questions = useMemo(() => getOrderedQuestions(questionOrder), [questionOrder]);
  const question = questions[currentIndex];
  
  const [showSectionModal, setShowSectionModal] = useState(false);
  const [isContinuing, setIsContinuing] = useState(false);
  
  const isFlagged = flags[question?.id];
  const currentAnswer = answers[question?.id];

  // Keyboard Shortcuts
  useEffect(() => {
    if (showSectionModal || isNavigationLocked) return;
    
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if typing in an input or textarea
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName)) return;

      if (e.key === 'ArrowRight') {
        if (currentIndex < questions.length - 1 && !isLastInSection) jumpToQuestion(currentIndex + 1);
        else if (isLastInSection) setShowSectionModal(true);
      } else if (e.key === 'ArrowLeft') {
        if (currentIndex > 0) jumpToQuestion(currentIndex - 1);
      } else if (e.key.toLowerCase() === 'f') {
        if (question) toggleFlag(question.id);
      } else if (['a', 'b', 'c', 'd', 'e'].includes(e.key.toLowerCase())) {
        if (question && question.options) {
          const index = e.key.toLowerCase().charCodeAt(0) - 97; // 'a' -> 0
          if (index < question.options.length) {
            const letter = String.fromCharCode(65 + index);
            setAnswer(question.id, letter);
          }
        }
      } else if (['1', '2', '3', '4', '5'].includes(e.key)) {
        if (question && question.options) {
          const index = parseInt(e.key) - 1;
          if (index < question.options.length) {
            const letter = String.fromCharCode(65 + index);
            setAnswer(question.id, letter);
          }
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentIndex, jumpToQuestion, question, toggleFlag, showSectionModal, isNavigationLocked, questions.length]);

  // Section logic
  const { isLastInSection, nextSectionName, currentSectionStats } = useMemo(() => {
    if (!question) return { isLastInSection: false, nextSectionName: '', currentSectionStats: { total: 0, answered: 0 } };
    
    const nextQ = questions[currentIndex + 1];
    const isLast = nextQ ? nextQ.category !== question.category : false;
    const nextName = nextQ ? nextQ.category : '';

    // Calculate current section stats
    let total = 0;
    let answeredCount = 0;
    questions.forEach(q => {
      if (q.category === question.category) {
        total++;
        if (answers[q.id]) answeredCount++;
      }
    });

    return {
      isLastInSection: isLast,
      nextSectionName: nextName,
      currentSectionStats: { total, answered: answeredCount }
    };
  }, [currentIndex, question, answers, questions]);

  if (!question) return null;

  const handleNextSection = () => {
    if (isContinuing) return;
    setIsContinuing(true);
    setTimeout(() => {
      setShowSectionModal(false);
      setIsContinuing(false);
      jumpToQuestion(currentIndex + 1);
    }, 400);
  };

  const renderWorkspace = () => {
    const qNum = currentIndex + 1;
    if (question.category.includes('Email')) {
      if (question.type === 'EMAIL_COMPOSE') {
        return <EmailComposeWorkspace question={question} questionNumber={qNum} />;
      }
      return <EmailWorkspace question={question} questionNumber={qNum} />;
    }
    if (question.category.includes('Communication')) {
      if (question.type === 'MULTIPLE_CHOICE') {
        return <EmailWorkspace question={question} questionNumber={qNum} />;
      }
      if (question.type === 'FREE_TEXT') {
        return <PassageWorkspace question={question} questionNumber={qNum} />;
      }
      return <VoiceWorkspace question={question} questionNumber={qNum} />;
    }
    if (question.category.includes('GitHub') || question.category.includes('Version Control')) {
      if (question.type === 'MULTIPLE_CHOICE') {
        return <ImageMCQWorkspace question={question} questionNumber={qNum} />;
      }
      return <GitWorkspace question={question} questionNumber={qNum} />;
    }
    if (question.category.includes('Code Snapshots') || question.category.includes('Analysis')) return <ImageMCQWorkspace question={question} questionNumber={qNum} />;
    if (question.category.includes('Technical Aptitude')) return <ImageMCQWorkspace question={question} questionNumber={qNum} />;
    if (question.category.includes('Architecture')) return <ArchitectureWorkspace question={question} questionNumber={qNum} />;
    return <CodeWorkspace question={question} questionNumber={qNum} />;
  };

  const unansweredCount = currentSectionStats.total - currentSectionStats.answered;

  return (
    <div className="flex flex-col h-full bg-white relative">
      <div className="flex-1 overflow-hidden relative bg-[#F8FAFC]">
        <AnimatePresence mode="wait">
          <motion.div
            key={question.id}
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -10 }}
            transition={{ duration: 0.25, ease: "easeInOut" }}
            className="absolute inset-0"
          >
            {renderWorkspace()}
          </motion.div>
        </AnimatePresence>
      </div>

      <div className="h-[48px] border-t border-slate-200 bg-white flex items-center justify-between px-6 shrink-0 z-10">
        <button
          onClick={() => jumpToQuestion(currentIndex - 1)}
          disabled={currentIndex === 0 || isNavigationLocked}
          className="flex items-center gap-2 text-slate-500 text-[11px] font-bold uppercase tracking-widest hover:text-slate-900 disabled:opacity-30 disabled:cursor-not-allowed transition-all min-w-[120px]"
        >
          <ChevronLeft size={16} /> Previous
        </button>
        
        <div className="flex items-center justify-center gap-12 flex-1">
          <AnimatePresence mode="wait">
            {(!currentAnswer || currentAnswer.trim().length === 0) ? (
              <motion.div 
                key="idle"
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-widest text-slate-400 w-44 justify-center"
              >
                <div className="w-1.5 h-1.5 rounded-full bg-slate-300"></div> Not Answered
              </motion.div>
            ) : saveStatus === 'SAVING' ? (
              <motion.div 
                key="saving"
                initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
                className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-widest text-slate-400 w-44 justify-center"
              >
                <Loader2 size={14} className="animate-spin" /> Saving...
              </motion.div>
            ) : saveStatus === 'SAVED' ? (
              <motion.div 
                key="saved"
                initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
                className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-widest text-emerald-600 w-44 justify-center"
              >
                <Check size={14} className="stroke-[3]" /> Saved just now
              </motion.div>
            ) : saveStatus === 'ERROR' ? (
              <motion.div 
                key="error"
                initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
                className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-widest text-red-500 w-44 justify-center"
                title="Failed to synchronize with server. Local changes preserved."
              >
                <AlertCircle size={14} /> Sync Failed (Retrying)
              </motion.div>
            ) : (
              <motion.div 
                key="pending"
                initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
                className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-widest text-amber-500 w-44 justify-center"
              >
                <div className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse"></div> Unsaved Changes
              </motion.div>
            )}
          </AnimatePresence>
          
          <button 
            onClick={() => toggleFlag(question.id)}
            className={`flex items-center justify-center gap-1.5 text-[11px] font-bold uppercase tracking-widest transition-all w-36 ${
              isFlagged 
                ? 'text-[#DC2626]' 
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <Flag size={14} className={`transition-transform duration-300 ${isFlagged ? 'fill-[#DC2626] scale-110' : ''}`} />
            {isFlagged ? 'Flagged' : 'Review Later'}
          </button>
        </div>

        <div className="min-w-[120px] flex justify-end">
          {currentIndex === questions.length - 1 ? (
            <button
              onClick={() => setStatus('REVIEW')}
              disabled={isNavigationLocked}
              className="flex items-center gap-2 text-[#DC2626] text-[11px] font-bold uppercase tracking-widest hover:text-[#B91C1C] transition-all disabled:opacity-30 disabled:cursor-not-allowed"
            >
              Review <ChevronRight size={16} />
            </button>
          ) : isLastInSection ? (
            <button
              onClick={() => setShowSectionModal(true)}
              disabled={isNavigationLocked}
              className="flex items-center gap-2 text-[#DC2626] text-[11px] font-bold uppercase tracking-widest hover:text-[#B91C1C] transition-all disabled:opacity-30 disabled:cursor-not-allowed"
            >
              NEXT SECTION <ChevronRight size={16} />
            </button>
          ) : (
            <button
              onClick={() => jumpToQuestion(currentIndex + 1)}
              disabled={isNavigationLocked}
              className="flex items-center gap-2 text-slate-800 text-[11px] font-bold uppercase tracking-widest hover:text-[#DC2626] transition-all disabled:opacity-30 disabled:cursor-not-allowed"
            >
              Next <ChevronRight size={16} />
            </button>
          )}
        </div>
      </div>

      {/* Section Transition Modal */}
      <AnimatePresence>
        {showSectionModal && (
          <div className="absolute inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col font-sans"
            >
              <div className="p-8">
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">
                  {unansweredCount > 0 ? 'SECTION REVIEW' : 'SECTION CHECKPOINT'}
                </div>
                <h2 className="text-xl font-semibold text-slate-900 mb-6">Move to next section?</h2>
                
                <div className="space-y-4 mb-8 text-[14px] text-slate-600">
                  <p>
                    You are about to leave <strong>{MODULE_DISPLAY_NAMES[question.category] || question.category}</strong> <span className="text-slate-500 text-xs font-normal">({question.category})</span> and begin <strong>{MODULE_DISPLAY_NAMES[nextSectionName] || nextSectionName}</strong> <span className="text-slate-500 text-xs font-normal">({nextSectionName})</span>.
                  </p>
                  
                  <div className="flex items-center gap-4 bg-slate-50 p-4 rounded-lg border border-slate-200">
                    <div className="flex-1">
                      <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Current Section Progress</div>
                      <div className="font-semibold text-slate-900">{currentSectionStats.answered} / {currentSectionStats.total} answered</div>
                    </div>
                    {unansweredCount === 0 && <Check className="text-emerald-500" size={24} />}
                  </div>

                  {unansweredCount > 0 && (
                    <div className="flex items-start gap-3 bg-[#FEF2F2] p-4 rounded-lg border border-[#FCA5A5] text-[#991B1B]">
                      <AlertCircle size={18} className="shrink-0 mt-0.5" />
                      <p className="text-[13px] leading-snug">
                        <strong>{unansweredCount} question{unansweredCount > 1 ? 's' : ''} remain unanswered.</strong><br/>
                        You can continue to the next section, but these will remain unanswered. You can return to them later.
                      </p>
                    </div>
                  )}
                  
                  {unansweredCount === 0 && (
                    <p className="text-[13px]">Once you continue, the next competency will begin. You can still return to this section later through the assessment review flow.</p>
                  )}
                </div>

                <div className="flex items-center gap-3 justify-end">
                  {unansweredCount > 0 ? (
                    <>
                      <button 
                        onClick={() => setShowSectionModal(false)}
                        className="px-4 py-2 text-[12px] font-bold text-slate-600 uppercase tracking-widest hover:bg-slate-100 rounded-md transition-colors"
                        disabled={isContinuing}
                      >
                        REVIEW UNANSWERED
                      </button>
                      <button 
                        onClick={handleNextSection}
                        disabled={isContinuing}
                        className="px-6 py-2 bg-[#DC2626] text-white text-[12px] font-bold uppercase tracking-widest rounded-md hover:bg-[#B91C1C] transition-colors flex items-center gap-2"
                      >
                        {isContinuing ? <Loader2 size={16} className="animate-spin" /> : null}
                        {isContinuing ? 'CONTINUING...' : 'CONTINUE ANYWAY →'}
                      </button>
                    </>
                  ) : (
                    <>
                      <button 
                        onClick={() => setShowSectionModal(false)}
                        className="px-4 py-2 text-[12px] font-bold text-slate-600 uppercase tracking-widest hover:bg-slate-100 rounded-md transition-colors"
                        disabled={isContinuing}
                      >
                        CANCEL
                      </button>
                      <button 
                        onClick={handleNextSection}
                        disabled={isContinuing}
                        className="px-6 py-2 bg-[#DC2626] text-white text-[12px] font-bold uppercase tracking-widest rounded-md hover:bg-[#B91C1C] transition-colors flex items-center gap-2"
                      >
                        {isContinuing ? <Loader2 size={16} className="animate-spin" /> : null}
                        {isContinuing ? 'CONTINUING...' : 'CONTINUE →'}
                      </button>
                    </>
                  )}
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
