"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { DsIcon, DsPill, DsAvatar, DsButton, DsToast, useToast } from "@/app/_ds";
import type { CoachDashboardData, CoachAssignedPlayer, CoachSubmission } from "@/lib/dashboard-data";

/* There is no real backend for a coach to log fitness/behavioural data
   FOR another player: fitness_data and behavioral_assessment both key on
   user_id with no recorded_by_user_id column, and /api/onboarding/fitness
   always writes to the CALLER's own row. Wiring "Quick Log" to that route
   would silently corrupt data — it'd overwrite the coach's own fitness_data,
   not the player's, while looking like it succeeded. Until that schema gap
   is closed, these stay an honest "not built yet" message instead of a fake
   success state. */
const NO_BACKEND_MSG =
  "Coach-submitted player evaluations aren't built yet — fitness_data/behavioral_assessment have no column recording who submitted them for whom.";

// ─── Types ────────────────────────────────────────────────────────────────────

type CoachPlayer = { id:string; name:string; city:string; role:string; age:number; vlevel:string; yoyo:string; assessed:string; status:string };
type Submission  = { type:'fitness'|'behaviour'|'milestone'; name:string; summary:string; when:string; playerId:string };

interface CoachDashboardProps {
  data?: CoachDashboardData;
}

const VLEVEL_TONE: Record<string,"neutral"|"accent"|"ok"|"blue"> = {
  "L1 Self":"neutral","L2 Identity":"accent","L3 Performance":"ok","L4 Scout":"blue",
};
const STATUS_TONE: Record<string,"neutral"|"accent"|"ok"|"bad"|"blue"|"purple"|"ghost"> = {
  "Fitness due":"accent","Eval due":"blue","Milestone":"purple","Up to date":"ghost",
};

const VLEVEL_LABEL: Record<number,string> = { 1:"L1 Self", 2:"L2 Identity", 3:"L3 Performance", 4:"L4 Scout" };
const PENDING_STATUS: Record<string,string> = { fitness:"Fitness due", behaviour:"Eval due", milestone:"Milestone" };
const COACH_STATUS_LABEL: Record<string,string> = { PENDING_REVIEW:"Pending Review", APPROVED:"Verified Coach", REJECTED:"Rejected" };

