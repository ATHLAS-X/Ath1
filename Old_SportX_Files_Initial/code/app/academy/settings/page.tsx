import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import AcademyStubShell from "../_components/AcademyStubShell";

export const dynamic = "force-dynamic";

export default async function AcademySettingsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/auth/login?from=/academy/settings");
  if ((session.user as any).role !== "academy_admin") redirect("/dashboard");

  return (
    <AcademyStubShell
      title="Settings"
      sub="Academy profile, branding, billing"
      desc="Update your academy name, contact details, logo, and notification preferences."
      note="UI coming next — the underlying APIs (/api/academy/profile, /api/academy/logo) are already live."
    />
  );
}
