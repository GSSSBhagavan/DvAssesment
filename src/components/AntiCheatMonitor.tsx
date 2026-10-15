'use client';
import { useEffect, useState } from 'react';

export default function AntiCheatMonitor() {
  const [warnings, setWarnings] = useState(0);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        setWarnings((w) => w + 1);
        alert('Warning: Leaving the assessment tab is a violation of testing policy.');
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, []);

  if (warnings === 0) return null;

  return (
    <div className="fixed top-0 left-0 w-full bg-orange-500 text-white text-center py-1 font-semibold z-50">
      Anti-Cheat Warning: Tab Switch Detected ({warnings} times)
    </div>
  );
}
