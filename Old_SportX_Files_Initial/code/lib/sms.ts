/**
 * SMS provider stub. No real gateway is wired up yet — see the unchecked
 * "MSG91 SMS gateway wired" item in docs/TEAM_WORKING_AGREEMENT.md. Replace
 * the body below with a real Twilio / MSG91 / etc. call when that lands.
 *
 * In dev the OTP is surfaced in the /api/auth/otp/send response (when
 * NODE_ENV !== 'production') so the test harness and curl users can grab it
 * from there. The console log here must NOT echo `message` — for OTP sends
 * the message body literally contains the plaintext code, so logging it is
 * equivalent to logging the secret itself. Phone number is masked too.
 *
 * Production guard: without this, a real deploy would silently "succeed"
 * at sending SMS that never actually go out, with no signal to anyone that
 * the gateway isn't connected. Throwing here instead surfaces the gap
 * immediately (as a 500 from the calling route) instead of masking it.
 */
export async function sendSms(to: string, message: string): Promise<{ delivered: boolean }> {
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "SMS gateway not configured — lib/sms.ts is still the dev stub. " +
      "Wire up MSG91/Twilio before relying on SMS delivery in production.",
    );
  }
  // eslint-disable-next-line no-console
  console.log(`[SMS STUB] sent to ${maskPhone(to)} (${message.length} chars)`);
  return { delivered: true };
}

function maskPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.length <= 4) return "*".repeat(digits.length);
  return `${"*".repeat(digits.length - 4)}${digits.slice(-4)}`;
}
