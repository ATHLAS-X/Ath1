/**
 * Email stub. Replace with Resend / SES / Postmark in production.
 * Dev mode logs to the server console — the body and subject are visible
 * in the npm-run-dev terminal.
 */
export async function sendEmail(params: {
  to: string;
  subject: string;
  body: string;
}): Promise<{ delivered: boolean }> {
  // eslint-disable-next-line no-console
  console.log(
    `\n[EMAIL STUB] → ${params.to}\n             ${params.subject}\n` +
      params.body
        .split("\n")
        .map((l) => "             " + l)
        .join("\n") +
      "\n",
  );
  return { delivered: true };
}
