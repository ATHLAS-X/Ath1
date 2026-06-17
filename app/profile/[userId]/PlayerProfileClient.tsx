"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { initials, scoreRingPath, AVA_COLORS, roleColor, calcAge } from "@/lib/score-utils";
import { Ring, Ladder } from "@/components/sx/widgets";
import "@/app/sportx.css";

const PHASE_COLORS: Record<string, string> = {
  Powerplay: "#3B82F6",
  Middle: "#8B5CF6",
  Death: "#F59E0B",
};

const SB_COLORS = ["#3B82F6", "#8B5CF6", "#F59E0B", "#22C55E", "#EC4899", "#9aa3b2"];

interface Props {
  userId: string;
  data: any;
  viewerRole?: string;
  viewerId?: string;
}

function BigScoreRing({ score }: { score: number }) {
  const S = 132, cx = S / 2, cy = S / 2, w = 9;
  const { r, circ, fill, col } = scoreRingPath(score, S, w);
  const arcRef = useRef<SVGCircleElement>(null);

  useEffect(() => {
    if (!arcRef.current) return;
    arcRef.current.style.strokeDashoffset = String(circ);
    const id = requestAnimationFrame(() => {
      if (!arcRef.current) return;
      arcRef.current.style.transition = "stroke-dashoffset 1.2s ease-out";
      arcRef.current.style.strokeDashoffset = "0";
    });
    return () => cancelAnimationFrame(id);
  }, [circ]);

  return (
    <svg width={S} height={S} viewBox={`0 0 ${S} ${S}`}>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="#1A1A1A" strokeWidth={w} />
      <circle ref={arcRef} cx={cx} cy={cy} r={r} fill="none" stroke={col} strokeWidth={w}
        strokeLinecap="round"
        strokeDasharray={`${fill.toFixed(1)} ${(circ - fill).toFixed(1)}`}
        transform={`rotate(-90 ${cx} ${cy})`}
        style={{ filter: "drop-shadow(0 0 6px rgba(34,197,94,0.35))" }} />
      <text x={cx} y={cy - 4} textAnchor="middle" fill="#F0F0F0"
        fontSize="34" fontWeight="700" fontFamily="Space Grotesk,monospace">{score}</text>
      <text x={cx} y={cy + 16} textAnchor="middle" fill="#555555"
        fontSize="8.5" letterSpacing="2" fontFamily="Space Grotesk,monospace">SPORTX SCORE</text>
    </svg>
  );
}

