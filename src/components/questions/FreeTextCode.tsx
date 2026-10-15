'use client';
import { useAssessmentState } from '@/hooks/useAssessmentState';
import ImageReference from './ImageReference';
import Editor from '@monaco-editor/react';
import { Loader2 } from 'lucide-react';

export default function FreeTextCode({ question }: { question: any }) {
  const { setAnswer, answers } = useAssessmentState();
  const currentAnswer = answers[question.id] || '';

  const handleEditorChange = (value: string | undefined) => {
    if (value !== undefined) {
      setAnswer(question.id, value);
    }
  };

  return (
    <div className="flex flex-col w-full h-full pb-8">
      <ImageReference assets={question.assets} />
      
      <div className="flex-1 flex flex-col min-h-[300px]">
        <div className="bg-slate-900 px-4 py-2 border border-white/10 rounded-t-xl flex justify-between items-center border-b-0">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-widest">Your Solution Workspace</span>
          <span className="text-xs font-mono text-slate-500 bg-slate-950 px-2 py-1 rounded">Bash / Plain Text</span>
        </div>
        <div className="flex-1 border border-white/10 rounded-b-xl overflow-hidden shadow-inner relative group">
          <Editor
            height="100%"
            defaultLanguage="shell"
            theme="vs-dark"
            value={currentAnswer}
            onChange={handleEditorChange}
            loading={
              <div className="flex items-center justify-center h-full bg-[#1e1e1e] text-slate-400">
                <Loader2 className="animate-spin mr-2" size={20} /> Loading Editor...
              </div>
            }
            options={{
              minimap: { enabled: false },
              fontSize: 14,
              fontFamily: 'JetBrains Mono, monospace',
              lineHeight: 24,
              padding: { top: 20 },
              scrollBeyondLastLine: false,
              wordWrap: 'on',
              renderLineHighlight: 'none',
              hideCursorInOverviewRuler: true,
              overviewRulerBorder: false,
            }}
          />
        </div>
      </div>
    </div>
  );
}
