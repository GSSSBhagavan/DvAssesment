'use client';
import { useAssessmentState } from '@/hooks/useAssessmentState';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, ZoomIn, X } from 'lucide-react';
import Image from 'next/image';
import { useState, useEffect, useMemo } from 'react';
import { getOrderedQuestions } from '@/lib/safe-questions';

export default function EmailWorkspace({ question, questionNumber }: { question: any; questionNumber?: number }) {
  const { setAnswer, answers, currentIndex: globalIndex, questionOrder } = useAssessmentState();
  const selected = answers[question.id];
  const [isFullscreen, setIsFullscreen] = useState(false);

  const displayNum = questionNumber ?? (globalIndex + 1);

  const questions = useMemo(() => getOrderedQuestions(questionOrder), [questionOrder]);

  // Find next image for preloading
  const nextImageToPreload = useMemo(() => {
    const currentIndex = questions.findIndex(q => q.id === question.id);
    if (currentIndex !== -1 && currentIndex + 1 < questions.length) {
      const nextQ = questions[currentIndex + 1];
      if (nextQ.assets?.imageAsset) {
        return nextQ.assets.imageAsset;
      }
    }
    return null;
  }, [question.id, questions]);

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsFullscreen(false);
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, []);

  // Keyboard shortcuts for A, B, C, D (1, 2, 3, 4)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (question.type !== 'MULTIPLE_CHOICE') return;
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      
      const keyMap: Record<string, number> = {
        'a': 0, '1': 0,
        'b': 1, '2': 1,
        'c': 2, '3': 2,
        'd': 3, '4': 3,
        'e': 4, '5': 4
      };
      
      const idx = keyMap[e.key.toLowerCase()];
      const labels = ['A', 'B', 'C', 'D', 'E'];
      if (idx !== undefined && question.options && idx < question.options.length) {
        setAnswer(question.id, labels[idx]);
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [question, setAnswer]);

  const labels = ['A', 'B', 'C', 'D', 'E'];
  const hasImage = !!question.assets?.imageAsset;

  // Determine option layout automatically
  const useGrid = useMemo(() => {
    if (question.type !== 'MULTIPLE_CHOICE' || !question.options) return false;
    const avgLen = question.options.reduce((acc: number, val: string) => acc + val.length, 0) / question.options.length;
    return avgLen < 80;
  }, [question]);

  return (
    <div className="h-full flex flex-col p-4 lg:p-6 lg:px-10 overflow-y-auto custom-scrollbar font-sans bg-white relative">
      <div className="max-w-5xl w-full mx-auto flex flex-col h-full gap-4 lg:gap-5">
        
        {/* Header and Question combined to save space */}
        <div className="flex flex-col gap-2 shrink-0">
          <div className="flex items-center gap-3">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest bg-slate-100 px-2 py-0.5 rounded">QUESTION {String(displayNum).padStart(2, '0')}</span>
            <span className="text-[10px] font-bold text-[#DC2626] uppercase tracking-widest bg-[#FEF2F2] px-2 py-0.5 rounded">~1 MIN</span>
          </div>
          <h2 className="text-[17px] md:text-lg font-semibold text-slate-900 leading-snug">{question.question}</h2>
        </div>

        {/* Evidence Viewer */}
        <div className="shrink-0 flex flex-col">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-1.5 h-1.5 rounded-full bg-[#DC2626]"></div>
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">SCENARIO EVIDENCE</span>
            <span className="text-[10px] font-medium text-slate-400 px-2 border-l border-slate-200 uppercase tracking-widest">Professional Context</span>
          </div>

          {hasImage ? (
            <button 
              onClick={() => setIsFullscreen(true)}
              className="w-full group rounded-lg overflow-hidden border border-slate-200 shadow-sm transition-shadow hover:shadow-md bg-[#F8FAFC] relative flex items-center justify-center email-evidence-container focus:outline-none focus:ring-2 focus:ring-slate-300"
              style={{ height: 'clamp(240px, 40vh, 380px)' }}
            >
              <div className="w-full h-full relative p-2">
                <Image 
                  src={question.assets.imageAsset} 
                  alt={question.assets.imageDescription || 'Scenario evidence'} 
                  fill 
                  className="object-contain"
                  sizes="(max-width: 1024px) 100vw, 1024px"
                  priority
                />
              </div>
              <div className="absolute inset-0 bg-slate-900/0 group-hover:bg-slate-900/5 transition-colors flex items-center justify-center pointer-events-none">
                <div className="opacity-0 group-hover:opacity-100 bg-white/95 backdrop-blur-sm text-slate-700 text-[11px] font-bold uppercase tracking-wider px-4 py-2 rounded-full shadow-lg flex items-center gap-2 transform translate-y-2 group-hover:translate-y-0 transition-all border border-slate-200">
                  <ZoomIn size={14} className="text-[#DC2626]" /> VIEW FULLSCREEN
                </div>
              </div>
            </button>
          ) : (
            <div className="bg-white rounded-lg overflow-hidden border border-slate-200 shadow-sm transition-shadow hover:shadow-md">
              <div className="p-4 text-sm leading-relaxed text-slate-700 whitespace-pre-wrap max-h-[30vh] overflow-y-auto">
                {question.assets?.imageDescription || "Missing scenario context."}
              </div>
            </div>
          )}
        </div>

        {/* Response Area */}
        <div className="flex-1 flex flex-col shrink-0">
          <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2 flex justify-between">
            <span>
              SELECT THE MOST PROFESSIONAL RESPONSE
            </span>
          </div>
          
          <div className="pb-4">
            <div className={`grid gap-3 ${useGrid ? 'grid-cols-1 md:grid-cols-2' : 'grid-cols-1'}`}>
              {question.options?.map((opt: string, i: number) => {
                const isSelected = selected === labels[i] || selected === opt;
                return (
                  <button
                    key={i}
                    onClick={() => setAnswer(question.id, labels[i])}
                    className={`w-full text-left px-4 py-3 min-h-[52px] rounded-lg border transition-all flex items-center gap-3 relative overflow-hidden focus:outline-none focus:ring-2 focus:ring-[#DC2626]/20 ${
                      isSelected 
                        ? 'bg-[#FEF2F2] border-[#DC2626] shadow-sm' 
                        : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50 shadow-sm'
                    }`}
                  >
                    <div className={`w-6 h-6 shrink-0 rounded flex items-center justify-center font-mono text-[11px] font-bold transition-colors ${
                      isSelected ? 'bg-[#DC2626] text-white border border-[#DC2626]' : 'bg-white border border-slate-200 text-slate-500'
                    }`}>
                      {labels[i]}
                    </div>
                    
                    <span className={`text-[13px] leading-snug font-medium ${isSelected ? 'text-[#991B1B]' : 'text-slate-700'}`}>{opt}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

      </div>

      {/* Fullscreen Overlay */}
      <AnimatePresence>
        {isFullscreen && hasImage && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-[#0F172A]/90 backdrop-blur-sm flex items-center justify-center p-4 md:p-8"
            onClick={() => setIsFullscreen(false)}
          >
            <button 
              onClick={() => setIsFullscreen(false)}
              className="absolute top-4 right-4 text-white/70 hover:text-white bg-white/10 hover:bg-white/20 p-2 rounded-full transition-colors z-10"
            >
              <X size={24} />
            </button>
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              transition={{ type: "spring", bounce: 0, duration: 0.3 }}
              className="relative w-full h-full max-w-[90vw] max-h-[90vh] rounded-xl overflow-hidden shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <Image 
                src={question.assets.imageAsset} 
                alt={question.assets.imageDescription || 'Scenario evidence fullscreen'} 
                fill 
                className="object-contain"
                sizes="100vw"
                quality={100}
                priority
              />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Preload next image silently */}
      {nextImageToPreload && (
        <div className="hidden">
          <Image src={nextImageToPreload} alt="preload" width={100} height={100} priority />
        </div>
      )}
    </div>
  );
}