export default function PlayerProfileClient({ userId, data, viewerRole, viewerId }: Props) {
  const router = useRouter();
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState("T20");
  const [shortlisted, setShortlisted] = useState(false);
  const [inviteSent, setInviteSent] = useState(false);
  const [noteOpen, setNoteOpen] = useState(false);
  const [note, setNote] = useState("");

  const isOwner = viewerId === userId;
  const isScout = viewerRole === "scout";

  const { user, profile, cricket, performance, matches, fitness, video, score, aadhaar, coach } = data;
  const age = calcAge(aadhaar?.verified_dob ?? profile?.date_of_birth);
  const name = user?.name ?? "Player";
  const role = cricket?.player_role ?? profile?.playing_role ?? "Player";
  const state = profile?.state ?? "";
  const city = profile?.city ?? "";
  const academy = profile?.academy_name_custom ?? "";

  const perf = performance.find((p: any) => p.format === activeTab) ?? performance[0] ?? null;

  /* Verification ladder level: explicit column if present, otherwise derived */
  const vLevel = Number(
    profile?.verification_level
      ?? 1 + (aadhaar?.age_verified ? 1 : 0) + (score?.coach_verified ? 1 : 0),
  );

  /* Profile completion checklist — drives the hero ring and the checklist card */
  const checklist = [
    { n: "Basic Profile", done: Boolean(profile) },
    { n: "Cricket Profile", done: Boolean(cricket ?? profile?.playing_role) },
    { n: "Videos", done: Boolean(video?.youtube_video_id) },
    { n: "Performance Stats", done: performance.length > 0 },
    { n: "Match History", done: matches.length > 0 },
    { n: "Fitness Tests", done: Boolean(fitness) },
    { n: "Coach Evaluation", done: score?.coach_verified === true },
    { n: "Identity Verification", done: aadhaar?.age_verified === true },
  ];
  const completionPct = Math.round((checklist.filter((c) => c.done).length / checklist.length) * 100);

  const sbRows = [
    { n: "Performance", v: score?.performance_score ?? 0, m: 40, col: "#3B82F6" },
    { n: "Experience",  v: score?.experience_score ?? 0,  m: 15, col: "#8B5CF6" },
    { n: "Fitness",     v: score?.fitness_score ?? 0,     m: 15, col: "#F59E0B" },
    { n: "Verification",v: score?.verification_score ?? 0,m: 15, col: "#22C55E" },
    { n: "Mindset",     v: score?.mindset_score ?? 0,     m: 10, col: "#EC4899" },
    { n: "Profile",     v: score?.profile_score ?? 0,     m: 5,  col: "#9aa3b2" },
  ];

  const fitRows = fitness ? [
    { n: "Sprint",   pct: fitness.sprint_time ? Math.min(100, ((5.5 - fitness.sprint_time) / 1.5) * 100) : 0, mark: 72, v: fitness.sprint_time ? `${fitness.sprint_time}s` : "—" },
    { n: "Push-ups", pct: fitness.pushups_60s ? Math.min(100, (fitness.pushups_60s / 60) * 100) : 0, mark: 62, v: fitness.pushups_60s ?? "—" },
    { n: "Yo-Yo",    pct: fitness.yoyo_level ? Math.min(100, (fitness.yoyo_level / 20) * 100) : 0, mark: 70, v: fitness.yoyo_level ?? "—" },
    { n: "2km",      pct: fitness.run_2km_time ? 70 : 0, mark: 66, v: fitness.run_2km_time ?? "—" },
    { n: "HR",       pct: fitness.resting_hr_bpm ? Math.min(100, ((80 - fitness.resting_hr_bpm) / 20) * 100 + 50) : 0, mark: 60, v: fitness.resting_hr_bpm ? `${fitness.resting_hr_bpm}bpm` : "—" },
    { n: "BMI",      pct: fitness.bmi ? Math.min(100, ((30 - Math.abs(Number(fitness.bmi) - 22)) / 8) * 100) : 0, mark: 78, v: fitness.bmi ? Number(fitness.bmi).toFixed(1) : "—" },
  ] : [];

  const roadmap = score?.roadmap ? (typeof score.roadmap === "string" ? JSON.parse(score.roadmap) : score.roadmap) : null;
  const topActions: string[] = roadmap?.top_3_actions ?? [];

  const handleCopy = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShortlist = async () => {
    await fetch("/api/scout/shortlist", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ player_user_id: userId }),
    });
    setShortlisted(true);
  };

  const handleInvite = async () => {
    await fetch("/api/scout/trial-invite", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ player_user_id: userId }),
    });
    setInviteSent(true);
  };

  const handleNote = async () => {
    await fetch("/api/scout/notes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ player_user_id: userId, note }),
    });
    setNoteOpen(false);
    setNote("");
  };

  return (
    <div className="sx-root" style={{ paddingBottom: isScout ? 72 : 0 }}>
      <style dangerouslySetInnerHTML={{ __html: `
        .sx-root { font-family: 'Instrument Sans', system-ui, sans-serif; }
        .shell { max-width: 1480px; margin: 0 auto; padding: 16px; }
        .topbar { display: flex; align-items: center; gap: 12px; margin-bottom: 14px; }
        .back { display: inline-flex; align-items: center; gap: 6px; color: var(--lbl); font-size: 12px; text-decoration: none; transition: color 0.15s; }
        .back:hover { color: var(--text); }
        .hero { position: relative; min-height: 280px; display: flex; align-items: flex-start; padding: 26px 30px 22px; overflow: hidden; }
        .hero-glow { position: absolute; right: 110px; top: 30px; width: 280px; height: 280px; border-radius: 50%; background: #F59E0B; opacity: 0.08; filter: blur(60px); pointer-events: none; }
        .hero-left { position: relative; z-index: 2; flex: 1; min-width: 0; }
        .hero-label-row { display: flex; align-items: center; gap: 8px; }
        .hero-name { font-family: var(--num); font-size: 48px; font-weight: 700; line-height: 1.05; margin-top: 8px; letter-spacing: 0.01em; }
        .hero-role-row { display: flex; align-items: center; gap: 10px; margin-top: 10px; }
        .hero-academy { font-size: 12px; color: var(--mut); }
        .hero-stats { display: flex; gap: 8px; margin-top: 22px; flex-wrap: wrap; }
        .hstat { width: 90px; padding: 10px 8px; text-align: center; background: var(--card); border: 1px solid var(--line); border-radius: 10px; }
        .hstat .v { font-family: var(--num); font-size: 24px; font-weight: 700; }
        .hstat .l { font-size: 9px; letter-spacing: 1.2px; text-transform: uppercase; color: var(--mut); margin-top: 2px; }
        /* Container is fully transparent — no card background peeking around
           the photo. The image itself (or the initials fallback) carries
           its own shape and contrast. */
        .hero-photo { position: absolute; right: 170px; top: 18px; bottom: 18px; z-index: 3; width: 220px; height: auto; max-height: calc(100% - 36px); display: flex; align-items: center; justify-content: center; background: transparent; border: none; border-radius: 0; overflow: visible; }
        .hero-photo img { width: 100%; height: 100%; object-fit: contain; }
        .hero-tier { position: relative; z-index: 2; margin-left: auto; width: 132px; flex-shrink: 0; display: flex; flex-direction: column; align-items: center; gap: 8px; text-align: center; }
        .tier-lbl { font-size: 9px; letter-spacing: 2px; text-transform: uppercase; color: var(--lbl2); font-family: var(--num); font-weight: 600; }
        .cc-row { display: flex; align-items: center; gap: 9px; padding: 7px 0; font-size: 12px; }
        .cc-row + .cc-row { border-top: 1px solid var(--line); }
        .cc-row .nm { flex: 1; color: var(--lbl); }
        .cc-ok { color: var(--green); font-family: var(--num); font-weight: 700; font-size: 11px; }
        .cc-miss { color: var(--mut); font-family: var(--num); font-weight: 600; font-size: 11px; }
        .vbar-wrap { width: 120px; }
        .vbar-lbl { display: flex; justify-content: space-between; font-size: 10px; color: var(--lbl); margin-bottom: 4px; }
        .vbar { height: 5px; background: var(--line); border-radius: 99px; overflow: hidden; }
        .vbar .fill { height: 100%; background: var(--green); border-radius: 99px; box-shadow: 0 0 8px var(--green-glow); }
        .main { display: grid; grid-template-columns: 30% 1fr 30%; gap: 14px; margin-top: 14px; align-items: stretch; }
        .colstack { display: flex; flex-direction: column; gap: 14px; min-width: 0; height: 100%; }
        /* Last card in each column grows to fill the remaining height so column bottoms align */
        .colstack > .card:last-child { flex: 1 1 auto; }
        .colstack > .card:last-child > .cb { height: 100%; }
        .chead2 { display: flex; align-items: center; justify-content: space-between; padding: 12px 14px 0; }
        .cb { padding: 12px 14px 14px; }
        .id-row { display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 8px 0; }
        .id-row + .id-row { border-top: 1px solid var(--line); }
        .id-row .k { font-size: 11.5px; color: var(--mut); }
        .id-row .v { font-size: 12.5px; font-weight: 600; display: flex; align-items: center; gap: 6px; }
        .fit-big { display: flex; align-items: baseline; gap: 8px; }
        .fit-big .v { font-family: var(--num); font-size: 34px; font-weight: 700; color: var(--green); }
        .fit-big .m { font-family: var(--num); font-size: 15px; color: var(--mut); }
        .fit-big .l { font-size: 9px; letter-spacing: 2px; text-transform: uppercase; color: var(--lbl2); margin-left: auto; }
        .fm-row { display: flex; align-items: center; gap: 9px; margin-top: 9px; }
        .fm-row .n { font-size: 11px; color: var(--mut); width: 60px; flex-shrink: 0; }
        .fm-track { flex: 1; position: relative; height: 5px; background: var(--card-alt); border: 1px solid var(--line); border-radius: 99px; }
        .fm-fill { position: absolute; left: 0; top: 0; bottom: 0; background: var(--green); border-radius: 99px; }
        .fm-mark { position: absolute; top: -3px; width: 1.5px; height: 11px; background: var(--amber); }
        .fm-row .v { font-family: var(--num); font-size: 11.5px; font-weight: 600; width: 44px; text-align: right; flex-shrink: 0; }
        .tabs { display: flex; gap: 5px; }
        .tab { height: 25px; padding: 0 13px; border-radius: 7px; display: inline-flex; align-items: center; font-family: var(--num); font-size: 11px; font-weight: 600; color: var(--mut); background: transparent; border: 1px solid transparent; cursor: pointer; }
        .tab.on { background: var(--head); border-color: var(--line2); color: var(--text); }
        .phase-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
        .phase { background: var(--card-alt); border: 1px solid var(--line); border-radius: 10px; padding: 10px 12px; }
        .phase .n { font-size: 9px; letter-spacing: 1.6px; text-transform: uppercase; color: var(--lbl); }
        .phase .v { font-family: var(--num); font-size: 22px; font-weight: 700; margin-top: 3px; }
        .phase .bar { position: relative; height: 4px; background: var(--line); border-radius: 99px; margin-top: 8px; }
        .phase .bar .f { position: absolute; left: 0; top: 0; bottom: 0; border-radius: 99px; }
        .phase .bm { position: absolute; top: -2.5px; width: 1.5px; height: 9px; background: rgba(240,240,240,0.45); }
        .phase .bm-lbl { font-size: 8.5px; color: var(--lbl2); margin-top: 5px; font-family: var(--num); }
        .sgrid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 7px; }
        .sg-cell { background: var(--card-alt); border: 1px solid var(--line); border-radius: 9px; padding: 8px 6px; text-align: center; }
        .sg-cell .v { font-family: var(--num); font-size: 16px; font-weight: 700; }
        .sg-cell .v.na { color: var(--mut); }
        .sg-cell .l { font-size: 8px; letter-spacing: 1px; text-transform: uppercase; color: var(--mut); margin-top: 2px; }
        .sect-label2 { font-family: var(--num); font-size: 10px; font-weight: 600; letter-spacing: 1.8px; text-transform: uppercase; color: var(--lbl2); margin: 14px 0 7px; }
        .sect-label2:first-child { margin-top: 0; }
        .mh-row { display: flex; align-items: center; gap: 8px; padding: 8px 0; font-size: 12px; }
        .mh-row + .mh-row { border-top: 1px solid var(--line); }
        .mh-opp { font-weight: 600; width: 92px; flex-shrink: 0; }
        .mh-score { font-family: var(--num); font-weight: 600; margin-left: auto; }
        .sb-bars { margin-top: 12px; display: flex; flex-direction: column; gap: 9px; }
        .sbb { display: flex; align-items: center; gap: 9px; }
        .sbb .n { font-size: 11px; color: var(--mut); width: 76px; flex-shrink: 0; }
        .sbb .track { flex: 1; height: 5px; background: var(--card-alt); border: 1px solid var(--line); border-radius: 99px; overflow: hidden; }
        .sbb .fill { height: 100%; border-radius: 99px; }
        .sbb .v { font-family: var(--num); font-size: 11px; font-weight: 600; width: 40px; text-align: right; flex-shrink: 0; }
        .road-action { background: var(--card-alt); border: 1px solid var(--line); border-radius: 10px; padding: 10px 12px; }
        .road-action .t { font-size: 12.5px; font-weight: 600; }
        .road-track { height: 5px; background: var(--line); border-radius: 99px; margin-top: 8px; overflow: hidden; }
        .road-track .f { height: 100%; background: var(--green); border-radius: 99px; }
        .road-meta { display: flex; justify-content: space-between; font-size: 10px; color: var(--mut); margin-top: 5px; font-family: var(--num); }
        .road-collapsed { display: flex; align-items: center; gap: 8px; padding: 9px 12px; margin-top: 7px; background: var(--card-alt); border: 1px solid var(--line); border-radius: 10px; font-size: 11.5px; color: var(--mut); cursor: pointer; transition: border-color 0.15s; }
        .road-collapsed:hover { border-color: var(--line2); }
        .vid-wrap { position: relative; }
        .vid-play { position: absolute; inset: 0; display: grid; place-items: center; pointer-events: none; }
        .vid-play .p { width: 36px; height: 36px; border-radius: 50%; background: rgba(10,10,10,0.72); border: 1px solid var(--line2); display: grid; place-items: center; }
        .pill-row { display: flex; gap: 6px; flex-wrap: wrap; margin-top: 8px; }
        .wpill { display: inline-flex; align-items: center; gap: 5px; padding: 5px 10px; border-radius: 99px; font-size: 11px; font-weight: 500; }
        .wpill.g { background: var(--green-bg); border: 1px solid var(--green-bd); color: #86efac; }
        .wpill.a { background: var(--amber-bg); border: 1px solid var(--amber-bd); color: #fcd34d; }
        .scout-bar { position: fixed; bottom: 0; left: 0; right: 0; z-index: 50; background: #111111; border-top: 1px solid var(--line); padding: 12px 24px; display: flex; align-items: center; gap: 10px; }
      ` }} />

      <div className="shell">
        {/* Topbar */}
        <div className="topbar">
          <Link className="back" href={isScout ? "/scout/dashboard" : "/dashboard"}>
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path d="M7.5 2L3.5 6L7.5 10" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            {isScout ? "Back to Scout Dashboard" : "Dashboard"}
          </Link>
          <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
            <button className="btn sm" onClick={handleCopy}>
              {copied ? "Copied!" : "Share Profile"}
            </button>
            {isOwner && (
              <Link href="/onboarding/4" className="btn sm" style={{ textDecoration: "none" }}>Edit</Link>
            )}
          </div>
        </div>

        {/* ═══ HERO ═══ */}
        <div className="card hero">
          <div className="hero-glow" />

          <div className="hero-left">
            <div className="hero-label-row">
              <span className="sect-title">Player Profile</span>
              {score?.coach_verified && (
                <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
                  <path d="M7 1L12 3V7C12 10 10 12.4 7 13C4 12.4 2 10 2 7V3L7 1Z" stroke="#22C55E" strokeWidth="1.2" strokeLinejoin="round" />
                  <path d="M5 7L6.4 8.4L9 5.6" stroke="#22C55E" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
            </div>
            <h1 className="hero-name">{name.toUpperCase()}</h1>
            <div className="hero-role-row">
              <span className="bdg solid-green">{role}</span>
              <span className="hero-academy">
                {[academy, city, state].filter(Boolean).join(" · ")}
              </span>
            </div>
            <Ladder level={vLevel} />
            <div className="hero-stats">
              <div className="hstat">
                <div className="v" style={{ color: "var(--green)" }}>{score?.total_score ?? "—"}</div>
                <div className="l">SportX Score</div>
              </div>
              <div className="hstat">
                <div className="v">{perf?.bpi != null ? Number(perf.bpi).toFixed(1) : "—"}</div>
                <div className="l">BPI</div>
              </div>
              <div className="hstat">
                <div className="v">{perf?.matches ?? "—"}</div>
                <div className="l">Matches</div>
              </div>
              <div className="hstat">
                <div className="v">{perf?.wickets ?? "—"}</div>
                <div className="l">Wickets</div>
              </div>
              <div className="hstat">
                <div className="v">{age ?? "—"}</div>
                <div className="l">Age</div>
              </div>
            </div>
          </div>

          {/* Photo / avatar */}
          <div className="hero-photo">
            {profile?.avatar_url ? (
              <Image src={profile.avatar_url} alt={name} fill style={{ objectFit: "contain" }} />
            ) : (
              <div style={{
                width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center",
                background: `radial-gradient(circle at 35% 32%, ${AVA_COLORS[0]}, #052e14)`,
                borderRadius: "50%",
                fontFamily: "var(--num)", fontWeight: 700, fontSize: 64, color: "#04140a",
              }}>
                {initials(name)}
              </div>
            )}
          </div>

          <div className="hero-tier">
            <span className="tier-lbl">Profile<br />Completion</span>
            <Ring pct={completionPct} size={84} stroke={7} />
            <span className={`bdg ${profile?.profile_status === "Live" ? "green" : "ghost"}`}>
              {profile?.profile_status === "Live" ? "Live · Consent ✓" : (profile?.profile_status ?? "Draft")}
            </span>
          </div>
        </div>

        {/* ═══ MAIN ═══ */}
        <div className="main">

          {/* LEFT */}
          <div className="colstack">
            <div className="card">
              <div className="chead2"><span className="sect-title">Identity</span></div>
              <div className="cb">
                {[
                  {
                    /* Always show the DOB the player declared on their profile —
                       the Aadhaar mock returns a simulated DOB which can shadow
                       the real one. The Aadhaar ✓ badge still indicates that
                       identity was checked, but the date shown is the player's
                       actual entry. */
                    k: "Date of Birth",
                    v: profile?.date_of_birth
                      ? new Date(profile.date_of_birth).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })
                      : "—",
                    tag: aadhaar?.age_verified ? "Aadhaar ✓" : null,
                    tagColor: "green",
                  },
                  {
                    /* Prefer the player's declared height/weight on the profile.
                       fitness_data is updated later (and can lag); only fall back
                       to it when the profile values are missing. BMI is always
                       recomputed from the chosen height/weight pair so all three
                       numbers stay self-consistent. */
                    k: "Height / Weight / BMI",
                    v: (() => {
                      const hCm = profile?.height_cm != null
                        ? Number(profile.height_cm)
                        : fitness?.height_cm != null ? Number(fitness.height_cm) : null;
                      const wKg = profile?.weight_kg != null
                        ? Number(profile.weight_kg)
                        : fitness?.weight_kg != null ? Number(fitness.weight_kg) : null;
                      if (hCm == null && wKg == null) return "—";
                      const bmi = hCm && wKg ? (wKg / Math.pow(hCm / 100, 2)).toFixed(1) : "—";
                      return `${hCm != null ? hCm.toFixed(0) : "—"}cm · ${wKg != null ? wKg.toFixed(0) : "—"}kg · ${bmi}`;
                    })(),
                  },
                  { k: "State", v: state || "—" },
                  { k: "District", v: profile?.district || "—" },
                  {
                    k: "Academy",
                    v: academy || "—",
                    tag: academy ? "Registered ✓" : null,
                    tagColor: "green",
                  },
                  {
                    k: "Coach",
                    v: coach?.coach_name || "—",
                    tag: coach?.coach_status === "APPROVED" ? "Verified ✓" : null,
                    tagColor: "green",
                  },
                ].map(({ k, v, tag, tagColor }) => (
                  <div key={k} className="id-row">
                    <span className="k">{k}</span>
                    <span className="v">
                      {v}
                      {tag && <span className={`bdg ${tagColor ?? "green"}`} style={{ height: 17, fontSize: "8.5px" }}>{tag}</span>}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="card">
              <div className="chead2">
                <span className="sect-title">Profile Completion</span>
                <span className={`bdg ${completionPct >= 75 ? "green" : completionPct >= 50 ? "amber" : "ghost"}`}>{completionPct}%</span>
              </div>
              <div className="cb">
                {checklist.map((c) => (
                  <div key={c.n} className="cc-row">
                    <span className="nm">{c.n}</span>
                    {c.done
                      ? <span className="cc-ok">✓ Done</span>
                      : <span className="cc-miss">○ Missing</span>}
                  </div>
                ))}
              </div>
            </div>

            <div className="card">
              <div className="chead2"><span className="sect-title">Fitness Score</span></div>
              <div className="cb">
                {fitness ? (
                  <>
                    <div className="fit-big">
                      <span className="v">{fitness.fitness_score ?? "—"}</span>
                      <span className="m">/100</span>
                      <span className="l">Fitness</span>
                    </div>
                    <div style={{ marginTop: 6 }}>
                      {fitRows.map((f) => (
                        <div key={f.n} className="fm-row">
                          <span className="n">{f.n}</span>
                          <div className="fm-track">
                            <div className="fm-fill" style={{ width: `${Math.max(0, f.pct)}%` }} />
                            <div className="fm-mark" style={{ left: `${f.mark}%` }} />
                          </div>
                          <span className="v">{f.v}</span>
                        </div>
                      ))}
                    </div>
                  </>
                ) : (
                  <div style={{ color: "var(--mut)", fontSize: 12 }}>
                    Complete fitness assessment
                    {isOwner && (
                      <Link href="/onboarding" style={{ color: "var(--green)", marginLeft: 6 }}>→ Start</Link>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Behavioural / Mental Assessment — own profile only, hidden from scouts */}
            {isOwner && !isScout && data.behaviour && (
              <div className="card">
                <div className="chead2">
                  <span className="sect-title">Mental Assessment 🔒</span>
                  <span className="bdg ghost">Private</span>
                </div>
                <div className="cb">
                  {(() => {
                    /* behavioural_assessment.mindset_score is stored on a
                       0–100 scale (DB-level — see lib/dashboard-data.ts).
                       Auto-detect the scale so legacy 0–10 rows still render
                       correctly. */
                    const raw = data.behaviour.mindset_score ?? 0;
                    const max = raw > 10 ? 100 : 10;
                    const m = Math.min(max, Math.max(0, raw));
                    const r = 32, circ = 2 * Math.PI * r;
                    const fill = (m / max) * circ;
                    return (
                      <div style={{ display: "flex", justifyContent: "center", padding: "4px 0 10px" }}>
                        <svg width="80" height="80" viewBox="0 0 80 80">
                          <circle cx="40" cy="40" r={r} fill="none" stroke="#1A1A1A" strokeWidth="6" />
                          <circle cx="40" cy="40" r={r} fill="none" stroke="#EC4899" strokeWidth="6"
                            strokeLinecap="round"
                            strokeDasharray={`${fill.toFixed(1)} ${(circ - fill).toFixed(1)}`}
                            transform="rotate(-90 40 40)" />
                          <text x="40" y="44" textAnchor="middle" fill="#F0F0F0"
                            fontSize="18" fontWeight="700" fontFamily="Space Grotesk,monospace">
                            {m}<tspan fill="#555" fontSize="10">/{max}</tspan>
                          </text>
                        </svg>
                      </div>
                    );
                  })()}
                  {data.behaviour.strengths && (
                    <>
                      <div className="sect-label2">Strengths</div>
                      <div className="pill-row">
                        {(Array.isArray(data.behaviour.strengths) ? data.behaviour.strengths : [data.behaviour.strengths]).map((s: string) => (
                          <span key={s} className="wpill g">{s}</span>
                        ))}
                      </div>
                    </>
                  )}
                  {data.behaviour.gaps && (
                    <>
                      <div className="sect-label2">Gaps</div>
                      <div className="pill-row">
                        {(Array.isArray(data.behaviour.gaps) ? data.behaviour.gaps : [data.behaviour.gaps]).map((g: string) => (
                          <span key={g} className="wpill a">{g}</span>
                        ))}
                      </div>
                    </>
                  )}
                  {data.behaviour.coaching_tip && (
                    <p style={{ marginTop: 12, fontSize: 12, fontStyle: "italic", color: "var(--mut)" }}>
                      {data.behaviour.coaching_tip}
                    </p>
                  )}
                  <p style={{ marginTop: 10, fontSize: 10, color: "var(--lbl)", textAlign: "center" }}>
                    🔒 Not visible to scouts
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* CENTRE */}
          <div className="colstack">
            <div className="card">
              <div className="chead2">
                <span className="sect-title">Performance Stats</span>
                <div className="tabs">
                  {["T20", "ODI", "List-A"].map((t) => (
                    <button key={t} className={`tab${activeTab === t ? " on" : ""}`}
                      onClick={() => setActiveTab(t)}>
                      {t}
                    </button>
                  ))}
                </div>
              </div>
              <div className="cb">
                {perf ? (
                  <>
                    <div className="sect-label2">Phase Split</div>
                    <div className="phase-grid">
                      {[
                        { n: "Powerplay", v: perf.powerplay_sr ?? "—", u: role.includes("Bowl") ? "ECON" : "SR", pct: perf.powerplay_sr ? Math.min(100, (perf.powerplay_sr / 200) * 100) : 0, bm: 66 },
                        { n: "Middle",    v: perf.middle_avg ?? "—",   u: "AVG",  pct: perf.middle_avg ? Math.min(100, (perf.middle_avg / 50) * 100) : 0,   bm: 60 },
                        { n: "Death",     v: perf.death_sr ?? "—",     u: role.includes("Bowl") ? "ECON" : "SR",  pct: perf.death_sr ? Math.min(100, (perf.death_sr / 200) * 100) : 0,   bm: 62 },
                      ].map((ph) => (
                        <div key={ph.n} className="phase">
                          <div className="n">{ph.n}</div>
                          <div className="v" style={{ color: PHASE_COLORS[ph.n] }}>
                            {ph.v} <small style={{ fontSize: 10, color: "var(--mut)", fontWeight: 500 }}>{ph.u}</small>
                          </div>
                          <div className="bar">
                            <div className="f" style={{ width: `${ph.pct}%`, background: PHASE_COLORS[ph.n] }} />
                            <div className="bm" style={{ left: `${ph.bm}%` }} />
                          </div>
                          <div className="bm-lbl">benchmark {(ph.bm / 10 + 1).toFixed(1)}</div>
                        </div>
                      ))}
                    </div>

                    <div className="sect-label2">Batting</div>
                    <div className="sgrid">
                      {[
                        { v: perf.runs ?? "—", l: "Runs" },
                        { v: perf.innings != null ? (perf.runs / perf.innings).toFixed(1) : "—", l: "Avg" },
                        { v: perf.highest_score ?? "—", l: "Highest" },
                        { v: perf.fifties ?? "—", l: "50s" },
                      ].map((s) => (
                        <div key={s.l} className="sg-cell">
                          <div className={`v${s.v === "—" ? " na" : ""}`}>{s.v}</div>
                          <div className="l">{s.l}</div>
                        </div>
                      ))}
                    </div>

                    <div className="sect-label2">Bowling</div>
                    <div className="sgrid">
                      {[
                        { v: perf.wickets ?? "—", l: "Wickets", c: "#22C55E" },
                        { v: perf.economy != null ? Number(perf.economy).toFixed(1) : "—", l: "Economy" },
                        { v: perf.bowl_avg != null ? Number(perf.bowl_avg).toFixed(1) : "—", l: "Average" },
                        { v: perf.best_figures ?? "—", l: "Best" },
                      ].map((s) => (
                        <div key={s.l} className="sg-cell">
                          <div className={`v${s.v === "—" ? " na" : ""}`} style={s.c ? { color: s.c } : {}}>{s.v}</div>
                          <div className="l">{s.l}</div>
                        </div>
                      ))}
                    </div>
                  </>
                ) : (
                  <div style={{ color: "var(--mut)", fontSize: 12, padding: "8px 0" }}>
                    No stats logged yet
                    {isOwner && (
                      <Link href="/onboarding" style={{ color: "var(--green)", marginLeft: 6 }}>→ Add stats</Link>
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className="card">
              <div className="chead2"><span className="sect-title">Match History — Last 5</span></div>
              <div className="cb">
                {matches.length === 0 ? (
                  <div style={{ color: "var(--mut)", fontSize: 12 }}>
                    No matches logged yet
                    {isOwner && (
                      <Link href="/onboarding" style={{ color: "var(--green)", marginLeft: 6 }}>→ Add Match</Link>
                    )}
                  </div>
                ) : matches.slice(0, 5).map((m: any) => {
                  const mqiColor = m.mqi_weight >= 1.0 ? "green" : "amber";
                  const resColor = m.match_result === "Won" ? "green" : "red";
                  return (
                    <div key={m.id} className="mh-row">
                      <span className="mh-opp">vs {m.opponent}</span>
                      <span className="bdg ghost">{m.format}</span>
                      <span className={`bdg ${mqiColor}`}>MQI {m.mqi_weight}×</span>
                      <span className="mh-score">
                        {m.runs_scored ?? 0} R · {m.wickets_taken ?? 0} W
                      </span>
                      <span className={`bdg ${resColor}`} style={{ marginLeft: 10 }}>{m.match_result ?? "—"}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* RIGHT */}
          <div className="colstack">
            <div className="card">
              <div className="chead2"><span className="sect-title">SportX Score Breakdown</span></div>
              <div className="cb">
                <div style={{ display: "flex", justifyContent: "center", padding: "4px 0 2px" }}>
                  <BigScoreRing score={score?.total_score ?? 0} />
                </div>
                <div className="sb-bars">
                  {sbRows.map((s) => (
                    <div key={s.n} className="sbb">
                      <span className="n">{s.n}</span>
                      <div className="track">
                        <div className="fill" style={{ width: `${Math.min(100, (s.v / s.m) * 100).toFixed(0)}%`, background: s.col }} />
                      </div>
                      <span className="v" style={{ color: s.col }}>{s.v}/{s.m}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="card">
              <div className="chead2">
                <span className="sect-title">AI Roadmap</span>
                <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
                  <path d="M7 1.5C7.6 4.5 9.5 6.4 12.5 7C9.5 7.6 7.6 9.5 7 12.5C6.4 9.5 4.5 7.6 1.5 7C4.5 6.4 6.4 4.5 7 1.5Z" stroke="#8B5CF6" strokeWidth="1.2" strokeLinejoin="round" />
                </svg>
              </div>
              <div className="cb">
                {topActions.length > 0 ? (
                  <>
                    <div className="road-action">
                      <div className="t">{topActions[0]}</div>
                      <div className="road-track"><div className="f" style={{ width: "62%" }} /></div>
                      <div className="road-meta"><span>In progress</span><span>Target</span></div>
                    </div>
                    {topActions.slice(1).map((a: string, i: number) => (
                      <div key={i} className="road-collapsed">
                        <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                          <path d="M3 2L7 5L3 8" stroke="#555555" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                        {a}
                      </div>
                    ))}
                  </>
                ) : (
                  <div style={{ color: "var(--mut)", fontSize: 12 }}>
                    {isOwner ? (
                      <button className="btn green" style={{ width: "100%" }}
                        onClick={() => fetch(`/api/player/roadmap/generate`, { method: "POST" })}>
                        Generate AI Roadmap
                      </button>
                    ) : "No roadmap generated yet"}
                  </div>
                )}
              </div>
            </div>

            <div className="card">
              <div className="chead2">
                <span className="sect-title">Video Analysis</span>
                {video?.youtube_video_id && <span className="bdg green">AI Analysed ✓</span>}
              </div>
              <div className="cb">
                {video?.youtube_video_id ? (
                  <>
                    <div className="vid-wrap">
                      <a href={`https://www.youtube.com/watch?v=${video.youtube_video_id}`} target="_blank" rel="noreferrer">
                        <Image
                          src={`https://img.youtube.com/vi/${video.youtube_video_id}/hqdefault.jpg`}
                          alt="Video thumbnail"
                          width={400} height={130}
                          style={{ width: "100%", height: 130, objectFit: "cover", borderRadius: 9 }}
                        />
                        <div className="vid-play">
                          <div className="p">
                            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                              <path d="M3.8 2.3V9.7L9.5 6L3.8 2.3Z" fill="#F0F0F0" />
                            </svg>
                          </div>
                        </div>
                      </a>
                    </div>
                    {video.strong_points && (
                      <>
                        <div className="sect-label2">Strong</div>
                        <div className="pill-row">
                          {(Array.isArray(video.strong_points) ? video.strong_points : [video.strong_points]).map((p: string) => (
                            <span key={p} className="wpill g">{p}</span>
                          ))}
                        </div>
                      </>
                    )}
                    {video.weak_points && (
                      <>
                        <div className="sect-label2">Work On</div>
                        <div className="pill-row">
                          {(Array.isArray(video.weak_points) ? video.weak_points : [video.weak_points]).map((p: string) => (
                            <span key={p} className="wpill a">{p}</span>
                          ))}
                        </div>
                      </>
                    )}
                  </>
                ) : (
                  <div style={{ color: "var(--mut)", fontSize: 12 }}>
                    No video uploaded yet
                    {isOwner && (
                      <Link href="/videos/upload" style={{ color: "var(--green)", marginLeft: 6 }}>→ Upload Video</Link>
                    )}
                  </div>
                )}
              </div>
            </div>

          </div>
        </div>
      </div>

      {/* Scout action bar */}
      {isScout && (
        <div className="scout-bar">
          <button className="btn green" onClick={handleShortlist} disabled={shortlisted}>
            {shortlisted ? "Shortlisted ✓" : "Shortlist Player"}
          </button>
          <button className="btn blue-outline" onClick={handleInvite} disabled={inviteSent}>
            {inviteSent ? "Invite Sent ✓" : "Send Trial Invite"}
          </button>
          <button className="btn" onClick={() => setNoteOpen(!noteOpen)}>Add Note</button>
          {noteOpen && (
            <div style={{ display: "flex", gap: 6, flex: 1 }}>
              <input
                style={{ flex: 1, height: 30, padding: "0 10px", background: "var(--card-alt)", border: "1px solid var(--line2)", borderRadius: 8, color: "var(--text)", fontSize: 12 }}
                placeholder="Add a note about this player…"
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
              <button className="btn green sm" onClick={handleNote}>Save</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
