/**
 * Standard Password Validation & Strength Engine
 * Single source of truth for candidate password complexity policies across
 * both frontend live validation and backend API enforcement.
 */

export interface PasswordRuleDefinition {
  id: 'length' | 'uppercase' | 'lowercase' | 'number' | 'special';
  label: string;
  test: (password: string) => boolean;
}

export interface PasswordRuleStatus {
  id: 'length' | 'uppercase' | 'lowercase' | 'number' | 'special';
  label: string;
  passed: boolean;
}

export type PasswordStrengthState = 'empty' | 'weak' | 'fair' | 'strong';

export interface PasswordValidationResult {
  rules: PasswordRuleStatus[];
  satisfiedCount: number;
  totalRules: number;
  isValid: boolean;
  strength: PasswordStrengthState;
  strengthLabel: string;
  score: number; // 0: empty, 1: weak, 2: fair, 3: strong
  errors: string[];
}

export const MIN_PASSWORD_LENGTH = 8;
export const MAX_PASSWORD_LENGTH = 128;

// Required complexity rules as specified by assessment security standards
export const PASSWORD_RULES: PasswordRuleDefinition[] = [
  {
    id: 'length',
    label: 'At least 8 characters',
    test: (pw: string) => pw.length >= MIN_PASSWORD_LENGTH,
  },
  {
    id: 'uppercase',
    label: 'One uppercase letter',
    test: (pw: string) => /[A-Z]/.test(pw),
  },
  {
    id: 'lowercase',
    label: 'One lowercase letter',
    test: (pw: string) => /[a-z]/.test(pw),
  },
  {
    id: 'number',
    label: 'One number',
    test: (pw: string) => /[0-9]/.test(pw),
  },
  {
    id: 'special',
    label: 'One special character (!@#$%&*)',
    test: (pw: string) => /[^A-Za-z0-9]/.test(pw),
  },
];

/**
 * Evaluates password string against all 5 complexity rules in real-time.
 * NOTE: The raw password is never trimmed or altered, preserving exact characters.
 */
export function validatePassword(password: string = ''): PasswordValidationResult {
  const safePassword = typeof password === 'string' ? password : '';
  const errors: string[] = [];

  // Check maximum length restriction
  if (safePassword.length > MAX_PASSWORD_LENGTH) {
    errors.push(`Password must not exceed ${MAX_PASSWORD_LENGTH} characters.`);
  }

  const rules: PasswordRuleStatus[] = PASSWORD_RULES.map((rule) => {
    const passed = rule.test(safePassword);
    if (!passed && safePassword.length > 0) {
      errors.push(`Password must include: ${rule.label.toLowerCase()}`);
    }
    return {
      id: rule.id,
      label: rule.label,
      passed,
    };
  });

  const satisfiedCount = rules.filter((r) => r.passed).length;
  const totalRules = rules.length;
  const allRulesPassed = satisfiedCount === totalRules && safePassword.length <= MAX_PASSWORD_LENGTH;

  // Strength score calculation strictly derived from satisfied rules
  let strength: PasswordStrengthState = 'empty';
  let strengthLabel = '';
  let score = 0;

  if (safePassword.length === 0) {
    strength = 'empty';
    strengthLabel = '';
    score = 0;
  } else if (satisfiedCount <= 2) {
    strength = 'weak';
    strengthLabel = 'Weak';
    score = 1;
  } else if (satisfiedCount >= 3 && satisfiedCount < totalRules) {
    strength = 'fair';
    strengthLabel = 'Fair';
    score = 2;
  } else if (satisfiedCount === totalRules) {
    strength = 'strong';
    strengthLabel = 'Strong';
    score = 3;
  }

  return {
    rules,
    satisfiedCount,
    totalRules,
    isValid: allRulesPassed,
    strength,
    strengthLabel,
    score,
    errors,
  };
}

/**
 * Validates match between password and confirmPassword fields in real time.
 */
export function validatePasswordConfirmation(
  password: string = '',
  confirmPassword: string = ''
): { matches: boolean; error: string | null } {
  if (!confirmPassword) {
    return { matches: false, error: null };
  }

  if (password !== confirmPassword) {
    return { matches: false, error: 'Passwords do not match' };
  }

  return { matches: true, error: null };
}

/**
 * Formats a clean, user-safe backend validation message for rejected passwords.
 */
export function getPasswordPolicyErrorMessage(password: string = ''): string | null {
  if (!password || password.length === 0) {
    return 'Please enter a password.';
  }

  if (password.length > MAX_PASSWORD_LENGTH) {
    return `Password cannot exceed ${MAX_PASSWORD_LENGTH} characters.`;
  }

  const result = validatePassword(password);
  if (result.isValid) {
    return null;
  }

  const missingRequirements = result.rules
    .filter((r) => !r.passed)
    .map((r) => r.label.toLowerCase());

  return `Password must satisfy all complexity rules: missing ${missingRequirements.join(', ')}.`;
}
