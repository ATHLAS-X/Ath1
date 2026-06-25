/**
 * Auth bridge — mints short-lived HS256 JWTs that the Backend/AI compute
 * service accepts as Bearer tokens.
 *
 * The compute service (app/core/security.py) verifies JWTs signed with
 * AUTH_JWT_SECRET and reads `sub` (user id) + `role` claims. Next.js stores
 * roles in lowercase ("player", "scout", "academy_admin"); the compute service
 * expects UPPERCASE ("PLAYER", "SCOUT", "ACADEMY_ADMIN"). This module handles
 * the mapping transparently.
 *
 * IMPORTANT: COMPUTE_AUTH_SECRET must be identical to AUTH_JWT_SECRET in
 * Backend/AI/.env. Generate with: openssl rand -hex 32
 */

import { SignJWT } from "jose";

/** Encode the shared secret once per cold start. */
function getSecretKey(): Uint8Array {
  const secret = process.env.COMPUTE_AUTH_SECRET;
  if (!secret) {
    throw new Error(
      "COMPUTE_AUTH_SECRET is not set. This must match AUTH_JWT_SECRET in Backend/AI/.env.",
    );
  }
  return new TextEncoder().encode(secret);
}

/**
 * Mint a forwarding JWT for the compute service.
 *
 * @param userId  - The authenticated user's UUID (from session.user.id)
 * @param role    - The user's role in Next.js lowercase format (e.g. "player")
 * @returns       - A signed JWT string valid for 5 minutes
 */
export async function mintComputeToken(
  userId: string,
  role: string,
): Promise<string> {
  const key = getSecretKey();

  // Compute service Role enum is UPPERCASE; Next.js stores lowercase.
  // "academy_admin" → "ACADEMY_ADMIN", "player" → "PLAYER", etc.
  const computeRole = role.toUpperCase();

  return new SignJWT({
    sub: userId,
    user_id: userId, // compute service reads both sub and user_id
    role: computeRole,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("5m")
    .sign(key);
}
