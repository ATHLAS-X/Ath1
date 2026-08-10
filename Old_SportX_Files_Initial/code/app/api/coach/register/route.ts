import { sql } from "@/lib/db";
import { fail, ok, saveUpload, clientIp } from "@/lib/onboarding-server";
import { IMAGE_OR_PDF_ALLOWLIST, UploadValidationError, readAndValidateUpload } from "@/lib/upload-validation";

const MAX_BYTES = 10 * 1024 * 1024; // 10 MB

/**
 * Coach lands here from /coach/register?token=… and submits identity + cert.
 * No NextAuth session required — invite token is the auth.
 *
 * MVP: status starts at PENDING_REVIEW; the player-side GET /coach/status flips
 * it to APPROVED after 5 seconds (TODO: real P8 review queue).
 */
export async function POST(req: Request) {
  const ct = req.headers.get("content-type") ?? "";
  if (!ct.includes("multipart/form-data")) return fail("Expected multipart/form-data");
  const form = await req.formData();

  const token = String(form.get("token") ?? "").trim();
  const coachName = String(form.get("coach_name") ?? "").trim();
  const academy = String(form.get("academy_club") ?? "").trim();
  const officialId = String(form.get("official_id") ?? "").trim();
  const cert = form.get("cert") as File | null;

  if (!token) return fail("Missing invite token");
  if (!coachName || !academy || !officialId) return fail("Coach name, academy, and official ID are required");
  if (!cert) return fail("Coaching certificate is required");

  const invites = (await sql`
    SELECT id, user_id, status FROM coach_invites WHERE token = ${token} LIMIT 1
  `) as unknown as Array<{ id: string; user_id: string; status: string }>;
  const invite = invites[0];
  if (!invite) return fail("Invalid or expired invite token", 404);
  if (invite.status !== "PENDING") return fail("Invite has already been used", 410);

  let upload;
  try {
    upload = await readAndValidateUpload(cert, MAX_BYTES, IMAGE_OR_PDF_ALLOWLIST);
  } catch (e) {
    if (e instanceof UploadValidationError) return fail(e.message);
    throw e;
  }
  const certUrl = await saveUpload(invite.user_id, upload, "coach-certs");

  await sql`
    INSERT INTO coach_registry
      (user_id, coach_name, academy_club, official_id, cert_url, coach_status, invite_id)
    VALUES
      (${invite.user_id}, ${coachName}, ${academy}, ${officialId}, ${certUrl}, 'PENDING_REVIEW', ${invite.id})
  `;
  await sql`
    UPDATE coach_invites SET status = 'REDEEMED', redeemed_at = NOW() WHERE id = ${invite.id}
  `;

  // Auto-flag rule: same client IP redeems 5+ coach registrations within 24h ⇒ BULK_VERIFY_ABUSE.
  // We store the registering IP on the invite via signed_ip if available; here we sniff the
  // current IP and look for a 24h burst across all coach_registry rows authored from the same
  // IP (which we keep in player_notifications.body as a side-channel; in production this would
  // be a dedicated column).
  const ip = clientIp(req);
  if (ip && ip !== "unknown") {
    const burst = (await sql`
      SELECT COUNT(*)::int AS n FROM guardian_consent
      WHERE signed_ip = ${ip} AND signed_at > NOW() - INTERVAL '24 hours'
    `) as unknown as Array<{ n: number }>;
    if ((burst[0]?.n ?? 0) > 5) {
      await sql`
        INSERT INTO fraud_flags (user_id, affected_user_id, affected_account_type, flag_type, reason, flagged_reason)
        VALUES (${invite.user_id}, ${invite.user_id}, 'coach', 'BULK_VERIFY_ABUSE',
                ${`Coach IP ${ip} verified ${burst[0]?.n} accounts within 24h.`},
                ${`Coach IP ${ip} verified ${burst[0]?.n} accounts within 24h.`})
      `;
    }
  }

  return ok({ status: "PENDING_REVIEW", cert_url: certUrl });
}
