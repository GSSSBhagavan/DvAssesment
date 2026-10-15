const fs = require('fs');

const file = 'src/components/assessment/AssessmentHeader.tsx';

let newContent = `'use client';
import { useAssessmentState } from '@/hooks/useAssessmentState';
import { Clock } from 'lucide-react';
import assessmentData from '@/lib/assessment-data.json';
import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';

export default function AssessmentHeader() {
  const { currentIndex, answers, endTime, expireAssessment, status } = useAssessmentState();
  const [timeLeft, setTimeLeft] = useState<number>(0);

  const total = assessmentData.length;
  const answered = Object.keys(answers).length;
  const progress = Math.round((answered / total) * 100);

  useEffect(() => {
    if (!endTime) return;
    const tick = () => {
      const remaining = Math.max(0, endTime - Date.now());
      setTimeLeft(remaining);
      if (remaining === 0 && status === 'IN_PROGRESS') {
        expireAssessment();
      }
    };
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [endTime, status, expireAssessment]);

  const h = Math.floor(timeLeft / 3600000);
  const m = Math.floor((timeLeft % 3600000) / 60000);
  const s = Math.floor((timeLeft % 60000) / 1000);

  let timerClass = 'text-slate-600';
  let pulseClass = '';
  if (h === 0 && m < 5) {
    timerClass = 'text-[#DC2626] font-bold';
    pulseClass = 'animate-pulse';
  } else if (h === 0 && m < 15) {
    timerClass = 'text-amber-600 font-medium';
  }

  return (
    <div className="flex flex-col z-50 shrink-0">
      <header className="h-[48px] bg-white flex items-center justify-between px-6 font-sans relative border-b border-slate-200">
        
        {/* Left Side: Brand */}
        <div className="flex items-center gap-3">
          <span className="text-[12px] font-bold text-slate-800 tracking-wider">DV</span>
          <span className="text-[12px] text-slate-400">|</span>
          <span className="text-[11px] font-medium text-slate-500 tracking-wider uppercase">Engineering Assessment</span>
        </div>

        {/* Center: Progress (Desktop) */}
        {status !== 'REVIEW' && (
          <div className="hidden lg:flex items-center gap-4 absolute left-1/2 -translate-x-1/2 w-48">
            <span className="text-[11px] font-mono font-medium text-slate-700">{String(currentIndex + 1).padStart(2, '0')} / {String(total).padStart(2, '0')}</span>
            <div className="flex-1 h-[2px] bg-slate-100 overflow-hidden">
              <motion.div 
                initial={false}
                animate={{ width: \`\${((currentIndex + 1) / total) * 100}%\` }}
                className="h-full bg-slate-400"
              />
            </div>
          </div>
        )}

        {/* Right Side: Status/Timer */}
        <div className="flex items-center gap-6">
          <div className={\`flex items-center gap-1.5 text-[12px] font-mono tracking-tight \${timerClass} \${pulseClass}\`}>
            {String(h).padStart(2, '0')}:{String(m).padStart(2, '0')}:{String(s).padStart(2, '0')}
          </div>
          
          <button 
            onClick={() => useAssessmentState.getState().setShowSubmitModal(true)}
            className="hidden sm:flex text-[11px] font-bold uppercase tracking-wider text-slate-500 hover:text-slate-900 transition-colors"
          >
            Submit
          </button>
        </div>
      </header>
      
      {/* Global Progress Bar Line */}
      <div className="h-[2px] w-full bg-transparent">
        <motion.div 
          initial={false}
          animate={{ width: \`\${progress}%\` }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="h-full bg-[#DC2626]/20"
        />
      </div>
    </div>
  );
}
`;

fs.writeFileSync(file, newContent);
console.log('Fixed AssessmentHeader');
