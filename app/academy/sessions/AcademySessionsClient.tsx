"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { signOut } from "next-auth/react";
import { DsAvatar, DsButton, DsIcon, DsInput, DsPill, DsSelect } from "@/app/_ds";

type BatchRow = { id: string; batch_name: string; age_group: string | null };
type CoachRow = { id: string; coach_name: string };
type SessionRow = {
  id: string;
  batch_id: string | null;
  coach_id: string | null;
  session_date: string;
  start_time: string | null;
  end_time: string | null;
  session_type: string | null;
  venue: string | null;
  title: string | null;
  created_at: string;
  batch_name: string | null;
  age_group: string | null;
  coach_name: string | null;
  attendance_count: number;
  present_count: number;
  absent_count: number;
  late_count: number;
};
type AttendanceRow = {
  player_profile_id: string;
  player_name: string;
  playing_role: string | null;
  status: "PRESENT" | "ABSENT" | "LATE" | "UNMARKED";
  remarks: string | null;
  marked_at: string | null;
  marked_by_name: string | null;
};
type NoteRow = {
  id: string;
  body: string;
  visibility: "COACHES" | "PLAYERS" | "PRIVATE";
  coach_name: string | null;
  updated_at: string | null;
  created_at: string;
  tagged_players: Array<{ id: string; name: string }>;
};

type DetailPayload = {
  session: SessionRow;
  players: AttendanceRow[];
  cohort_missing: boolean;
  notes: NoteRow[];
};

interface Props {
  academy: { id: string; name: string; logoUrl: string | null };
  adminName: string;
  adminEmail: string;
  batches: BatchRow[];
  coaches: CoachRow[];
  initialSessions: SessionRow[];
}

const NAV = [
  { label: "Dashboard", href: "/academy/dashboard", icon: "dashboard" },
  { label: "Players", href: "/academy/players", icon: "players" },
  { label: "Sessions & Attendance", href: "/academy/sessions", icon: "calendar" },
  { label: "Coaches", href: "/academy/coaches", icon: "coaches" },
  { label: "Fitness & Assessments", href: "/academy/fitness", icon: "fitness" },
  { label: "Settings", href: "/academy/settings", icon: "settings" },
];

const STATUS_TONE: Record<string, "neutral" | "accent" | "ok" | "bad" | "blue" | "orange" | "purple"> = {
  PRESENT: "ok",
  ABSENT: "bad",
  LATE: "orange",
  UNMARKED: "neutral",
};

const VIS_TONE: Record<string, "neutral" | "accent" | "ok" | "bad"> = {
  COACHES: "accent",
  PLAYERS: "ok",
  PRIVATE: "bad",
};

function fmtDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  return Number.isNaN(d.getTime())
    ? iso
    : d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

function fmtTime(value: string | null): string {
  return value?.trim() ? value : "—";
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "A";
  return (parts[0][0] + (parts[parts.length - 1]?.[0] ?? "")).toUpperCase();
}

