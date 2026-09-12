import bcrypt from "bcryptjs";

const SALT_ROUNDS = 10;

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

export async function comparePassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

// Precomputed once at module load (not per request) — used only to burn
// comparable bcrypt time when authenticateWithPassword (src/lib/auth.ts)
// finds no matching user, so that path isn't measurably faster than a real
// wrong-password attempt (which does run bcrypt.compare against a real
// hash). Never used to authenticate anything; the fixed input value has no
// significance beyond being stable across process restarts.
const DUMMY_HASH_FOR_TIMING = bcrypt.hashSync("timing-normalization-only-not-a-real-account", SALT_ROUNDS);

export async function compareDummyForTiming(password: string): Promise<void> {
  await bcrypt.compare(password, DUMMY_HASH_FOR_TIMING);
}

const MIN_PASSWORD_LENGTH = 10;
// Top-of-list rockyou-style passwords plus obvious site-specific guesses —
// blocked outright regardless of length/character-class checks below.
const COMMON_PASSWORDS = new Set([
  "password", "password1", "password123", "123456", "12345678", "123456789",
  "qwerty", "qwerty123", "111111", "123123", "abc123", "letmein", "welcome",
  "admin123", "iloveyou", "athlasx", "athlasx123", "cricket", "cricket123",
]);

// Exported so callers doing an additional check beyond this function (e.g.
// the signup route's Have I Been Pwned lookup in src/lib/hibp.ts) can reuse
// the exact same user-facing message rather than a second, driftable copy.
export const PASSWORD_TOO_COMMON_MESSAGE = "This password is too common — please choose a different one";

/**
 * Server-side password-strength gate for account creation. Signup previously
 * accepted any non-empty string (including "a") straight into bcrypt — this
 * is the minimum bar before that hash is ever created. Login (comparePassword)
 * is intentionally untouched: strength rules apply only at creation time, not
 * to existing accounts signing in with whatever they already have.
 */
export function validatePasswordStrength(password: string): string | null {
  if (password.length < MIN_PASSWORD_LENGTH) {
    return `Password must be at least ${MIN_PASSWORD_LENGTH} characters long`;
  }
  if (!/[a-zA-Z]/.test(password) || !/[0-9]/.test(password)) {
    return "Password must contain both letters and numbers";
  }
  if (COMMON_PASSWORDS.has(password.toLowerCase())) {
    return PASSWORD_TOO_COMMON_MESSAGE;
  }
  return null;
}
