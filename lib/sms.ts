/**
 * SMS provider stub. Replace with Twilio / MSG91 / etc. in production.
 *
 * In dev the OTP is surfaced in the /api/auth/otp/send response (when
 * NODE_ENV !== 'production') so the test harness and curl users can grab it
 * from there. The console log here must NOT echo `message` — for OTP sends
 * the message body literally contains the plaintext code, so logging it is
 * equivalent to logging the secret itself. Phone number is masked too.
 */
export async function sendSms(to: string, message: string): Promise<{ delivered: boolean }> {
  // eslint-disable-next-line no-console
  console.log(`[SMS STUB] sent to ${maskPhone(to)} (${message.length} chars)`);
  return { delivered: true };
}

function maskPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.length <= 4) return "*".repeat(digits.length);
  return `${"*".repeat(digits.length - 4)}${digits.slice(-4)}`;
}
