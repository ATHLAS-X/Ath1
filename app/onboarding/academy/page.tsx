import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import AcademyProfileForm from "./AcademyProfileForm";

export default async function AcademyOnboardingPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/auth/login?from=/onboarding/academy");
  if ((session.user as any).role !== "academy_admin") redirect("/dashboard");
  return <AcademyProfileForm userName={(session.user as any).name ?? "Academy Admin"} />;
}
