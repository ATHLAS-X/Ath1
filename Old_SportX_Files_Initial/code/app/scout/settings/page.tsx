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
    <div style={{ minHeight: "100vh", padding: "1.6rem", background: "var(--ax-bg)", color: "var(--ax-text)" }}>
      <div style={{ maxWidth: 700, margin: "0 auto" }}>
        <Link href="/scout/dashboard" style={{ display: "inline-flex", alignItems: "center", gap: "0.4rem", fontSize: "0.82rem", color: "var(--ax-text-dim)", textDecoration: "none", marginBottom: "0.6rem" }}>← Back to dashboard</Link>
        <h1 style={{ fontFamily: "var(--ax-font-display)", textTransform: "uppercase", fontWeight: 400, fontSize: "1.8rem", margin: "0.4rem 0 0.4rem" }}>Settings</h1>
        <p style={{ color: "var(--ax-text-dim)", fontSize: "0.84rem", marginBottom: "1rem" }}>
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
