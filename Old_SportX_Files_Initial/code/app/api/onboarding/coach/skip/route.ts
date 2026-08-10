import { advanceStep } from "@/lib/onboarding";
import { ok, requireUserId } from "@/lib/onboarding-server";

/**
 * Player chose "I don't have a coach yet". Just advance Step 10 — discovery
 * will gate on score > 60 instead of coach_verified (see Step 11).
 */
export async function POST() {
  const guard = await requireUserId();
  if (guard instanceof Response) return guard;
  const state = await advanceStep(guard.userId, 10);
  return ok({ skipped: true, onboarding: state });
}