export default function AcademySessionsClient({ academy, adminName, adminEmail, batches, coaches, initialSessions }: Props) {
  const pathname = usePathname() ?? "";
  const router = useRouter();

  const [sessions, setSessions] = useState(initialSessions);
  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState(false);
  const [selectedId, setSelectedId] = useState(initialSessions[0]?.id ?? "");
  const [detail, setDetail] = useState<DetailPayload | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);

  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [batchId, setBatchId] = useState("");
  const [busyCreate, setBusyCreate] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [createOk, setCreateOk] = useState<string | null>(null);
  const [form, setForm] = useState({
    batch_id: "",
    coach_id: "",
    session_date: new Date().toISOString().slice(0, 10),
    start_time: "",
    end_time: "",
    session_type: "Practice",
    venue: "",
    title: "",
  });

  const hasFilters = from || to || batchId;

  const loadSessions = useCallback(async () => {
    setLoading(true);
    setFetchError(false);
    const params = new URLSearchParams();
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    if (batchId) params.set("batch_id", batchId);
    try {
      const res = await fetch(`/api/academy/sessions?${params.toString()}`);
      const data = await res.json().catch(() => ({}));
      if (!data?.success) {
        setFetchError(true);
        return;
      }
      const nextSessions = (data.sessions ?? []) as SessionRow[];
      setSessions(nextSessions);
      setSelectedId((current) => nextSessions.some((item) => item.id === current) ? current : (nextSessions[0]?.id ?? ""));
    } catch {
      setFetchError(true);
    } finally {
      setLoading(false);
    }
  }, [from, to, batchId]);

  useEffect(() => {
    const timer = setTimeout(() => { void loadSessions(); }, 250);
    return () => clearTimeout(timer);
  }, [loadSessions]);

  useEffect(() => {
    if (!selectedId) {
      setDetail(null);
      return;
    }
    let active = true;
    const loadDetail = async () => {
      setDetailLoading(true);
      setDetailError(null);
      try {
        const [attendanceRes, notesRes] = await Promise.all([
          fetch(`/api/academy/sessions/${selectedId}/attendance`),
          fetch(`/api/academy/sessions/${selectedId}/notes`),
        ]);
        const attendanceData = await attendanceRes.json().catch(() => ({}));
        const notesData = await notesRes.json().catch(() => ({}));
        if (!attendanceData?.success) {
          throw new Error(attendanceData?.error ?? "Unable to load attendance");
        }
        if (!notesData?.success) {
          throw new Error(notesData?.error ?? "Unable to load notes");
        }
        if (!active) return;
        setDetail({
          session: attendanceData.session,
          players: attendanceData.players ?? [],
          cohort_missing: Boolean(attendanceData.cohort_missing),
          notes: notesData.notes ?? [],
        });
      } catch (error) {
        if (!active) return;
        setDetail(null);
        setDetailError(error instanceof Error ? error.message : "Unable to load session details");
      } finally {
        if (active) setDetailLoading(false);
      }
    };
    void loadDetail();
    return () => { active = false; };
  }, [selectedId]);

  const selectedSession = useMemo(() => sessions.find((session) => session.id === selectedId) ?? null, [sessions, selectedId]);
  const totalAttendance = detail?.players?.length ?? 0;
  const marked = detail?.players?.filter((player) => player.status !== "UNMARKED").length ?? 0;
  const unmarked = totalAttendance - marked;
  const present = detail?.players?.filter((player) => player.status === "PRESENT").length ?? 0;
  const absent = detail?.players?.filter((player) => player.status === "ABSENT").length ?? 0;
  const late = detail?.players?.filter((player) => player.status === "LATE").length ?? 0;
  const initialsText = initials(adminName);

  const clearFilters = () => {
    setFrom("");
    setTo("");
    setBatchId("");
  };

  const submitCreate = async () => {
    setBusyCreate(true);
    setCreateError(null);
    setCreateOk(null);
    try {
      const res = await fetch("/api/academy/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json().catch(() => ({}));
      if (!data?.success) {
        setCreateError(data?.error ?? "Session creation failed");
        return;
      }
      setCreateOk("Session created");
      setForm((current) => ({ ...current, title: "", venue: "", start_time: "", end_time: "" }));
      await loadSessions();
      if (data.session?.id) setSelectedId(data.session.id);
    } catch {
      setCreateError("Session creation failed");
    } finally {
      setBusyCreate(false);
    }
  };

  const batchLabel = (id: string | null) => batches.find((batch) => batch.id === id)?.batch_name ?? "No batch";
  const coachLabel = (id: string | null) => coaches.find((coach) => coach.id === id)?.coach_name ?? "Unassigned";

  return (
    <div style={{ display: "grid", gridTemplateColumns: "248px 1fr", width: "100%", minHeight: "100vh", background: "var(--ax-bg)", color: "var(--ax-text)" }}>
      <aside style={{ display: "flex", flexDirection: "column", background: "var(--ax-bg-soft)", borderRight: "1px solid var(--ax-border)", padding: "1.3rem 0.9rem", position: "sticky", top: 0, height: "100vh" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", padding: "0 0.4rem 1.3rem" }}>
          <span style={{ fontFamily: "var(--ax-font-display)", fontSize: "1.35rem", lineHeight: 1, letterSpacing: "-0.01em" }}>
            ATHLAS<span style={{ color: "var(--ax-accent)" }}>X</span>
          </span>
          <span style={{ fontFamily: "var(--ax-font-label)", textTransform: "uppercase", letterSpacing: "0.16em", fontSize: "0.6rem", fontWeight: 700, color: "var(--ax-text-faint)", borderLeft: "1px solid var(--ax-border)", paddingLeft: "0.6rem" }}>
            Academy
          </span>
        </div>
        <nav style={{ display: "flex", flexDirection: "column", gap: "0.2rem" }}>
          {NAV.map((item) => {
            const on = pathname === item.href || (item.href !== "/academy/dashboard" && pathname.startsWith(item.href));
            return (
              <Link key={item.href} href={item.href} style={{ display: "flex", alignItems: "center", gap: "0.75rem", textAlign: "left", cursor: "pointer",
                padding: "0.62rem 0.7rem", borderRadius: "var(--ax-radius-md)", border: "1px solid " + (on ? "var(--ax-accent)" : "transparent"),
                background: on ? "var(--ax-accent-14)" : "transparent", color: on ? "var(--ax-accent-bright)" : "var(--ax-text-dim)",
                fontFamily: "var(--ax-font-body)", fontSize: "0.9rem", fontWeight: on ? 700 : 600, textDecoration: "none", transition: "all 0.14s ease" }}>
                <DsIcon name={item.icon} size={18} />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div style={{ marginTop: "auto", display: "flex", gap: "0.6rem", alignItems: "center", padding: "0.7rem 0.6rem", borderRadius: "var(--ax-radius-md)", background: "rgba(13,13,13,0.72)", border: "1px solid var(--ax-border)" }}>
          <span style={{ width: 34, height: 34, flex: "0 0 auto", borderRadius: "var(--ax-radius-sm)", display: "grid", placeItems: "center", background: "var(--ax-accent-14)", color: "var(--ax-accent-bright)" }}>
            <DsIcon name="building" size={17} />
          </span>
          <div style={{ minWidth: 0 }}>
            <b style={{ display: "block", fontSize: "0.82rem", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{academy.name}</b>
            <small style={{ fontSize: "0.72rem", color: "var(--ax-text-faint)" }}>Sessions</small>
          </div>
        </div>
      </aside>

      <div style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
        <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "1rem", padding: "0.85rem 1.6rem", borderBottom: "1px solid var(--ax-border)", background: "rgba(13,13,13,0.6)", WebkitBackdropFilter: "blur(10px)", backdropFilter: "blur(10px)", position: "sticky", top: 0, zIndex: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.8rem" }}>
            {academy.logoUrl ? (
              <img src={academy.logoUrl} alt="" style={{ width: 38, height: 38, borderRadius: "var(--ax-radius-md)", objectFit: "cover" }} />
            ) : (
              <span style={{ width: 38, height: 38, borderRadius: "var(--ax-radius-md)", display: "grid", placeItems: "center", background: "var(--ax-field)", border: "1px solid var(--ax-border)", color: "var(--ax-accent-bright)" }}>
                <DsIcon name="calendar" size={18} />
              </span>
            )}
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
                <b style={{ fontSize: "0.98rem" }}>{academy.name}</b>
                <DsPill tone="accent" dot>Sessions</DsPill>
              </div>
              <small style={{ fontSize: "0.74rem", color: "var(--ax-text-faint)" }}>/academy/sessions</small>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
              <DsAvatar initial={initialsText} size={34} />
              <div style={{ lineHeight: 1.2 }}>
                <b style={{ display: "block", fontSize: "0.84rem" }}>{adminName}</b>
                <small style={{ fontSize: "0.72rem", color: "var(--ax-text-faint)" }}>{adminEmail}</small>
              </div>
            </div>
            <DsButton variant="ghost" size="sm" leadingIcon={<DsIcon name="logout" size={15} />} onClick={() => signOut({ callbackUrl: "/auth/login" })}>Logout</DsButton>
          </div>
        </header>

        <main style={{ flex: 1, overflowY: "auto" }}>
          <div style={{ maxWidth: 1600, margin: "0 auto", padding: "1.6rem 2.2rem 3rem" }}>
            <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: "1rem", marginBottom: "1.2rem", flexWrap: "wrap" }}>
              <div>
                <p style={{ fontFamily: "var(--ax-font-label)", textTransform: "uppercase", letterSpacing: "0.18em", fontSize: "11px", fontWeight: 700, color: "var(--ax-accent-bright)", margin: "0 0 0.4rem" }}>Academy Sessions</p>
                <h1 style={{ fontFamily: "var(--ax-font-display)", textTransform: "uppercase", fontWeight: 400, lineHeight: 0.95, fontSize: "clamp(28px,3vw,40px)", margin: 0 }}>Training schedule</h1>
              </div>
              <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                <DsPill tone="neutral" size="sm">{sessions.length} sessions</DsPill>
                <DsPill tone="neutral" size="sm">{batches.length} batches</DsPill>
                <DsPill tone="neutral" size="sm">{coaches.length} coaches</DsPill>
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1.15fr", gap: "0.95rem", alignItems: "start" }}>
              <div style={{ display: "grid", gap: "0.95rem" }}>
                <section style={{ borderRadius: "var(--ax-radius-xl)", background: "var(--ax-card)", border: "1px solid var(--ax-border)", boxShadow: "var(--ax-shadow-card)", padding: "1rem 1.1rem" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "0.8rem", marginBottom: "0.95rem" }}>
                    <div>
                      <div style={{ fontFamily: "var(--ax-font-label)", textTransform: "uppercase", letterSpacing: "0.08em", fontSize: "0.68rem", fontWeight: 700, color: "var(--ax-text-faint)" }}>Create session</div>
                      <div style={{ fontSize: "1rem", fontWeight: 700, marginTop: "0.2rem" }}>Plan a new training block</div>
                    </div>
                    <DsPill tone="neutral" size="sm">Admin only</DsPill>
                  </div>

                  <div style={{ display: "grid", gap: "0.75rem" }}>
                    <div style={{ display: "grid", gridTemplateColumns: "1.1fr 0.9fr", gap: "0.75rem" }}>
                      <label style={{ display: "grid", gap: "0.35rem" }}>
                        <span style={{ fontSize: "0.72rem", textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--ax-text-faint)", fontWeight: 700 }}>Batch</span>
                        <DsSelect value={form.batch_id} onChange={(e) => setForm((current) => ({ ...current, batch_id: e.target.value }))}>
                          <option value="">No batch</option>
                          {batches.map((batch) => <option key={batch.id} value={batch.id}>{batch.batch_name}{batch.age_group ? ` · ${batch.age_group}` : ""}</option>)}
                        </DsSelect>
                      </label>
                      <label style={{ display: "grid", gap: "0.35rem" }}>
                        <span style={{ fontSize: "0.72rem", textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--ax-text-faint)", fontWeight: 700 }}>Coach</span>
                        <DsSelect value={form.coach_id} onChange={(e) => setForm((current) => ({ ...current, coach_id: e.target.value }))}>
                          <option value="">Unassigned</option>
                          {coaches.map((coach) => <option key={coach.id} value={coach.id}>{coach.coach_name}</option>)}
                        </DsSelect>
                      </label>
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "0.75rem" }}>
                      <label style={{ display: "grid", gap: "0.35rem" }}>
                        <span style={{ fontSize: "0.72rem", textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--ax-text-faint)", fontWeight: 700 }}>Date</span>
                        <DsInput type="date" value={form.session_date} onChange={(e) => setForm((current) => ({ ...current, session_date: e.target.value }))} />
                      </label>
                      <label style={{ display: "grid", gap: "0.35rem" }}>
                        <span style={{ fontSize: "0.72rem", textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--ax-text-faint)", fontWeight: 700 }}>Start</span>
                        <DsInput type="time" value={form.start_time} onChange={(e) => setForm((current) => ({ ...current, start_time: e.target.value }))} />
                      </label>
                      <label style={{ display: "grid", gap: "0.35rem" }}>
                        <span style={{ fontSize: "0.72rem", textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--ax-text-faint)", fontWeight: 700 }}>End</span>
                        <DsInput type="time" value={form.end_time} onChange={(e) => setForm((current) => ({ ...current, end_time: e.target.value }))} />
                      </label>
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
                      <label style={{ display: "grid", gap: "0.35rem" }}>
                        <span style={{ fontSize: "0.72rem", textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--ax-text-faint)", fontWeight: 700 }}>Title</span>
                        <DsInput value={form.title} onChange={(e) => setForm((current) => ({ ...current, title: e.target.value }))} placeholder="Match prep, net session, recovery" />
                      </label>
                      <label style={{ display: "grid", gap: "0.35rem" }}>
                        <span style={{ fontSize: "0.72rem", textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--ax-text-faint)", fontWeight: 700 }}>Type</span>
                        <DsInput value={form.session_type} onChange={(e) => setForm((current) => ({ ...current, session_type: e.target.value }))} placeholder="Practice" />
                      </label>
                    </div>

                    <label style={{ display: "grid", gap: "0.35rem" }}>
                      <span style={{ fontSize: "0.72rem", textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--ax-text-faint)", fontWeight: 700 }}>Venue</span>
                      <DsInput value={form.venue} onChange={(e) => setForm((current) => ({ ...current, venue: e.target.value }))} placeholder="Main ground / indoor nets" />
                    </label>

                    {createError && <div style={{ fontSize: "0.84rem", color: "var(--ax-bad-text)", fontWeight: 600 }}>{createError}</div>}
                    {createOk && <div style={{ fontSize: "0.84rem", color: "var(--ax-ok)", fontWeight: 600 }}>{createOk}</div>}

                    <div style={{ display: "flex", gap: "0.65rem", justifyContent: "flex-end", flexWrap: "wrap" }}>
                      <DsButton variant="outline" size="sm" onClick={() => setForm({ batch_id: "", coach_id: "", session_date: new Date().toISOString().slice(0, 10), start_time: "", end_time: "", session_type: "Practice", venue: "", title: "" })}>Reset</DsButton>
                      <DsButton variant="fill" size="sm" onClick={submitCreate} disabled={busyCreate}>{busyCreate ? "Saving…" : "Create session"}</DsButton>
                    </div>
                  </div>
                </section>

                <section style={{ borderRadius: "var(--ax-radius-xl)", background: "var(--ax-card)", border: "1px solid var(--ax-border)", boxShadow: "var(--ax-shadow-card)", padding: "1rem 1.1rem" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "0.8rem", marginBottom: "0.85rem" }}>
                    <div>
                      <div style={{ fontFamily: "var(--ax-font-label)", textTransform: "uppercase", letterSpacing: "0.08em", fontSize: "0.68rem", fontWeight: 700, color: "var(--ax-text-faint)" }}>Filters</div>
                      <div style={{ fontSize: "1rem", fontWeight: 700, marginTop: "0.2rem" }}>Narrow the schedule</div>
                    </div>
                    <button onClick={clearFilters} disabled={!hasFilters} style={{ border: "none", background: "transparent", color: hasFilters ? "var(--ax-accent-bright)" : "var(--ax-text-faint)", cursor: hasFilters ? "pointer" : "default", fontFamily: "var(--ax-font-label)", textTransform: "uppercase", letterSpacing: "0.08em", fontSize: "0.7rem", fontWeight: 700 }}>
                      Clear
                    </button>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "0.65rem" }}>
                    <label style={{ display: "grid", gap: "0.35rem" }}>
                      <span style={{ fontSize: "0.72rem", textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--ax-text-faint)", fontWeight: 700 }}>From</span>
                      <DsInput type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
                    </label>
                    <label style={{ display: "grid", gap: "0.35rem" }}>
                      <span style={{ fontSize: "0.72rem", textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--ax-text-faint)", fontWeight: 700 }}>To</span>
                      <DsInput type="date" value={to} onChange={(e) => setTo(e.target.value)} />
                    </label>
                    <label style={{ display: "grid", gap: "0.35rem" }}>
                      <span style={{ fontSize: "0.72rem", textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--ax-text-faint)", fontWeight: 700 }}>Batch</span>
                      <DsSelect value={batchId} onChange={(e) => setBatchId(e.target.value)}>
                        <option value="">All batches</option>
                        {batches.map((batch) => <option key={batch.id} value={batch.id}>{batch.batch_name}</option>)}
                      </DsSelect>
                    </label>
                  </div>
                </section>

                <section style={{ borderRadius: "var(--ax-radius-xl)", background: "var(--ax-card)", border: "1px solid var(--ax-border)", boxShadow: "var(--ax-shadow-card)", overflow: "hidden" }}>
                  <div style={{ padding: "1rem 1.1rem", borderBottom: "1px solid var(--ax-border)", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "0.75rem" }}>
                    <div>
                      <div style={{ fontFamily: "var(--ax-font-label)", textTransform: "uppercase", letterSpacing: "0.08em", fontSize: "0.68rem", fontWeight: 700, color: "var(--ax-text-faint)" }}>Sessions</div>
                      <div style={{ fontSize: "1rem", fontWeight: 700, marginTop: "0.2rem" }}>{loading ? "Loading…" : `${sessions.length} scheduled`}</div>
                    </div>
                    {fetchError && <DsPill tone="bad" size="sm">Failed to load</DsPill>}
                  </div>
                  <div style={{ maxHeight: 720, overflowY: "auto" }}>
                    {sessions.length === 0 ? (
                      <div style={{ padding: "2rem 1.1rem", color: "var(--ax-text-faint)", fontSize: "0.9rem" }}>
                        {hasFilters ? "No sessions match the selected filters." : "No sessions created yet."}
                      </div>
                    ) : (
                      <div style={{ display: "grid" }}>
                        {sessions.map((sessionRow) => {
                          const active = selectedId === sessionRow.id;
                          return (
                            <button key={sessionRow.id} onClick={() => setSelectedId(sessionRow.id)} style={{ textAlign: "left", border: "none", background: active ? "var(--ax-accent-08)" : "transparent", color: "inherit", cursor: "pointer", padding: "0.95rem 1.1rem", borderBottom: "1px solid var(--ax-border)", transition: "background 0.14s ease" }}>
                              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "0.75rem" }}>
                                <div style={{ minWidth: 0 }}>
                                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
                                    <b style={{ fontSize: "0.92rem" }}>{sessionRow.title || sessionRow.session_type || "Training session"}</b>
                                    {sessionRow.age_group && <DsPill tone="neutral" size="sm">{sessionRow.age_group}</DsPill>}
                                  </div>
                                  <div style={{ marginTop: "0.25rem", fontSize: "0.78rem", color: "var(--ax-text-faint)" }}>
                                    {fmtDate(sessionRow.session_date)} · {fmtTime(sessionRow.start_time)}{sessionRow.end_time ? ` - ${fmtTime(sessionRow.end_time)}` : ""}
                                  </div>
                                  <div style={{ marginTop: "0.35rem", fontSize: "0.8rem", color: "var(--ax-text-dim)" }}>
                                    {sessionRow.batch_name ?? "No batch"}{sessionRow.coach_name ? ` · ${sessionRow.coach_name}` : ""}
                                  </div>
                                </div>
                                <div style={{ display: "grid", gap: "0.35rem", justifyItems: "end", flexShrink: 0 }}>
                                  <DsPill tone="accent" size="sm">{sessionRow.attendance_count} marked</DsPill>
                                  <div style={{ fontSize: "0.76rem", color: "var(--ax-text-faint)" }}>{sessionRow.present_count} P · {sessionRow.absent_count} A · {sessionRow.late_count} L</div>
                                </div>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </section>
              </div>

              <section style={{ borderRadius: "var(--ax-radius-xl)", background: "var(--ax-card)", border: "1px solid var(--ax-border)", boxShadow: "var(--ax-shadow-card)", overflow: "hidden" }}>
                <div style={{ padding: "1rem 1.15rem", borderBottom: "1px solid var(--ax-border)", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "0.75rem" }}>
                  <div>
                    <div style={{ fontFamily: "var(--ax-font-label)", textTransform: "uppercase", letterSpacing: "0.08em", fontSize: "0.68rem", fontWeight: 700, color: "var(--ax-text-faint)" }}>Session detail</div>
                    <div style={{ fontSize: "1rem", fontWeight: 700, marginTop: "0.2rem" }}>{detailLoading ? "Loading…" : selectedSession?.title || selectedSession?.session_type || "Select a session"}</div>
                  </div>
                  {selectedSession && <DsPill tone="neutral" size="sm">{batchLabel(selectedSession.batch_id)}</DsPill>}
                </div>

                <div style={{ padding: "1.1rem" }}>
                  {detailError ? (
                    <div style={{ color: "var(--ax-bad-text)", fontWeight: 600 }}>{detailError}</div>
                  ) : !selectedSession ? (
                    <div style={{ padding: "2rem 0", color: "var(--ax-text-faint)" }}>Pick a session to inspect attendance and notes.</div>
                  ) : !detail ? (
                    <div style={{ padding: "2rem 0", color: "var(--ax-text-faint)" }}>Loading detail…</div>
                  ) : (
                    <div style={{ display: "grid", gap: "1rem" }}>
                      <div style={{ display: "flex", gap: "0.45rem", flexWrap: "wrap" }}>
                        <DsPill tone="accent" size="sm">{detail.session.session_type || "Practice"}</DsPill>
                        {detail.session.batch_id ? <DsPill tone="neutral" size="sm">{detail.session.batch_name ?? "Batch"}</DsPill> : <DsPill tone="bad" size="sm">No batch</DsPill>}
                        {detail.session.age_group && <DsPill tone="neutral" size="sm">{detail.session.age_group}</DsPill>}
                        {detail.session.coach_name && <DsPill tone="blue" size="sm">{detail.session.coach_name}</DsPill>}
                      </div>

                      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "0.65rem" }}>
                        <InfoTile label="Present" value={present} tone="ok" />
                        <InfoTile label="Absent" value={absent} tone="bad" />
                        <InfoTile label="Late" value={late} tone="orange" />
                        <InfoTile label="Unmarked" value={unmarked} tone="neutral" />
                      </div>

                      <div style={{ display: "grid", gap: "0.35rem", fontSize: "0.88rem", color: "var(--ax-text-dim)" }}>
                        <div><b style={{ color: "var(--ax-text)" }}>Date:</b> {fmtDate(detail.session.session_date)}</div>
                        <div><b style={{ color: "var(--ax-text)" }}>Time:</b> {fmtTime(detail.session.start_time)}{detail.session.end_time ? ` - ${fmtTime(detail.session.end_time)}` : ""}</div>
                        <div><b style={{ color: "var(--ax-text)" }}>Venue:</b> {detail.session.venue || "—"}</div>
                      </div>

                      {detail.cohort_missing && (
                        <div style={{ padding: "0.85rem 0.95rem", borderRadius: "var(--ax-radius-lg)", border: "1px solid var(--ax-bad)", background: "var(--ax-bad-soft)", color: "var(--ax-bad-text)", fontSize: "0.86rem", fontWeight: 600 }}>
                          This session has no batch cohort, so attendance is unavailable until a batch is assigned.
                        </div>
                      )}

                      {!detail.cohort_missing && (
                        <div style={{ display: "grid", gap: "0.7rem" }}>
                          <div style={{ fontSize: "0.78rem", textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--ax-text-faint)", fontWeight: 700 }}>Roster</div>
                          <div style={{ overflowX: "auto" }}>
                            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.86rem" }}>
                              <thead>
                                <tr style={{ background: "var(--ax-bg-soft)" }}>
                                  {["Player", "Role", "Status", "Remarks"].map((header) => (
                                    <th key={header} style={{ textAlign: "left", padding: "0.6rem 0.7rem", fontFamily: "var(--ax-font-label)", textTransform: "uppercase", letterSpacing: "0.08em", fontSize: "0.64rem", fontWeight: 700, color: "var(--ax-text-faint)" }}>{header}</th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody>
                                {detail.players.map((player) => (
                                  <tr key={player.player_profile_id} style={{ borderTop: "1px solid var(--ax-border)" }}>
                                    <td style={{ padding: "0.7rem", fontWeight: 600 }}>{player.player_name}</td>
                                    <td style={{ padding: "0.7rem", color: "var(--ax-text-dim)" }}>{player.playing_role ?? "—"}</td>
                                    <td style={{ padding: "0.7rem" }}><DsPill tone={STATUS_TONE[player.status] ?? "neutral"} size="sm">{player.status}</DsPill></td>
                                    <td style={{ padding: "0.7rem", color: "var(--ax-text-dim)" }}>{player.remarks || "—"}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}

                      <div style={{ display: "grid", gap: "0.7rem" }}>
                        <div style={{ fontSize: "0.78rem", textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--ax-text-faint)", fontWeight: 700 }}>Notes</div>
                        {detail.notes.length === 0 ? (
                          <div style={{ padding: "0.95rem", borderRadius: "var(--ax-radius-lg)", border: "1px solid var(--ax-border)", background: "var(--ax-field)", color: "var(--ax-text-faint)", fontSize: "0.86rem" }}>No staff-visible notes yet.</div>
                        ) : (
                          <div style={{ display: "grid", gap: "0.75rem" }}>
                            {detail.notes.map((note) => (
                              <article key={note.id} style={{ padding: "0.9rem", borderRadius: "var(--ax-radius-lg)", border: "1px solid var(--ax-border)", background: "var(--ax-field)" }}>
                                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "0.75rem", marginBottom: "0.55rem", flexWrap: "wrap" }}>
                                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
                                    <DsPill tone={VIS_TONE[note.visibility] ?? "neutral"} size="sm">{note.visibility}</DsPill>
                                    <span style={{ fontSize: "0.82rem", color: "var(--ax-text-dim)" }}>{note.coach_name ?? "Coach"}</span>
                                  </div>
                                  <span style={{ fontSize: "0.76rem", color: "var(--ax-text-faint)" }}>{fmtDate(note.created_at)}</span>
                                </div>
                                <p style={{ margin: 0, whiteSpace: "pre-wrap", fontSize: "0.88rem", lineHeight: 1.55 }}>{note.body}</p>
                                {note.tagged_players.length > 0 && (
                                  <div style={{ display: "flex", gap: "0.35rem", flexWrap: "wrap", marginTop: "0.65rem" }}>
                                    {note.tagged_players.map((player) => <DsPill key={player.id} tone="neutral" size="sm">{player.name}</DsPill>)}
                                  </div>
                                )}
                              </article>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </section>
            </div>

            {fetchError && (
              <div style={{ marginTop: "0.9rem", color: "var(--ax-bad-text)", fontSize: "0.88rem", fontWeight: 600 }}>
                Could not load sessions right now.
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}

function InfoTile({ label, value, tone }: { label: string; value: number; tone: "ok" | "bad" | "orange" | "neutral" }) {
  const fg = {
    ok: "var(--ax-ok)",
    bad: "var(--ax-bad-text)",
    orange: "#FFB35C",
    neutral: "var(--ax-text-dim)",
  }[tone];
  return (
    <div style={{ padding: "0.75rem 0.8rem", borderRadius: "var(--ax-radius-lg)", border: "1px solid var(--ax-border)", background: "var(--ax-field)" }}>
      <div style={{ fontFamily: "var(--ax-font-label)", textTransform: "uppercase", letterSpacing: "0.08em", fontSize: "0.62rem", fontWeight: 700, color: "var(--ax-text-faint)" }}>{label}</div>
      <div style={{ marginTop: "0.25rem", fontFamily: "var(--ax-font-display)", fontSize: "1.45rem", color: fg }}>{value}</div>
    </div>
  );
}
