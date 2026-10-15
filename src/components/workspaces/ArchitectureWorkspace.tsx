'use client';
import { useAssessmentState } from '@/hooks/useAssessmentState';
import { motion } from 'framer-motion';
import { Check } from 'lucide-react';

export default function ArchitectureWorkspace({ question }: { question: any }) {
  const { setAnswer, answers } = useAssessmentState();
  const currentAnswer = answers[question.id] || '';
  
  const labels = ['A', 'B', 'C', 'D', 'E'];

  return (
    <div className="h-full flex flex-col p-6 lg:p-10 overflow-y-auto custom-scrollbar font-sans bg-transparent">
      <div className="max-w-4xl w-full mx-auto flex flex-col h-full">
        
        {/* Mission Context Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest bg-slate-100 px-2 py-0.5 rounded">MISSION {String(question.id).padStart(2, '0')}</span>
            <span className="text-[10px] font-bold text-[#DC2626] uppercase tracking-widest bg-[#FEF2F2] px-2 py-0.5 rounded">SYSTEM DESIGN</span>
          </div>
          <h2 className="text-[17px] md:text-lg font-semibold text-slate-900 leading-snug">{question.question}</h2>
          
          {question.assets?.imageDescription && (
            <div className="mt-6 p-6 bg-white border border-slate-200 rounded-lg shadow-sm">
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">ARCHITECTURE CONSTRAINTS</div>
              <p className="text-[13px] font-mono text-slate-700 leading-relaxed whitespace-pre-wrap">{question.assets.imageDescription}</p>
            </div>
          )}
        </div>

        <div className="flex-1 pb-6">
          <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3">
            <span>ENGINEERING DECISION</span>
          </div>
          
          <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
            {question.options?.map((opt: string, i: number) => {
              const isSelected = currentAnswer === opt;
              const splitIdx = opt.indexOf(' - ');
              const title = splitIdx > -1 ? opt.substring(0, splitIdx) : opt;
              const desc = splitIdx > -1 ? opt.substring(splitIdx + 3) : null;

              return (
                <button
                  key={i}
                  onClick={() => setAnswer(question.id, opt)}
                  className={`w-full text-left p-5 rounded-lg border transition-all flex flex-col gap-3 group relative overflow-hidden focus:outline-none focus:ring-2 focus:ring-[#DC2626]/20 ${
                    isSelected 
                      ? 'bg-[#FEF2F2] border-[#DC2626] shadow-sm' 
                      : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50 shadow-sm'
                  }`}
                >
                  <div className="flex items-start gap-3 w-full">
                    <div className={`shrink-0 w-6 h-6 rounded flex items-center justify-center font-mono text-[11px] font-bold transition-colors ${
                      isSelected ? 'border-[#DC2626] bg-[#DC2626] text-white' : 'border border-slate-200 text-slate-500 bg-white group-hover:border-slate-300'
                    }`}>
                      {isSelected ? <Check size={12} className="stroke-[3]" /> : labels[i]}
                    </div>
                    
                    <div className={`font-semibold text-[14px] leading-snug ${isSelected ? 'text-[#991B1B]' : 'text-slate-800'}`}>
                      {title}
                    </div>
                  </div>

                  {desc && (
                    <div className={`text-[13px] leading-relaxed pl-9 ${isSelected ? 'text-[#991B1B]/80' : 'text-slate-500'}`}>
                      {desc}
                    </div>
                  )}

                  {isSelected && (
                    <motion.div 
                      layoutId="arch-selection"
                      className="absolute left-0 top-0 bottom-0 w-1 bg-[#DC2626]"
                    />
                  )}
                </button>
              );
            })}
          </div>
        </div>

      </div>
    </div>
  );
}
