import { db } from "@/lib/db";

/**
 * Attendance-flag dismiss/snooze state machine. Ported from
 * origin/v1-features-sparsh (lib/academy/attendance-flags.ts).
 *
 * Sparsh's version computed "N consecutive absences" from a batch-scoped
 * training_sessions/session_attendance pair that does not exist on main
 * (main's TrainingSession/SessionAttendance models are Squad-scoped, a
 * different subsystem entirely — see prisma/schema.prisma). Porting the
 * session-attendance-derived computation would require also porting
 * lib/academy/training-sessions.ts and lib/academy/player-detail-attendance.ts
 * into a whole new batch-scoped session/attendance schema, which is out of
 * scope for this port. What's preserved here is the pure, fully-portable
 * state machine — threshold classification, snooze-duration validation,
 * snooze-expiry — plus a Prisma-backed dismiss/snooze store
 * (AcademyAttendanceFlag) that a future batch-attendance computation can
 * plug into by supplying its own `consecutiveAbsences` per player.
 */

export const DEFAULT_ABSENCE_THRESHOLD = 2;
export const MIN_SNOOZE_DAYS = 1;
export const MAX_SNOOZE_DAYS = 90;

export type FollowUpStatus = "clear" | "open" | "snoozed" | "dismissed";

export type FlagStateRow = {
  status: "dismissed" | "snoozed";
  snoozed_until: string | null;
  duration_days: number | null;
};

export function formatAbsenceReason(absences: number): string {
  return `${absences} absence${absences === 1 ? "" : "s"} in a row`;
}

export function parseSnoozeDurationDays(raw: unknown): number | null {
  if (raw == null || raw === "") return null;
  const n = typeof raw === "number" ? raw : Number(String(raw).trim());
  if (!Number.isInteger(n)) return null;
  if (n < MIN_SNOOZE_DAYS || n > MAX_SNOOZE_DAYS) return null;
  return n;
}

export function snoozeUntilFromDays(days: number, now: Date = new Date()): Date {
  const until = new Date(now.getTime());
  until.setUTCDate(until.getUTCDate() + days);
  return until;
}

export function isSnoozeActive(
  snoozedUntil: string | Date | null | undefined,
  now: Date = new Date(),
): boolean {
  if (snoozedUntil == null || snoozedUntil === "") return false;
  const d = snoozedUntil instanceof Date ? snoozedUntil : new Date(snoozedUntil);
  if (Number.isNaN(d.getTime())) return false;
  return d.getTime() > now.getTime();
}

export function classifyFollowUpStatus(opts: {
  consecutiveAbsences: number;
  threshold: number;
  state: { status: "dismissed" | "snoozed"; snoozed_until: string | null } | null;
  now?: Date;
}): FollowUpStatus {
  const now = opts.now ?? new Date();
  if (opts.consecutiveAbsences < opts.threshold) return "clear";
  if (!opts.state) return "open";
  if (opts.state.status === "snoozed") {
    return isSnoozeActive(opts.state.snoozed_until, now) ? "snoozed" : "open";
  }
  if (opts.state.status === "dismissed") return "dismissed";
  return "open";
}

async function loadState(academyId: string, playerId: string): Promise<FlagStateRow | null> {
  const row = await db.academyAttendanceFlag.findUnique({
    where: { academy_id_player_id: { academy_id: academyId, player_id: playerId } },
  });
  if (!row) return null;
  return {
    status: row.status,
    snoozed_until: row.snoozed_until ? row.snoozed_until.toISOString() : null,
    duration_days: row.duration_days,
  };
}

/**
 * Follow-up status for one player given a caller-supplied consecutive
 * absence count (computed upstream from whatever attendance source is
 * wired in), overlaid with this academy's dismiss/snooze state.
 */
