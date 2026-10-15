'use client';
import { useAssessmentState } from '@/hooks/useAssessmentState';
import Editor from '@monaco-editor/react';
import { Loader2, Check } from 'lucide-react';
import { motion } from 'framer-motion';

export default function CodeWorkspace({ question, questionNumber }: { question: any; questionNumber?: number }) {
  const { setAnswer, answers, currentIndex } = useAssessmentState();
  const displayNum = questionNumber ?? (currentIndex + 1);
  const currentAnswer = answers[question.id] || '';
  
  const labels = ['A', 'B', 'C', 'D', 'E'];

  let lang = 'python';
  if (question.assets?.codeSnippet?.includes('public class')) lang = 'java';
  if (question.assets?.codeSnippet?.includes('function') || question.assets?.codeSnippet?.includes('const ')) lang = 'javascript';

  return (
    <div className="h-full flex flex-col bg-white font-sans border border-slate-200 rounded-lg overflow-hidden m-4 lg:m-6 shadow-sm">
      <div className="flex h-full">
        
        {/* Left: Code Editor */}
        <div className="w-1/2 border-r border-slate-200 flex flex-col h-full bg-[#FAFAFA]">
          <div className="h-10 border-b border-slate-200 bg-white flex items-center px-4 shrink-0 justify-between">
            <span className="text-[10px] font-mono font-bold text-slate-500 uppercase tracking-widest bg-white px-3 py-1 -mb-[9px] border-t border-x border-slate-200 rounded-t text-slate-700">
              {lang.toUpperCase()}
            </span>
            <div className="flex gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full bg-slate-200"></div>
              <div className="w-2.5 h-2.5 rounded-full bg-slate-200"></div>
              <div className="w-2.5 h-2.5 rounded-full bg-slate-200"></div>
            </div>
          </div>
          <div className="flex-1 relative">
            <Editor
              height="100%"
              language={lang}
              theme="light"
              value={question.assets?.codeSnippet || '// No code provided'}
              options={{
                readOnly: true,
                minimap: { enabled: false },
                fontSize: 13,
                fontFamily: 'JetBrains Mono, monospace',
                padding: { top: 16, bottom: 16 },
                scrollBeyondLastLine: false,
                renderLineHighlight: 'none',
              }}
              loading={<div className="flex justify-center mt-10"><Loader2 className="animate-spin text-slate-400" /></div>}
            />
          </div>
        </div>

        {/* Right: Task & Output/Answer */}
        <div className="w-1/2 flex flex-col h-full bg-white overflow-y-auto custom-scrollbar">
          <div className="p-6 lg:p-8 flex-1 flex flex-col">
            
            <div className="mb-6">
              <div className="flex items-center gap-3 mb-2">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest bg-slate-100 px-2 py-0.5 rounded">QUESTION {String(displayNum).padStart(2, '0')}</span>
                <span className="text-[10px] font-bold text-[#DC2626] uppercase tracking-widest bg-[#FEF2F2] px-2 py-0.5 rounded">CODE ANALYSIS</span>
              </div>
              <h2 className="text-[16px] font-semibold text-slate-900 leading-snug">{question.question}</h2>
            </div>

            <div className="flex-1 flex flex-col pb-4">
              <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3">
                {question.type === 'FREE_TEXT' ? 'DEVELOPER RESPONSE' : 'SELECT THE CORRECT OUTPUT / FINDING'}
              </div>
              
              {question.type === 'FREE_TEXT' ? (
                <div className="bg-[#FAFAFA] border border-slate-200 rounded-lg p-1 flex-1 focus-within:ring-2 focus-within:ring-slate-300 transition-all min-h-[200px]">
                  <Editor
                    height="100%"
                    language="shell"
                    theme="light"
                    value={currentAnswer}
                    onChange={(val) => setAnswer(question.id, val || '')}
                    options={{
                      minimap: { enabled: false },
                      fontSize: 13,
                      fontFamily: 'JetBrains Mono, monospace',
                      padding: { top: 12 },
                      scrollBeyondLastLine: false,
                      lineNumbers: 'off',
                      renderLineHighlight: 'none',
                    }}
                  />
                </div>
              ) : (
                <div className="space-y-3">
                  {question.options?.map((opt: string, i: number) => {
                    const isSelected = currentAnswer === opt;
                    return (
                      <button
                        key={i}
                        onClick={() => setAnswer(question.id, opt)}
                        className={`w-full text-left px-4 py-3 rounded-lg font-mono text-[13px] transition-all flex items-center gap-3 relative overflow-hidden border focus:outline-none focus:ring-2 focus:ring-[#DC2626]/20 ${
                          isSelected 
                            ? 'bg-[#FEF2F2] border-[#DC2626] text-[#991B1B] shadow-sm' 
                            : 'bg-white border-slate-200 text-slate-700 hover:border-slate-300 hover:bg-slate-50 shadow-sm'
                        }`}
                      >
                        <div className={`shrink-0 w-6 h-6 rounded flex items-center justify-center font-sans text-[11px] font-bold transition-colors ${
                          isSelected ? 'border-[#DC2626] bg-[#DC2626] text-white' : 'border border-slate-200 text-slate-500 bg-white'
                        }`}>
                          {isSelected ? <Check size={12} className="stroke-[3]" /> : labels[i]}
                        </div>
                        <span className="flex-1 leading-snug">{opt}</span>
                        {isSelected && (
                          <motion.div 
                            layoutId="code-selection"
                            className="absolute left-0 top-0 bottom-0 w-1 bg-[#DC2626]"
                          />
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
