/**
 * Standards-aware email validation and normalization utility.
 * Supports universal domains: Gmail, Outlook, Yahoo, educational institutions (.edu, .edu.in),
 * company domains (.co.in, .org), custom domains, subdomains, plus-addressing, and dots.
 * 
 * Rejects malformed addresses such as:
 * - Empty string or whitespace
 * - Missing local part or domain part (e.g., '@gmail.com', 'student@')
 * - Multiple '@' characters (e.g., 'student@@gmail.com')
 * - Spaces in local or domain part
 * - Domain without TLD or with invalid TLD (e.g., 'student@gmail', 'student@.com')
 * - Consecutive dots in local part or domain (e.g., 'student..name@example.com', 'student@example..com')
 * - Leading or trailing dots in local part
 */

export function validateEmail(raw: unknown): boolean {
  if (typeof raw !== 'string') return false;
  const email = raw.trim();

  // Basic length constraints per RFC 5321 (max total 254)
  if (!email || email.length > 254) return false;

  // Disallow any whitespace within the email
  if (/[\s]/.test(email)) return false;

  const atParts = email.split('@');
  if (atParts.length !== 2) return false;

  const [local, domain] = atParts;
  if (!local || local.length > 64 || !domain || domain.length > 253) return false;

  // Local part validation:
  // Cannot begin or end with a dot, cannot contain consecutive dots
  if (local.startsWith('.') || local.endsWith('.')) return false;
  if (local.includes('..')) return false;

  // Allowed standard characters in unquoted local part
  const localRegex = /^[a-zA-Z0-9!#$%&'*+/=?^_`{|}~.-]+$/;
  if (!localRegex.test(local)) return false;

  // Domain part validation:
  // Cannot begin or end with a dot, cannot contain consecutive dots
  if (domain.startsWith('.') || domain.endsWith('.')) return false;
  if (domain.includes('..')) return false;

  const labels = domain.split('.');
  if (labels.length < 2) return false;

  for (const label of labels) {
    if (!label || label.length > 63) return false;
    if (label.startsWith('-') || label.endsWith('-')) return false;
    if (!/^[a-zA-Z0-9-]+$/.test(label)) return false;
  }

  // Top-Level Domain (TLD) must be at least 2 alphabetic characters
  const tld = labels[labels.length - 1];
  if (!/^[a-zA-Z]{2,}$/.test(tld)) return false;

  return true;
}

/**
 * Consistently trims and lowercases email for case-insensitive lookup,
 * without stripping plus tags (+) or periods (.) from the local part.
 */
export function normalizeEmail(raw: string): string {
  return raw.trim().toLowerCase();
}

/**
 * Returns user-friendly validation error message or null if valid.
 */
export function getEmailValidationError(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) {
    return 'Please enter your email address.';
  }
  if (!validateEmail(trimmed)) {
    return 'Enter a valid email address, such as student@gmail.com.';
  }
  return null;
}
