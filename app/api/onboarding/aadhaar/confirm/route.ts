import { sql } from "@/lib/db";
import { advanceStep } from "@/lib/onboarding";
import { ageFromDob, fail, ok, requireUserId } from "@/lib/onboarding-server";

// TODO: Production — Surepass confirm-OTP:
//   POST https://kyc-api.surepass.io/api/v1/aadhaar-v2/submit-otp
//   Body: { client_id, otp }
//   Response includes full Aadhaar JSON; extract DOB, name, masked number.
//   Discrepancy check: compare profile DOB with verified_dob; flag if delta > 180 days.

export async function POST(req: Request) {
  const guard = await requireUserId();
  if (guard instanceof Response) return guard;

  let body: any;
  try { body = await req.json(); } catch { return fail("Invalid JSON"); }
  const aadhaar = String(body?.aadhaar ?? "").replace(/\D/g, "");
  const otp = String(body?.otp ?? "").trim();
  const declaredDob = body?.declared_dob ? String(body.declared_dob) : null;
  if (aadhaar.length !== 12) return fail("Aadhaar must be 12 digits");
  if (!/^\d{6}$/.test(otp)) return fail("OTP must be 6 digits");

  // MVP: simulate a verified DOB. Default = 17 years ago today so the minor
  // flow is exercisable; caller may pass `simulated_dob` to override.
  const sim = body?.simulated_dob ? new Date(String(body.simulated_dob)) : null;
  const verifiedDob = sim && !isNaN(sim.getTime())
    ? sim
    : new Date(new Date().setFullYear(new Date().getFullYear() - 17));
  const masked = `XXXX-XXXX-${aadhaar.slice(-4)}`;
  const token = `mvp_${aadhaar.slice(-4)}_${Date.now()}`;

  // Discrepancy: > 6 months between declared and verified DOB.
  let discrepancy = false;
  if (declaredDob) {
    const decl = new Date(declaredDob);
    if (!isNaN(decl.getTime())) {
      const months = Math.abs(verifiedDob.getTime() - decl.getTime()) / (1000 * 60 * 60 * 24 * 30);
      discrepancy = months > 6;
    }
  }

  const age = ageFromDob(verifiedDob);
  const pts = 3;

  // Upsert by user (latest row wins; we just delete previous attempts).
  await sql`DELETE FROM aadhaar_verification WHERE user_id = ${guard.userId}`;
  await sql`
    INSERT INTO aadhaar_verification
      (user_id, masked_aadhaar, verified_dob, age_verified, aadhaar_token, discrepancy_flag, verification_pts)
    VALUES
      (${guard.userId}, ${masked}, ${verifiedDob.toISOString().slice(0,10)}, true, ${token}, ${discrepancy}, ${pts})
  `;
  /* Bump verification ladder to L2 (Identity Verified) — only if it's lower,
     since L3/L4 are stricter and shouldn't be downgraded by a re-verify. */
  await sql`
    UPDATE player_profiles
    SET verification_level = GREATEST(COALESCE(verification_level, 1), 2),
        updated_at = NOW()
    WHERE user_id = ${guard.userId}
  `;

  // Auto-flag rule: same masked Aadhaar used by another account ⇒ DUPLICATE_AADHAAR.
  const dupes = (await sql`
    SELECT user_id FROM aadhaar_verification
    WHERE masked_aadhaar = ${masked} AND user_id <> ${guard.userId}
    LIMIT 1
  `) as unknown as Array<{ user_id: string }>;
  if (dupes.length) {
    await sql`
      INSERT INTO fraud_flags (user_id, affected_user_id, affected_account_type, flag_type, reason, flagged_reason)
      VALUES (${guard.userId}, ${guard.userId}, 'player', 'DUPLICATE_AADHAAR',
              ${`Aadhaar ${masked} previously verified by another account.`},
              ${`Aadhaar ${masked} previously verified by another account.`})
    `;
  }
  // Auto-flag rule: declared vs verified DOB > 6 months ⇒ AGE_DISCREPANCY.
  if (discrepancy) {
    await sql`
      INSERT INTO fraud_flags (user_id, affected_user_id, affected_account_type, flag_type, reason, flagged_reason)
      VALUES (${guard.userId}, ${guard.userId}, 'player', 'AGE_DISCREPANCY',
              'Declared DOB differs from verified Aadhaar DOB by more than 6 months.',
              'Declared DOB differs from verified Aadhaar DOB by more than 6 months.')
    `;
  }

  const state = await advanceStep(guard.userId, 2);
  return ok({
    masked_aadhaar: masked,
    verified_dob: verifiedDob.toISOString().slice(0,10),
    age,
    is_minor: age < 18,
    discrepancy_flag: discrepancy,
    verification_pts: pts,
    onboarding: state,
  });
}
