import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { sql } from "@/lib/db";
import CoachOnboardingWizard from "@/components/onboarding/coach/CoachOnboardingWizard";

export const dynamic = "force-dynamic";

export default async function CoachOnboardingPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/auth/login?from=/onboarding/coach");

  const role = (session.user as any).role as string;
  if (role !== "coach" && role !== "COACH") redirect("/dashboard");

  const userId = (session.user as any).id as string;

  // Load resume step from coach_profiles if it exists
  let initialStep = 0;
  try {
    const raw = (q: string, p: unknown[]) =>
      (sql as unknown as (q: string, p: unknown[]) => Promise<any[]>)(q, p);
    const rows = await raw(
      `SELECT onboarding_step, onboarding_complete FROM coach_profiles WHERE user_id = $1 LIMIT 1`,
      [userId],
    );
    if (rows[0]) {
      if (rows[0].onboarding_complete) redirect("/dashboard/coach");
      initialStep = Math.max(0, (rows[0].onboarding_step ?? 1) - 1);
    }
  } catch {
    // coach_profiles table may not exist yet — wizard will create it on first save
  }

  return <CoachOnboardingWizard initialStep={initialStep} />;
}
