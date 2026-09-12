import { createHash } from "crypto";

const HIBP_TIMEOUT_MS = 2000;

/**
 * Checks a password against Have I Been Pwned's Pwned Passwords range API
 * using k-anonymity: only the first 5 hex characters of the password's
 * SHA-1 hash are ever sent over the network — the plaintext password, and
 * even the full hash, never leave this process. HIBP's range endpoint
 * returns every suffix sharing that 5-character prefix (typically several
 * hundred rows); the actual match is completed locally by comparing the
 * remaining 35 characters against each returned suffix.
 *
 * Fails OPEN, deliberately: signup must never be blocked by a third-party
 * outage. Any network error, non-200 response, or timeout (2s, short by
 * design) is treated as "not found" here. This is safe to fail open on
 * because the caller (src/app/api/auth/signup/route.ts) already ran
 * password.ts's own hardcoded-list check before ever calling this — a HIBP
 * failure just means that local list remains the only check for this one
 * request, not that zero checks ran.
 */
export async function isPasswordBreached(password: string): Promise<boolean> {
  const sha1 = createHash("sha1").update(password, "utf8").digest("hex").toUpperCase();
  const prefix = sha1.slice(0, 5);
  const suffix = sha1.slice(5);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), HIBP_TIMEOUT_MS);
  try {
    const res = await fetch(`https://api.pwnedpasswords.com/range/${prefix}`, {
      signal: controller.signal,
    });
    if (!res.ok) return false;
    const body = await res.text();
    return body
      .split("\n")
      .some((line) => line.trim().split(":")[0] === suffix);
  } catch {
    // AbortError (timeout), DNS/network failure, etc. — fail open.
    return false;
  } finally {
    clearTimeout(timeout);
  }
}
