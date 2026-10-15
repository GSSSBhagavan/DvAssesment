'use client';
import { useAssessmentState } from '@/hooks/useAssessmentState';
import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, Terminal, Loader2 } from 'lucide-react';

type GitPayload = {
  questionId: number;
  value: string;
  rawValue: string;
  normalizedValue: string;
  answered: boolean;
  updatedAt: number;
};

export default function GitWorkspace({ question, questionNumber }: { question: any; questionNumber?: number }) {
  const { setAnswer, answers, currentIndex } = useAssessmentState();
  const displayNum = questionNumber ?? (currentIndex + 1);
  
  const getInitialAnswer = () => {
    const raw = answers[question.id] || '';
    try {
      const parsed = JSON.parse(raw);
      return parsed.value !== undefined ? parsed.value : raw;
    } catch {
      return raw;
    }
  };

  const [localValue, setLocalValue] = useState(getInitialAnswer());
  const [saveState, setSaveState] = useState<'IDLE' | 'SAVING' | 'SAVED'>('IDLE');
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Update local state when question changes
  useEffect(() => {
    setLocalValue(getInitialAnswer());
    setSaveState('IDLE');
    if (inputRef.current) {
      inputRef.current.focus();
    }
  }, [question.id]);

  // Debounced Autosave
  useEffect(() => {
    const rawSaved = answers[question.id] || '';
    let savedVal = rawSaved;
    try {
      const p = JSON.parse(rawSaved);
      if (p.value !== undefined) savedVal = p.value;
    } catch {}

    if (localValue === savedVal) return;

    setSaveState('SAVING');
    
    const handler = setTimeout(() => {
      const trimmed = localValue.trim();
      
      if (trimmed.length > 0) {
        const payload: GitPayload = {
          questionId: question.id,
          value: localValue,
          rawValue: localValue,
          normalizedValue: trimmed.replace(/\s+/g, ' '),
          answered: true,
          updatedAt: Date.now()
        };
        setAnswer(question.id, JSON.stringify(payload));
        setSaveState('SAVED');
        
        setTimeout(() => setSaveState('IDLE'), 2000);
      } else {
        setAnswer(question.id, '');
        setSaveState('IDLE');
      }
    }, 400);

    return () => clearTimeout(handler);
  }, [localValue, question.id]); // eslint-disable-line

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      // Allow next navigation via the main Next button instead of auto-skipping
    }
  };

  const maxChars = question.responseConfig?.maxLength || 200;
  const isOverLimit = localValue.length > maxChars;

  return (
    <div className="h-full flex flex-col p-6 lg:p-10 overflow-y-auto custom-scrollbar font-sans bg-[#F8FAFC]">
      <div className="max-w-4xl w-full mx-auto flex flex-col h-full">
        
        {/* Header */}
        <div className="mb-8 flex flex-col md:flex-row gap-6">
          <div className="flex-1 bg-white border border-slate-200/60 p-8 rounded-[2rem] shadow-sm">
             <div className="flex items-center gap-3 mb-5">
               <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest bg-slate-100/80 px-2.5 py-1 rounded-full">
                 QUESTION {String(displayNum).padStart(2, '0')}
               </span>
               <span className="text-[10px] font-bold text-[#DC2626] uppercase tracking-widest bg-[#FEF2F2] px-2.5 py-1 rounded-full">
                 REPOSITORY TASK
               </span>
               {question.expectedDurationSeconds && (
                 <span className="ml-auto text-[11px] font-bold text-slate-400 uppercase tracking-widest">
                   ~{question.expectedDurationSeconds} SEC
                 </span>
               )}
             </div>
             <h2 className="text-xl md:text-2xl font-semibold text-slate-800 tracking-tight leading-snug">{question.question}</h2>
          </div>
        </div>

        {/* IDE Container */}
        <div className="flex-1 bg-slate-900 rounded-[2rem] flex flex-col shadow-2xl shadow-slate-900/20 overflow-hidden border border-slate-800 relative">
          
          {/* Top Bar */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/50">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-slate-700"></div>
              <div className="w-3 h-3 rounded-full bg-slate-700"></div>
              <div className="w-3 h-3 rounded-full bg-slate-700"></div>
            </div>
            <div className="flex items-center gap-2 text-[11px] font-mono text-slate-400 font-semibold tracking-widest uppercase">
              <Terminal size={14} className="text-slate-500" />
              bash — ~/datavalley/project
            </div>
            <div className="w-12"></div> {/* Spacer for centering */}
          </div>

          {/* Editor Area */}
          <div className="flex-1 p-6 relative flex flex-col group cursor-text" onClick={() => inputRef.current?.focus()}>
            <div className="flex items-start gap-3 flex-1 relative z-10">
              <span className="text-emerald-400 font-mono text-[16px] pt-1 font-bold select-none">$</span>
              <textarea
                ref={inputRef}
                className="flex-1 bg-transparent border-0 text-slate-100 font-mono text-[16px] leading-[1.6] focus:ring-0 focus:outline-none resize-none min-h-[100px] h-full"
                spellCheck={false}
                autoComplete="off"
                placeholder="git ..."
                value={localValue}
                onChange={(e) => setLocalValue(e.target.value)}
                onKeyDown={handleKeyDown}
              />
            </div>
            
            {/* Focus Ring Indicator inside editor */}
            <div className="absolute inset-4 rounded-xl border-2 border-transparent group-focus-within:border-emerald-500/20 pointer-events-none transition-colors duration-300" />
          </div>

          {/* Bottom Status Bar */}
          <div className="bg-[#0f111a] px-6 py-4 flex items-center justify-between border-t border-slate-800">
            <div className="flex items-center gap-6">
              <div className="flex flex-col">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">COMMAND RESPONSE</span>
                <span className="text-[12px] font-mono text-slate-400 mt-1">Expected: Single Git command</span>
              </div>
            </div>
            
            <div className="flex items-center gap-6">
              {/* Save Indicator */}
              <div className="w-24 flex justify-end">
                <AnimatePresence mode="wait">
                  {saveState === 'SAVING' && (
                    <motion.div key="saving" initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -5 }} className="flex items-center gap-2 text-[11px] font-bold text-amber-500 uppercase tracking-widest">
                      <Loader2 size={12} className="animate-spin" /> SAVING...
                    </motion.div>
                  )}
                  {saveState === 'SAVED' && (
                    <motion.div key="saved" initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -5 }} className="flex items-center gap-1.5 text-[11px] font-bold text-emerald-500 uppercase tracking-widest">
                      <Check size={14} strokeWidth={3} /> SAVED
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Character Count */}
              <div className={`text-[12px] font-mono tracking-tight ${isOverLimit ? 'text-[#DC2626]' : 'text-slate-500'}`}>
                {localValue.length} <span className="text-slate-600">/ {maxChars}</span>
              </div>
            </div>
          </div>

        </div>

      </div>
    </div>
  );
}
