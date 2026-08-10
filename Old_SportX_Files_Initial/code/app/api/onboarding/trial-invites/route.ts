import { ok, requireUserId } from "@/lib/onboarding-server";

/**
 * Trial invites surface — empty in MVP. Scouts will write to a future
 * `trial_invites` table; the dashboard polls this for unread counts.
 */
export async function GET() {
  const guard = await requireUserId();
  if (guard instanceof Response) return guard;
  return ok({ invites: [] });
}
