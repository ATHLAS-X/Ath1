"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { signOut } from "next-auth/react";
import { toast } from "sonner";
import { Skeleton, SkeletonStyles } from "@/components/ui/Skeleton";

/* Player detail page — two-column on desktop, stacked on mobile.
   Left: avatar + identity card + invite controls + edit modal.
   Right: tabs for Performance, Fitness, Verification. */

interface Player {
  id: string;
  user_id: string | null;
  first_name: string;
  last_name: string;
  date_of_birth: string | null;
  gender: string | null;
  playing_role: string | null;
  batting_style: string | null;
  bowling_style: string | null;
  city: string | null;
  state: string | null;
  district: string | null;
  height_cm: any;
  weight_kg: any;
  verification_level: number;
  profile_status: string;
  invite_sent: boolean;
  invite_sent_at: string | null;
  claimed_at: string | null;
  email: string | null;
}

interface Props {
  academy: { id: string; name: string };
  adminName: string;
  adminEmail: string;
  player: Player;
}

const NAV = [
  { label: "Dashboard",             href: "/academy/dashboard" },
  { label: "Players",               href: "/academy/players" },
  { label: "Coaches",               href: "/academy/coaches" },
  { label: "Fitness & Assessments", href: "/academy/fitness" },
  { label: "Settings",              href: "/academy/settings" },
];

const VL_META: Record<number, { label: string; bg: string; fg: string; border: string; description: string }> = {
  1: { label: "Unverified",           bg: "#F1F5F9", fg: "#475569", border: "#CBD5E1",
       description: "Self-registered. Profile created but identity not yet confirmed." },
  2: { label: "Identity Verified",    bg: "#FEF3C7", fg: "#92400E", border: "#FCD34D",
       description: "Identity confirmed via Aadhaar OTP or in-person check by the academy." },
  3: { label: "Performance Verified", bg: "#DCFCE7", fg: "#15803D", border: "#86EFAC",
       description: "At least three scorecards approved by AthlasX, or a verified coach endorsement on file." },
  4: { label: "Scout Verified",       bg: "#DBEAFE", fg: "#1D4ED8", border: "#93C5FD",
       description: "Endorsed by a verified scout after a trial, match, or video review." },
};

const STATUS_META: Record<string, { bg: string; fg: string }> = {
  "Draft":             { bg: "#F1F5F9", fg: "#475569" },
  "Pending Approval":  { bg: "#FEF3C7", fg: "#92400E" },
  "Live":              { bg: "#DCFCE7", fg: "#15803D" },
  "Rejected":          { bg: "#FEE2E2", fg: "#B91C1C" },
};

