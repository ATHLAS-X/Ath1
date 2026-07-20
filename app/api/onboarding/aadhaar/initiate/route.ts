import bcrypt from "bcryptjs";
import { sql } from "@/lib/db";
import { fail, ok, requireUserId } from "@/lib/onboarding-server";
import { rateLimit, rateLimitResponse } from "@/lib/rate-limit";

const OTP_TTL_SECONDS = 10 * 60;

// TODO: Production should call Surepass Aadhaar OTP API:
//   POST https://kyc-api.surepass.io/api/v1/aadhaar-v2/generate-otp
//   Headers: Authorization: Bearer <SUREPASS_TOKEN>
//   Body: { id_number: "<12-digit-aadhaar>" }
//   Response: { client_id: "...", message: "OTP sent" }
//   Persist client_id server-side keyed by (userId, aadhaar) so confirm() can reference it.

export async function POST(req: Request) {
  const guard = await requireUserId();
  if (guard instanceof Response) return guard;

  const limit = await rateLimit("aadhaar-initiate", guard.userId, 5, 60 * 60);
  if (!limit.success) return rateLimitResponse(limit);

  let body: any;
  try { body = await req.json(); } catch { return fail("Invalid JSON"); }
  const raw = String(body?.aadhaar ?? "").replace(/\D/g, "");
  if (raw.length !== 12) return fail("Aadhaar must be 12 digits");

  /* 6-digit code, stored hashed; consumer (confirm) compares with bcrypt.
     Only the last 4 digits of the Aadhaar number are persisted — never the
     full number. */
  const code = String(Math.floor(100000 + Math.random() * 900000));
  const code_hash = await bcrypt.hash(code, 8);
  const expires_at = new Date(Date.now() + OTP_TTL_SECONDS * 1000);
  const last4 = raw.slice(-4);

  await sql`
    UPDATE aadhaar_otps SET consumed_at = NOW()
    WHERE user_id = ${guard.userId} AND consumed_at IS NULL
  `;
  await sql`
    INSERT INTO aadhaar_otps (user_id, aadhaar_last4, code_hash, expires_at)
    VALUES (${guard.userId}, ${last4}, ${code_hash}, ${expires_at.toISOString()})
  `;

  // MVP: pretend an OTP was sent over the Aadhaar-linked mobile via Surepass.
  // Never log the Aadhaar number — masked or otherwise.
  const payload: Record<string, unknown> = { message: "OTP sent to Aadhaar-linked mobile" };
  if (process.env.NODE_ENV !== "production") payload.dev_otp = code;
  return ok(payload);
}
