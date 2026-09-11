import { db } from "@/lib/db";
import type { AcademyBatch, AcademyBatchStatus } from "@prisma/client";

/**
 * Batch scheduling + roster helpers for the academy admin's batch management
 * surface. Ported from origin/v1-features-sparsh (lib/academy/batches.ts),
 * which used hand-rolled raw SQL against a `batches` / `batch_players` table
 * pair with idempotent DDL migrations run at request time. Main now has a
 * real Prisma-modeled AcademyBatch / AcademyBatchMembership pair
 * (prisma/schema.prisma), so all the DDL/"ensureTable" plumbing is gone —
 * only the pure scheduling helpers and the query logic (rewritten against
 * Prisma) survive the port.
 */

export const BATCH_AGE_GROUPS = ["Any", "U-10", "U-13", "U-17", "Senior"] as const;
export type BatchAgeGroup = (typeof BATCH_AGE_GROUPS)[number];

export const BATCH_WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;
export type BatchWeekday = (typeof BATCH_WEEKDAYS)[number];

export type BatchScheduleSlot = {
  day: BatchWeekday;
  start: string;
  end: string;
};

/** API / UX shape — maps to AcademyBatch's batch_name/batch_status/schedule_* columns. */
export type BatchRow = {
  id: string;
  academy_id: string;
  name: string;
  age_group: BatchAgeGroup;
  schedule: BatchScheduleSlot[];
  status: "active" | "archived";
  created_at: string;
  updated_at: string;
  player_count?: number;
};

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const SCHEDULE_TIME_RE = /^([01]\d|2[0-3]):[0-5]\d-([01]\d|2[0-3]):[0-5]\d$/;

export type BatchPlayerRow = {
  id: string;
  name: string;
  playing_role: string | null;
  batch_id?: string | null;
};

/** True when every slot shares the same start/end (matches the single schedule_time column). */
export function scheduleSlotsShareOneTime(slots: BatchScheduleSlot[]): boolean {
  if (slots.length <= 1) return true;
  const first = slots[0];
  return slots.every((s) => s.start === first.start && s.end === first.end);
}

/** Encode UX weekday+times slots into `schedule_days` + `schedule_time`. */
export function scheduleToDbFields(slots: BatchScheduleSlot[]): {
  schedule_days: string[];
  schedule_time: string;
} {
  if (!slots.length) {
    return { schedule_days: [], schedule_time: "" };
  }
  const first = slots[0];
  return {
    schedule_days: slots.map((s) => s.day),
    schedule_time: `${first.start}-${first.end}`,
  };
}

/** Decode DB schedule columns into UX slots (shared time window per day). */
export function scheduleFromDbFields(days: unknown, time: unknown): BatchScheduleSlot[] {
  const dayList = Array.isArray(days) ? days.map((d) => String(d ?? "").trim()) : [];
  const t = String(time ?? "").trim();
  if (!SCHEDULE_TIME_RE.test(t) || dayList.length === 0) return [];
  const [start, end] = t.split("-");
  if (!TIME_RE.test(start) || !TIME_RE.test(end)) return [];
  const out: BatchScheduleSlot[] = [];
  for (const day of dayList) {
    if (!(BATCH_WEEKDAYS as readonly string[]).includes(day)) continue;
    out.push({ day: day as BatchWeekday, start, end });
  }
  return out;
}

export function mapBatchStatusFromDb(raw: unknown): "active" | "archived" {
  return String(raw ?? "").trim().toUpperCase() === "ARCHIVED" ? "archived" : "active";
}

export function mapBatchStatusToDb(status: "active" | "archived"): AcademyBatchStatus {
  return status === "archived" ? "ARCHIVED" : "ACTIVE";
}

export function isBatchArchived(row: { batch_status?: unknown }): boolean {
  return mapBatchStatusFromDb(row.batch_status) === "archived";
}

export function parseAgeGroup(raw: unknown): BatchAgeGroup | null {
  const v = String(raw ?? "").trim();
  return (BATCH_AGE_GROUPS as readonly string[]).includes(v) ? (v as BatchAgeGroup) : null;
}

