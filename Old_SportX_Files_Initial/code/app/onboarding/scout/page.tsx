import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { sql } from "@/lib/db";
import ScoutOnboardingWizard from "./ScoutOnboardingWizard";

export const dynamic = "force-dynamic";

export default async function ScoutOnboardingPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/auth/login?from=/onboarding/scout");
  if ((session.user as any).role !== "scout") redirect("/dashboard");

  const userId = (session.user as any).id as string;
  const rows = (await sql`
    SELECT designation, organization_name, org_type, region, years_experience, proof_url,
           preferred_age_groups, preferred_roles, preferred_regions,
           verification_level, profile_status, submitted_at
    FROM scout_profiles WHERE user_id = ${userId} LIMIT 1
  `) as unknown as any[];
  const profile = rows[0] ?? null;

  return (
    <ScoutOnboardingWizard
      initial={{
        designation:          profile?.designation ?? "",
        organization_name:    profile?.organization_name ?? "",
        org_type:             profile?.org_type ?? "",
        region:               profile?.region ?? "",
        years_experience:     profile?.years_experience ?? null,
        proof_url:            profile?.proof_url ?? "",
        preferred_age_groups: profile?.preferred_age_groups ?? [],
        preferred_roles:      profile?.preferred_roles ?? [],
        preferred_regions:    profile?.preferred_regions ?? [],
      }}
      profileStatus={profile?.profile_status ?? "Draft"}
      verificationLevel={profile?.verification_level ?? "L0"}
      userName={(session.user as any).name ?? "Scout"}
      userEmail={(session.user as any).email ?? ""}
    />
  );
}
