'use client';
import { useAssessmentState } from '@/hooks/useAssessmentState';
import { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, Loader2 } from 'lucide-react';

export default function PassageWorkspace({ question }: { question: any }) {
  const { setAnswer, answers } = useAssessmentState();
  const [text, setText] = useState('');
  const [saveState, setSaveState] = useState<'IDLE' | 'SAVING' | 'SAVED'>('IDLE');
  
  const maxCharacters = 500;
  const charCount = text.length;

  // Helper to parse answer payload
  const parseAnswer = (ans?: string) => {
    if (!ans) return { text: '' };
    try {
      return JSON.parse(ans);
    } catch {
      return { text: ans || '' }; // Fallback for old plain text
    }
  };

  // Sync down if question ID changes
  useEffect(() => {
    const val = parseAnswer(answers[question.id]);
    setText(val.text || '');
    setSaveState('IDLE');
  }, [question.id, answers]);

  // Sync to global state with debounce
  useEffect(() => {
    const t = setTimeout(() => {
      const currentGlobal = parseAnswer(answers[question.id]);
      
      if (text !== currentGlobal.text) {
        setSaveState('SAVING');
        
        const trimmed = text.trim();
        if (trimmed.length > 0) {
          setAnswer(question.id, JSON.stringify({ text }));
        } else {
          // If empty, remove from state so it marks as UNANSWERED
          setAnswer(question.id, '');
        }

        setTimeout(() => setSaveState('SAVED'), 400);
      }
    }, 400);

    return () => clearTimeout(t);
  }, [text, question.id, setAnswer, answers]);

  return (
    <div className="h-full flex flex-col p-6 lg:p-10 overflow-y-auto custom-scrollbar font-sans bg-[#F8FAFC]">
      <div className="max-w-4xl w-full mx-auto flex flex-col gap-6 h-full">
        
        {/* Top: Premium Reading Card */}
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white border border-slate-200 shadow-sm rounded-2xl overflow-hidden"
        >
          <div className="bg-slate-50 border-b border-slate-200 px-6 py-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-2.5 h-2.5 rounded-full bg-slate-300" />
              <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                SCENARIO
              </div>
            </div>
          </div>
          <div className="p-8">
            <div className="text-[15px] leading-relaxed text-slate-800 whitespace-pre-wrap font-medium">
              {question.passage}
            </div>
          </div>
        </motion.div>

        {/* Bottom: Question & Textarea */}
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="flex-1 flex flex-col bg-white border border-slate-200 shadow-sm rounded-2xl p-8"
        >
          <div className="mb-6 flex flex-col gap-4">
            <div className="flex items-center gap-3">
               <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest bg-slate-100/80 px-2.5 py-1 rounded-full">
                 MISSION {String(question.id).padStart(2, '0')}
               </span>
               <span className="text-[10px] font-bold text-[#2563EB] uppercase tracking-widest bg-[#EFF6FF] px-2.5 py-1 rounded-full">
                 ✎ WRITTEN RESPONSE
               </span>
            </div>
            <div>
              <h2 className="text-xl font-semibold text-slate-800 tracking-tight">
                {question.question}
              </h2>
            </div>
          </div>
          
          <div className="flex-1 flex flex-col relative group">
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Type your professional response here..."
              maxLength={maxCharacters}
              className="flex-1 w-full p-6 pb-12 bg-white border border-slate-300 rounded-xl focus:outline-none focus:border-[#2563EB] focus:ring-4 focus:ring-[#EFF6FF] text-[15px] leading-relaxed text-slate-800 resize-none font-sans transition-all shadow-inner"
            />
            
            {/* Footer inside textarea (Counters & Save State) */}
            <div className="absolute bottom-4 left-6 right-6 flex items-center justify-between pointer-events-none">
              
              {/* Save State Indicator */}
              <div className="flex items-center">
                <AnimatePresence mode="wait">
                  {saveState === 'SAVING' && (
                    <motion.div 
                      key="saving"
                      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                      className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-slate-400"
                    >
                      <Loader2 size={12} className="animate-spin" /> Saving...
                    </motion.div>
                  )}
                  {saveState === 'SAVED' && (
                    <motion.div 
                      key="saved"
                      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                      className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-emerald-600"
                    >
                      <Check size={12} className="stroke-[3]" /> Saved
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Character Count */}
              <div className="flex items-center gap-2">
                <span className={`text-[11px] font-bold uppercase tracking-widest ${charCount > maxCharacters * 0.9 ? 'text-amber-500' : 'text-slate-400'}`}>
                  {charCount} / {maxCharacters}
                </span>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