export function parseSchedule(
  raw: unknown,
): { ok: true; value: BatchScheduleSlot[] } | { ok: false; error: string } {
  if (!Array.isArray(raw)) return { ok: false, error: "Schedule must be an array of weekday slots" };
  if (raw.length === 0) return { ok: false, error: "Pick at least one training day with times" };

  const out: BatchScheduleSlot[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") {
      return { ok: false, error: "Invalid schedule slot" };
    }
    const day = String((item as any).day ?? "").trim();
    const start = String((item as any).start ?? "").trim();
    const end = String((item as any).end ?? "").trim();
    if (!(BATCH_WEEKDAYS as readonly string[]).includes(day)) {
      return { ok: false, error: `Invalid weekday: ${day || "(empty)"}` };
    }
    if (!TIME_RE.test(start) || !TIME_RE.test(end)) {
      return { ok: false, error: "Times must be HH:MM (24h)" };
    }
    if (start >= end) {
      return { ok: false, error: `End time must be after start on ${day}` };
    }
    out.push({ day: day as BatchWeekday, start, end });
  }

  if (!scheduleSlotsShareOneTime(out)) {
    const first = out[0];
    return {
      ok: false,
      error:
        `All selected days must share the same start and end time ` +
        `(would save ${first.start}-${first.end} only). ` +
        `Use one shared window, or separate Morning/Evening batches.`,
    };
  }

  return { ok: true, value: out };
}

export function mapBatchRow(row: AcademyBatch, playerCount?: number): BatchRow {
  return {
    id: row.id,
    academy_id: row.academy_id,
    name: row.batch_name,
    age_group: (row.age_group as BatchAgeGroup | null) ?? "Any",
    schedule: scheduleFromDbFields(row.schedule_days, row.schedule_time),
    status: mapBatchStatusFromDb(row.batch_status),
    created_at: row.created_at.toISOString(),
    updated_at: row.updated_at.toISOString(),
    player_count: playerCount,
  };
}

/** Fetch a batch owned by this academy, or null. */
export async function loadOwnedActiveBatch(academyId: string, batchId: string) {
  return db.academyBatch.findFirst({ where: { id: batchId, academy_id: academyId } });
}

/** Player must belong to this academy (has an active membership in one of its batches, or none yet — any known PlayerProfile is eligible to join). */
export async function assertPlayerExists(
  playerId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!playerId) return { ok: false, error: "player_id is required" };
  const player = await db.playerProfile.findUnique({ where: { id: playerId } });
  if (!player) return { ok: false, error: "Player not found" };
  return { ok: true };
}

/**
 * Place a player in a batch. Unique membership means assign or reactivate.
 */
export async function assignPlayerToBatch(
  academyId: string,
  batchId: string,
  playerId: string,
): Promise<
  | { ok: true; added: boolean }
  | { ok: false; error: string; status: 400 | 404 }
> {
  const batch = await loadOwnedActiveBatch(academyId, batchId);
  if (!batch) return { ok: false, error: "Batch not found", status: 404 };
  if (isBatchArchived(batch)) {
    return { ok: false, error: "Cannot add players to an archived batch", status: 400 };
  }

  const playerOk = await assertPlayerExists(playerId);
  if (!playerOk.ok) return { ok: false, error: playerOk.error, status: 400 };

  const existing = await db.academyBatchMembership.findUnique({
    where: { batch_id_player_id: { batch_id: batchId, player_id: playerId } },
  });

  if (existing) {
    if (existing.status === "active") return { ok: true, added: false };
    await db.academyBatchMembership.update({
      where: { id: existing.id },
      data: { status: "active" },
    });
    return { ok: true, added: true };
  }

  await db.academyBatchMembership.create({
    data: { batch_id: batchId, player_id: playerId },
  });
  return { ok: true, added: true };
}

