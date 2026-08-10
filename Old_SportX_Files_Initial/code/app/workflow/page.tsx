import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import WorkflowClient from "./WorkflowClient";

export const dynamic = "force-dynamic";

export default async function WorkflowPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/auth/login?from=/workflow");
  const role = (session.user as any).role ?? "player";
  /* The page is informational — open to every authenticated user. We pass
     their role through so the back-to-dashboard link goes to the right
     surface. */
  const backHref =
    role === "athlasx_admin" ? "/admin"
    : role === "scout" ? "/scout/dashboard"
    : role === "academy_admin" ? "/dashboard/academy"
    : "/dashboard/player";
  return <WorkflowClient backHref={backHref} role={role} />;
}
