import { randomBytes } from "node:crypto";
import { sql } from "@/lib/db";
import { advanceStep } from "@/lib/onboarding";
import { fail, ok, requireUserId } from "@/lib/onboarding-server";

function token() {
  return randomBytes(20).toString("hex");
}

export async function POST(req: Request) {
  const guard = await requireUserId();
  if (guard instanceof Response) return guard;
  let body: any;
  try { body = await req.json(); } catch { return fail("Invalid JSON"); }

  const coachName = String(body?.coach_name ?? "").trim();
  const email = String(body?.coach_email ?? "").trim().toLowerCase();
  const phone = String(body?.coach_phone ?? "").replace(/\D/g, "");
  if (!coachName) return fail("Coach name is required");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return fail("Coach email is invalid");

  const inviteToken = token();
  const base = process.env.NEXTAUTH_URL ?? "http://localhost:3000";
  const inviteUrl = `${base}/coach/register?token=${inviteToken}`;

  await sql`
    INSERT INTO coach_invites (user_id, coach_name, coach_email, coach_phone, token, status)
    VALUES (${guard.userId}, ${coachName}, ${email}, ${phone || null}, ${inviteToken}, 'PENDING')
  `;

  // MVP: log instead of sending an email.
  // TODO: production — send via SES / nodemailer with a templated invite.
  console.log(`[coach.invite] To: ${email}  Coach: ${coachName}  Link: ${inviteUrl}`);

  const state = await advanceStep(guard.userId, 10);
  return ok({ invite_url: inviteUrl, status: "PENDING", onboarding: state });
}
