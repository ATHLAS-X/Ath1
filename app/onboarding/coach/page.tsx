import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { sql } from "@/lib/db";
import CoachOnboardingWizard from "./CoachOnboardingWizard";

export const dynamic = "force-dynamic";

export default async function CoachOnboardingPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/auth/login?from=/onboarding/coach");
  if ((session.user as any).role !== "coach") redirect("/dashboard");

  const userId = (session.user as any).id as string;
  const rows = (await sql`
    SELECT coach_name, academy_club, official_id, cert_url, coach_status
    FROM coach_registry WHERE user_id = ${userId} LIMIT 1
  `) as unknown as any[];
  const profile = rows[0] ?? null;

  return (
    <CoachOnboardingWizard
      initial={{
        coach_name:   profile?.coach_name   ?? (session.user as any).name ?? "",
        academy_club: profile?.academy_club ?? "",
        official_id:  profile?.official_id  ?? "",
        cert_url:     profile?.cert_url     ?? "",
      }}
      coachStatus={profile?.coach_status ?? "DRAFT"}
      userName={(session.user as any).name ?? "Coach"}
      userEmail={(session.user as any).email ?? ""}
    />
  );
}