export async function removePlayerFromBatch(
  academyId: string,
  batchId: string,
  playerId: string,
): Promise<{ ok: true } | { ok: false; error: string; status: 400 | 404 }> {
  const batch = await loadOwnedActiveBatch(academyId, batchId);
  if (!batch) return { ok: false, error: "Batch not found", status: 404 };

  const existing = await db.academyBatchMembership.findUnique({
    where: { batch_id_player_id: { batch_id: batchId, player_id: playerId } },
  });
  if (!existing || existing.status !== "active") {
    return { ok: false, error: "Player is not in this batch", status: 404 };
  }

  await db.academyBatchMembership.update({
    where: { id: existing.id },
    data: { status: "removed" },
  });
  return { ok: true };
}

export async function listPlayersInBatch(
  academyId: string,
  batchId: string,
): Promise<{ ok: true; players: BatchPlayerRow[] } | { ok: false; error: string }> {
  const batch = await loadOwnedActiveBatch(academyId, batchId);
  if (!batch) return { ok: false, error: "Batch not found" };

  const memberships = await db.academyBatchMembership.findMany({
    where: { batch_id: batchId, status: "active" },
    include: { player: true },
    orderBy: { joined_at: "desc" },
  });

  return {
    ok: true,
    players: memberships.map((m) => ({
      id: m.player.id,
      name: m.player.full_name,
      playing_role: m.player.playing_role ?? null,
      batch_id: m.batch_id,
    })),
  };
}

/** player_count per batch id for the academy's active batches. */
export async function playerCountsByBatch(academyId: string): Promise<Map<string, number>> {
  const grouped = await db.academyBatchMembership.groupBy({
    by: ["batch_id"],
    where: { status: "active", batch: { academy_id: academyId } },
    _count: { _all: true },
  });
  return new Map(grouped.map((g) => [g.batch_id, g._count._all]));
}

const WEEKDAY_TO_JS: Record<BatchWeekday, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

const JS_TO_WEEKDAY: BatchWeekday[] = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function to12h(hhmm: string): string {
  const [hStr, m] = hhmm.split(":");
  let h = Number(hStr);
  const ampm = h >= 12 ? "pm" : "am";
  h = h % 12 || 12;
  return `${h}:${m}${ampm}`;
}

/** Compact schedule label for dashboard / list rows: `Mon/Wed · 6:30–8:00am`. */
export function formatScheduleLabel(schedule: BatchScheduleSlot[]): string {
  if (!schedule.length) return "No times set";
  const days = schedule.map((s) => s.day).join("/");
  const first = schedule[0];
  return `${days} · ${to12h(first.start)}–${to12h(first.end)}`;
}

/**
 * Next upcoming session from recurring weekday slots.
 * Examples: `Today · 6:30am`, `Tomorrow · 5:00pm`, `Thu · 5:00pm`.
 */
export function nextSessionLabel(schedule: BatchScheduleSlot[], now: Date = new Date()): string {
  if (!schedule.length) return "—";

  let bestMs = Infinity;
  let best: { day: BatchWeekday; start: string } | null = null;

  for (const slot of schedule) {
    const targetDow = WEEKDAY_TO_JS[slot.day];
    if (targetDow == null) continue;
    const [hh, mm] = slot.start.split(":").map(Number);
    const candidate = new Date(now);
    const delta = (targetDow - now.getDay() + 7) % 7;
    candidate.setDate(now.getDate() + delta);
    candidate.setHours(hh, mm, 0, 0);
    if (candidate.getTime() <= now.getTime()) {
      candidate.setDate(candidate.getDate() + 7);
    }
    const ms = candidate.getTime() - now.getTime();
    if (ms < bestMs) {
      bestMs = ms;
      best = { day: slot.day, start: slot.start };
    }
  }

  if (!best) return "—";

  const when = new Date(now.getTime() + bestMs);
  const dayDiff = Math.floor(
    (new Date(when.getFullYear(), when.getMonth(), when.getDate()).getTime() -
      new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()) /
      86_400_000,
  );
  const time = to12h(best.start);
  if (dayDiff === 0) return `Today · ${time}`;
  if (dayDiff === 1) return `Tomorrow · ${time}`;
  return `${JS_TO_WEEKDAY[when.getDay()]} · ${time}`;
}

