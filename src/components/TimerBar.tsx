'use client';
import { useEffect, useState } from 'react';
import { Clock } from 'lucide-react';

export default function TimerBar({ 
  totalTimeInSeconds, 
  onTimeUp 
}: { 
  totalTimeInSeconds: number, 
  onTimeUp: () => void 
}) {
  const [timeLeft, setTimeLeft] = useState(totalTimeInSeconds);

  useEffect(() => {
    if (timeLeft <= 0) {
      onTimeUp();
      return;
    }
    const timer = setInterval(() => setTimeLeft((prev) => prev - 1), 1000);
    return () => clearInterval(timer);
  }, [timeLeft, onTimeUp]);

  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;
  const isLow = timeLeft < 300; // Less than 5 mins

  return (
    <div className={`flex items-center gap-2 font-mono font-medium text-lg ${isLow ? 'text-red-600 animate-pulse' : 'text-slate-700'}`}>
      <Clock size={20} className={isLow ? 'text-red-500' : 'text-slate-400'} />
      {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
    </div>
  );
}
