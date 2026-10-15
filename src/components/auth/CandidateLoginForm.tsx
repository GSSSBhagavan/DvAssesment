'use client';
import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ArrowRight, 
  ArrowLeft,
  Loader2, 
  AlertCircle, 
  Eye, 
  EyeOff 
} from 'lucide-react';
import { useAssessmentState } from '@/hooks/useAssessmentState';

export interface CandidateUser {
  id?: string;
  email?: string;
  fullName?: string;
  role?: string;
}

export interface CandidateLoginFormProps {
  onSuccess?: (user: CandidateUser) => void;
  onBackToWelcome?: () => void;
  accentColor?: 'red' | 'blue';
  showHeaderLogo?: boolean;
  className?: string;
  title?: string;
  subtitle?: string;
}

export default function CandidateLoginForm({
  onSuccess,
  onBackToWelcome,
  accentColor = 'blue',
  showHeaderLogo = false,
  className = '',
  title = 'Candidate Sign In',
  subtitle = 'Enter your registered credentials to continue.'
}: CandidateLoginFormProps) {
  const router = useRouter();
  const resetAssessmentState = useAssessmentState((s) => s.resetState);

  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const isBlue = accentColor === 'blue';
  const inputInteractiveClasses = isBlue
    ? "hover:border-[#2563EB] focus:border-[#2563EB] focus:ring-3 focus:ring-[#2563EB]/15"
    : "hover:border-[#DC2626] focus:border-[#DC2626] focus:ring-3 focus:ring-[#DC2626]/12";
  const buttonAccentClasses = isBlue
    ? "bg-[#2563EB] hover:bg-[#1D4ED8] active:bg-[#1E40AF] focus-visible:ring-[#2563EB]"
    : "bg-[#DC2626] hover:bg-[#B91C1C] active:bg-[#991B1B] focus-visible:ring-[#DC2626]";

  const isFormValid = email.trim().length > 0 && password.trim().length > 0;

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading || !isFormValid) return;
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          email: email.trim(), 
          password,
          fullName: fullName.trim() || undefined
        })
      });

      const data = await res.json();

      if (res.ok && data.success) {
        resetAssessmentState();
        if (onSuccess) {
          onSuccess(data.user);
        } else {
          if (data.user?.role === 'ADMIN') {
            router.replace('/admin');
          } else {
            router.replace('/');
          }
        }
      } else {
        setError(data.error || 'Unable to sign in. Please verify your registered credentials.');
      }
    } catch {
      setError('A network error occurred. Please verify your connection and try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={`w-full max-w-md ${className}`}>
      {/* Back to Welcome Navigation */}
      {onBackToWelcome && (
        <button
          type="button"
          onClick={onBackToWelcome}
          disabled={loading}
          className="inline-flex items-center gap-1.5 text-[13px] font-medium text-[#71717A] hover:text-[#2563EB] transition-colors mb-5 group cursor-pointer disabled:opacity-50"
        >
          <ArrowLeft size={14} className="transition-transform duration-150 group-hover:-translate-x-1" />
          <span>Back to Welcome</span>
        </button>
      )}

      {/* Optional Standalone Header Brand Logo */}
      {showHeaderLogo && (
        <div className="mb-5">
          <img
            src="/datavalley-logo.png"
            alt="Data Valley"
            className="h-9 w-auto object-contain mix-blend-multiply"
          />
        </div>
      )}

      {/* Header Narrative */}
      <div className="space-y-1.5 mb-6">
        <h1 className="text-3xl sm:text-[34px] font-extrabold text-[#121214] tracking-[-0.035em] leading-tight font-sans">
          {title}
        </h1>
        <p className="text-[14px] sm:text-[14.5px] text-[#52525B] leading-relaxed font-normal">
          {subtitle}
        </p>
      </div>

      {/* Error Alert */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -6, height: 0 }}
            animate={{ opacity: 1, y: 0, height: 'auto' }}
            exit={{ opacity: 0, y: -6, height: 0 }}
            className="mb-4 overflow-hidden"
          >
            <div className="p-3 rounded-xl bg-[#FEF2F2] border border-[#DC2626]/25 text-[#991B1B] text-[13px] flex items-center gap-2.5 shadow-xs">
              <AlertCircle size={16} className="text-[#DC2626] shrink-0" />
              <span className="leading-snug font-medium">{error}</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Compact, Clearly Aligned Form */}
      <form onSubmit={handleLogin} className="space-y-3.5">
        {/* Email Field */}
        <div>
          <label 
            htmlFor="candidate-email" 
            className="block text-[13px] font-semibold text-[#18181B] mb-1.5"
          >
            Registered Email
          </label>
          <input
            id="candidate-email"
            type="email"
            required
            autoFocus
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="student@example.com"
            disabled={loading}
            className={`w-full px-3.5 py-2.5 sm:py-3 bg-white border border-black/[0.12] rounded-xl text-[14px] text-[#121214] transition-all placeholder:text-[#A1A1AA] outline-none disabled:opacity-60 disabled:bg-black/[0.02] shadow-xs ${inputInteractiveClasses}`}
          />
        </div>

        {/* Full Name Field */}
        <div>
          <label 
            htmlFor="candidate-name" 
            className="block text-[13px] font-semibold text-[#18181B] mb-1.5"
          >
            Full Name <span className="text-[#86868B] font-normal text-xs">(optional)</span>
          </label>
          <input
            id="candidate-name"
            type="text"
            autoComplete="name"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="Your full name"
            disabled={loading}
            className={`w-full px-3.5 py-2.5 sm:py-3 bg-white border border-black/[0.12] rounded-xl text-[14px] text-[#121214] transition-all placeholder:text-[#A1A1AA] outline-none disabled:opacity-60 disabled:bg-black/[0.02] shadow-xs ${inputInteractiveClasses}`}
          />
        </div>

        {/* Password Field */}
        <div>
          <label 
            htmlFor="candidate-password" 
            className="block text-[13px] font-semibold text-[#18181B] mb-1.5"
          >
            Password
          </label>
          <div className="relative">
            <input
              id="candidate-password"
              type={showPassword ? 'text' : 'password'}
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••••••"
              disabled={loading}
              className={`w-full pl-3.5 pr-11 py-2.5 sm:py-3 bg-white border border-black/[0.12] rounded-xl text-[14px] text-[#121214] transition-all placeholder:text-[#A1A1AA] outline-none disabled:opacity-60 disabled:bg-black/[0.02] shadow-xs ${inputInteractiveClasses}`}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              disabled={loading}
              className={`absolute right-2.5 top-1/2 -translate-y-1/2 p-1.5 text-[#71717A] ${isBlue ? 'hover:text-[#2563EB]' : 'hover:text-[#DC2626]'} rounded-lg transition-colors cursor-pointer disabled:opacity-50`}
              title={showPassword ? 'Hide password' : 'Show password'}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </div>

        {/* Submit Primary CTA */}
        <div className="pt-2">
          <button
            type="submit"
            disabled={loading || !isFormValid}
            className={`w-full py-3.5 rounded-full font-medium text-[15px] shadow-sm hover:shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer disabled:bg-black/[0.08] disabled:text-[#A1A1AA] disabled:cursor-not-allowed disabled:shadow-none disabled:active:scale-100 group text-white ${buttonAccentClasses}`}
          >
            {loading ? (
              <>
                <Loader2 size={16} className="animate-spin text-white" />
                <span>Signing In...</span>
              </>
            ) : (
              <>
                <span>Enter Assessment</span>
                <ArrowRight size={16} className="transition-transform duration-200 group-hover:translate-x-1" />
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
