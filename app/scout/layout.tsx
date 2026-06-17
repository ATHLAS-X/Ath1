import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export default async function ScoutLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/auth/login");
  const role = (session.user as any).role;
  if (role !== "scout") redirect("/dashboard");
  return <>{children}</>;
}
