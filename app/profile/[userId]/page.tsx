import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { loadDashboardData, loadDashboardUser } from "@/lib/dashboard-loader";
import { canViewPlayerProfile } from "@/lib/authz";
import PlayerProfileClient from "./PlayerProfileClient";
import DashboardSkeleton from "@/components/dashboard/DashboardSkeleton";

interface Props {
  params: { userId: string };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  try {
    const user = await loadDashboardUser(params.userId);
    if (!user) return { title: "Player | AthlasX" };
    return { title: `${user.name} | AthlasX` };
  } catch {
    return { title: "Player | AthlasX" };
  }
}

async function ProfileLoader({ userId }: { userId: string }) {
  const session = await getServerSession(authOptions);
  const viewerId = (session?.user as any)?.id;
  const viewerRole = (session?.user as any)?.role;
  const isOwner = viewerId === userId;

  let data: any = null;
  try {
    data = await loadDashboardData(userId, isOwner);
  } catch {
    /* DB error — render empty shell rather than crashing */
  }

  if (!data) {
    /* We couldn't load the profile row, so there's no visibility value to
       check. Fail closed for non-owners rather than showing a bare shell to
       a viewer we can't authorize — only the owner gets the empty-shell
       fallback (verified entirely from the session, no DB needed). */
    if (!isOwner) notFound();

    const emptyData = {
      user: { id: userId, name: "Player" },
      profile: null, cricket: null, performance: [],
      matches: [], fitness: null, behaviour: null,
      video: null, score: null, aadhaar: null,
      guardian: null, coach: null, isOwner,
    };
    return (
      <PlayerProfileClient
        userId={userId}
        data={emptyData}
        viewerRole={viewerRole}
        viewerId={viewerId}
      />
    );
  }

  /* 404, not 403 — don't reveal whether a hidden/private profile exists. */
  if (!canViewPlayerProfile(session, { visibility: data.profile?.visibility ?? null, user_id: userId })) {
    notFound();
  }

  return (
    <PlayerProfileClient
      userId={userId}
      data={data}
      viewerRole={viewerRole}
      viewerId={viewerId}
    />
  );
}

export default function PlayerProfilePage({ params }: Props) {
  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <ProfileLoader userId={params.userId} />
    </Suspense>
  );
}
