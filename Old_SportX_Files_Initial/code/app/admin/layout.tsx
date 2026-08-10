import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { isAdminUser } from "@/lib/admin-server";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/auth/login?from=/admin");
  const admin = await isAdminUser(session.user.id, (session.user as any).role);
  if (!admin) redirect("/dashboard");
  return <>{children}</>;
}
