import { redirect, notFound } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { sql } from "@/lib/db";
import PlayerDetailClient from "./PlayerDetailClient";

export const dynamic = "force-dynamic";

interface Params { player_id: string }

export default async function AcademyPlayerDetailPage({ params }: { params: Params }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect(`/auth/login?from=/academy/players/${params.player_id}`);
  if ((session.user as any).role !== "academy_admin") redirect("/dashboard");
  const adminUserId = (session.user as any).id as string;

  const aRows = (await sql`
    SELECT id, academy_name, logo_url FROM academies WHERE user_id = ${adminUserId} LIMIT 1
  `) as unknown as any[];
  if (!aRows[0]) redirect("/onboarding/academy");

  const playerRows = (await sql`
    SELECT pp.id, pp.user_id, pp.first_name, pp.last_name, pp.date_of_birth, pp.gender,
           pp.playing_role, pp.batting_style, pp.bowling_style,
           pp.city, pp.state, pp.district,
           pp.height_cm, pp.weight_kg,
           COALESCE(pp.verification_level, 1) AS verification_level,
           COALESCE(pp.profile_status, 'Draft') AS profile_status,
           pp.invite_token IS NOT NULL AS invite_sent,
           pp.invite_sent_at, pp.claimed_at,
           pp.academy_id, u.email
    FROM player_profiles pp
    LEFT JOIN users u ON u.id = pp.user_id
    WHERE pp.id = ${params.player_id} LIMIT 1
  `) as unknown as any[];
  const player = playerRows[0];
  if (!player || player.academy_id !== aRows[0].id) notFound();

  return (
    <PlayerDetailClient
      academy={{ id: aRows[0].id, name: aRows[0].academy_name }}
      adminName={(session.user as any).name ?? "Admin"}
      adminEmail={(session.user as any).email ?? ""}
      player={{
        id:                 player.id,
        user_id:            player.user_id,
        first_name:         player.first_name ?? "",
        last_name:          player.last_name ?? "",
        date_of_birth:      player.date_of_birth ?? null,
        gender:             player.gender ?? null,
        playing_role:       player.playing_role ?? null,
        batting_style:      player.batting_style ?? null,
        bowling_style:      player.bowling_style ?? null,
        city:               player.city ?? null,
        state:              player.state ?? null,
        district:           player.district ?? null,
        height_cm:          player.height_cm,
        weight_kg:          player.weight_kg,
        verification_level: Number(player.verification_level ?? 1),
        profile_status:     player.profile_status,
        invite_sent:        player.invite_sent,
        invite_sent_at:     player.invite_sent_at,
        claimed_at:         player.claimed_at,
        email:              player.email ?? null,
      }}
    />
  );
}