export type DashboardBatchSummary = {
  id: string;
  name: string;
  age_group: BatchAgeGroup;
  player_count: number;
  max_players: number | null;
  schedule_label: string;
  next_session: string;
};

export type DashboardBatchStats = {
  players: number;
  batches: number;
  pending_joins: number;
};

function mondayOf(d: Date): string {
  const day = d.getUTCDay();
  const diff = (day === 0 ? -6 : 1) - day;
  const monday = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + diff));
  return monday.toISOString().slice(0, 10);
}

export type EnrollmentTrendPoint = { week: string; count: number };

/** Batch + roster summary for the academy admin dashboard. */
export async function loadDashboardBatchSummary(academyId: string): Promise<{
  stats: DashboardBatchStats;
  batches: DashboardBatchSummary[];
  enrollmentTrend: EnrollmentTrendPoint[];
  newThisMonth: number;
  capacity: { total: number; filled: number } | null;
}> {
  const [players, pendingJoins, batchRows, counts, memberships] = await Promise.all([
    db.academyBatchMembership.count({ where: { status: "active", batch: { academy_id: academyId } } }),
    db.academyJoinRequest.count({ where: { academy_id: academyId, status: "pending" } }),
    db.academyBatch.findMany({
      where: { academy_id: academyId, batch_status: "ACTIVE" },
      orderBy: { created_at: "desc" },
    }),
    playerCountsByBatch(academyId),
    // Real "player enrollment, last 8 weeks" trend. joined_at is a real
    // per-membership timestamp already on every row — bucketing it by
    // week is aggregation, not invention, unlike the mockup's sparkline
    // (which came with no data behind it at all before this).
    db.academyBatchMembership.findMany({
      where: { batch: { academy_id: academyId } },
      select: { joined_at: true },
    }),
  ]);

  const batches: DashboardBatchSummary[] = batchRows.map((row) => {
    const schedule = scheduleFromDbFields(row.schedule_days, row.schedule_time);
    return {
      id: row.id,
      name: row.batch_name,
      age_group: (row.age_group as BatchAgeGroup | null) ?? "Any",
      player_count: counts.get(row.id) ?? 0,
      max_players: row.max_players,
      schedule_label: formatScheduleLabel(schedule),
      next_session: nextSessionLabel(schedule),
    };
  });

  // Real capacity/fill figure — only when at least one batch has actually
  // set max_players (it's an optional field; most seed/dev batches won't
  // have it). Batches without a cap don't contribute a denominator, so
  // this never implies a limit that isn't really configured.
  const cappedBatches = batches.filter((b) => b.max_players != null && b.max_players > 0);
  const capacity = cappedBatches.length
    ? {
        total: cappedBatches.reduce((sum, b) => sum + (b.max_players ?? 0), 0),
        filled: cappedBatches.reduce((sum, b) => sum + b.player_count, 0),
      }
    : null;

  const byWeek = new Map<string, number>();
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 3600 * 1000);
  let newThisMonth = 0;
  for (const m of memberships) {
    byWeek.set(mondayOf(m.joined_at), (byWeek.get(mondayOf(m.joined_at)) ?? 0) + 1);
    if (m.joined_at >= thirtyDaysAgo) newThisMonth += 1;
  }
  const eightWeeksAgo = mondayOf(new Date(now.getTime() - 8 * 7 * 24 * 3600 * 1000));
  const enrollmentTrend = Array.from(byWeek.entries())
    .filter(([week]) => week >= eightWeeksAgo)
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([week, count]) => ({ week, count }));

  return {
    stats: {
      players,
      batches: batches.length,
      pending_joins: pendingJoins,
    },
    batches,
    enrollmentTrend,
    newThisMonth,
    capacity,
  };
}
