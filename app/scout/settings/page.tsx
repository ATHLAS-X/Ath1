import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { sql } from "@/lib/db";
import ScoutSettingsForm from "./ScoutSettingsForm";
import SignOutButton from "./SignOutButton";

export const dynamic = "force-dynamic";

export default async function ScoutSettingsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/auth/login?from=/scout/settings");
  if ((session.user as any).role !== "scout") redirect("/dashboard");
  const userId = (session.user as any).id as string;

  const rows = (await sql`
    SELECT designation, organization_name, org_type, region, years_experience, proof_url
    FROM scout_profiles WHERE user_id = ${userId} LIMIT 1
  `) as unknown as any[];
  const p = rows[0] ?? {};

  return (
    <div className="sx-root" style={{ minHeight: "100vh", padding: 24 }}>
      <div style={{ maxWidth: 700, margin: "0 auto" }}>
        <Link href="/scout/dashboard" className="btn" style={{ textDecoration: "none", marginBottom: 8, display: "inline-block" }}>← Back to dashboard</Link>
        <h1 className="sect-title" style={{ fontSize: 22, marginTop: 8, marginBottom: 4 }}>Settings</h1>
        <p style={{ color: "var(--mut)", fontSize: 12.5, marginBottom: 16 }}>
          Signed in as {session.user.name ?? session.user.email} ({session.user.email})
        </p>

        <ScoutSettingsForm
          initial={{
            designation: p.designation ?? "",
            organization_name: p.organization_name ?? "",
            org_type: p.org_type ?? "",
            region: p.region ?? "",
            years_experience: p.years_experience ?? null,
            proof_url: p.proof_url ?? "",
          }}
        />

        <div style={{ marginTop: 20 }}>
          <SignOutButton />
        </div>
      </div>
    </div>
  );
}
