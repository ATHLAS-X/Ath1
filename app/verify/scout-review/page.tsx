import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { sql } from "@/lib/db";
import ScoutReviewClient from "./ScoutReviewClient";

export default async function ScoutReviewPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/auth/login?from=/verify/scout-review");
  const userId = (session.user as any).id as string;

  const [profileRows, aadhaarRows, matchRows, requestRows] = await Promise.all([
    sql`SELECT verification_level, profile_status FROM player_profiles WHERE user_id = ${userId} LIMIT 1` as unknown as Promise<any[]>,
    sql`SELECT age_verified FROM aadhaar_verification WHERE user_id = ${userId} LIMIT 1` as unknown as Promise<any[]>,
    sql`SELECT COUNT(*)::int AS approved FROM match_logs WHERE user_id = ${userId} AND ocr_status = 'VERIFIED'` as unknown as Promise<any[]>,
    sql`
      SELECT id, status, evidence_metadata, created_at
      FROM verifications
      WHERE player_user_id = ${userId} AND verification_type = 'SCOUT'
      ORDER BY created_at DESC LIMIT 1
    ` as unknown as Promise<any[]>,
  ]);

  const aadhaarOk = (aadhaarRows as any[])[0]?.age_verified === true;
  const approvedScorecards = (matchRows as any[])[0]?.approved ?? 0;
  const performanceOk = approvedScorecards >= 3;
  const storedLevel = (profileRows as any[])[0]?.verification_level ?? 1;
  const derivedLevel = Math.max(1, aadhaarOk ? 2 : 1, performanceOk ? 3 : 1);
  const effectiveLevel = Math.max(storedLevel, derivedLevel);
  const existing = (requestRows as any[])[0] ?? null;

  return (
    <ScoutReviewClient
      level={effectiveLevel}
      identityVerified={aadhaarOk}
      performanceVerified={performanceOk}
      approvedScorecards={Number(approvedScorecards)}
      existingRequest={existing ? {
        id: existing.id,
        status: existing.status,
        note: existing.evidence_metadata?.note ?? "",
        submittedAt: new Date(existing.created_at).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }),
      } : null}
    />
  );
}
