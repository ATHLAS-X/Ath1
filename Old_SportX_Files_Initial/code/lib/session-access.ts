import { sql } from "@/lib/db";

export const ATTENDANCE_STATUSES = new Set(["PRESENT", "ABSENT", "LATE", "UNMARKED"]);
export const NOTE_VISIBILITIES = new Set(["COACHES", "PLAYERS", "PRIVATE"]);
export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isUuid(value: string): boolean {
  return UUID_RE.test(value);
}

export async function academyForAdmin(userId: string): Promise<{ id: string; academy_name: string } | null> {
  const rows = (await sql`
    SELECT id, academy_name FROM academies WHERE user_id = ${userId} LIMIT 1
  `) as unknown as Array<{ id: string; academy_name: string }>;
  return rows[0] ?? null;
}

export async function coachMembership(userId: string): Promise<{ id: string; academy_id: string; coach_name: string } | null> {
  const rows = (await sql`
    SELECT id, academy_id, coach_name
    FROM academy_coaches
    WHERE user_id = ${userId} AND deleted_at IS NULL AND coach_status = 'ACTIVE'
    LIMIT 1
  `) as unknown as Array<{ id: string; academy_id: string; coach_name: string }>;
  return rows[0] ?? null;
}

export async function coachSession(userId: string, sessionId: string): Promise<{
  id: string; academy_id: string; batch_id: string | null; coach_id: string | null; session_date: string;
} | null> {
  const rows = (await sql`
    SELECT s.id, s.academy_id, s.batch_id, s.coach_id, s.session_date
    FROM training_sessions s
    JOIN academy_coaches ac ON ac.id = s.coach_id
    WHERE s.id = ${sessionId}
      AND ac.user_id = ${userId}
      AND ac.academy_id = s.academy_id
      AND ac.deleted_at IS NULL
      AND ac.coach_status = 'ACTIVE'
    LIMIT 1
  `) as unknown as Array<{ id: string; academy_id: string; batch_id: string | null; coach_id: string | null; session_date: string }>;
  return rows[0] ?? null;
}

export async function adminSession(userId: string, sessionId: string): Promise<{
  id: string; academy_id: string; batch_id: string | null; coach_id: string | null; session_date: string;
} | null> {
  const rows = (await sql`
    SELECT s.id, s.academy_id, s.batch_id, s.coach_id, s.session_date
    FROM training_sessions s
    JOIN academies a ON a.id = s.academy_id
    WHERE s.id = ${sessionId} AND a.user_id = ${userId}
    LIMIT 1
  `) as unknown as Array<{ id: string; academy_id: string; batch_id: string | null; coach_id: string | null; session_date: string }>;
  return rows[0] ?? null;
}
