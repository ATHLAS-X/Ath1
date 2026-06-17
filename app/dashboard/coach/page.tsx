import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { loadCoachDashboard } from "@/lib/dashboard-data";
import CoachDashboardClient from "./CoachDashboardClient";

export const dynamic = "force-dynamic";

export default async function CoachDashboardPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/auth/login?from=/dashboard/coach");
  const role = (session.user as any).role as string | undefined;
  if (role !== "coach") redirect("/dashboard");

  const userId = (session.user as any).id as string;
  const data = await loadCoachDashboard(userId);

  return <CoachDashboardClient data={data} />;
}
