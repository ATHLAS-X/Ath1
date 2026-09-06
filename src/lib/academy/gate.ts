import { NextResponse } from "next/server";
import { ACADEMY_SELF_SERVE_ENABLED } from "@/lib/feature-flags";

/**
 * Every route under src/app/api/academy/** and src/app/api/academy/join/**
 * calls this first, before any auth/role check — the whole self-serve
 * academy surface is flagged off by default (see feature-flags.ts's
 * comment for why). Returns a ready-to-return 404 (not 403 — the surface
 * doesn't exist right now, this isn't a permissions question) or null if
 * the flag is on.
 */
export function academyGate(): NextResponse | null {
  if (ACADEMY_SELF_SERVE_ENABLED) return null;
  return NextResponse.json({ error: "Academy administration is not available yet" }, { status: 404 });
}
