import { Resend } from "resend";

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

const FROM_ADDRESS = process.env.EMAIL_FROM ?? "AthlasX <noreply@athlasx.in>";
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

export async function sendEmail(params: {
  to: string;
  subject: string;
  body: string;
  html?: string;
}): Promise<{ delivered: boolean }> {
  if (!resend) {
    // Dev fallback — logs to terminal when RESEND_API_KEY is not set
    console.log(
      `\n[EMAIL] → ${params.to}\n         ${params.subject}\n` +
        params.body.split("\n").map((l) => "         " + l).join("\n") + "\n",
    );
    return { delivered: true };
  }

  const { error } = await resend.emails.send({
    from: FROM_ADDRESS,
    to: params.to,
    subject: params.subject,
    html: params.html ?? `<pre style="font-family:sans-serif">${params.body}</pre>`,
    text: params.body,
  });

  if (error) {
    console.error("[email] Resend error:", error);
    return { delivered: false };
  }
  return { delivered: true };
}

// ── Typed email helpers ────────────────────────────────────────────────────

export async function sendVerificationEmail(params: {
  to: string;
  name: string;
  token: string;
}): Promise<{ delivered: boolean }> {
  const link = `${APP_URL}/api/auth/verify-email?token=${params.token}`;
  return sendEmail({
    to: params.to,
    subject: "Verify your AthlasX email address",
    body: `Hi ${params.name},\n\nPlease verify your email to activate your AthlasX account:\n\n${link}\n\nThis link expires in 24 hours.\n\nIf you did not create an account, ignore this email.`,
    html: `
      <div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:32px">
        <h2 style="color:#1e293b">Verify your email</h2>
        <p style="color:#475569">Hi ${params.name},</p>
        <p style="color:#475569">Please verify your email address to activate your AthlasX account.</p>
        <a href="${link}"
           style="display:inline-block;margin:24px 0;padding:12px 28px;background:#2563eb;color:#fff;border-radius:6px;text-decoration:none;font-weight:600">
          Verify email address
        </a>
        <p style="color:#94a3b8;font-size:13px">This link expires in 24 hours.<br>If you did not create an account, ignore this email.</p>
        <hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0">
        <p style="color:#94a3b8;font-size:12px">AthlasX · India's cricket talent platform</p>
      </div>`,
  });
}

export async function sendCoachInviteEmail(params: {
  to: string;
  coachName: string;
  inviteUrl: string;
  adminName: string;
}): Promise<{ delivered: boolean }> {
  return sendEmail({
    to: params.to,
    subject: "You've been invited to join AthlasX as a coach",
    body: `Hi ${params.coachName},\n\n${params.adminName} has invited you to join AthlasX as a verified coach.\n\nComplete your registration here: ${params.inviteUrl}\n\nIf you did not expect this invitation, ignore this email.`,
    html: `
      <div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:32px">
        <h2 style="color:#1e293b">Coach invitation</h2>
        <p style="color:#475569">Hi ${params.coachName},</p>
        <p style="color:#475569">${params.adminName} has invited you to join AthlasX as a verified coach.</p>
        <a href="${params.inviteUrl}"
           style="display:inline-block;margin:24px 0;padding:12px 28px;background:#2563eb;color:#fff;border-radius:6px;text-decoration:none;font-weight:600">
          Complete registration
        </a>
        <p style="color:#94a3b8;font-size:13px">If you did not expect this invitation, ignore this email.</p>
        <hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0">
        <p style="color:#94a3b8;font-size:12px">AthlasX · India's cricket talent platform</p>
      </div>`,
  });
}

export async function sendPlayerInviteEmail(params: {
  to: string;
  playerName: string;
  academyName: string;
  claimUrl: string;
}): Promise<{ delivered: boolean }> {
  return sendEmail({
    to: params.to,
    subject: `${params.academyName} has created an AthlasX profile for you`,
    body: `Hi ${params.playerName},\n\n${params.academyName} has created an AthlasX player profile for you.\n\nClaim it here: ${params.claimUrl}\n\nYou'll fill in any missing details and submit for approval.`,
    html: `
      <div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:32px">
        <h2 style="color:#1e293b">Your AthlasX profile is ready</h2>
        <p style="color:#475569">Hi ${params.playerName},</p>
        <p style="color:#475569">${params.academyName} has created a player profile for you on AthlasX.</p>
        <a href="${params.claimUrl}"
           style="display:inline-block;margin:24px 0;padding:12px 28px;background:#2563eb;color:#fff;border-radius:6px;text-decoration:none;font-weight:600">
          Claim your profile
        </a>
        <p style="color:#94a3b8;font-size:13px">You'll be able to fill in your details and submit for scout review.</p>
        <hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0">
        <p style="color:#94a3b8;font-size:12px">AthlasX · India's cricket talent platform</p>
      </div>`,
  });
}

export async function sendPasswordResetEmail(params: {
  to: string;
  name: string;
  resetUrl: string;
}): Promise<{ delivered: boolean }> {
  return sendEmail({
    to: params.to,
    subject: "Reset your AthlasX password",
    body: `Hi ${params.name},\n\nReset your password here: ${params.resetUrl}\n\nThis link expires in 1 hour.\n\nIf you did not request a reset, ignore this email.`,
    html: `
      <div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:32px">
        <h2 style="color:#1e293b">Reset your password</h2>
        <p style="color:#475569">Hi ${params.name},</p>
        <p style="color:#475569">Click below to reset your AthlasX password. This link expires in 1 hour.</p>
        <a href="${params.resetUrl}"
           style="display:inline-block;margin:24px 0;padding:12px 28px;background:#dc2626;color:#fff;border-radius:6px;text-decoration:none;font-weight:600">
          Reset password
        </a>
        <p style="color:#94a3b8;font-size:13px">If you did not request this, ignore this email — your password will not change.</p>
        <hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0">
        <p style="color:#94a3b8;font-size:12px">AthlasX · India's cricket talent platform</p>
      </div>`,
  });
}
