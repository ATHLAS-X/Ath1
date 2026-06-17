import { advanceStep } from "@/lib/onboarding";
import { ok, requireUserId } from "@/lib/onboarding-server";
import { calculateSportXScore } from "@/lib/score-engine";

export async function POST() {
  const guard = await requireUserId();
  if (guard instanceof Response) return guard;
  const result = await calculateSportXScore(guard.userId);
  const state = await advanceStep(guard.userId, 11);
  return ok({ ...result, onboarding: state });
}
