import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import PlayerProfileWizard from "./PlayerProfileWizard";

export default async function PlayerOnboardingPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/auth/login?from=/onboarding/player");
  if ((session.user as any).role !== "player") redirect("/dashboard");
  return <PlayerProfileWizard userName={(session.user as any).name ?? "Player"} />;
}
