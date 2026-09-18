/**
 * Password-reset email delivery. No email-sending infrastructure exists
 * anywhere in this codebase yet (no nodemailer/Resend/SendGrid/mailgun
 * dependency in package.json, no usage in src/), so there is no real
 * delivery path.
 *
 * Outside production the link is logged instead of sent, so the whole flow
 * (POST /api/auth/forgot-password -> a real token in the DB -> POST
 * /api/auth/reset-password) stays testable end to end — the same "disclose
 * the dev-mode stub, don't fake success" pattern this codebase already uses
 * for OTP (see e.g. src/lib/aadhaar-verification.ts).
 *
 * In production it refuses instead. Writing a working reset link into
 * production logs would hand the account to anyone who can read them, and
 * "succeeding" without sending anything tells users to wait for an email
 * that never arrives.
 */

/**
 * Whether this environment can deliver a reset email. Callers must check
 * this BEFORE looking the account up — see forgot-password/route.ts for why
 * the order matters. When a real provider is wired in, this should return
 * true whenever that provider's credentials are configured.
 */
export function canDeliverPasswordResetEmail(): boolean {
  return process.env.NODE_ENV !== "production";
}

export async function sendPasswordResetEmail(email: string, resetUrl: string): Promise<void> {
  if (!canDeliverPasswordResetEmail()) {
    // Backstop only — forgot-password checks canDeliverPasswordResetEmail()
    // before the account lookup. Deliberately doesn't log the link.
    throw new Error("No password-reset email provider is configured for this environment");
  }
  // eslint-disable-next-line no-console
  console.log(
    JSON.stringify({
      event: "auth.password_reset_email_stub",
      to: email,
      resetUrl,
      note: "no real email provider is configured yet — dev-mode stub, nothing was actually sent",
    }),
  );
}
