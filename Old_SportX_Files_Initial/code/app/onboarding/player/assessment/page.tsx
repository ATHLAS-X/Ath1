import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import PsychAssessmentForm from "@/components/onboarding/PsychAssessmentForm";

export const metadata = {
  title: "Cricket Development Profile | AthlasX",
  description: "Complete the ACSI-28 psychological assessment to unlock personalised development insights.",
};

export default async function AssessmentPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    redirect("/auth/login");
  }

  const userName = session.user.name ?? session.user.email ?? "Player";

  return <PsychAssessmentForm userName={userName} />;
}
