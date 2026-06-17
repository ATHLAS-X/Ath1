import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { sql } from "@/lib/db";
import AcademyOnboardingWizard from "./AcademyOnboardingWizard";

export const dynamic = "force-dynamic";

export default async function AcademyOnboardingPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/auth/login?from=/academy/onboarding");
  if ((session.user as any).role !== "academy_admin") redirect("/dashboard");
  const userId = (session.user as any).id as string;

  const aRows = (await sql`
    SELECT id, academy_name, logo_url, profile_status,
           COALESCE(onboarding_step, 1) AS onboarding_step,
           onboarding_completed_at
    FROM academies WHERE user_id = ${userId} LIMIT 1
  `) as unknown as any[];
  const a = aRows[0];

  /* No academy row yet → admin must finish the basic profile first. */
  if (!a) redirect("/onboarding/academy");

  /* Onboarding complete → straight to the new academy-admin dashboard. */
  if (a.onboarding_completed_at) redirect("/academy/dashboard");

  const [coachCountRows, playerCountRows] = await Promise.all([
    sql`SELECT COUNT(*)::int AS n FROM academy_coaches WHERE academy_id = ${a.id}` as unknown as Promise<any[]>,
    sql`SELECT COUNT(*)::int AS n FROM player_profiles WHERE academy_id = ${a.id} AND source_channel = 'Academy'` as unknown as Promise<any[]>,
  ]);

  return (
    <AcademyOnboardingWizard
      academyName={a.academy_name}
      logoUrl={a.logo_url ?? null}
      startStep={Math.max(1, Math.min(4, a.onboarding_step ?? 1))}
      initialCoachCount={coachCountRows[0]?.n ?? 0}
      initialPlayerCount={playerCountRows[0]?.n ?? 0}
    />
  );
}
