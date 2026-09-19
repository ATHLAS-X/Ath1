import { createHash } from "crypto";

const HIBP_TIMEOUT_MS = 2000;

function warnHibpFailure(reason: string): void {
  // eslint-disable-next-line no-console
  console.warn(
    JSON.stringify({
      event: "auth.hibp_check_failed",
      reason,
      note: "failed open — only the local common-password list ran for this request",
    }),
  );
}

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
 * because every caller (signup, reset-password, change-password) runs
 * password.ts's own hardcoded-list check first — a HIBP failure means that
 * local list is the only check for this one request, not that zero ran.
 *
 * Failing open is not failing silently: every failure logs a structured
 * warning, so a lookup that has stopped working shows up in the logs instead
 * of looking exactly like every password being clean.
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
    if (!res.ok) {
      warnHibpFailure(`http_${res.status}`);
      return false;
    }
    const body = await res.text();
    return body
      .split("\n")
      .some((line) => line.trim().split(":")[0] === suffix);
  } catch (err) {
    // AbortError (timeout), DNS/network failure, etc. — fail open, but visibly.
    warnHibpFailure(err instanceof Error && err.name === "AbortError" ? "timeout" : "network_error");
    return false;
  } finally {
    clearTimeout(timeout);
  }
}
