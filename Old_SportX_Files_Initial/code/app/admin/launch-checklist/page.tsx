import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { isAdminUser } from "@/lib/admin-server";
import LaunchChecklist from "@/components/admin/LaunchChecklist";

export const dynamic = "force-dynamic";

export default async function LaunchChecklistPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/auth/login?from=/admin/launch-checklist");
  const admin = await isAdminUser(session.user.id);
  if (!admin) redirect("/dashboard");
  return <LaunchChecklist />;
}
