import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { isAdminUser } from "@/lib/admin-server";
import { sql } from "@/lib/db";
import UsersClient from "./UsersClient";

export const dynamic = "force-dynamic";

export default async function AdminUsersPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/auth/login?from=/admin/users");
  const admin = await isAdminUser(session.user.id);
  if (!admin) redirect("/dashboard");

  let users: any[] = [];
  try {
    users = (await sql`
      SELECT u.id, u.name, u.email, u.role,
             COALESCE(u.account_status, 'pending') AS account_status,
             u.created_at, u.phone, u.phone_verified_at
      FROM users u
      ORDER BY u.created_at DESC
      LIMIT 100
    `) as unknown as any[];
  } catch {}

  return <UsersClient initialUsers={users} />;
}
