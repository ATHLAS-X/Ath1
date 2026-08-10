"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { signOut } from "next-auth/react";
import { DsAvatar, DsButton, DsIcon, DsInput, DsPill, DsSelect } from "@/app/_ds";

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
  roster_count: number;
  marked_count: number;
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

type EditableAttendance = Record<string, { status: AttendanceRow["status"]; remarks: string }>;

interface Props {
  coach: { coachId: string; coachName: string; academyName: string; logoUrl: string | null };
  initialSessions: SessionRow[];
}

const NAV = [
  { label: "Dashboard", href: "/dashboard/coach", icon: "dashboard" },
  { label: "Sessions & Attendance", href: "/dashboard/coach/sessions", icon: "calendar" },
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
  if (!parts.length) return "C";
  return (parts[0][0] + (parts[parts.length - 1]?.[0] ?? "")).toUpperCase();
}

export default function CoachSessionsClient({ coach, initialSessions }: Props) {
  const pathname = usePathname() ?? "";
  const router = useRouter();

  const [sessions, setSessions] = useState(initialSessions);
  const [selectedId, setSelectedId] = useState(initialSessions[0]?.id ?? "");
  const [detail, setDetail] = useState<DetailPayload | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [sessionsBusy, setSessionsBusy] = useState(false);
  const [sessionBusyError, setSessionBusyError] = useState<string | null>(null);

  const [attendanceDraft, setAttendanceDraft] = useState<EditableAttendance>({});
  const [attendanceSaving, setAttendanceSaving] = useState(false);
  const [attendanceMessage, setAttendanceMessage] = useState<string | null>(null);

  const [noteBody, setNoteBody] = useState("");
  const [noteVisibility, setNoteVisibility] = useState<"COACHES" | "PLAYERS" | "PRIVATE">("COACHES");
  const [noteSearch, setNoteSearch] = useState("");
  const [taggedPlayers, setTaggedPlayers] = useState<Set<string>>(new Set());
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [noteSaving, setNoteSaving] = useState(false);
  const [noteError, setNoteError] = useState<string | null>(null);
  const [noteMessage, setNoteMessage] = useState<string | null>(null);

  const selectedSession = useMemo(() => sessions.find((session) => session.id === selectedId) ?? null, [sessions, selectedId]);
  const roster = detail?.players ?? [];
  const rosterCount = roster.length;
  const marked = roster.filter((player) => player.status !== "UNMARKED").length;
  const unmarked = rosterCount - marked;
  const allUnmarked = rosterCount > 0 && roster.every((player) => player.status === "UNMARKED");
  const visibleTaggablePlayers = useMemo(() => roster.filter((player) => player.player_name.toLowerCase().includes(noteSearch.toLowerCase().trim())), [roster, noteSearch]);
  const initialsText = initials(coach.coachName);

  const reloadSessions = useCallback(async () => {
    setSessionsBusy(true);
    setSessionBusyError(null);
    try {
      const res = await fetch("/api/coach/sessions");
      const data = await res.json().catch(() => ({}));
      if (!data?.success) {
        setSessionBusyError(data?.error ?? "Could not load sessions");
        return;
      }
      const nextSessions = (data.sessions ?? []) as SessionRow[];
      setSessions(nextSessions);
      setSelectedId((current) => nextSessions.some((session) => session.id === current) ? current : (nextSessions[0]?.id ?? ""));
    } catch {
      setSessionBusyError("Could not load sessions");
    } finally {
      setSessionsBusy(false);
    }
  }, []);

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
          fetch(`/api/coach/sessions/${selectedId}/attendance`),
          fetch(`/api/coach/sessions/${selectedId}/notes`),
        ]);
        const attendanceData = await attendanceRes.json().catch(() => ({}));
        const notesData = await notesRes.json().catch(() => ({}));
        if (!attendanceData?.success) throw new Error(attendanceData?.error ?? "Unable to load attendance");
        if (!notesData?.success) throw new Error(notesData?.error ?? "Unable to load notes");
        if (!active) return;
        const nextDetail = {
          session: attendanceData.session,
          players: attendanceData.players ?? [],
          cohort_missing: Boolean(attendanceData.cohort_missing),
          notes: notesData.notes ?? [],
        };
        setDetail(nextDetail);
        const nextDraft: EditableAttendance = {};
        for (const player of nextDetail.players) {
          nextDraft[player.player_profile_id] = { status: player.status, remarks: player.remarks ?? "" };
        }
        setAttendanceDraft(nextDraft);
        setAttendanceMessage(null);
        setNoteMessage(null);
        setNoteError(null);
        setEditingNoteId(null);
        setNoteBody("");
        setNoteVisibility("COACHES");
        setTaggedPlayers(new Set());
      } catch (error) {
        if (!active) return;
        setDetail(null);
        setDetailError(error instanceof Error ? error.message : "Unable to load session detail");
      } finally {
        if (active) setDetailLoading(false);
      }
    };
    void loadDetail();
    return () => { active = false; };
  }, [selectedId]);

  const saveAttendance = async () => {
    if (!selectedId || !detail || detail.cohort_missing) return;
    setAttendanceSaving(true);
    setAttendanceMessage(null);
    setNoteError(null);
    try {
      const payload = Object.entries(attendanceDraft).map(([player_profile_id, value]) => ({
        player_profile_id,
        status: value.status,
        remarks: value.remarks,
      }));
      const res = await fetch(`/api/coach/sessions/${selectedId}/attendance`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ attendance: payload }),
      });
      const data = await res.json().catch(() => ({}));
      if (!data?.success) {
        setAttendanceMessage(null);
        setAttendanceMessage(null);
        setAttendanceSaving(false);
        setAttendanceMessage(data?.error ?? "Attendance save failed");
        return;
      }
      setAttendanceMessage("Attendance saved");
      await reloadSessions();
      await Promise.all([
        fetch(`/api/coach/sessions/${selectedId}/attendance`).then((response) => response.json()),
        fetch(`/api/coach/sessions/${selectedId}/notes`).then((response) => response.json()),
      ]).then(([attendanceData, notesData]) => {
        if (attendanceData?.success && notesData?.success) {
          const nextDetail = {
            session: attendanceData.session,
            players: attendanceData.players ?? [],
            cohort_missing: Boolean(attendanceData.cohort_missing),
            notes: notesData.notes ?? [],
          };
          setDetail(nextDetail);
          const nextDraft: EditableAttendance = {};
          for (const player of nextDetail.players) {
            nextDraft[player.player_profile_id] = { status: player.status, remarks: player.remarks ?? "" };
          }
          setAttendanceDraft(nextDraft);
        }
      });
    } catch {
      setAttendanceMessage("Attendance save failed");
    } finally {
      setAttendanceSaving(false);
    }
  };

  const beginNoteEdit = (note: NoteRow) => {
    setEditingNoteId(note.id);
    setNoteBody(note.body);
    setNoteVisibility(note.visibility);
    setTaggedPlayers(new Set(note.tagged_players.map((player) => player.id)));
    setNoteSearch("");
    setNoteError(null);
    setNoteMessage(null);
  };

  const resetNoteComposer = () => {
    setEditingNoteId(null);
    setNoteBody("");
    setNoteVisibility("COACHES");
    setTaggedPlayers(new Set());
    setNoteSearch("");
    setNoteError(null);
    setNoteMessage(null);
  };

  const saveNote = async () => {
    if (!selectedId) return;
    const body = noteBody.trim();
    if (!body) {
      setNoteError("Write a note before saving.");
      return;
    }
    setNoteSaving(true);
    setNoteError(null);
    setNoteMessage(null);
    try {
      const payload = {
        body,
        visibility: noteVisibility,
        tagged_player_profile_ids: Array.from(taggedPlayers),
      };
      const res = await fetch(editingNoteId ? `/api/coach/session-notes/${editingNoteId}` : `/api/coach/sessions/${selectedId}/notes`, {
        method: editingNoteId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!data?.success) {
        setNoteError(data?.error ?? "Note save failed");
        return;
      }
      setNoteMessage(editingNoteId ? "Note updated" : "Note saved");
      resetNoteComposer();
      const [attendanceData, notesData] = await Promise.all([
        fetch(`/api/coach/sessions/${selectedId}/attendance`).then((response) => response.json()),
        fetch(`/api/coach/sessions/${selectedId}/notes`).then((response) => response.json()),
      ]);
      if (attendanceData?.success && notesData?.success) {
        setDetail({
          session: attendanceData.session,
          players: attendanceData.players ?? [],
          cohort_missing: Boolean(attendanceData.cohort_missing),
          notes: notesData.notes ?? [],
        });
      }
    } catch {
      setNoteError("Note save failed");
    } finally {
      setNoteSaving(false);
    }
  };

  const deleteNote = async (noteId: string) => {
    if (!selectedId) return;
    setNoteSaving(true);
    setNoteError(null);
    try {
      const res = await fetch(`/api/coach/session-notes/${noteId}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!data?.success) {
        setNoteError(data?.error ?? "Delete failed");
        return;
      }
      if (editingNoteId === noteId) resetNoteComposer();
      const [attendanceData, notesData] = await Promise.all([
        fetch(`/api/coach/sessions/${selectedId}/attendance`).then((response) => response.json()),
        fetch(`/api/coach/sessions/${selectedId}/notes`).then((response) => response.json()),
      ]);
      if (attendanceData?.success && notesData?.success) {
        setDetail({
          session: attendanceData.session,
          players: attendanceData.players ?? [],
          cohort_missing: Boolean(attendanceData.cohort_missing),
          notes: notesData.notes ?? [],
        });
      }
    } catch {
      setNoteError("Delete failed");
    } finally {
      setNoteSaving(false);
    }
  };

  const toggleTag = (playerId: string) => {
    setTaggedPlayers((current) => {
      const next = new Set(current);
      if (next.has(playerId)) next.delete(playerId);
      else next.add(playerId);
      return next;
    });
  };

  const updateAttendance = (playerId: string, status?: AttendanceRow["status"], remarks?: string) => {
    setAttendanceDraft((current) => ({
      ...current,
      [playerId]: {
        status: status ?? current[playerId]?.status ?? "UNMARKED",
        remarks: remarks ?? current[playerId]?.remarks ?? "",
      },
    }));
  };

  const sessionTitle = selectedSession?.title || selectedSession?.session_type || "Select a session";

  return (
    <div style={{ display: "grid", gridTemplateColumns: "248px 1fr", width: "100%", minHeight: "100vh", background: "var(--ax-bg)", color: "var(--ax-text)" }}>
      <aside style={{ display: "flex", flexDirection: "column", background: "var(--ax-bg-soft)", borderRight: "1px solid var(--ax-border)", padding: "1.3rem 0.9rem", position: "sticky", top: 0, height: "100vh" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", padding: "0 0.4rem 1.3rem" }}>
          <span style={{ fontFamily: "var(--ax-font-display)", fontSize: "1.35rem", lineHeight: 1, letterSpacing: "-0.01em" }}>
            ATHLAS<span style={{ color: "var(--ax-accent)" }}>X</span>
          </span>
          <span style={{ fontFamily: "var(--ax-font-label)", textTransform: "uppercase", letterSpacing: "0.16em", fontSize: "0.6rem", fontWeight: 700, color: "var(--ax-text-faint)", borderLeft: "1px solid var(--ax-border)", paddingLeft: "0.6rem" }}>
            Coach
          </span>
        </div>
        <nav style={{ display: "flex", flexDirection: "column", gap: "0.2rem" }}>
          {NAV.map((item) => {
            const on = pathname === item.href || (item.href !== "/dashboard/coach" && pathname.startsWith(item.href));
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
            <DsIcon name="calendar" size={17} />
          </span>
          <div style={{ minWidth: 0 }}>
            <b style={{ display: "block", fontSize: "0.82rem", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{coach.coachName}</b>
            <small style={{ fontSize: "0.72rem", color: "var(--ax-text-faint)" }}>{coach.academyName}</small>
          </div>
        </div>
      </aside>

      <div style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
        <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "1rem", padding: "0.85rem 1.6rem", borderBottom: "1px solid var(--ax-border)", background: "rgba(13,13,13,0.6)", WebkitBackdropFilter: "blur(10px)", backdropFilter: "blur(10px)", position: "sticky", top: 0, zIndex: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.8rem" }}>
            {coach.logoUrl ? (
              <img src={coach.logoUrl} alt="" style={{ width: 38, height: 38, borderRadius: "var(--ax-radius-md)", objectFit: "cover" }} />
            ) : (
              <span style={{ width: 38, height: 38, borderRadius: "var(--ax-radius-md)", display: "grid", placeItems: "center", background: "var(--ax-field)", border: "1px solid var(--ax-border)", color: "var(--ax-accent-bright)" }}>
                <DsIcon name="calendar" size={18} />
              </span>
            )}
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
                <b style={{ fontSize: "0.98rem" }}>{coach.coachName}</b>
                <DsPill tone="accent" dot>Coach sessions</DsPill>
              </div>
              <small style={{ fontSize: "0.74rem", color: "var(--ax-text-faint)" }}>{coach.academyName}</small>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
            <Link href="/dashboard/coach" style={{ textDecoration: "none" }}>
              <DsButton variant="outline" size="sm" leadingIcon={<DsIcon name="arrowRight" size={14} />}>Back to dashboard</DsButton>
            </Link>
            <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
              <DsAvatar initial={initialsText} size={34} />
              <div style={{ lineHeight: 1.2 }}>
                <b style={{ display: "block", fontSize: "0.84rem" }}>{coach.coachName}</b>
                <small style={{ fontSize: "0.72rem", color: "var(--ax-text-faint)" }}>Active coach</small>
              </div>
            </div>
            <DsButton variant="ghost" size="sm" leadingIcon={<DsIcon name="logout" size={15} />} onClick={() => signOut({ callbackUrl: "/auth/login" })}>Logout</DsButton>
          </div>
        </header>

        <main style={{ flex: 1, overflowY: "auto" }}>
          <div style={{ maxWidth: 1600, margin: "0 auto", padding: "1.6rem 2.2rem 3rem" }}>
            <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: "1rem", marginBottom: "1.2rem", flexWrap: "wrap" }}>
              <div>
                <p style={{ fontFamily: "var(--ax-font-label)", textTransform: "uppercase", letterSpacing: "0.18em", fontSize: "11px", fontWeight: 700, color: "var(--ax-accent-bright)", margin: "0 0 0.4rem" }}>Sessions & Attendance</p>
                <h1 style={{ fontFamily: "var(--ax-font-display)", textTransform: "uppercase", fontWeight: 400, lineHeight: 0.95, fontSize: "clamp(28px,3vw,40px)", margin: 0 }}>Mark the session</h1>
              </div>
              <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                <DsPill tone="neutral" size="sm">{sessions.length} sessions</DsPill>
                <DsPill tone="neutral" size="sm">{sessionsBusy ? "Updating…" : "Live roster"}</DsPill>
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "0.88fr 1.12fr", gap: "0.95rem", alignItems: "start" }}>
              <section style={{ borderRadius: "var(--ax-radius-xl)", background: "var(--ax-card)", border: "1px solid var(--ax-border)", boxShadow: "var(--ax-shadow-card)", overflow: "hidden" }}>
                <div style={{ padding: "1rem 1.1rem", borderBottom: "1px solid var(--ax-border)", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "0.75rem" }}>
                  <div>
                    <div style={{ fontFamily: "var(--ax-font-label)", textTransform: "uppercase", letterSpacing: "0.08em", fontSize: "0.68rem", fontWeight: 700, color: "var(--ax-text-faint)" }}>Assigned sessions</div>
                    <div style={{ fontSize: "1rem", fontWeight: 700, marginTop: "0.2rem" }}>{selectedSession?.title || selectedSession?.session_type || "Choose a session"}</div>
                  </div>
                  {sessionBusyError && <DsPill tone="bad" size="sm">Error</DsPill>}
                </div>
                <div style={{ maxHeight: 720, overflowY: "auto" }}>
                  {sessions.length === 0 ? (
                    <div style={{ padding: "2rem 1.1rem", color: "var(--ax-text-faint)", fontSize: "0.9rem" }}>No sessions are assigned yet.</div>
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
                                  {sessionRow.batch_name ?? "No batch"}
                                </div>
                              </div>
                              <div style={{ display: "grid", gap: "0.35rem", justifyItems: "end", flexShrink: 0 }}>
                                <DsPill tone="accent" size="sm">{sessionRow.marked_count} marked</DsPill>
                                <div style={{ fontSize: "0.76rem", color: "var(--ax-text-faint)" }}>{sessionRow.present_count} P · {sessionRow.absent_count} A · {sessionRow.late_count} L</div>
                              </div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
                {sessionBusyError && <div style={{ padding: "0.8rem 1.1rem", fontSize: "0.84rem", color: "var(--ax-bad-text)", borderTop: "1px solid var(--ax-border)" }}>{sessionBusyError}</div>}
              </section>

              <section style={{ borderRadius: "var(--ax-radius-xl)", background: "var(--ax-card)", border: "1px solid var(--ax-border)", boxShadow: "var(--ax-shadow-card)", overflow: "hidden" }}>
                <div style={{ padding: "1rem 1.15rem", borderBottom: "1px solid var(--ax-border)", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "0.75rem" }}>
                  <div>
                    <div style={{ fontFamily: "var(--ax-font-label)", textTransform: "uppercase", letterSpacing: "0.08em", fontSize: "0.68rem", fontWeight: 700, color: "var(--ax-text-faint)" }}>Session detail</div>
                    <div style={{ fontSize: "1rem", fontWeight: 700, marginTop: "0.2rem" }}>{detailLoading ? "Loading…" : sessionTitle}</div>
                  </div>
                  {selectedSession && <DsPill tone="neutral" size="sm">{selectedSession.batch_name ?? "No batch"}</DsPill>}
                </div>

                <div style={{ padding: "1.1rem", display: "grid", gap: "1rem" }}>
                  {detailError ? (
                    <div style={{ color: "var(--ax-bad-text)", fontWeight: 600 }}>{detailError}</div>
                  ) : !selectedSession ? (
                    <div style={{ padding: "2rem 0", color: "var(--ax-text-faint)" }}>Pick a session to mark attendance and write notes.</div>
                  ) : !detail ? (
                    <div style={{ padding: "2rem 0", color: "var(--ax-text-faint)" }}>Loading detail…</div>
                  ) : (
                    <>
                      <div style={{ display: "flex", gap: "0.45rem", flexWrap: "wrap" }}>
                        <DsPill tone="accent" size="sm">{detail.session.session_type || "Practice"}</DsPill>
                        {detail.session.age_group ? <DsPill tone="neutral" size="sm">{detail.session.age_group}</DsPill> : null}
                        {detail.session.batch_id ? <DsPill tone="neutral" size="sm">{detail.session.batch_name ?? "Batch"}</DsPill> : <DsPill tone="bad" size="sm">No batch</DsPill>}
                      </div>

                      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "0.65rem" }}>
                        <InfoTile label="Present" value={detail.players.filter((player) => player.status === "PRESENT").length} tone="ok" />
                        <InfoTile label="Absent" value={detail.players.filter((player) => player.status === "ABSENT").length} tone="bad" />
                        <InfoTile label="Late" value={detail.players.filter((player) => player.status === "LATE").length} tone="orange" />
                        <InfoTile label="Unmarked" value={detail.players.filter((player) => player.status === "UNMARKED").length} tone="neutral" />
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
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "0.75rem" }}>
                            <div style={{ fontSize: "0.78rem", textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--ax-text-faint)", fontWeight: 700 }}>Attendance</div>
                            {allUnmarked && <DsPill tone="neutral" size="sm">All unmarked</DsPill>}
                          </div>
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
                                {roster.map((player) => (
                                  <tr key={player.player_profile_id} style={{ borderTop: "1px solid var(--ax-border)" }}>
                                    <td style={{ padding: "0.7rem", fontWeight: 600 }}>{player.player_name}</td>
                                    <td style={{ padding: "0.7rem", color: "var(--ax-text-dim)" }}>{player.playing_role ?? "—"}</td>
                                    <td style={{ padding: "0.7rem" }}>
                                      <DsSelect value={attendanceDraft[player.player_profile_id]?.status ?? player.status} onChange={(e) => updateAttendance(player.player_profile_id, e.target.value as AttendanceRow["status"])}>
                                        {(["PRESENT", "ABSENT", "LATE", "UNMARKED"] as const).map((status) => <option key={status} value={status}>{status}</option>)}
                                      </DsSelect>
                                    </td>
                                    <td style={{ padding: "0.7rem" }}>
                                      <DsInput value={attendanceDraft[player.player_profile_id]?.remarks ?? player.remarks ?? ""} onChange={(e) => updateAttendance(player.player_profile_id, undefined, e.target.value)} placeholder="Optional remarks" />
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                          <div style={{ display: "flex", gap: "0.65rem", justifyContent: "flex-end", flexWrap: "wrap" }}>
                            {attendanceMessage && <span style={{ alignSelf: "center", color: attendanceMessage.includes("saved") ? "var(--ax-ok)" : "var(--ax-bad-text)", fontSize: "0.84rem", fontWeight: 600 }}>{attendanceMessage}</span>}
                            <DsButton variant="fill" size="sm" onClick={saveAttendance} disabled={attendanceSaving}>{attendanceSaving ? "Saving…" : "Save attendance"}</DsButton>
                          </div>
                        </div>
                      )}

                      <div style={{ display: "grid", gap: "0.8rem", paddingTop: "0.2rem", borderTop: "1px solid var(--ax-border)" }}>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "0.75rem", flexWrap: "wrap" }}>
                          <div>
                            <div style={{ fontSize: "0.78rem", textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--ax-text-faint)", fontWeight: 700 }}>Notes</div>
                            <div style={{ fontSize: "0.92rem", fontWeight: 700, marginTop: "0.2rem" }}>{editingNoteId ? "Edit note" : "Add note"}</div>
                          </div>
                          {editingNoteId && <DsPill tone="neutral" size="sm">Editing</DsPill>}
                        </div>

                        <label style={{ display: "grid", gap: "0.35rem" }}>
                          <span style={{ fontSize: "0.72rem", textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--ax-text-faint)", fontWeight: 700 }}>Body</span>
                          <textarea
                            value={noteBody}
                            onChange={(e) => setNoteBody(e.target.value)}
                            placeholder="Worked on footwork and strike rotation."
                            style={{ minHeight: 112, resize: "vertical", width: "100%", padding: "0.8rem 0.9rem", borderRadius: "var(--ax-radius-md)", background: "var(--ax-field)", border: "1px solid var(--ax-border)", color: "var(--ax-text)", fontFamily: "var(--ax-font-body)", fontSize: "0.9rem", outline: "none" }}
                          />
                        </label>

                        <div style={{ display: "grid", gridTemplateColumns: "0.65fr 1.35fr", gap: "0.75rem", alignItems: "start" }}>
                          <label style={{ display: "grid", gap: "0.35rem" }}>
                            <span style={{ fontSize: "0.72rem", textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--ax-text-faint)", fontWeight: 700 }}>Visibility</span>
                            <DsSelect value={noteVisibility} onChange={(e) => setNoteVisibility(e.target.value as NoteRow["visibility"]) }>
                              <option value="COACHES">Coaches</option>
                              <option value="PLAYERS">Players</option>
                              <option value="PRIVATE">Private</option>
                            </DsSelect>
                          </label>

                          <div style={{ display: "grid", gap: "0.5rem" }}>
                            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "0.75rem", flexWrap: "wrap" }}>
                              <span style={{ fontSize: "0.72rem", textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--ax-text-faint)", fontWeight: 700 }}>Tag players</span>
                              <DsInput value={noteSearch} onChange={(e) => setNoteSearch(e.target.value)} placeholder="Search roster" style={{ maxWidth: 220 }} />
                            </div>
                            <div style={{ maxHeight: 190, overflowY: "auto", display: "grid", gap: "0.45rem", padding: "0.6rem", borderRadius: "var(--ax-radius-md)", border: "1px solid var(--ax-border)", background: "var(--ax-field)" }}>
                              {visibleTaggablePlayers.length === 0 ? (
                                <div style={{ color: "var(--ax-text-faint)", fontSize: "0.84rem" }}>No players match this search.</div>
                              ) : (
                                visibleTaggablePlayers.map((player) => {
                                  const checked = taggedPlayers.has(player.player_profile_id);
                                  return (
                                    <label key={player.player_profile_id} style={{ display: "flex", alignItems: "center", gap: "0.65rem", padding: "0.4rem 0.55rem", borderRadius: "var(--ax-radius-sm)", background: checked ? "var(--ax-accent-08)" : "transparent", cursor: "pointer" }}>
                                      <input type="checkbox" checked={checked} onChange={() => toggleTag(player.player_profile_id)} />
                                      <span style={{ flex: 1, minWidth: 0 }}>
                                        <b style={{ display: "block", fontSize: "0.86rem" }}>{player.player_name}</b>
                                        <small style={{ color: "var(--ax-text-faint)" }}>{player.playing_role ?? "Player"}</small>
                                      </span>
                                    </label>
                                  );
                                })
                              )}
                            </div>
                          </div>
                        </div>

                        {noteError && <div style={{ color: "var(--ax-bad-text)", fontSize: "0.84rem", fontWeight: 600 }}>{noteError}</div>}
                        {noteMessage && <div style={{ color: "var(--ax-ok)", fontSize: "0.84rem", fontWeight: 600 }}>{noteMessage}</div>}

                        <div style={{ display: "flex", gap: "0.65rem", justifyContent: "flex-end", flexWrap: "wrap" }}>
                          {editingNoteId && <DsButton variant="outline" size="sm" onClick={resetNoteComposer}>Cancel edit</DsButton>}
                          <DsButton variant="fill" size="sm" onClick={saveNote} disabled={noteSaving}>{noteSaving ? "Saving…" : editingNoteId ? "Update note" : "Save note"}</DsButton>
                        </div>

                        <div style={{ display: "grid", gap: "0.7rem" }}>
                          {detail.notes.length === 0 ? (
                            <div style={{ padding: "0.95rem", borderRadius: "var(--ax-radius-lg)", border: "1px solid var(--ax-border)", background: "var(--ax-field)", color: "var(--ax-text-faint)", fontSize: "0.86rem" }}>No notes yet.</div>
                          ) : (
                            detail.notes.map((note) => (
                              <article key={note.id} style={{ padding: "0.9rem", borderRadius: "var(--ax-radius-lg)", border: "1px solid var(--ax-border)", background: "var(--ax-field)" }}>
                                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "0.75rem", marginBottom: "0.55rem", flexWrap: "wrap" }}>
                                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
                                    <DsPill tone={VIS_TONE[note.visibility] ?? "neutral"} size="sm">{note.visibility}</DsPill>
                                    <span style={{ fontSize: "0.82rem", color: "var(--ax-text-dim)" }}>{note.coach_name ?? coach.coachName}</span>
                                  </div>
                                  <div style={{ display: "flex", gap: "0.4rem", alignItems: "center", flexWrap: "wrap" }}>
                                    <span style={{ fontSize: "0.76rem", color: "var(--ax-text-faint)" }}>{fmtDate(note.created_at)}</span>
                                    <button onClick={() => beginNoteEdit(note)} style={{ border: "1px solid var(--ax-border)", background: "transparent", borderRadius: "var(--ax-radius-sm)", padding: "0.32rem 0.55rem", color: "var(--ax-text)", cursor: "pointer", fontSize: "0.74rem", fontFamily: "var(--ax-font-label)", textTransform: "uppercase" }}>Edit</button>
                                    <button onClick={() => deleteNote(note.id)} style={{ border: "1px solid var(--ax-bad)", background: "transparent", borderRadius: "var(--ax-radius-sm)", padding: "0.32rem 0.55rem", color: "var(--ax-bad-text)", cursor: "pointer", fontSize: "0.74rem", fontFamily: "var(--ax-font-label)", textTransform: "uppercase" }}>Delete</button>
                                  </div>
                                </div>
                                <p style={{ margin: 0, whiteSpace: "pre-wrap", fontSize: "0.88rem", lineHeight: 1.55 }}>{note.body}</p>
                                {note.tagged_players.length > 0 && (
                                  <div style={{ display: "flex", gap: "0.35rem", flexWrap: "wrap", marginTop: "0.65rem" }}>
                                    {note.tagged_players.map((player) => <DsPill key={player.id} tone="neutral" size="sm">{player.name}</DsPill>)}
                                  </div>
                                )}
                              </article>
                            ))
                          )}
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </section>
            </div>
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
