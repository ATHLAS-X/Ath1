/**
 * Stub email-sender for the password-reset flow. Checked first: no
 * email-sending infrastructure exists anywhere in this codebase (no
 * nodemailer/Resend/SendGrid/mailgun dependency in package.json, no usage
 * in src/ — confirmed via grep) — there is nothing to reuse.
 *
 * This is a clearly-named interface specifically so the reset flow is
 * fully testable end to end (POST /api/auth/forgot-password ->
 * a real token in the DB -> POST /api/auth/reset-password) before a real
 * provider is wired in as a separate piece of work. Every environment
 * without a real provider configured logs the link instead of sending it,
 * the same "disclose the dev-mode stub, don't fake success" pattern this
 * codebase already uses for OTP (see e.g. src/lib/aadhaar-verification.ts).
 */
export async function sendPasswordResetEmail(email: string, resetUrl: string): Promise<void> {
  // TODO: wire a real provider (Resend, SendGrid, etc.) here as a separate
  // task. Until then, every environment — including production — logs
  // instead of sending; there is no real delivery path yet.
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
