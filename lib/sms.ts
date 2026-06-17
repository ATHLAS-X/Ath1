/**
 * SMS provider stub. Replace with Twilio / MSG91 / etc. in production.
 *
 * In dev we log to the server console — the OTP is also surfaced in the
 * /api/auth/otp/send response when NODE_ENV !== 'production' so the test
 * harness and curl users can grab it.
 */
export async function sendSms(to: string, message: string): Promise<{ delivered: boolean }> {
  // eslint-disable-next-line no-console
  console.log(`\n[SMS STUB] → ${to}\n           ${message}\n`);
  return { delivered: true };
}
