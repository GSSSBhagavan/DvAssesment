'use client';
import { useAssessmentState } from '@/hooks/useAssessmentState';
import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';

export default function ImageMCQWorkspace({ question }: { question: any }) {
  const { setAnswer, answers } = useAssessmentState();
  const [selected, setSelected] = useState<string | null>(answers[question.id] || null);

  // Sync to global state
  useEffect(() => {
    setSelected(answers[question.id] || null);
  }, [question.id, answers]);

  const handleSelect = (option: string) => {
    // Determine the letter
    const optionLetter = String.fromCharCode(65 + question.options.indexOf(option));
    setSelected(optionLetter);
    setAnswer(question.id, optionLetter);
  };

  return (
    <div className="h-full flex flex-col p-6 lg:p-10 overflow-y-auto custom-scrollbar font-sans bg-[#F8FAFC]">
      <div className="max-w-5xl w-full mx-auto flex flex-col h-full relative">
        
        {/* Header */}
        <div className="mb-6 flex flex-col gap-4">
          <div className="flex items-center gap-3">
             <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest bg-slate-100/80 px-2.5 py-1 rounded-full">
               QUESTION {String(question.id).padStart(2, '0')}
             </span>
             <span className="text-[10px] font-bold text-amber-600 uppercase tracking-widest bg-amber-50 px-2.5 py-1 rounded-full">
               MULTIPLE CHOICE
             </span>
          </div>
          <div>
            <h2 className="text-xl font-semibold text-slate-800 tracking-tight">
              {question.question}
            </h2>
            {question.passage && (
              <p className="mt-2 text-[14px] text-slate-600 font-medium">
                {question.passage}
              </p>
            )}
          </div>
        </div>
        
        <div className="flex flex-col lg:flex-row gap-8 flex-1">
          {/* Left: Image Viewer */}
          {question.image && (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex-1 bg-white border border-slate-200 shadow-sm rounded-2xl overflow-hidden flex items-center justify-center p-6 lg:p-10"
            >
              <img 
                src={question.image} 
                alt="Scenario context" 
                className="max-w-full max-h-full object-contain rounded-lg border border-slate-100 shadow-sm"
              />
            </motion.div>
          )}

          {/* Right: Options */}
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className={`flex flex-col gap-3 ${question.image ? 'w-full lg:w-[400px]' : 'w-full'}`}
          >
            <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 pl-1">
              Select the correct response
            </h3>
            
            <div className="flex flex-col gap-3">
              {question.options?.map((opt: string, idx: number) => {
                const letter = String.fromCharCode(65 + idx);
                const isSelected = selected === letter || selected === opt;
                
                return (
                  <button
                    key={idx}
                    onClick={() => handleSelect(opt)}
                    className={`w-full p-4 rounded-xl border text-left transition-all flex items-center gap-4 group ${
                      isSelected 
                        ? 'border-amber-500 bg-amber-50/50 shadow-[0_4px_12px_rgba(245,158,11,0.08)]' 
                        : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 text-[13px] font-bold transition-colors ${
                      isSelected 
                        ? 'bg-amber-500 text-white shadow-sm' 
                        : 'bg-slate-100 text-slate-500 group-hover:bg-slate-200'
                    }`}>
                      {letter}
                    </div>
                    <span className={`text-[14px] leading-snug font-medium ${isSelected ? 'text-amber-900' : 'text-slate-700'}`}>
                      {opt}
                    </span>
                  </button>
                );
              })}
            </div>
          </motion.div>
        </div>

      </div>
    </div>
  );
}
