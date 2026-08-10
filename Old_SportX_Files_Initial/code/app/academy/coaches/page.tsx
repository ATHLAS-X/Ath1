import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { sql } from "@/lib/db";
import CoachesClient from "./CoachesClient";

export const dynamic = "force-dynamic";

export default async function AcademyCoachesPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/auth/login?from=/academy/coaches");
  if ((session.user as any).role !== "academy_admin") redirect("/dashboard");
  const userId = (session.user as any).id as string;

  const aRows = (await sql`
    SELECT id, academy_name, logo_url FROM academies WHERE user_id = ${userId} LIMIT 1
  `) as unknown as any[];
  if (!aRows[0]) redirect("/onboarding/academy");

  return (
    <CoachesClient
      academyName={aRows[0].academy_name}
      adminName={(session.user as any).name ?? "Admin"}
      adminEmail={(session.user as any).email ?? ""}
    />
  );
}
