/**
 * Best-effort client IP extraction. No middleware.ts or other IP-extraction
 * code exists anywhere else in this codebase (confirmed via grep) — this is
 * the first, and other callers should reuse it rather than re-deriving
 * their own. This app deploys on Vercel (vercel.json pins region "bom1"),
 * whose edge network sets x-forwarded-for (client IP first in the
 * comma-separated chain); x-real-ip is checked as a fallback for any other
 * proxy in front of this app. Neither header is trustworthy from a
 * directly-reachable origin server (a client could forge them), but behind
 * Vercel's own proxy — the only place this app actually runs — the values
 * are proxy-set, not client-set.
 */
export function extractClientIp(headers: Headers | Record<string, unknown>): string {
  const get = (name: string): string | undefined => {
    if (headers instanceof Headers) return headers.get(name) ?? undefined;
    const v = headers[name] ?? headers[name.toLowerCase()];
    return Array.isArray(v) ? v[0] : typeof v === "string" ? v : undefined;
  };
  const forwardedFor = get("x-forwarded-for");
  if (forwardedFor) return forwardedFor.split(",")[0].trim();
  const realIp = get("x-real-ip");
  if (realIp) return realIp.trim();
  return "unknown";
}
