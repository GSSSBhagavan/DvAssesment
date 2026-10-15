'use client';
import { useAssessmentState } from '@/hooks/useAssessmentState';
import ImageReference from './ImageReference';
import { useEffect, useState } from 'react';

export default function MultipleChoice({ question }: { question: any }) {
  const { setAnswer, answers } = useAssessmentState();
  const selected = answers[question.id];
  
  // Keyboard navigation support
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // 1-4 mapped to index 0-3
      if (['1', '2', '3', '4'].includes(e.key)) {
        const index = parseInt(e.key) - 1;
        if (question.options[index]) {
          const letter = String.fromCharCode(65 + index);
          setAnswer(question.id, letter);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [question.id, question.options, setAnswer]);

  return (
    <div className="w-full">
      <ImageReference assets={question.assets} />
      
      <div className="flex flex-col gap-3">
        {question.options.map((option: string, idx: number) => {
          const letter = String.fromCharCode(65 + idx);
          const isSelected = selected === letter || selected === option;
          return (
            <button
              key={idx}
              onClick={() => setAnswer(question.id, letter)}
              className={`w-full text-left p-4 rounded-xl border transition-all duration-200 flex items-center group ${
                isSelected
                  ? 'bg-sky-500/10 border-sky-500/50 shadow-[0_0_20px_rgba(14,165,233,0.1)]'
                  : 'bg-slate-900 border-white/5 hover:border-white/15 hover:bg-slate-800'
              }`}
            >
              <div className={`w-8 h-8 rounded shrink-0 flex items-center justify-center font-mono text-sm font-bold mr-4 border transition-colors ${
                isSelected 
                  ? 'bg-sky-500 text-white border-sky-400' 
                  : 'bg-slate-950 text-slate-500 border-white/10 group-hover:bg-slate-900'
              }`}>
                {idx + 1}
              </div>
              <span className={`font-medium leading-relaxed ${isSelected ? 'text-sky-100' : 'text-slate-300'}`}>
                {option}
              </span>
            </button>
          );
        })}
      </div>
      <div className="mt-6 flex items-center gap-2 text-xs text-slate-500">
        <kbd className="px-2 py-1 bg-slate-900 border border-slate-800 rounded font-mono">1</kbd>
        <span>to</span>
        <kbd className="px-2 py-1 bg-slate-900 border border-slate-800 rounded font-mono">{question.options.length}</kbd>
        <span>to select</span>
      </div>
    </div>
  );
}