export async function loadAttendanceFollowUpForPlayer(
  academyId: string,
  playerId: string,
  consecutiveAbsences: number,
  threshold: number = DEFAULT_ABSENCE_THRESHOLD,
  now: Date = new Date(),
): Promise<{
  status: FollowUpStatus;
  consecutive_absences: number;
  threshold: number;
  snoozed_until: string | null;
  duration_days: number | null;
  flagged: boolean;
  can_unsnooze: boolean;
}> {
  const thr = Number.isInteger(threshold) && threshold >= 1 ? threshold : DEFAULT_ABSENCE_THRESHOLD;
  let state = await loadState(academyId, playerId);

  if (consecutiveAbsences < thr && state) {
    await db.academyAttendanceFlag.delete({
      where: { academy_id_player_id: { academy_id: academyId, player_id: playerId } },
    });
    state = null;
  } else if (state?.status === "snoozed" && !isSnoozeActive(state.snoozed_until, now)) {
    await db.academyAttendanceFlag.delete({
      where: { academy_id_player_id: { academy_id: academyId, player_id: playerId } },
    });
    state = null;
  }

  const status = classifyFollowUpStatus({ consecutiveAbsences, threshold: thr, state, now });

  return {
    status,
    consecutive_absences: consecutiveAbsences,
    threshold: thr,
    snoozed_until: status === "snoozed" ? state?.snoozed_until ?? null : null,
    duration_days: status === "snoozed" ? state?.duration_days ?? null : null,
    flagged: status === "open",
    can_unsnooze: status === "snoozed",
  };
}

export async function dismissAttendanceFlag(academyId: string, playerId: string): Promise<void> {
  await db.academyAttendanceFlag.upsert({
    where: { academy_id_player_id: { academy_id: academyId, player_id: playerId } },
    create: { academy_id: academyId, player_id: playerId, status: "dismissed" },
    update: { status: "dismissed", snoozed_until: null, duration_days: null },
  });
}

export async function snoozeAttendanceFlag(
  academyId: string,
  playerId: string,
  durationDays: number,
  now: Date = new Date(),
): Promise<{ snoozed_until: string; duration_days: number }> {
  const days = parseSnoozeDurationDays(durationDays);
  if (days == null) throw new Error("Invalid snooze duration");
  const until = snoozeUntilFromDays(days, now);
  await db.academyAttendanceFlag.upsert({
    where: { academy_id_player_id: { academy_id: academyId, player_id: playerId } },
    create: { academy_id: academyId, player_id: playerId, status: "snoozed", snoozed_until: until, duration_days: days },
    update: { status: "snoozed", snoozed_until: until, duration_days: days },
  });
  return { snoozed_until: until.toISOString(), duration_days: days };
}

export async function unsnoozeAttendanceFlag(academyId: string, playerId: string): Promise<void> {
  await db.academyAttendanceFlag.deleteMany({
    where: { academy_id: academyId, player_id: playerId, status: "snoozed" },
  });
}

export type FlagAction = "dismiss" | "snooze" | "unsnooze";

/**
 * Apply dismiss / snooze / unsnooze for one player.
 * Returns a structured error for invalid snooze duration; throws on DB failure.
 */
export async function applyAttendanceFlagAction(
  academyId: string,
  playerId: string,
  action: FlagAction,
  durationDays?: unknown,
  now: Date = new Date(),
): Promise<
  | { ok: true; action: FlagAction; snoozed_until?: string; duration_days?: number }
  | { ok: false; error: string }
> {
  if (action === "dismiss") {
    await dismissAttendanceFlag(academyId, playerId);
    return { ok: true, action };
  }
  if (action === "unsnooze") {
    await unsnoozeAttendanceFlag(academyId, playerId);
    return { ok: true, action };
  }
  const days = parseSnoozeDurationDays(durationDays);
  if (days == null) {
    return { ok: false, error: "duration_days required for snooze (integer 1-90)" };
  }
  const result = await snoozeAttendanceFlag(academyId, playerId, days, now);
  return { ok: true, action, ...result };
}
