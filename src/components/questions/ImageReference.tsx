'use client';
import { ImageIcon } from 'lucide-react';

export default function ImageReference({ assets }: { assets: any }) {
  if (!assets) return null;

  return (
    <div className="mb-8 w-full flex flex-col gap-4">
      {assets.codeSnippet && (
        <div className="bg-[#0d1117] border border-white/10 rounded-xl overflow-hidden shadow-2xl">
          <div className="bg-white/5 px-4 py-2 border-b border-white/5 flex items-center justify-between">
            <span className="text-xs font-mono text-slate-400">Code Snippet</span>
            <div className="flex gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full bg-red-500/20 border border-red-500/50"></div>
              <div className="w-2.5 h-2.5 rounded-full bg-amber-500/20 border border-amber-500/50"></div>
              <div className="w-2.5 h-2.5 rounded-full bg-green-500/20 border border-green-500/50"></div>
            </div>
          </div>
          <div className="p-5 overflow-x-auto">
            <pre className="font-mono text-sm text-slate-300 leading-relaxed">
              <code>{assets.codeSnippet}</code>
            </pre>
          </div>
        </div>
      )}

      {assets.imageDescription && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 flex items-start gap-4">
          <div className="p-3 bg-slate-950 rounded-lg shrink-0">
            <ImageIcon className="text-slate-500" size={24} />
          </div>
          <div>
            <h4 className="text-sm font-semibold text-slate-300 mb-1">Visual Reference Required</h4>
            <p className="text-sm text-slate-500 italic border-l-2 border-slate-700 pl-3 mt-2">
              {assets.imageDescription}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
