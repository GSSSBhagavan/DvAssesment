'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import DVWelcomeScreen from '@/components/welcome/DVWelcomeScreen';

export default function LoginPage() {
  const router = useRouter();
  const [checkingSession, setCheckingSession] = useState(true);
  const [existingUser, setExistingUser] = useState<{ email?: string; fullName?: string } | null>(null);

  useEffect(() => {
    fetch('/api/auth/me')
      .then(res => {
        if (!res.ok) throw new Error();
        return res.json();
      })
      .then(data => {
        if (data.user) {
          setExistingUser(data.user);
        }
        setCheckingSession(false);
      })
      .catch(() => {
        setCheckingSession(false);
      });
  }, []);

  if (checkingSession) {
    return (
      <div className="min-h-screen bg-[#FAF8F5] flex flex-col items-center justify-center font-sans">
        <div className="w-8 h-8 rounded-full border-2 border-black/10 border-t-[#DC2626] animate-spin mb-3" />
        <span className="text-xs font-mono text-[#71717A] tracking-widest uppercase">
          DV Labs · Initializing...
        </span>
      </div>
    );
  }

  return (
    <DVWelcomeScreen
      initialLoginView={true}
      isAuthenticated={Boolean(existingUser)}
      candidateName={existingUser?.fullName}
      onLoginClick={() => {}}
      onContinueToReadiness={() => router.push('/')}
      onLoginSuccess={() => router.replace('/')}
      onSignOut={async () => {
        await fetch('/api/auth/logout', { method: 'POST' });
        setExistingUser(null);
      }}
    />
  );
}
