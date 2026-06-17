import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { sql } from "@/lib/db";
import ClaimButton from "./ClaimButton";

interface Props { params: { token: string } }

async function loadInvite(token: string) {
  const rows = (await sql`
    SELECT i.id, i.status, i.invited_name, i.email, i.claimed_at,
           pp.id AS player_profile_id,
           pp.first_name, pp.last_name, pp.date_of_birth, pp.playing_role, pp.city, pp.state,
           a.academy_name, a.city AS academy_city, a.state AS academy_state
    FROM player_invites i
    LEFT JOIN player_profiles pp ON pp.id = i.player_profile_id
    LEFT JOIN academies a ON a.id = i.academy_id
    WHERE i.token = ${token}
    LIMIT 1
  `) as unknown as Array<any>;
  return rows[0] ?? null;
}

export default async function ClaimPage({ params }: Props) {
  const session = await getServerSession(authOptions);
  const invite = await loadInvite(params.token);

  if (!invite) {
    return Shell({ children: <p style={{ color: "var(--mut)" }}>This invite link is invalid or has expired.</p> });
  }
  if (invite.status === "Claimed") {
    return Shell({ children: <p style={{ color: "var(--green)" }}>✓ This profile has already been claimed.</p> });
  }

  return Shell({
    children: (
      <>
        <div className="sect-title" style={{ marginBottom: 8 }}>Profile Invite</div>
        <h1 style={{ fontFamily: "var(--num)", fontSize: 26, fontWeight: 700, marginBottom: 4 }}>
          {invite.first_name} {invite.last_name}
        </h1>
        <p style={{ color: "var(--mut)", fontSize: 12.5, marginBottom: 16 }}>
          <strong>{invite.academy_name}</strong>
          {invite.academy_city && ` · ${invite.academy_city}, ${invite.academy_state}`} created
          a draft SportX profile for you.
        </p>

        <div className="claim-grid">
          {invite.date_of_birth && (
            <Detail label="Date of birth" value={new Date(invite.date_of_birth).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })} />
          )}
          {invite.playing_role && <Detail label="Role" value={invite.playing_role} />}
          {invite.city && <Detail label="City" value={invite.city} />}
          {invite.state && <Detail label="State" value={invite.state} />}
        </div>

        <div style={{ marginTop: 22 }}>
          {!session?.user ? (
            <>
              <p style={{ color: "var(--mut)", fontSize: 12.5, marginBottom: 10 }}>
                Sign in or create a Player account, then return to this page to claim.
              </p>
              <Link href={`/auth/login?from=/claim/${params.token}`} className="btn green" style={{ marginRight: 6 }}>
                Sign in
              </Link>
              <Link href={`/auth/signup?role=player&from=/claim/${params.token}`} className="btn">
                Create Player account
              </Link>
            </>
          ) : (session.user as any).role !== "player" ? (
            <p style={{ color: "var(--red)" }}>
              Only Player accounts can claim a profile. You're signed in as{" "}
              <code>{(session.user as any).role}</code>.
            </p>
          ) : (
            <ClaimButton token={params.token} />
          )}
        </div>
      </>
    ),
  });
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="sx-root"
      style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 24 }}
    >
      <style>{`
        .claim-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
        .claim-detail { background: var(--card-alt); border: 1px solid var(--line); border-radius: 9px; padding: 10px 12px; }
        .claim-detail .k { font-size: 9px; letter-spacing: 1.5px; text-transform: uppercase; color: var(--lbl); font-family: var(--num); font-weight: 600; }
        .claim-detail .v { font-size: 13px; font-weight: 600; margin-top: 3px; }
      `}</style>
      <div className="card" style={{ maxWidth: 520, padding: 32 }}>{children}</div>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="claim-detail">
      <div className="k">{label}</div>
      <div className="v">{value}</div>
    </div>
  );
}
