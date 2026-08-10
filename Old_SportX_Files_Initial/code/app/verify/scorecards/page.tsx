import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { sql } from "@/lib/db";
import ScorecardsClient from "./ScorecardsClient";

export default async function ScorecardsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/auth/login?from=/verify/scorecards");
  const userId = (session.user as any).id as string;

  const [matchRows, aadhaarRows] = await Promise.all([
    sql`
      SELECT id, opponent, match_date, format, competition_level, mqi_tag,
             runs_scored, wickets_taken, ocr_status, created_at
      FROM match_logs
      WHERE user_id = ${userId}
      ORDER BY match_date DESC, created_at DESC
    ` as unknown as Promise<any[]>,
    sql`SELECT age_verified FROM aadhaar_verification WHERE user_id = ${userId} LIMIT 1` as unknown as Promise<any[]>,
  ]);

  const aadhaarOk = (aadhaarRows as any[])[0]?.age_verified === true;

  return (
    <ScorecardsClient
      identityVerified={aadhaarOk}
      initialMatches={(matchRows as any[]).map((m) => ({
        id: m.id,
        title: m.competition_level
          ? `${m.competition_level} — vs ${m.opponent}`
          : `vs ${m.opponent}`,
        submitted: new Date(m.created_at).toLocaleDateString("en-IN", { day: "2-digit", month: "short" }),
        fmt: m.format,
        runs: m.runs_scored ?? 0,
        wickets: m.wickets_taken ?? 0,
        status: m.ocr_status === "VERIFIED" ? "Approved"
              : m.ocr_status === "MANUAL_REVIEW" ? "Pending"
              : m.ocr_status === "REJECTED" ? "Rejected" : "Pending",
      }))}
    />
  );
}