function calcAge(dob: string | null): number | null {
  if (!dob) return null;
  const d = new Date(dob);
  if (Number.isNaN(d.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - d.getFullYear();
  const m = now.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age--;
  return age;
}

function initialsOf(p: Player): string {
  return ((p.first_name?.[0] ?? "") + (p.last_name?.[0] ?? "")).toUpperCase() || "?";
}

export default function PlayerDetailClient(p: Props) {
  const pathname = usePathname() ?? "";
  const router = useRouter();
  const [player, setPlayer] = useState(p.player);
  const [tab, setTab] = useState<"performance" | "fitness" | "verification">("performance");
  /* Sonner replaces the per-page toast strip. showToast() is kept as a
     thin alias so downstream call sites don't need changes. */
  const showToast = useCallback((m: string) => { toast.success(m); }, []);
  const [editOpen, setEditOpen] = useState(false);

  const refresh = async () => {
    const res = await fetch(`/api/academy/players/${player.id}`);
    const data = await res.json().catch(() => ({}));
    if (data?.success && data.player) {
      setPlayer((cur) => ({ ...cur, ...data.player, verification_level: Number(data.player.verification_level ?? cur.verification_level) }));
    }
  };

  const sendInvite = async () => {
    const res = await fetch(`/api/academy/players/${player.id}/invite`, { method: "POST" });
    const data = await res.json().catch(() => ({}));
    if (data?.success) {
      showToast(`Invite sent to ${player.first_name || "player"}`);
      refresh();
    } else showToast(data?.error ?? "Could not send invite");
  };

  const fullName = [player.first_name, player.last_name].filter(Boolean).join(" ") || "Player";
  const age = calcAge(player.date_of_birth);
  const vl = VL_META[Math.max(1, Math.min(4, player.verification_level))] ?? VL_META[1];
  const ps = STATUS_META[player.profile_status] ?? STATUS_META["Draft"];
  const adminInitials = p.adminName.split(" ").filter(Boolean).map((w) => w[0]).slice(0, 2).join("").toUpperCase();

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "#F5F5F5", color: "#0F172A", fontFamily: "'Instrument Sans', system-ui, sans-serif" }}>
      <style>{STYLES}</style>

      <aside className="pd-sidebar">
        <div className="pd-brand">
          <div className="pd-ball" />
          <div>
            <div className="pd-word">SPORT<em>X</em></div>
            <div className="pd-sub">Academy admin</div>
          </div>
        </div>
        <nav className="pd-nav">
          {NAV.map((item) => {
            const active = pathname === item.href || (item.href !== "/academy/dashboard" && pathname.startsWith(item.href));
            return <Link key={item.href} href={item.href} className={`pd-link${active ? " on" : ""}`}>{item.label}</Link>;
          })}
        </nav>
      </aside>

      <div style={{ flex: 1, minWidth: 0 }}>
        <header className="pd-topbar">
          <div>
            <Link href="/academy/players" className="pd-back">← Players</Link>
            <h1>{fullName}</h1>
          </div>
          <div className="pd-top-right">
            <div className="pd-admin">
              <div className="pd-avatar">{adminInitials}</div>
              <div>
                <div className="pd-admin-n">{p.adminName}</div>
                <div className="pd-admin-e">{p.adminEmail}</div>
              </div>
            </div>
            <button className="pd-logout" onClick={() => signOut({ callbackUrl: "/auth/login" })}>Logout</button>
          </div>
        </header>

        <main className="pd-main">
          <div className="pd-grid">

            {/* LEFT — Player card */}
            <aside className="pd-card pd-id">
              <div className="pd-id-avatar"><span>{initialsOf(player)}</span></div>
              <h2 className="pd-id-name">{fullName}</h2>
              <div className="pd-id-role">
                {player.playing_role ?? "—"}
                {player.batting_style && <> · {player.batting_style}</>}
                {player.bowling_style && <> · {player.bowling_style}</>}
              </div>

              <div className="pd-id-meta">
                <Row k="Location" v={[player.city, player.state, player.district].filter(Boolean).join(", ") || "—"} />
                <Row k="Date of birth"
                  v={player.date_of_birth
                    ? `${new Date(player.date_of_birth).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}${age != null ? ` · age ${age}` : ""}`
                    : "—"} />
                <Row k="Email" v={player.email ?? "—"} />
              </div>

              <div className="pd-id-badges">
                <Badge bg={vl.bg} fg={vl.fg} border={vl.border}>{vl.label}</Badge>
                <Badge bg={ps.bg} fg={ps.fg}>{player.profile_status}</Badge>
              </div>

              <button className="pd-edit" onClick={() => setEditOpen(true)}>Edit Player</button>

              <div className="pd-invite-block">
                <div className="pd-invite-label">Invite status</div>
                {player.claimed_at ? (
                  <div className="pd-invite-claim">
                    <span style={{ color: "#15803D", fontWeight: 700 }}>✓ Account claimed</span>
                    <span style={{ color: "#64748B", fontSize: 11 }}>
                      Claimed {new Date(player.claimed_at).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                    </span>
                  </div>
                ) : player.invite_sent ? (
                  <div className="pd-invite-claim">
                    <span style={{ color: "#92400E", fontWeight: 700 }}>Invite sent</span>
                    {player.invite_sent_at && (
                      <span style={{ color: "#64748B", fontSize: 11 }}>
                        {new Date(player.invite_sent_at).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                      </span>
                    )}
                    <button className="pd-resend" onClick={sendInvite}>Resend invite</button>
                  </div>
                ) : (
                  <div className="pd-invite-claim">
                    <span style={{ color: "#475569" }}>Not invited yet</span>
                    <button className="pd-resend" onClick={sendInvite}>Send invite</button>
                  </div>
                )}
              </div>
            </aside>

            {/* RIGHT — Tabs */}
            <section style={{ minWidth: 0 }}>
              <div className="pd-tabs">
                {(["performance", "fitness", "verification"] as const).map((t) => (
                  <button key={t} className={`pd-tab${tab === t ? " on" : ""}`} onClick={() => setTab(t)}>
                    {t === "performance" ? "Performance Stats"
                      : t === "fitness" ? "Fitness Assessments"
                      : "Verification"}
                  </button>
                ))}
              </div>

              {tab === "performance" && <TabPerformance playerId={player.id} />}
              {tab === "fitness"     && <TabFitness     playerId={player.id} />}
              {tab === "verification" && (
                <TabVerification
                  level={player.verification_level}
                  onUpgraded={() => { refresh(); showToast("Player marked as Identity Verified"); }}
                  playerId={player.id}
                />
              )}
            </section>

          </div>
        </main>
      </div>

      <SkeletonStyles />

      {editOpen && (
        <EditModal playerId={player.id} onClose={() => { setEditOpen(false); refresh(); }} onSaved={() => showToast("Player updated")} />
      )}
    </div>
  );
}

/* ────────── Tab 1: Performance stats ────────── */
function TabPerformance({ playerId }: { playerId: string }) {
  const [perf, setPerf] = useState<any>(null);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<Record<string, any>>({});
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    const res = await fetch(`/api/academy/players/${playerId}/performance`);
    const data = await res.json().catch(() => ({}));
    if (data?.success) {
      setPerf(data.performance);
      setForm(data.performance ?? {});
    }
    setLoading(false);
  };
  useEffect(() => { load(); }, [playerId]);

  const save = async () => {
    setBusy(true); setError(null);
    try {
      const res = await fetch(`/api/academy/players/${playerId}/performance`, {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json().catch(() => ({}));
      if (!data?.success) { setError(data?.error ?? "Save failed"); return; }
      await load(); setEditing(false);
    } finally { setBusy(false); }
  };

  if (loading) {
    return (
      <div className="pd-card pd-pad">
        <Skeleton width={160} height={18} style={{ marginBottom: 14 }} />
        <div className="pd-grid2">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <div key={i}>
              <Skeleton width={80} height={10} style={{ marginBottom: 6 }} />
              <Skeleton height={34} />
            </div>
          ))}
        </div>
      </div>
    );
  }

  const groups: Array<[string, Array<[string, string, string?]>]> = [
    ["Batting", [
      ["matches", "Matches"], ["innings", "Innings"], ["runs", "Runs"],
      ["batting_average", "Average"], ["strike_rate", "Strike rate"],
      ["highest_score", "Highest"], ["fifties", "50s"], ["hundreds", "100s"],
    ]],
    ["Bowling", [
      ["bowling_matches", "Matches"], ["wickets", "Wickets"], ["overs", "Overs"],
      ["economy", "Economy"], ["bowling_average", "Average"], ["best_figures", "Best figures", "text"],
    ]],
    ["Fielding", [
      ["catches", "Catches"], ["stumpings", "Stumpings"], ["runouts", "Run-outs"],
    ]],
  ];

  if (editing) {
    return (
      <div className="pd-card pd-pad">
        <div className="pd-section-head">
          <h3>Edit performance stats</h3>
          <span className="pd-muted">All fields optional</span>
        </div>
        {groups.map(([title, fields]) => (
          <div key={title} style={{ marginBottom: 18 }}>
            <div className="pd-group-title">{title}</div>
            <div className="pd-grid2">
              {fields.map(([k, label, type]) => (
                <label key={k} className="pd-field">
                  <span className="pd-field-label">{label}</span>
                  <input className="pd-input" type={type ?? "number"} step={type === "text" ? undefined : "any"}
                    value={form[k] ?? ""} onChange={(e) => setForm({ ...form, [k]: e.target.value })} />
                </label>
              ))}
            </div>
          </div>
        ))}
        {error && <p className="pd-error">{error}</p>}
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button onClick={() => setEditing(false)} className="pd-btn-cancel">Cancel</button>
          <button onClick={save} disabled={busy} className="pd-btn-save">{busy ? "Saving…" : "Save stats"}</button>
        </div>
      </div>
    );
  }

  return (
    <div className="pd-card pd-pad">
      <div className="pd-section-head">
        <h3>Performance Stats</h3>
        <button className="pd-btn-save" onClick={() => setEditing(true)}>Edit stats</button>
      </div>
      {!perf ? (
        <div className="pd-empty">No stats entered yet. Click <strong>Edit stats</strong> to add them.</div>
      ) : (
        groups.map(([title, fields]) => (
          <div key={title} className="pd-stats-block">
            <div className="pd-group-title">{title}</div>
            <div className="pd-stats-grid">
              {fields.map(([k, label]) => (
                <div key={k} className="pd-stat-cell">
                  <div className="pd-stat-label">{label}</div>
                  <div className="pd-stat-value">{perf[k] ?? "—"}</div>
                </div>
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  );
}

/* ────────── Tab 2: Fitness assessments ────────── */
function TabFitness({ playerId }: { playerId: string }) {
  const [data, setData] = useState<{ assessments: any[]; coaches: any[] } | null>(null);
  const [open, setOpen] = useState(false);

  const load = async () => {
    const res = await fetch(`/api/academy/players/${playerId}/fitness`);
    const j = await res.json().catch(() => ({}));
    if (j?.success) setData({ assessments: j.assessments ?? [], coaches: j.coaches ?? [] });
  };
  useEffect(() => { load(); }, [playerId]);

  return (
    <div className="pd-card pd-pad">
      <div className="pd-section-head">
        <h3>Fitness Assessments</h3>
        <button className="pd-btn-save" onClick={() => setOpen(true)}>+ Add assessment</button>
      </div>

      {!data ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {[0, 1, 2].map((i) => (
              <div key={i} style={{ background: "#F8FAFC", border: "1px solid #E2E8F0", borderRadius: 10, padding: 14 }}>
                <Skeleton width={140} height={14} style={{ marginBottom: 10 }} />
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
                  <Skeleton height={42} /><Skeleton height={42} /><Skeleton height={42} />
                </div>
              </div>
            ))}
          </div>
        )
        : data.assessments.length === 0 ? (
          <div className="pd-empty">No assessments recorded yet.</div>
        ) : (
          <div className="pd-timeline">
            {data.assessments.map((a) => (
              <AssessmentCard key={a.id} a={a} />
            ))}
          </div>
        )}

      {open && data && (
        <AddFitnessModal
          playerId={playerId}
          coaches={data.coaches}
          onClose={() => setOpen(false)}
          onSaved={() => { load(); setOpen(false); }}
        />
      )}
    </div>
  );
}

function AssessmentCard({ a }: { a: any }) {
  const supervised = !!a.is_supervised;
  return (
    <div className="pd-assess">
      <div className="pd-assess-head">
        <div className="pd-assess-date">
          {a.assessment_date ? new Date(a.assessment_date).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—"}
        </div>
        <Badge
          bg={supervised ? "#DCFCE7" : "#F1F5F9"}
          fg={supervised ? "#15803D" : "#475569"}
          border={supervised ? "#86EFAC" : "#CBD5E1"}
        >
          {supervised ? "Coach Verified" : "Self-reported"}
        </Badge>
      </div>
      <div className="pd-assess-row">
        <Metric label="Yo-Yo" v={a.yoyo_score} />
        <Metric label="30 m sprint" v={a.sprint_30m} unit="s" />
        <Metric label="2 km run" v={a.run_2km} unit="min" />
      </div>
      {a.coach_name && (
        <div className="pd-assess-coach">Assessed by <strong>{a.coach_name}</strong>{a.specialization ? ` · ${a.specialization}` : ""}</div>
      )}
      {a.notes && <div className="pd-assess-notes">{a.notes}</div>}
    </div>
  );
}

function Metric({ label, v, unit }: { label: string; v: any; unit?: string }) {
  return (
    <div className="pd-metric">
      <div className="pd-metric-label">{label}</div>
      <div className="pd-metric-value">{v != null && v !== "" ? `${v}${unit ? ` ${unit}` : ""}` : "—"}</div>
    </div>
  );
}

function AddFitnessModal({ playerId, coaches, onClose, onSaved }: {
  playerId: string; coaches: any[]; onClose: () => void; onSaved: () => void;
}) {
  const today = new Date().toISOString().slice(0, 10);
  const [form, setForm] = useState({
    assessment_date: today,
    yoyo_score: "",
    sprint_30m: "",
    run_2km: "",
    notes: "",
    assessed_by_coach_id: "",
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    setBusy(true); setError(null);
    try {
      const res = await fetch(`/api/academy/players/${playerId}/fitness`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, assessed_by_coach_id: form.assessed_by_coach_id || null }),
      });
      const data = await res.json().catch(() => ({}));
      if (!data?.success) { setError(data?.error ?? "Save failed"); return; }
      onSaved();
    } finally { setBusy(false); }
  };

  return (
    <div className="pd-modal-bg" onClick={onClose}>
      <div className="pd-modal" onClick={(e) => e.stopPropagation()}>
        <header className="pd-modal-head">
          <h3>Add fitness assessment</h3>
          <button onClick={onClose}>×</button>
        </header>
        <div className="pd-modal-body">
          <div className="pd-grid2">
            <label className="pd-field"><span className="pd-field-label">Assessment date *</span>
              <input className="pd-input" type="date" value={form.assessment_date}
                onChange={(e) => setForm({ ...form, assessment_date: e.target.value })} />
            </label>
            <label className="pd-field"><span className="pd-field-label">Assessed by coach</span>
              <select className="pd-input" value={form.assessed_by_coach_id}
                onChange={(e) => setForm({ ...form, assessed_by_coach_id: e.target.value })}>
                <option value="">Self-reported (no coach)</option>
                {coaches.map((c) => <option key={c.id} value={c.id}>{c.coach_name}{c.specialization ? ` · ${c.specialization}` : ""}</option>)}
              </select>
            </label>
            <label className="pd-field"><span className="pd-field-label">Yo-Yo score</span>
              <input className="pd-input" type="number" step="any" value={form.yoyo_score}
                onChange={(e) => setForm({ ...form, yoyo_score: e.target.value })} />
            </label>
            <label className="pd-field"><span className="pd-field-label">30 m sprint (seconds)</span>
              <input className="pd-input" type="number" step="any" value={form.sprint_30m}
                onChange={(e) => setForm({ ...form, sprint_30m: e.target.value })} />
            </label>
            <label className="pd-field"><span className="pd-field-label">2 km run (minutes)</span>
              <input className="pd-input" type="number" step="any" value={form.run_2km}
                onChange={(e) => setForm({ ...form, run_2km: e.target.value })} />
            </label>
            <label className="pd-field" style={{ gridColumn: "1 / -1" }}>
              <span className="pd-field-label">Notes</span>
              <textarea className="pd-input" rows={3} value={form.notes}
                style={{ height: "auto", padding: "8px 11px", resize: "vertical" }}
                onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </label>
          </div>
          <p className="pd-hint">
            Assessments with a coach selected count as <strong>Coach Verified</strong>;
            assessments without are <strong>Self-reported</strong>.
          </p>
          {error && <p className="pd-error">{error}</p>}
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 8 }}>
            <button onClick={onClose} className="pd-btn-cancel">Cancel</button>
            <button onClick={save} disabled={busy} className="pd-btn-save">{busy ? "Saving…" : "Save assessment"}</button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ────────── Tab 3: Verification ────────── */
function TabVerification({ level, onUpgraded, playerId }: { level: number; onUpgraded: () => void; playerId: string }) {
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const upgrade = async () => {
    setBusy(true); setError(null);
    try {
      const res = await fetch(`/api/academy/players/${playerId}/verify-identity`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!data?.success) { setError(data?.error ?? "Could not update"); return; }
      setConfirming(false);
      onUpgraded();
    } finally { setBusy(false); }
  };

  return (
    <div className="pd-card pd-pad">
      <div className="pd-section-head">
        <h3>Verification Level</h3>
        <Badge bg={VL_META[level].bg} fg={VL_META[level].fg} border={VL_META[level].border}>Level {level}: {VL_META[level].label}</Badge>
      </div>

      <div className="pd-ladder">
        {[1, 2, 3, 4].map((n) => {
          const meta = VL_META[n];
          const state = n < level ? "done" : n === level ? "current" : "todo";
          return (
            <div key={n} className={`pd-rung pd-rung--${state}`}>
              <div className="pd-rung-num">{state === "done" ? "✓" : n}</div>
              <div style={{ flex: 1 }}>
                <div className="pd-rung-name">{meta.label}</div>
                <div className="pd-rung-desc">{meta.description}</div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="pd-verify-actions">
        {level < 2 && !confirming && (
          <button className="pd-btn-save" onClick={() => setConfirming(true)}>Mark as Identity Verified</button>
        )}
        {confirming && (
          <div className="pd-confirm">
            <div className="pd-confirm-title">Confirm identity verification</div>
            <p className="pd-confirm-body">
              Confirm you have verified this player&apos;s identity via phone OTP
              or ID document. This sets the player to <strong>Level 2 — Identity Verified</strong>
              and will be visible to AthlasX admins and scouts.
            </p>
            {error && <p className="pd-error">{error}</p>}
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={upgrade} disabled={busy} className="pd-btn-save">
                {busy ? "Upgrading…" : "Yes, mark as verified"}
              </button>
              <button onClick={() => setConfirming(false)} className="pd-btn-cancel">Cancel</button>
            </div>
          </div>
        )}
        <p className="pd-hint" style={{ marginTop: 14 }}>
          Performance Verified (L3) and Scout Verified (L4) are managed by AthlasX —
          they need approved scorecards and a verified scout endorsement.
        </p>
      </div>
    </div>
  );
}

/* ────────── Edit modal (full player edit) ────────── */
function EditModal({ playerId, onClose, onSaved }: { playerId: string; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const res = await fetch(`/api/academy/players/${playerId}`);
      const data = await res.json().catch(() => ({}));
      if (data?.success && data.player) {
        const p = data.player;
        setForm({
          first_name: p.first_name ?? "",
          last_name:  p.last_name  ?? "",
          date_of_birth: p.date_of_birth ? p.date_of_birth.slice(0, 10) : "",
          gender: p.gender ?? "",
          playing_role: p.playing_role ?? "",
          batting_style: p.batting_style ?? "",
          bowling_style: p.bowling_style ?? "",
          city: p.city ?? "",
          state: p.state ?? "",
          height_cm: p.height_cm ?? "",
          weight_kg: p.weight_kg ?? "",
        });
      }
      setLoading(false);
    })();
  }, [playerId]);

  const save = async () => {
    setBusy(true); setError(null);
    try {
      const res = await fetch(`/api/academy/players/${playerId}`, {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json().catch(() => ({}));
      if (!data?.success) { setError(data?.error ?? "Save failed"); return; }
      onSaved(); onClose();
    } finally { setBusy(false); }
  };

  return (
    <div className="pd-modal-bg" onClick={onClose}>
      <div className="pd-modal" onClick={(e) => e.stopPropagation()}>
        <header className="pd-modal-head"><h3>Edit Player</h3><button onClick={onClose}>×</button></header>
        <div className="pd-modal-body">
          {loading ? <div className="pd-muted">Loading…</div> : (
            <>
              <div className="pd-grid2">
                {[
                  ["first_name", "First name *"],
                  ["last_name", "Last name *"],
                  ["date_of_birth", "Date of birth", "date"],
                  ["gender", "Gender", "select", ["Male", "Female", "Other"]],
                  ["playing_role", "Primary role", "select", ["Batsman", "Bowler", "All-Rounder", "WK"]],
                  ["batting_style", "Batting style", "select", ["Right-hand bat", "Left-hand bat"]],
                  ["bowling_style", "Bowling style", "select", ["Right-arm fast", "Left-arm fast", "Right-arm medium", "Left-arm medium", "Off Spin", "Leg Spin", "Left-arm Spin"]],
                  ["city", "City"], ["state", "State"],
                  ["height_cm", "Height (cm)", "number"], ["weight_kg", "Weight (kg)", "number"],
                ].map(([k, label, type, options]: any) => (
                  <label key={k} className="pd-field">
                    <span className="pd-field-label">{label}</span>
                    {type === "select" ? (
                      <select className="pd-input" value={form[k] ?? ""} onChange={(e) => setForm({ ...form, [k]: e.target.value })}>
                        <option value="">Select…</option>
                        {options.map((o: string) => <option key={o}>{o}</option>)}
                      </select>
                    ) : (
                      <input className="pd-input" type={type ?? "text"} value={form[k] ?? ""} onChange={(e) => setForm({ ...form, [k]: e.target.value })} />
                    )}
                  </label>
                ))}
              </div>
              {error && <p className="pd-error">{error}</p>}
              <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 12 }}>
                <button onClick={onClose} className="pd-btn-cancel">Cancel</button>
                <button onClick={save} disabled={busy} className="pd-btn-save">{busy ? "Saving…" : "Save changes"}</button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/* ─────────── Atoms ─────────── */
function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="pd-row">
      <span className="pd-row-k">{k}</span>
      <span className="pd-row-v">{v}</span>
    </div>
  );
}

function Badge({ children, bg, fg, border }: { children: React.ReactNode; bg: string; fg: string; border?: string }) {
  return (
    <span style={{
      display: "inline-flex", padding: "3px 10px", borderRadius: 99,
      background: bg, color: fg, border: `1px solid ${border ?? "transparent"}`,
      fontFamily: "'Space Grotesk', monospace", fontSize: 10.5, fontWeight: 600,
    }}>{children}</span>
  );
}

const STYLES = `
.pd-sidebar { width: 240px; flex-shrink: 0; background: #0A1628; color: #F1F5F9; display: flex; flex-direction: column; padding: 20px 14px; position: sticky; top: 0; height: 100vh; }
.pd-brand { display: flex; align-items: center; gap: 11px; padding: 4px 4px 14px; }
.pd-ball { width: 28px; height: 28px; border-radius: 50%; background: radial-gradient(circle at 32% 28%, #46ff97, #0e6e33 72%); box-shadow: 0 0 16px rgba(46,224,123,0.45); flex-shrink: 0; }
.pd-word { font-family: 'Space Grotesk', monospace; font-size: 16px; font-weight: 700; letter-spacing: 0.05em; }
.pd-word em { font-style: normal; color: #22C55E; }
.pd-sub { font-size: 10px; color: #94A3B8; letter-spacing: 1.5px; text-transform: uppercase; margin-top: 1px; }
.pd-nav { display: flex; flex-direction: column; gap: 4px; padding-top: 8px; }
.pd-link { display: block; padding: 10px 14px; border-radius: 9px; color: #94A3B8; font-size: 13px; font-weight: 500; text-decoration: none; border-left: 3px solid transparent; }
.pd-link:hover { color: #F1F5F9; background: rgba(255,255,255,0.04); }
.pd-link.on { background: rgba(34,197,94,0.12); color: #FFFFFF; border-left-color: #22C55E; }
@media (max-width: 800px) { .pd-sidebar { width: 60px; padding: 16px 8px; } .pd-link { padding: 10px 8px; font-size: 10px; text-align: center; } .pd-brand div:nth-child(2) { display: none; } }

.pd-topbar { display: flex; justify-content: space-between; align-items: center; padding: 14px 28px; background: #FFFFFF; border-bottom: 1px solid #E2E8F0; }
.pd-topbar h1 { font-size: 19px; font-weight: 700; margin: 4px 0 0; font-family: 'Space Grotesk', monospace; }
.pd-back { font-size: 11.5px; color: #64748B; text-decoration: none; font-weight: 600; }
.pd-back:hover { color: #0F172A; }
.pd-top-right { display: flex; align-items: center; gap: 14px; }
.pd-admin { display: flex; align-items: center; gap: 10px; }
.pd-avatar { width: 34px; height: 34px; border-radius: 50%; background: linear-gradient(135deg, #22C55E, #1D4ED8); color: #FFF; display: grid; place-items: center; font-family: 'Space Grotesk', monospace; font-weight: 700; font-size: 12px; }
.pd-admin-n { font-size: 12.5px; font-weight: 600; color: #0F172A; }
.pd-admin-e { font-size: 10.5px; color: #64748B; }
.pd-logout { padding: 7px 12px; border-radius: 7px; background: #F1F5F9; border: 1px solid #CBD5E1; color: #475569; font-size: 12px; font-weight: 600; cursor: pointer; }
.pd-logout:hover { background: #FEE2E2; color: #B91C1C; border-color: #FCA5A5; }
@media (max-width: 600px) { .pd-admin > div:last-child { display: none; } }

.pd-main { padding: 22px 28px 48px; max-width: 1280px; }
.pd-grid { display: grid; grid-template-columns: 320px 1fr; gap: 20px; }
@media (max-width: 900px) { .pd-grid { grid-template-columns: 1fr; } }

.pd-card { background: #FFFFFF; border: 1px solid #E2E8F0; border-radius: 12px; }
.pd-pad { padding: 18px 20px 22px; }

.pd-id { padding: 22px 20px; text-align: left; }
.pd-id-avatar { width: 90px; height: 90px; border-radius: 50%; background: linear-gradient(135deg, #22C55E, #1D4ED8); margin: 0 auto 14px; display: grid; place-items: center; color: #FFFFFF; font-family: 'Space Grotesk', monospace; font-weight: 700; font-size: 32px; }
.pd-id-name { font-size: 19px; font-weight: 700; margin: 4px 0 4px; text-align: center; font-family: 'Space Grotesk', monospace; }
.pd-id-role { font-size: 12px; color: #475569; text-align: center; margin-bottom: 16px; }
.pd-id-meta { border-top: 1px solid #E2E8F0; border-bottom: 1px solid #E2E8F0; padding: 8px 0; }
.pd-row { display: flex; gap: 10px; padding: 8px 0; align-items: flex-start; }
.pd-row + .pd-row { border-top: 1px solid #F1F5F9; }
.pd-row-k { width: 95px; flex-shrink: 0; font-size: 11px; color: #94A3B8; text-transform: uppercase; letter-spacing: 1px; font-weight: 600; }
.pd-row-v { flex: 1; font-size: 12.5px; color: #0F172A; word-break: break-word; }
.pd-id-badges { display: flex; gap: 6px; flex-wrap: wrap; margin-top: 14px; }
.pd-edit { width: 100%; margin-top: 14px; background: #22C55E; color: #FFFFFF; border: none; padding: 10px; border-radius: 8px; font-size: 13px; font-weight: 600; cursor: pointer; }
.pd-edit:hover { background: #16A34A; }

.pd-invite-block { margin-top: 16px; padding-top: 14px; border-top: 1px solid #E2E8F0; }
.pd-invite-label { font-size: 11px; color: #94A3B8; text-transform: uppercase; letter-spacing: 1px; font-weight: 600; margin-bottom: 8px; }
.pd-invite-claim { display: flex; flex-direction: column; gap: 4px; }
.pd-resend { align-self: flex-start; margin-top: 6px; background: #F1F5F9; border: 1px solid #CBD5E1; color: #0F172A; padding: 5px 12px; border-radius: 7px; font-size: 11.5px; font-weight: 600; cursor: pointer; }
.pd-resend:hover { background: #E2E8F0; }

.pd-tabs { display: flex; gap: 4px; padding: 4px; background: #FFFFFF; border: 1px solid #E2E8F0; border-radius: 10px; margin-bottom: 14px; width: fit-content; }
.pd-tab { padding: 7px 14px; border-radius: 7px; border: none; background: transparent; color: #64748B; font-size: 12px; font-weight: 600; cursor: pointer; font-family: 'Space Grotesk', monospace; }
.pd-tab:hover { color: #0F172A; background: #F8FAFC; }
.pd-tab.on { background: #0A1628; color: #FFFFFF; }

.pd-section-head { display: flex; justify-content: space-between; align-items: center; gap: 12px; margin-bottom: 14px; }
.pd-section-head h3 { font-size: 16px; font-weight: 700; color: #0F172A; margin: 0; font-family: 'Space Grotesk', monospace; }
.pd-muted { color: #64748B; font-size: 12px; }
.pd-empty { padding: 28px 0; text-align: center; color: #64748B; font-size: 13px; }

.pd-stats-block + .pd-stats-block { margin-top: 18px; padding-top: 18px; border-top: 1px solid #F1F5F9; }
.pd-group-title { font-size: 10.5px; font-weight: 700; color: #475569; text-transform: uppercase; letter-spacing: 1.2px; margin-bottom: 10px; }
.pd-stats-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; }
@media (max-width: 720px) { .pd-stats-grid { grid-template-columns: repeat(2, 1fr); } }
.pd-stat-cell { background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 8px; padding: 10px 12px; text-align: center; }
.pd-stat-label { font-size: 10px; color: #64748B; letter-spacing: 0.8px; text-transform: uppercase; font-weight: 600; }
.pd-stat-value { font-family: 'Space Grotesk', monospace; font-size: 22px; font-weight: 700; color: #0F172A; margin-top: 4px; }

.pd-grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
@media (max-width: 600px) { .pd-grid2 { grid-template-columns: 1fr; } }
.pd-field { display: block; }
.pd-field-label { display: block; font-size: 10px; font-weight: 600; color: #475569; letter-spacing: 1px; text-transform: uppercase; margin-bottom: 6px; }
.pd-input { width: 100%; height: 34px; padding: 0 11px; border-radius: 8px; border: 1px solid #CBD5E1; background: #FFFFFF; color: #0F172A; font-size: 12.5px; outline: none; }
.pd-input:focus { border-color: #22C55E; }

.pd-error { color: #DC2626; font-size: 12px; background: rgba(220,38,38,0.07); border: 1px solid rgba(220,38,38,0.3); padding: 8px 12px; border-radius: 8px; margin-top: 10px; }
.pd-hint { font-size: 11.5px; color: #64748B; font-style: italic; margin-top: 12px; }
.pd-btn-save { background: #22C55E; border: 1px solid #16A34A; color: #FFFFFF; padding: 8px 16px; border-radius: 8px; font-size: 12.5px; font-weight: 600; cursor: pointer; }
.pd-btn-save:hover:not(:disabled) { background: #16A34A; }
.pd-btn-save:disabled { opacity: 0.55; cursor: not-allowed; }
.pd-btn-cancel { background: #FFFFFF; border: 1px solid #CBD5E1; color: #475569; padding: 8px 16px; border-radius: 8px; font-size: 12.5px; font-weight: 600; cursor: pointer; }
.pd-btn-cancel:hover { background: #F1F5F9; }

.pd-timeline { display: flex; flex-direction: column; gap: 10px; }
.pd-assess { background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 10px; padding: 14px 16px; }
.pd-assess-head { display: flex; justify-content: space-between; align-items: center; gap: 12px; margin-bottom: 10px; }
.pd-assess-date { font-family: 'Space Grotesk', monospace; font-weight: 700; font-size: 13px; color: #0F172A; }
.pd-assess-row { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
.pd-metric { background: #FFFFFF; border: 1px solid #E2E8F0; border-radius: 8px; padding: 8px 10px; text-align: center; }
.pd-metric-label { font-size: 9.5px; color: #94A3B8; letter-spacing: 0.8px; text-transform: uppercase; font-weight: 600; }
.pd-metric-value { font-family: 'Space Grotesk', monospace; font-size: 16px; font-weight: 700; color: #0F172A; margin-top: 2px; }
.pd-assess-coach { font-size: 11.5px; color: #475569; margin-top: 10px; }
.pd-assess-notes { font-size: 12px; color: #475569; margin-top: 8px; font-style: italic; }

.pd-ladder { display: flex; flex-direction: column; gap: 8px; }
.pd-rung { display: flex; gap: 12px; padding: 12px 14px; border-radius: 10px; align-items: flex-start; background: #F8FAFC; border: 1px solid #E2E8F0; }
.pd-rung--done { background: #DCFCE7; border-color: #86EFAC; }
.pd-rung--current { background: #FEF3C7; border-color: #FCD34D; }
.pd-rung-num { width: 28px; height: 28px; border-radius: 50%; display: grid; place-items: center; font-family: 'Space Grotesk', monospace; font-weight: 700; font-size: 12px; background: #FFFFFF; border: 1.5px solid #CBD5E1; color: #475569; flex-shrink: 0; margin-top: 1px; }
.pd-rung--done .pd-rung-num { background: #16A34A; border-color: #15803D; color: #FFFFFF; }
.pd-rung--current .pd-rung-num { background: #D97706; border-color: #92400E; color: #FFFFFF; }
.pd-rung-name { font-size: 13.5px; font-weight: 700; color: #0F172A; }
.pd-rung-desc { font-size: 12px; color: #475569; margin-top: 3px; }

.pd-verify-actions { margin-top: 18px; }
.pd-confirm { background: #FEF3C7; border: 1px solid #FCD34D; border-radius: 10px; padding: 14px 16px; margin-top: 8px; }
.pd-confirm-title { font-size: 13.5px; font-weight: 700; color: #92400E; margin-bottom: 6px; }
.pd-confirm-body { font-size: 12.5px; color: #78350F; line-height: 1.55; margin-bottom: 12px; }

.pd-toast { position: fixed; bottom: 24px; right: 24px; background: #0F172A; color: #FFFFFF; padding: 11px 18px; border-radius: 9px; font-size: 13px; font-weight: 600; box-shadow: 0 10px 30px rgba(15,23,42,0.35); z-index: 200; }

.pd-modal-bg { position: fixed; inset: 0; background: rgba(15,23,42,0.55); backdrop-filter: blur(2px); z-index: 100; display: grid; place-items: start center; padding: 40px 16px; overflow-y: auto; }
.pd-modal { width: 100%; max-width: 720px; background: #FFFFFF; border-radius: 14px; box-shadow: 0 20px 60px rgba(15,23,42,0.35); overflow: hidden; }
.pd-modal-head { display: flex; align-items: center; justify-content: space-between; padding: 14px 20px; border-bottom: 1px solid #E2E8F0; }
.pd-modal-head h3 { font-size: 16px; font-weight: 700; color: #0F172A; margin: 0; font-family: 'Space Grotesk', monospace; }
.pd-modal-head button { width: 32px; height: 32px; border-radius: 8px; border: 1px solid #E2E8F0; background: #F8FAFC; font-size: 20px; line-height: 1; color: #475569; cursor: pointer; }
.pd-modal-body { padding: 18px 20px 20px; max-height: 70vh; overflow-y: auto; }

/* ─── Mobile patches (Task 5) ─── */
@media (max-width: 640px) {
  .pd-sidebar { position: fixed; bottom: 0; left: 0; right: 0; top: auto; width: 100%; height: 60px; padding: 0; flex-direction: row; border-top: 1px solid rgba(255,255,255,0.08); z-index: 50; }
  .pd-brand { display: none; }
  .pd-nav { flex-direction: row; padding-top: 0; gap: 0; flex: 1; height: 100%; align-items: stretch; }
  .pd-link { flex: 1; padding: 8px 4px; font-size: 9.5px; text-align: center; border-left: none; border-top: 3px solid transparent; line-height: 1.2; display: flex; align-items: center; justify-content: center; }
  .pd-link.on { border-top-color: #22C55E; border-left-color: transparent; }
  .pd-main { padding-bottom: 84px; }
  .pd-modal-bg { padding: 0; align-items: stretch; }
  .pd-modal { max-width: 100% !important; max-height: 100vh; min-height: 100vh; border-radius: 0; display: flex; flex-direction: column; }
  .pd-modal-body { max-height: none; flex: 1; }
}
`;
