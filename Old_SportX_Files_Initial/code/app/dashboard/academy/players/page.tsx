import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { sql } from "@/lib/db";
import BulkUploadClient from "./BulkUploadClient";

export default async function AcademyPlayersPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/auth/login?from=/dashboard/academy/players");
  if ((session.user as any).role !== "academy_admin") redirect("/dashboard");
  const adminId = (session.user as any).id as string;

  const [academyRows, inviteRows] = await Promise.all([
    sql`SELECT id, academy_name, profile_status FROM academies WHERE user_id = ${adminId} LIMIT 1` as unknown as Promise<any[]>,
    sql`
      SELECT i.id, i.invited_name, i.email, i.phone, i.status, i.sent_at, i.claimed_at,
             pp.first_name, pp.last_name
      FROM player_invites i
      LEFT JOIN player_profiles pp ON pp.id = i.player_profile_id
      JOIN academies a ON a.id = i.academy_id
      WHERE a.user_id = ${adminId}
      ORDER BY i.created_at DESC
      LIMIT 50
    ` as unknown as Promise<any[]>,
  ]);

  const academy = (academyRows as any[])[0];
  if (!academy) redirect("/onboarding/academy");

  return (
    <BulkUploadClient
      academyName={academy.academy_name}
      academyStatus={academy.profile_status ?? "Draft"}
      recentInvites={inviteRows as any[]}
    />
  );
}
