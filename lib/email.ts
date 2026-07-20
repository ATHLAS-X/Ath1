/**
 * Email stub. Replace with Resend / SES / Postmark in production.
 *
 * The log here must NOT echo the recipient address or the body — `body`
 * routinely contains a claim/invite link with a token embedded in it
 * (account-linking secret), and `to` is PII. Only the subject (generally
 * non-identifying, e.g. "Claim your AthlasX profile") and a masked
 * recipient are logged.
 */
export async function sendEmail(params: {
  to: string;
  subject: string;
  body: string;
}): Promise<{ delivered: boolean }> {
  // eslint-disable-next-line no-console
  console.log(`[EMAIL STUB] sent to ${maskEmail(params.to)} — "${params.subject}"`);
  return { delivered: true };
}

function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!domain) return "***";
  const maskedLocal = local.length <= 2 ? "*".repeat(local.length) : `${local[0]}${"*".repeat(local.length - 2)}${local[local.length - 1]}`;
  return `${maskedLocal}@${domain}`;
}