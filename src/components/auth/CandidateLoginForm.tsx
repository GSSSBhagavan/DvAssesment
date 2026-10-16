'use client';
import React, { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ArrowRight, 
  ArrowLeft,
  Loader2, 
  AlertCircle, 
  Eye, 
  EyeOff,
  Check
} from 'lucide-react';
import { useAssessmentState } from '@/hooks/useAssessmentState';
import { validateEmail, getEmailValidationError } from '@/lib/validation/email';
import { validatePassword, validatePasswordConfirmation } from '@/lib/validation/password';
import PasswordStrengthIndicator from '@/components/auth/PasswordStrengthIndicator';

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
  initialMode?: 'signin' | 'register';
}

export default function CandidateLoginForm({
  onSuccess,
  onBackToWelcome,
  accentColor = 'blue',
  showHeaderLogo = false,
  className = '',
  title,
  subtitle,
  initialMode = 'signin',
}: CandidateLoginFormProps) {
  const router = useRouter();
  const resetAssessmentState = useAssessmentState((s) => s.resetState);

  // Authentication mode: 'signin' for existing candidates; 'register' for new candidates
  const [mode, setMode] = useState<'signin' | 'register'>(initialMode);

  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Field interaction states for validation on blur/submit without premature errors
  const [emailTouched, setEmailTouched] = useState(false);
  const [fullNameTouched, setFullNameTouched] = useState(false);
  const [passwordTouched, setPasswordTouched] = useState(false);
  const [confirmPasswordTouched, setConfirmPasswordTouched] = useState(false);

  // Live real-time password evaluation
  const passwordValidation = useMemo(() => {
    return validatePassword(password);
  }, [password]);

  // Live real-time confirm-password match evaluation
  const confirmValidation = useMemo(() => {
    return validatePasswordConfirmation(password, confirmPassword);
  }, [password, confirmPassword]);

  const isBlue = accentColor === 'blue';
  const inputInteractiveClasses = isBlue
    ? "hover:border-[#2563EB] focus:border-[#2563EB] focus:ring-3 focus:ring-[#2563EB]/15"
    : "hover:border-[#DC2626] focus:border-[#DC2626] focus:ring-3 focus:ring-[#DC2626]/12";
  const buttonAccentClasses = isBlue
    ? "bg-[#2563EB] hover:bg-white active:bg-slate-100 text-white hover:text-[#121214] border-2 border-[#2563EB] hover:border-[#121214] focus-visible:ring-[#2563EB]"
    : "bg-[#DC2626] hover:bg-white active:bg-slate-100 text-white hover:text-[#121214] border-2 border-[#DC2626] hover:border-[#121214] focus-visible:ring-[#DC2626]";

  // Inline error states (evaluated only after user interaction or submit attempt)
  const emailError = emailTouched ? getEmailValidationError(email) : null;
  const fullNameError = fullNameTouched && mode === 'register'
    ? (!fullName.trim() 
        ? 'Please enter your full name.' 
        : fullName.trim().length < 2 
          ? 'Full name must be at least 2 characters.' 
          : null)
    : null;

  const passwordError = passwordTouched
    ? (!password
        ? 'Please enter your password.'
        : mode === 'register' && !passwordValidation.isValid
          ? 'Password must meet all 5 requirements.'
          : null)
    : null;

  const confirmPasswordError = confirmPasswordTouched && mode === 'register'
    ? (!confirmPassword
        ? 'Please confirm your password.'
        : !confirmValidation.matches
          ? 'Passwords do not match.'
          : null)
    : null;

  // Overall form validity condition
  const isFormValid = mode === 'signin'
    ? Boolean(validateEmail(email) && password.length > 0)
    : Boolean(
        validateEmail(email) && 
        fullName.trim().length >= 2 && 
        passwordValidation.isValid && 
        confirmValidation.matches
      );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;

    // Mark all fields touched on submit attempt
    setEmailTouched(true);
    setPasswordTouched(true);
    if (mode === 'register') {
      setFullNameTouched(true);
      setConfirmPasswordTouched(true);
    }

    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      setError('Please enter your email address.');
      return;
    }

    if (!validateEmail(trimmedEmail)) {
      setError('Enter a valid email address, such as student@gmail.com.');
      return;
    }

    if (mode === 'register') {
      const trimmedName = fullName.trim();
      if (!trimmedName || trimmedName.length < 2) {
        setError('Please enter your full name (at least 2 characters).');
        return;
      }

      if (!passwordValidation.isValid) {
        setError('Please ensure your password satisfies all 5 security requirements.');
        return;
      }

      if (password !== confirmPassword) {
        setError('Passwords do not match.');
        return;
      }
    } else {
      if (!password) {
        setError('Please enter your password.');
        return;
      }
    }

    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          email: trimmedEmail, 
          password,
          fullName: mode === 'register' ? fullName.trim() : (fullName.trim() || undefined),
          mode
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
        setError(data.error || 'Unable to connect right now. Please try again.');
      }
    } catch {
      setError('Unable to connect right now. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const currentTitle = title || (mode === 'signin' ? 'Candidate Sign In' : 'Create Candidate Account');
  const currentSubtitle = subtitle || (mode === 'signin' 
    ? 'Enter your registered credentials to continue.' 
    : 'Set up your credentials to begin the assessment.');

  return (
    <div className={`w-full max-w-md ${className}`}>
      {/* Back to Welcome Navigation */}
      {onBackToWelcome && (
        <button
          type="button"
          onClick={onBackToWelcome}
          disabled={loading}
          className="inline-flex items-center gap-1.5 text-[13px] font-medium text-[#71717A] hover:text-[#2563EB] transition-colors mb-4 group cursor-pointer disabled:opacity-50"
        >
          <ArrowLeft size={14} className="transition-transform duration-150 group-hover:-translate-x-1" />
          <span>Back to Welcome</span>
        </button>
      )}

      {/* Optional Standalone Header Brand Logo */}
      {showHeaderLogo && (
        <div className="mb-4">
          <img
            src="/datavalley-logo.png"
            alt="Data Valley"
            className="h-8.5 w-auto object-contain mix-blend-multiply"
          />
        </div>
      )}

      {/* Segmented Mode Selector: Sign In vs Create Account */}
      <div 
        className="flex p-1 bg-black/[0.05] rounded-xl mb-4.5 border border-black/[0.04] select-none"
        role="tablist"
        aria-label="Authentication mode"
      >
        <button
          type="button"
          role="tab"
          aria-selected={mode === 'signin'}
          onClick={() => {
            setMode('signin');
            setError('');
          }}
          disabled={loading}
          className={`flex-1 py-1.5 text-[13px] font-semibold rounded-lg transition-all cursor-pointer ${
            mode === 'signin'
              ? 'bg-white text-[#121214] shadow-xs'
              : 'text-[#71717A] hover:text-[#121214]'
          }`}
        >
          Sign In
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mode === 'register'}
          onClick={() => {
            setMode('register');
            setError('');
          }}
          disabled={loading}
          className={`flex-1 py-1.5 text-[13px] font-semibold rounded-lg transition-all cursor-pointer ${
            mode === 'register'
              ? 'bg-white text-[#121214] shadow-xs'
              : 'text-[#71717A] hover:text-[#121214]'
          }`}
        >
          Create Account
        </button>
      </div>

      {/* Header Narrative */}
      <div className="space-y-1 mb-5 text-left">
        <h1 className="text-2xl sm:text-[28px] font-extrabold text-[#121214] tracking-[-0.035em] leading-tight font-sans">
          {currentTitle}
        </h1>
        <p className="text-[13.5px] text-[#52525B] leading-relaxed font-normal">
          {currentSubtitle}
        </p>
      </div>

      {/* Error Alert */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -6, height: 0 }}
            animate={{ opacity: 1, y: 0, height: 'auto' }}
            exit={{ opacity: 0, y: -6, height: 0 }}
            className="mb-4 overflow-hidden text-left"
          >
            <div className="p-3 rounded-xl bg-[#FEF2F2] border border-[#DC2626]/25 text-[#991B1B] text-[12.5px] flex items-center justify-between gap-2.5 shadow-xs">
              <div className="flex items-center gap-2 min-w-0">
                <AlertCircle size={15} className="text-[#DC2626] shrink-0" />
                <span className="leading-snug font-medium truncate">{error}</span>
              </div>
              {error.includes('switch to Create Account') && (
                <button
                  type="button"
                  onClick={() => {
                    setMode('register');
                    setError('');
                  }}
                  className="text-[11.5px] font-bold text-[#2563EB] hover:underline shrink-0 cursor-pointer"
                >
                  Register
                </button>
              )}
              {error.includes('Please sign in instead') && (
                <button
                  type="button"
                  onClick={() => {
                    setMode('signin');
                    setError('');
                  }}
                  className="text-[11.5px] font-bold text-[#2563EB] hover:underline shrink-0 cursor-pointer"
                >
                  Sign In
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Compact, Clearly Aligned Form */}
      <form onSubmit={handleSubmit} className="space-y-3.5 text-left" noValidate>
        {/* Full Name Field (Required on registration) */}
        {mode === 'register' && (
          <div>
            <label 
              htmlFor="candidate-name" 
              className="block text-[13px] font-semibold text-[#18181B] mb-1.5"
            >
              Full Name <span className="text-[#DC2626] font-semibold text-xs">*</span>
            </label>
            <input
              id="candidate-name"
              type="text"
              required
              autoComplete="name"
              value={fullName}
              onChange={(e) => {
                setFullName(e.target.value);
                if (error) setError('');
              }}
              onBlur={() => setFullNameTouched(true)}
              placeholder="e.g. Maharshi Patel"
              disabled={loading}
              className={`w-full px-3.5 py-2.5 bg-white border ${fullNameError ? 'border-[#DC2626] focus:ring-[#DC2626]/15' : 'border-black/[0.12]'} rounded-xl text-[14px] text-[#121214] transition-all placeholder:text-[#A1A1AA] outline-none disabled:opacity-60 disabled:bg-black/[0.02] shadow-xs ${inputInteractiveClasses}`}
            />
            {fullNameError && (
              <p className="mt-1 text-[11.5px] text-[#DC2626] font-medium flex items-center gap-1">
                <span>{fullNameError}</span>
              </p>
            )}
          </div>
        )}

        {/* Email Field */}
        <div>
          <label 
            htmlFor="candidate-email" 
            className="block text-[13px] font-semibold text-[#18181B] mb-1.5"
          >
            {mode === 'signin' ? 'Registered Email' : 'Email Address'} <span className="text-[#DC2626] font-semibold text-xs">*</span>
          </label>
          <input
            id="candidate-email"
            type="email"
            required
            autoFocus
            autoComplete="email"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              if (error) setError('');
            }}
            onBlur={() => setEmailTouched(true)}
            placeholder="student@example.com"
            disabled={loading}
            className={`w-full px-3.5 py-2.5 bg-white border ${emailError ? 'border-[#DC2626] focus:ring-[#DC2626]/15' : 'border-black/[0.12]'} rounded-xl text-[14px] text-[#121214] transition-all placeholder:text-[#A1A1AA] outline-none disabled:opacity-60 disabled:bg-black/[0.02] shadow-xs ${inputInteractiveClasses}`}
          />
          {emailError && (
            <p className="mt-1 text-[11.5px] text-[#DC2626] font-medium flex items-center gap-1">
              <span>{emailError}</span>
            </p>
          )}
        </div>

        {/* Password Field */}
        <div>
          <label 
            htmlFor="candidate-password" 
            className="block text-[13px] font-semibold text-[#18181B] mb-1.5"
          >
            {mode === 'signin' ? 'Password' : 'Create Password'} <span className="text-[#DC2626] font-semibold text-xs">*</span>
          </label>
          <div className="relative">
            <input
              id="candidate-password"
              type={showPassword ? 'text' : 'password'}
              required
              autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                if (error) setError('');
              }}
              onBlur={() => setPasswordTouched(true)}
              placeholder="••••••••••••"
              disabled={loading}
              aria-describedby={mode === 'register' ? 'password-strength-section' : undefined}
              className={`w-full pl-3.5 pr-11 py-2.5 bg-white border ${passwordError ? 'border-[#DC2626] focus:ring-[#DC2626]/15' : 'border-black/[0.12]'} rounded-xl text-[14px] text-[#121214] transition-all placeholder:text-[#A1A1AA] outline-none disabled:opacity-60 disabled:bg-black/[0.02] shadow-xs ${inputInteractiveClasses}`}
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

          {/* Real-time Password Strength Indicator & 5-Rule Checklist (Registration mode) */}
          {mode === 'register' && (
            <div id="password-strength-section">
              <PasswordStrengthIndicator 
                validation={passwordValidation} 
                showChecklist={true} 
              />
            </div>
          )}

          {passwordError && mode === 'signin' && (
            <p className="mt-1 text-[11.5px] text-[#DC2626] font-medium flex items-center gap-1">
              <span>{passwordError}</span>
            </p>
          )}
        </div>

        {/* Confirm Password Field (Registration Mode Only) */}
        {mode === 'register' && (
          <div>
            <label 
              htmlFor="candidate-confirm-password" 
              className="block text-[13px] font-semibold text-[#18181B] mb-1.5"
            >
              Confirm Password <span className="text-[#DC2626] font-semibold text-xs">*</span>
            </label>
            <div className="relative">
              <input
                id="candidate-confirm-password"
                type={showConfirmPassword ? 'text' : 'password'}
                required
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => {
                  setConfirmPassword(e.target.value);
                  if (error) setError('');
                }}
                onBlur={() => setConfirmPasswordTouched(true)}
                placeholder="••••••••••••"
                disabled={loading}
                className={`w-full pl-3.5 pr-11 py-2.5 bg-white border ${confirmPasswordError ? 'border-[#DC2626] focus:ring-[#DC2626]/15' : 'border-black/[0.12]'} rounded-xl text-[14px] text-[#121214] transition-all placeholder:text-[#A1A1AA] outline-none disabled:opacity-60 disabled:bg-black/[0.02] shadow-xs ${inputInteractiveClasses}`}
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                disabled={loading}
                className={`absolute right-2.5 top-1/2 -translate-y-1/2 p-1.5 text-[#71717A] ${isBlue ? 'hover:text-[#2563EB]' : 'hover:text-[#DC2626]'} rounded-lg transition-colors cursor-pointer disabled:opacity-50`}
                title={showConfirmPassword ? 'Hide password' : 'Show password'}
                aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
              >
                {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>

            {/* Live Match State Indicators */}
            {confirmPassword.length > 0 && confirmValidation.matches && (
              <p className="mt-1 text-[11.5px] text-[#059669] font-medium flex items-center gap-1">
                <Check size={12} strokeWidth={3} />
                <span>Passwords match</span>
              </p>
            )}
            {confirmPasswordError && (
              <p className="mt-1 text-[11.5px] text-[#DC2626] font-medium flex items-center gap-1">
                <AlertCircle size={12} />
                <span>{confirmPasswordError}</span>
              </p>
            )}
          </div>
        )}

        {/* Submit Primary CTA */}
        <div className="pt-2">
          <button
            type="submit"
            disabled={loading || !isFormValid}
            className={`w-full py-3 rounded-full font-medium text-[14.5px] shadow-sm hover:shadow-md transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer disabled:bg-black/[0.08] disabled:border-transparent disabled:text-[#A1A1AA] disabled:cursor-not-allowed disabled:shadow-none disabled:active:scale-100 group ${buttonAccentClasses}`}
          >
            {loading ? (
              <>
                <Loader2 size={16} className="animate-spin text-current" />
                <span>{mode === 'signin' ? 'Signing In...' : 'Creating Account...'}</span>
              </>
            ) : (
              <>
                <span>{mode === 'signin' ? 'Enter Assessment' : 'Create Account & Start'}</span>
                <ArrowRight size={16} className="transition-transform duration-200 group-hover:translate-x-1 text-current" />
              </>
            )}
          </button>
        </div>

        {/* Bottom Mode Switch Helper */}
        <div className="pt-2 text-center">
          {mode === 'signin' ? (
            <p className="text-[12.5px] text-[#71717A]">
              First time taking this test?{' '}
              <button
                type="button"
                onClick={() => {
                  setMode('register');
                  setError('');
                }}
                disabled={loading}
                className="font-semibold text-[#2563EB] hover:underline cursor-pointer"
              >
                Create an account
              </button>
            </p>
          ) : (
            <p className="text-[12.5px] text-[#71717A]">
              Already registered?{' '}
              <button
                type="button"
                onClick={() => {
                  setMode('signin');
                  setError('');
                }}
                disabled={loading}
                className="font-semibold text-[#2563EB] hover:underline cursor-pointer"
              >
                Sign in to your account
              </button>
            </p>
          )}
        </div>
      </form>
    </div>
  );
}
