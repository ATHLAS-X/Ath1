import { sql } from "@/lib/db";
import { ageFromDob, ok, requireUserId } from "@/lib/onboarding-server";

export async function GET() {
  const guard = await requireUserId();
  if (guard instanceof Response) return guard;

  const rows = (await sql`
    SELECT verified_dob FROM aadhaar_verification
    WHERE user_id = ${guard.userId}
    ORDER BY created_at DESC LIMIT 1
  `) as unknown as Array<{ verified_dob: string | Date | null }>;

  if (!rows[0]?.verified_dob) return ok({ isMinor: false, age: null, verifiedDob: null });
  const age = ageFromDob(rows[0].verified_dob as any);
  return ok({ isMinor: age < 18, age, verifiedDob: rows[0].verified_dob });
}
