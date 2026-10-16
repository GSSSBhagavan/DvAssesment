'use client';

import React from 'react';
import { Check } from 'lucide-react';
import { PasswordValidationResult } from '@/lib/validation/password';

export interface PasswordStrengthIndicatorProps {
  validation: PasswordValidationResult;
  showChecklist?: boolean;
  className?: string;
  isFieldActive?: boolean;
}

export default function PasswordStrengthIndicator({
  validation,
  showChecklist = true,
  className = '',
  isFieldActive = false,
}: PasswordStrengthIndicatorProps) {
  const { rules, strength, strengthLabel, score, isValid, satisfiedCount, totalRules } = validation;
  const isEmpty = strength === 'empty';

  // Dynamic visual styling for the segmented strength meter
  const getMeterColor = (index: number) => {
    if (isEmpty) return 'bg-black/[0.08]';

    if (strength === 'weak') {
      return index === 0 ? 'bg-[#DC2626]' : 'bg-black/[0.08]';
    }
    if (strength === 'fair') {
      return index <= 1 ? 'bg-[#D97706]' : 'bg-black/[0.08]';
    }
    if (strength === 'strong') {
      return 'bg-[#059669]';
    }
    return 'bg-black/[0.08]';
  };

  const getLabelColor = () => {
    if (isEmpty) return 'text-[#71717A]';
    if (strength === 'weak') return 'text-[#DC2626]';
    if (strength === 'fair') return 'text-[#D97706]';
    if (strength === 'strong') return 'text-[#059669]';
    return 'text-[#71717A]';
  };

  return (
    <div className={`space-y-2 pt-1 font-sans ${className}`} aria-label="Password complexity and strength">
      {/* Real-time Strength Meter & Live Status Label */}
      <div className="flex items-center justify-between gap-3">
        {/* 3-Segment Strength Progress Bar */}
        <div 
          className="flex-1 flex items-center gap-1.5 h-1.5"
          role="progressbar"
          aria-valuenow={score}
          aria-valuemin={0}
          aria-valuemax={3}
          aria-label={isEmpty ? 'Password strength meter' : `Password strength: ${strengthLabel}`}
        >
          {[0, 1, 2].map((segIndex) => (
            <div
              key={segIndex}
              className={`flex-1 h-full rounded-full transition-colors duration-200 ${getMeterColor(segIndex)}`}
            />
          ))}
        </div>

        {/* Textual Strength Label (Hidden when empty per specification) */}
        {!isEmpty && (
          <div className="shrink-0 flex items-center gap-1.5">
            <span 
              className={`text-[11px] font-semibold tracking-wide transition-colors ${getLabelColor()}`}
              aria-live="polite"
            >
              {strengthLabel}
            </span>
            <span className="text-[10px] font-mono text-[#71717A]">
              ({satisfiedCount}/{totalRules})
            </span>
          </div>
        )}
      </div>

      {/* Live Password Requirements Checklist */}
      {showChecklist && (
        <div 
          className="pt-1 grid grid-cols-1 sm:grid-cols-2 gap-x-2 gap-y-1.5 select-none"
          role="list"
          aria-label="Password requirements checklist"
        >
          {rules.map((rule) => {
            const isPassed = rule.passed;

            return (
              <div
                key={rule.id}
                role="listitem"
                className={`flex items-center gap-1.5 text-[11.5px] transition-colors duration-150 ${
                  isPassed
                    ? 'text-[#047857] font-medium'
                    : 'text-[#71717A] font-normal'
                }`}
              >
                {/* Accessible Icon Status */}
                <div
                  className={`w-3.5 h-3.5 rounded-full flex items-center justify-center shrink-0 transition-colors ${
                    isPassed
                      ? 'bg-[#ECFDF5] text-[#059669]'
                      : 'bg-black/[0.05] text-[#A1A1AA]'
                  }`}
                  aria-hidden="true"
                >
                  {isPassed ? (
                    <Check size={9} strokeWidth={3} />
                  ) : (
                    <span className="w-1 h-1 rounded-full bg-[#A1A1AA]" />
                  )}
                </div>

                <span className="truncate leading-none">
                  {rule.label}
                </span>
                
                {/* Screen reader only status announcement */}
                <span className="sr-only">
                  {isPassed ? ': satisfied' : ': not yet satisfied'}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {/* Screen reader status container */}
      <div className="sr-only" role="status" aria-live="polite">
        {!isEmpty && (
          isValid
            ? 'All password requirements met. Password strength is strong.'
            : `Password strength is ${strengthLabel}. ${totalRules - satisfiedCount} requirements remaining.`
        )}
      </div>
    </div>
  );
}
