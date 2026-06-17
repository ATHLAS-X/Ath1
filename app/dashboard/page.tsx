import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getRedirectByRole } from "@/lib/auth-redirect";
import { sql } from "@/lib/db";

export default async function DashboardRouter() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/auth/login?from=/dashboard");
  const user = session.user as any;

  /* For players: a stale JWT can still say account_status='pending' after
     onboarding submit (until they re-login). Trust the DB over the JWT and
     send them to their dashboard if profile is already submitted.
     NOTE: redirect() throws NEXT_REDIRECT — must NOT be called inside a
     try/catch that swallows the throw. */
  let target: string | null = null;
  if (user.role === "player" && user.account_status === "pending") {
    try {
      const rows = (await sql`
        SELECT pp.profile_status, u.account_status
        FROM users u
        LEFT JOIN player_profiles pp ON pp.user_id = u.id
        WHERE u.id = ${user.id} LIMIT 1
      `) as unknown as Array<{ profile_status: string | null; account_status: string | null }>;
      const r = rows[0];
      const liveAccount = r?.account_status === "active";
      const submitted = r?.profile_status && r.profile_status !== "Draft";
      if (liveAccount || submitted) target = "/dashboard/player";
    } catch {
      /* DB blip — fall through to normal redirect */
    }
  }

  redirect(target ?? getRedirectByRole(user));
}