function timeAgo(iso: string | null): string {
  if (!iso) return "—";
  const ms = Date.now() - new Date(iso).getTime();
  if (ms < 0 || Number.isNaN(ms)) return "—";
  const days = Math.floor(ms / 86_400_000);
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days}d ago`;
  const weeks = Math.floor(days / 7);
  return `${weeks}w ago`;
}

function toCoachPlayer(p: CoachAssignedPlayer): CoachPlayer {
  return {
    id: p.user_id,
    name: p.name,
    city: p.state ? `${p.city}, ${p.state}` : p.city,
    role: p.playing_role,
    age: p.age ?? 0,
    vlevel: VLEVEL_LABEL[p.verification_level] ?? "L1 Self",
    yoyo: p.latest_yoyo != null ? String(p.latest_yoyo) : "—",
    assessed: timeAgo(p.last_assessment_at),
    status: p.pending_action ? (PENDING_STATUS[p.pending_action] ?? "Up to date") : "Up to date",
  };
}

function toSubmission(s: CoachSubmission): Submission {
  return { type: s.kind, name: s.player_name, summary: s.summary, when: timeAgo(s.submitted_at), playerId: s.player_user_id };
}

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

const NAV_ITEMS = [
  { key:"dashboard",  label:"Dashboard",   icon:"dashboard" },
  { key:"players",    label:"My Players",  icon:"players"   },
  { key:"sessions",   label:"Sessions",    icon:"calendar"  },
  { key:"fitness",    label:"Fitness Log", icon:"fitness"   },
  { key:"behaviour",  label:"Behavioural", icon:"brain"     },
  { key:"milestones", label:"Milestones",  icon:"milestone" },
];

// ─── CoKpi ───────────────────────────────────────────────────────────────────

type KpiTone = "accent"|"ok"|"blue"|"purple";
const KPI_TONE: Record<KpiTone,{tint:string;tintBg:string}> = {
  accent: { tint:"var(--ax-accent-bright)",       tintBg:"var(--ax-accent-14)"           },
  ok:     { tint:"var(--ax-ok)",                  tintBg:"var(--ax-ok-soft)"             },
  blue:   { tint:"#7DBBFF",                       tintBg:"rgba(74,158,255,0.14)"         },
  purple: { tint:"#C4B5FD",                       tintBg:"rgba(167,139,250,0.16)"        },
};

function CoKpi({ icon, label, value, tone }: { icon:string; label:string; value:string|number; tone:KpiTone }) {
  const { tint, tintBg } = KPI_TONE[tone];
  return (
    <div style={{
      padding:"1rem 1.1rem", borderRadius:"var(--ax-radius-xl)",
      background:"var(--ax-card)", border:"1px solid var(--ax-border)", boxShadow:"var(--ax-shadow-card)",
    }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
        <span style={{
          fontFamily:"var(--ax-font-label)", textTransform:"uppercase",
          letterSpacing:"0.08em", fontSize:"0.62rem", fontWeight:700, color:"var(--ax-text-faint)",
        }}>{label}</span>
        <span style={{
          width:28, height:28, borderRadius:"var(--ax-radius-sm)",
          background:tintBg, color:tint, display:"grid", placeItems:"center", flexShrink:0,
        }}>
          <DsIcon name={icon} size={15} />
        </span>
      </div>
      <div style={{ fontFamily:"var(--ax-font-display)", fontSize:"2.1rem", lineHeight:0.95, marginTop:"0.55rem" }}>
        {value}
      </div>
    </div>
  );
}

// ─── QuickBtn ────────────────────────────────────────────────────────────────

function QuickBtn({ label, busy, disabled, onClick }: { label:string; busy:boolean; disabled:boolean; onClick:()=>void }) {
  const [hov, setHov] = useState(false);
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        padding:"0.32rem 0.7rem", borderRadius:"var(--ax-radius-sm)",
        fontFamily:"var(--ax-font-label)", textTransform:"uppercase", fontSize:"0.66rem", fontWeight:700,
        border:"1px solid var(--ax-border)", background:"var(--ax-field)",
        color: hov && !disabled && !busy ? "var(--ax-accent-bright)" : "var(--ax-text)",
        borderColor: hov && !disabled && !busy ? "var(--ax-accent)" : "var(--ax-border)",
        opacity: disabled ? 0.4 : 1,
        cursor: disabled ? "not-allowed" : "pointer",
        minWidth:58, transition:"all var(--ax-dur-fast) var(--ax-ease)",
      }}
    >
      {busy ? "…" : label}
    </button>
  );
}

// ─── PermRow ─────────────────────────────────────────────────────────────────

function PermRow({ ok, label, value }: { ok:boolean; label:string; value:string }) {
  return (
    <div style={{
      display:"flex", alignItems:"center", gap:"0.6rem",
      padding:"0.65rem 0.8rem", borderRadius:"var(--ax-radius-md)",
      background:"var(--ax-card)", border:"1px solid var(--ax-border)",
    }}>
      <span style={{
        width:9, height:9, borderRadius:"50%", flexShrink:0,
        background: ok ? "var(--ax-ok)" : "var(--ax-text-faint)",
        boxShadow:  ok ? "0 0 8px var(--ax-ok)" : "none",
      }} />
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ fontSize:"0.8rem", fontWeight:700 }}>{label}</div>
        <div style={{ fontSize:"0.7rem", color: ok ? "var(--ax-ok)" : "var(--ax-text-faint)", marginTop:"0.1rem" }}>{value}</div>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function CoachDashboardClient({ data }: CoachDashboardProps = {}) {
  const router = useRouter();
  const [nav, setNav]       = useState("dashboard");
  const [filter, setFilter] = useState<"all"|"fitness"|"eval">("all");
  const [busy, setBusy]     = useState<string|null>(null);
  const { toast, showToast } = useToast();
  const tableRef = useRef<HTMLDivElement>(null);

  /* Sidebar nav doesn't have separate routed pages (this is a single-page
     dashboard) — clicking it does something real anyway: jumps to and
     filters the actual player table for that category. Milestones has no
     dedicated filter today (no "milestone" entry in the table's filter set
     below), so it scrolls to the table without changing the filter. */
  function goToNav(key: string) {
    setNav(key);
    if (key === "fitness") setFilter("fitness");
    else if (key === "behaviour") setFilter("eval");
    else if (key === "players" || key === "milestones") setFilter("all");
    if (key === "sessions") router.push("/dashboard/coach/sessions");
    else if (key !== "dashboard") tableRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  /* assigned_players/recent_submissions come from lib/dashboard-data.ts's
     loadCoachDashboard(), which is still an explicitly-documented mock (the
     coach_registry/player_profiles/fitness_data schema has no real
     coach↔player link yet — academy_club is free text, fitness_data has no
     recorded_by_user_id). Identity fields (coach_name/status/academy) ARE
     real once a live loader replaces the mock, since those just come from
     this coach's own coach_registry row. The bug fixed here is narrower:
     this component used to ignore `data` completely and render a second,
     entirely different set of hardcoded names — now it at least reflects
     whatever loadCoachDashboard actually returns. */
  const coachName = data?.coach_name ?? "Coach";
  const coachStatusLabel = COACH_STATUS_LABEL[data?.coach_status ?? "PENDING_REVIEW"] ?? data?.coach_status ?? "Pending Review";
  const academyName = data?.academy_name ?? "No academy linked";
  const canSubmit = data?.can_submit_fitness ?? false;
  const firstName = coachName.trim().split(/\s+/)[0] ?? coachName;

  const players = (data?.assigned_players ?? []).map(toCoachPlayer);
  const submissions = (data?.recent_submissions ?? []).map(toSubmission);

  const pendingFitness = players.filter(p => p.status === "Fitness due").length;
  const pendingEval    = players.filter(p => p.status === "Eval due").length;
  const filtered = players.filter(p =>
    filter === "all" ? true : filter === "fitness" ? p.status === "Fitness due" : p.status === "Eval due"
  );

  const quickLog = (p: CoachPlayer, kind: "fitness"|"eval") => {
    if (!canSubmit) return;
    showToast(NO_BACKEND_MSG);
  };

  const kicker: React.CSSProperties = {
    fontFamily:"var(--ax-font-label)", textTransform:"uppercase",
    letterSpacing:"0.18em", fontSize:"11px", fontWeight:700,
    color:"var(--ax-accent-bright)", margin:"0 0 0.4rem",
  };
  const groupLabel: React.CSSProperties = {
    fontFamily:"var(--ax-font-label)", textTransform:"uppercase",
    letterSpacing:"0.16em", fontSize:"0.62rem", fontWeight:700,
    color:"var(--ax-accent-bright)", margin:"0 0 0.7rem",
  };
  const cardShell: React.CSSProperties = {
    position:"relative", overflow:"hidden",
    borderRadius:"var(--ax-radius-xl)",
    background:"var(--ax-card)",
    border:"1px solid var(--ax-border)",
    boxShadow:"var(--ax-shadow-card)",
  };

  const subTone: Record<string,{tint:string;tintBg:string}> = {
    fitness:   { tint:"var(--ax-ok)",    tintBg:"var(--ax-ok-soft)"           },
    behaviour: { tint:"#7DBBFF",         tintBg:"rgba(74,158,255,0.14)"       },
    milestone: { tint:"#C4B5FD",         tintBg:"rgba(167,139,250,0.16)"      },
  };

  return (
    <div style={{
      position:"relative", display:"grid", gridTemplateColumns:"232px 1fr 320px",
      width:"100%", height:"100%", background:"var(--ax-bg)", color:"var(--ax-text)", overflow:"hidden",
    }}>

      {/* ── Sidebar ────────────────────────────────────────────────────── */}
      <aside style={{
        display:"flex", flexDirection:"column",
        background:"var(--ax-bg-soft)", borderRight:"1px solid var(--ax-border)",
        padding:"1.3rem 0.9rem",
      }}>
        {/* Logo */}
        <div style={{ display:"flex", alignItems:"center", gap:"0.7rem", padding:"0 0.4rem 1.3rem" }}>
          <span style={{ fontFamily:"var(--ax-font-display)", fontSize:"1.45rem", textTransform:"uppercase", letterSpacing:"0.04em", lineHeight:1 }}>
            ATHLAS<span style={{ color:"var(--ax-accent)" }}>X</span>
          </span>
          <span style={{
            fontFamily:"var(--ax-font-label)", fontSize:"0.68rem", fontWeight:700,
            textTransform:"uppercase", letterSpacing:"0.12em",
            color:"var(--ax-text-faint)", paddingLeft:"0.7rem",
            borderLeft:"1px solid var(--ax-border)",
          }}>Coach</span>
        </div>

        {/* Nav */}
        <nav style={{ display:"flex", flexDirection:"column", gap:"0.25rem" }}>
          {NAV_ITEMS.map(item => {
            const active = nav === item.key;
            const badge = item.key === "fitness" ? pendingFitness : item.key === "behaviour" ? pendingEval : 0;
            return (
              <button
                key={item.key}
                onClick={() => goToNav(item.key)}
                style={{
                  display:"flex", alignItems:"center", gap:"0.65rem",
                  padding:"0.6rem 0.8rem", borderRadius:"var(--ax-radius-md)",
                  background:    active ? "var(--ax-accent-14)"    : "transparent",
                  border:        active ? "1px solid var(--ax-accent)" : "1px solid transparent",
                  color:         active ? "var(--ax-accent-bright)" : "var(--ax-text-dim)",
                  fontFamily:    "var(--ax-font-label)", fontWeight:700,
                  textTransform: "uppercase", letterSpacing:"0.06em", fontSize:"0.78rem",
                  cursor:"pointer", width:"100%", textAlign:"left",
                  transition:"all var(--ax-dur-fast) var(--ax-ease)",
                }}
              >
                <DsIcon name={item.icon} size={16} />
                <span style={{ flex:1 }}>{item.label}</span>
                {badge > 0 && (
                  <span style={{
                    fontFamily:"var(--ax-font-label)", fontSize:"0.66rem", fontWeight:700,
                    padding:"0.05rem 0.4rem", borderRadius:"999px",
                    background:"var(--ax-accent)", color:"var(--ax-text-on-accent)",
                  }}>{badge}</span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Coach card */}
        <div style={{ marginTop:"auto", padding:"0.9rem 0.6rem 0", borderTop:"1px solid var(--ax-border)" }}>
          <div style={{ display:"flex", gap:"0.6rem", alignItems:"center", marginBottom:"0.5rem" }}>
            <DsAvatar initial={initialsOf(coachName)} size={36} />
            <div>
              <div style={{ fontSize:"0.84rem", fontWeight:700, lineHeight:1.2 }}>{coachName}</div>
              <DsPill tone={canSubmit ? "ok" : "neutral"} size="sm" dot>{coachStatusLabel}</DsPill>
            </div>
          </div>
          <p style={{ fontSize:"0.72rem", color:"var(--ax-text-faint)", margin:"0.6rem 0 0" }}>{academyName}</p>
          {!canSubmit && (
            <div style={{
              display:"flex", gap:"0.5rem", padding:"0.6rem 0.7rem",
              borderRadius:"var(--ax-radius-md)", marginTop:"0.75rem",
              background:"var(--ax-bad-soft)", border:"1px solid var(--ax-bad)",
              alignItems:"flex-start",
            }}>
              <DsIcon name="lock" size={15} style={{ color:"var(--ax-bad-text)", flexShrink:0 }} />
              <small style={{ fontSize:"0.72rem", color:"var(--ax-bad-text)", lineHeight:1.4 }}>
                Submissions locked until your account is approved.
              </small>
            </div>
          )}
        </div>
      </aside>

      {/* ── Centre ─────────────────────────────────────────────────────── */}
      <main style={{ display:"flex", flexDirection:"column", minWidth:0 }}>

        {/* Topbar */}
        <header style={{
          display:"flex", alignItems:"center", justifyContent:"space-between", gap:"1rem",
          padding:"0.85rem 1.6rem", flexShrink:0,
          borderBottom:"1px solid var(--ax-border)",
          background:"rgba(13,13,13,0.72)", backdropFilter:"blur(12px)",
        }}>
          <div style={{ display:"flex", gap:"0.5rem", flexWrap:"wrap" }}>
            <DsPill tone="neutral" size="sm">Workflow P3 · Capture</DsPill>
            <DsPill tone="neutral" size="sm">P4 · Endorse Scorecards</DsPill>
          </div>
          <div style={{ display:"flex", alignItems:"center", gap:"0.65rem" }}>
            <Link href="/dashboard/coach/sessions" style={{ textDecoration:"none" }}>
              <DsButton variant="outline" size="sm" leadingIcon={<DsIcon name="calendar" size={14} />}>Sessions & Attendance</DsButton>
            </Link>
            <button style={{
              width:38, height:38, borderRadius:"var(--ax-radius-md)",
              background:"var(--ax-field)", border:"1px solid var(--ax-border)",
              color:"var(--ax-text-dim)", cursor:"pointer",
              display:"grid", placeItems:"center", position:"relative", flexShrink:0,
            }} onClick={() => showToast("No new notifications.") }>
              <DsIcon name="bell" size={17} />
              <span style={{
                position:"absolute", top:7, right:7, width:7, height:7,
                borderRadius:"50%", background:"var(--ax-accent)", boxShadow:"var(--ax-glow-dot)",
              }} />
            </button>
          </div>
        </header>

        {/* Scroll area */}
        <div style={{ flex:1, overflowY:"auto", padding:"1.5rem 1.6rem 2.5rem" }}>

          {/* Hero header */}
          <p style={kicker}>Coach Dashboard</p>
          <h1 style={{ fontFamily:"var(--ax-font-display)", textTransform:"uppercase", fontWeight:400, lineHeight:0.92, fontSize:"clamp(30px,3.4vw,46px)", margin:"0 0 0.5rem" }}>
            Good evening, <span style={{ color:"var(--ax-accent)" }}>{firstName}</span>
          </h1>
          <p style={{ margin:"0 0 1.4rem", fontSize:"0.92rem", color:"var(--ax-text-dim)" }}>
            {academyName} · {players.length} assigned players
          </p>

          {/* KPI strip */}
          <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:"0.9rem", marginBottom:"1.6rem" }}>
            <CoKpi icon="assigned" label="Assigned"        value={players.length}          tone="accent"  />
            <CoKpi icon="fitness"  label="Fitness Due"     value={pendingFitness}          tone="ok"      />
            <CoKpi icon="brain"    label="Evals Due"       value={pendingEval}             tone="blue"    />
            <CoKpi icon="check"    label="Submitted · 30d" value={data?.counts.submissions_30d ?? 0} tone="purple"  />
          </div>

          {/* My Players table */}
          <div ref={tableRef} style={cardShell}>
            <div aria-hidden style={{ position:"absolute", inset:0, pointerEvents:"none", background:"var(--ax-corner-glow)" }} />
            <div style={{ position:"relative" }}>

              {/* Table header + filter pills */}
              <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", gap:"1rem", padding:"1.1rem 1.4rem 0.9rem", flexWrap:"wrap" }}>
                <h2 style={{ fontFamily:"var(--ax-font-label)", textTransform:"uppercase", letterSpacing:"0.06em", fontSize:"1rem", fontWeight:700, margin:0 }}>
                  My Players
                </h2>
                <div style={{ display:"flex", gap:"0.4rem" }}>
                  {([["all","All",players.length],["fitness","Fitness",pendingFitness],["eval","Behaviour",pendingEval]] as [string,string,number][]).map(([key,label,count]) => {
                    const active = filter === key;
                    return (
                      <button key={key} onClick={() => setFilter(key as any)} style={{
                        padding:"0.28rem 0.7rem", borderRadius:"var(--ax-radius-pill)",
                        fontFamily:"var(--ax-font-label)", textTransform:"uppercase", fontSize:"0.68rem", fontWeight:700,
                        cursor:"pointer",
                        border:      active ? "1px solid var(--ax-accent)"    : "1px solid var(--ax-border)",
                        background:  active ? "var(--ax-accent-14)"           : "transparent",
                        color:       active ? "var(--ax-accent-bright)"       : "var(--ax-text-dim)",
                        transition:"all var(--ax-dur-fast) var(--ax-ease)",
                      }}>{label} {count}</button>
                    );
                  })}
                </div>
              </div>

              <div style={{ overflowX:"auto" }}>
                <table style={{ width:"100%", borderCollapse:"collapse", fontSize:"0.87rem" }}>
                  <thead>
                    <tr style={{ background:"var(--ax-bg-soft)" }}>
                      {["Player","Role","Age","Verification","Last YoYo","Last Assessed","Status","Quick log"].map((h, i) => (
                        <th key={i} style={{
                          padding:"0.6rem 0.9rem",
                          textAlign: [2,4].includes(i) ? "center" : i === 7 ? "right" : "left",
                          fontFamily:"var(--ax-font-label)", textTransform:"uppercase",
                          letterSpacing:"0.06em", fontSize:"0.65rem", fontWeight:700,
                          color:"var(--ax-text-faint)", borderBottom:"1px solid var(--ax-border)",
                          whiteSpace:"nowrap",
                        }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map(p => (
                      <tr
                        key={p.id}
                        style={{ borderBottom:"1px solid var(--ax-border)", transition:"background var(--ax-dur-fast)" }}
                        onMouseEnter={e => (e.currentTarget.style.background = "var(--ax-bg-elevated)")}
                        onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                      >
                        {/* Player */}
                        <td style={{ padding:"0.7rem 0.9rem" }}>
                          <div style={{ display:"flex", alignItems:"center", gap:"0.6rem" }}>
                            <DsAvatar initial={p.name.split(" ").map(w=>w[0]).join("").slice(0,2)} size={28} />
                            <div>
                              <div style={{ fontWeight:700, fontSize:"0.86rem" }}>{p.name}</div>
                              <div style={{ fontSize:"0.7rem", color:"var(--ax-text-faint)" }}>{p.city}</div>
                            </div>
                          </div>
                        </td>
                        {/* Role */}
                        <td style={{ padding:"0.7rem 0.9rem", color:"var(--ax-text-dim)" }}>{p.role}</td>
                        {/* Age */}
                        <td style={{ padding:"0.7rem 0.9rem", textAlign:"center", color:"var(--ax-text-dim)", fontVariantNumeric:"tabular-nums" }}>{p.age}</td>
                        {/* Verification */}
                        <td style={{ padding:"0.7rem 0.9rem" }}>
                          <DsPill tone={VLEVEL_TONE[p.vlevel] ?? "neutral"} size="sm">{p.vlevel}</DsPill>
                        </td>
                        {/* YoYo */}
                        <td style={{ padding:"0.7rem 0.9rem", textAlign:"center", fontVariantNumeric:"tabular-nums", color:"var(--ax-text)" }}>{p.yoyo}</td>
                        {/* Last assessed */}
                        <td style={{ padding:"0.7rem 0.9rem", color:"var(--ax-text-faint)", whiteSpace:"nowrap" }}>{p.assessed}</td>
                        {/* Status */}
                        <td style={{ padding:"0.7rem 0.9rem" }}>
                          <DsPill
                            tone={STATUS_TONE[p.status] ?? "neutral"}
                            dot={STATUS_TONE[p.status] !== "ghost"}
                            size="sm"
                          >{p.status}</DsPill>
                        </td>
                        {/* Quick log */}
                        <td style={{ padding:"0.7rem 0.9rem", textAlign:"right" }}>
                          <div style={{ display:"flex", gap:"0.4rem", justifyContent:"flex-end" }}>
                            <QuickBtn label="Fitness" busy={busy === `${p.id}:fitness`} disabled={!canSubmit} onClick={() => quickLog(p, "fitness")} />
                            <QuickBtn label="Eval"    busy={busy === `${p.id}:eval`}    disabled={!canSubmit} onClick={() => quickLog(p, "eval")}    />
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

            </div>
          </div>

        </div>
      </main>

      {/* ── Right Panel ────────────────────────────────────────────────── */}
      <aside style={{
        borderLeft:"1px solid var(--ax-border)", background:"var(--ax-bg-soft)",
        overflowY:"auto", padding:"1.3rem 1.2rem 2.5rem",
      }}>

        {/* Submission permissions */}
        <div style={{ marginBottom:"1.6rem" }}>
          <p style={groupLabel}>Submission permissions</p>
          <div style={{ display:"flex", flexDirection:"column", gap:"0.5rem" }}>
            <PermRow ok={data?.coach_status === "APPROVED"} label="Coach status approved" value={coachStatusLabel} />
            <PermRow ok={!!data?.academy_name} label="Bound to academy" value={academyName} />
            <PermRow ok={canSubmit} label="Can submit fitness / behaviour" value={canSubmit ? "Yes" : "No"} />
          </div>
        </div>

        {/* Recent submissions */}
        <div style={{ marginBottom:"1.6rem" }}>
          <p style={groupLabel}>Recent submissions</p>
          <div style={{ display:"flex", flexDirection:"column", gap:"0.5rem" }}>
            {submissions.map((s, i) => {
              const { tint, tintBg } = subTone[s.type] ?? subTone.fitness;
              const icon = s.type === "behaviour" ? "brain" : s.type === "milestone" ? "milestone" : "fitness";
              return (
                <a
                  key={i}
                  href={`/profile/${s.playerId}`}
                  onClick={e => { e.preventDefault(); router.push(`/profile/${s.playerId}`); }}
                  style={{
                    display:"flex", gap:"0.6rem", padding:"0.6rem 0.7rem",
                    borderRadius:"var(--ax-radius-md)",
                    background:"var(--ax-card)", border:"1px solid var(--ax-border)",
                    alignItems:"center", textDecoration:"none", color:"var(--ax-text)",
                  }}
                >
                  <span style={{
                    width:30, height:30, borderRadius:"var(--ax-radius-sm)",
                    background:tintBg, color:tint, display:"grid", placeItems:"center", flexShrink:0,
                  }}>
                    <DsIcon name={icon} size={15} />
                  </span>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontSize:"0.82rem", fontWeight:700 }}>{s.name}</div>
                    <div style={{ fontSize:"0.7rem", color:"var(--ax-text-faint)", whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{s.summary}</div>
                  </div>
                  <span style={{ fontSize:"0.68rem", color:"var(--ax-text-faint)", flex:"0 0 auto" }}>{s.when}</span>
                </a>
              );
            })}
          </div>
        </div>

        {/* Quick actions */}
        <p style={groupLabel}>Quick actions</p>
        <div style={{ display:"flex", flexDirection:"column", gap:"0.5rem" }}>
          {[
            { label:"Log Fitness Assessment",       icon:"plus" },
            { label:"Add Behavioural Evaluation",   icon:"plus" },
            { label:"Record Milestone",             icon:"plus" },
          ].map(({ label, icon }) => (
            <QuickAction key={label} label={label} icon={icon} onAction={() => showToast(NO_BACKEND_MSG)} />
          ))}
        </div>

      </aside>

      <DsToast message={toast} />
    </div>
  );
}

// ─── QuickAction (right panel button) ────────────────────────────────────────

function QuickAction({ label, icon, onAction }: { label:string; icon:string; onAction:()=>void }) {
  const [hov, setHov] = useState(false);
  return (
    <button
      onClick={onAction}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        display:"flex", alignItems:"center", gap:"0.6rem",
        padding:"0.7rem 0.85rem", borderRadius:"var(--ax-radius-md)",
        background:"var(--ax-field)",
        border:`1px solid ${hov ? "var(--ax-accent)" : "var(--ax-border)"}`,
        color: hov ? "var(--ax-accent-bright)" : "var(--ax-text)",
        fontFamily:"var(--ax-font-body)", fontSize:"0.85rem", fontWeight:600,
        cursor:"pointer", textAlign:"left", width:"100%",
        transition:"all var(--ax-dur-fast) var(--ax-ease)",
      }}
    >
      <DsIcon name={icon} size={16} style={{ color:"var(--ax-accent-bright)", flexShrink:0 }} />
      {label}
    </button>
  );
}
