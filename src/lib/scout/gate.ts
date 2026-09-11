import { NextResponse } from "next/server";
import { SCOUT_SELF_SERVE_ENABLED } from "@/lib/feature-flags";

/**
 * Every route under src/app/api/scout/** calls this first, before any
 * auth/role check — mirrors src/lib/academy/gate.ts exactly. Returns a
 * ready-to-return 404 (the surface doesn't exist right now, not a
 * permissions question) or null if the flag is on.
 */
export function scoutGate(): NextResponse | null {
  if (SCOUT_SELF_SERVE_ENABLED) return null;
  return NextResponse.json({ error: "Scout accounts are not available yet" }, { status: 404 });
}
