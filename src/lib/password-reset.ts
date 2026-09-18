import { randomBytes, createHash } from "crypto";
import { db } from "@/lib/db";

const TOKEN_BYTES = 32; // 256-bit raw token — unguessable, rate-limiting on it is a safety net, not the primary defense
const TTL_MINUTES = 30;

/** Same principle as password_hash: never store the raw token. */
export function hashResetToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

/** Creates a token row and returns the RAW token — the only place it ever
 *  exists outside this one return value is the emailed reset link. */
export async function createPasswordResetToken(userId: string): Promise<string> {
  const token = randomBytes(TOKEN_BYTES).toString("hex");
  const expiresAt = new Date(Date.now() + TTL_MINUTES * 60 * 1000);
  await db.passwordResetToken.create({
    data: {
      user_id: userId,
      token_hash: hashResetToken(token),
      expires_at: expiresAt,
    },
  });
  return token;
}

export interface ConsumedPasswordReset {
  userId: string;
}

/**
 * Redeems a token exactly once: rejects if the hash doesn't match any row,
 * if it's already been consumed, or if it's past expires_at. On success,
 * the consumed_at write is a conditional updateMany (WHERE consumed_at IS
 * NULL) rather than a plain update — two concurrent requests racing to
 * redeem the same token can both pass the initial read, but only one can
 * win that conditional write, so only one call ever returns a userId.
 *
 * The winning redemption also retires every other outstanding token for the
 * same user, in the same transaction. Someone who requested three links
 * because the first email was slow shouldn't be left with two that still
 * work after their password has already changed.
 */
export async function consumePasswordResetToken(token: string): Promise<ConsumedPasswordReset | null> {
  const tokenHash = hashResetToken(token);
  const row = await db.passwordResetToken.findUnique({ where: { token_hash: tokenHash } });
  if (!row) return null;
  if (row.consumed_at) return null;
  if (row.expires_at.getTime() < Date.now()) return null;

  const won = await db.$transaction(async (tx) => {
    const now = new Date();
    const result = await tx.passwordResetToken.updateMany({
      where: { id: row.id, consumed_at: null },
      data: { consumed_at: now },
    });
    if (result.count === 0) return false; // lost a race to a concurrent redemption

    await tx.passwordResetToken.updateMany({
      where: { user_id: row.user_id, consumed_at: null },
      data: { consumed_at: now },
    });
    return true;
  });
  if (!won) return null;

  return { userId: row.user_id };
}
