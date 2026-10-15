'use client';
import { useAssessmentState } from '@/hooks/useAssessmentState';
import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Check } from 'lucide-react';

export default function EmailComposeWorkspace({ question }: { question: any }) {
  const { setAnswer, answers } = useAssessmentState();

  const parseAnswer = (val: string | undefined) => {
    if (!val) return { subject: '', body: '' };
    try {
      return JSON.parse(val);
    } catch {
      return { subject: '', body: '' };
    }
  };

  const initialVal = parseAnswer(answers[question.id]);
  const [subject, setSubject] = useState(initialVal.subject);
  const [body, setBody] = useState(initialVal.body);
  const [saveState, setSaveState] = useState<'IDLE' | 'SAVING' | 'SAVED'>('IDLE');

  const toField = question.responseConfig?.to || 'Recipient';
  const wordCount = body.trim() ? body.trim().split(/\s+/).length : 0;
  const charCount = subject.length;

  // Real-time local state to global state debounce
  useEffect(() => {
    const currentGlobal = parseAnswer(answers[question.id]);
    
    if (subject !== currentGlobal.subject || body !== currentGlobal.body) {
      setSaveState('SAVING');
      
      const hasContent = subject.trim().length > 0 && body.trim().length > 0;
      
      if (hasContent) {
        setAnswer(question.id, JSON.stringify({ subject, body }));
      } else if (!subject.trim() && !body.trim()) {
        setAnswer(question.id, '');
      } else {
        setAnswer(question.id, JSON.stringify({ subject, body }));
      }

      const t = setTimeout(() => {
        setSaveState('SAVED');
      }, 400);

      return () => clearTimeout(t);
    }
  }, [subject, body, question.id, setAnswer, answers]);

  // Sync down if question ID changes
  useEffect(() => {
    const val = parseAnswer(answers[question.id]);
    setSubject(val.subject);
    setBody(val.body);
    setSaveState('IDLE');
  }, [question.id, answers]);

  return (
    <div className="h-full flex flex-col p-6 lg:p-10 overflow-y-auto custom-scrollbar font-sans bg-[#F8FAFC]">
      <div className="max-w-4xl w-full mx-auto flex flex-col gap-6 h-full relative">
        
        {/* Scenario Header */}
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white border border-slate-200 shadow-sm rounded-2xl overflow-hidden shrink-0"
        >
          <div className="bg-slate-50 border-b border-slate-200 px-6 py-3 flex items-center gap-3">
            <div className="w-2.5 h-2.5 rounded-full bg-[#2563EB]" />
            <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
              WORKPLACE SCENARIO
            </div>
            <span className="ml-auto text-[10px] font-bold text-slate-400 uppercase tracking-widest bg-slate-200/50 px-2.5 py-1 rounded-full">
              MISSION {String(question.id).padStart(2, '0')}
            </span>
          </div>
          <div className="p-8">
            <div className="text-[15px] leading-relaxed text-slate-800 whitespace-pre-wrap font-medium">
              {question.question}
            </div>
          </div>
        </motion.div>

        {/* Email Composer */}
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="flex-1 flex flex-col bg-white border border-slate-200 shadow-xl shadow-slate-200/40 rounded-2xl overflow-hidden min-h-[400px]"
        >
          {/* Composer Header */}
          <div className="bg-[#0F172A] px-6 py-4 flex items-center justify-between">
            <div className="text-[12px] font-bold text-white uppercase tracking-widest">
              NEW MESSAGE
            </div>
          </div>
          
          <div className="flex flex-col flex-1">
            {/* To Field */}
            <div className="flex items-center px-6 py-4 border-b border-slate-100">
              <span className="w-16 text-[13px] font-bold text-slate-400">To:</span>
              <div className="flex items-center gap-2">
                <div className="px-3 py-1 bg-slate-100 text-slate-700 text-[13px] rounded-md border border-slate-200">
                  {toField}
                </div>
              </div>
            </div>

            {/* Subject Field */}
            <div className="flex items-center px-6 py-4 border-b border-slate-100 relative group">
              <span className="w-16 text-[13px] font-bold text-slate-400">Subject:</span>
              <input
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Write your subject..."
                className="flex-1 bg-transparent border-none focus:outline-none text-[15px] font-semibold text-slate-900 placeholder:text-slate-300 placeholder:font-normal"
                maxLength={150}
              />
              <div className="absolute right-6 opacity-0 group-focus-within:opacity-100 transition-opacity">
                <span className={`text-[11px] font-bold uppercase tracking-widest ${charCount > 130 ? 'text-amber-500' : 'text-slate-300'}`}>
                  {charCount} / 150
                </span>
              </div>
            </div>

            {/* Body Field */}
            <div className="flex-1 relative flex flex-col">
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="Write your email..."
                className="flex-1 w-full p-6 bg-transparent border-none focus:outline-none text-[15px] leading-relaxed text-slate-800 resize-none font-sans placeholder:text-slate-300"
              />
            </div>
            
            {/* Composer Footer */}
            <div className="bg-slate-50 border-t border-slate-200 px-6 py-4 flex items-center justify-between mt-auto">
              <div className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">
                {wordCount} words
              </div>
              <div className="flex items-center gap-2">
                {saveState === 'SAVING' && (
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest animate-pulse">
                    SAVING...
                  </span>
                )}
                {saveState === 'SAVED' && (
                  <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-600 uppercase tracking-widest bg-emerald-50 px-2 py-1 rounded">
                    <Check size={12} strokeWidth={3} /> SAVED
                  </span>
                )}
              </div>
            </div>

          </div>
        </motion.div>
        
      </div>
    </div>
  );
}
