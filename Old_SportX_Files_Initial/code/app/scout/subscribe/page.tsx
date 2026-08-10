import Link from "next/link";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";

export default async function ScoutSubscribePage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/auth/login");
  if ((session.user as any).role !== "scout") redirect("/dashboard");

  return (
    <div className="sx-root" style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 24 }}>
      <div className="card" style={{ maxWidth: 480, padding: 32, textAlign: "center" }}>
        <div className="sect-title" style={{ marginBottom: 12 }}>Scout Pro</div>
        <h1 style={{ fontFamily: "var(--num)", fontSize: 32, fontWeight: 700, marginBottom: 8 }}>
          Unlock Scout Access
        </h1>
        <p style={{ color: "var(--mut)", fontSize: 13, marginBottom: 24 }}>
          Get verified-player discovery, watchlists, trial invites, and AI-ranked talent.
        </p>
        <div style={{ fontFamily: "var(--num)", fontSize: 40, fontWeight: 700, color: "var(--green)", lineHeight: 1 }}>
          ₹999<span style={{ fontSize: 14, color: "var(--mut)", fontWeight: 500 }}>/month</span>
        </div>
        <Link href="/scout/dashboard" className="btn green" style={{ width: "100%", marginTop: 24 }}>
          Continue to Dashboard (Demo)
        </Link>
        <p style={{ fontSize: 11, color: "var(--lbl)", marginTop: 16 }}>
          Payment integration coming soon. Demo mode bypasses the paywall.
        </p>
      </div>
    </div>
  );
}
