import { SignJWT } from "jose";

/**
 * Mints a short-lived HS256 JWT for the Next.js → compute service call.
 * The compute service validates this token using AUTH_JWT_SECRET (same value as COMPUTE_AUTH_SECRET here).
 * Tokens expire in 5 minutes — enough for a single request/poll cycle.
 */
export async function mintComputeToken(userId: string, role: string): Promise<string> {
  if (!process.env.COMPUTE_AUTH_SECRET) {
    throw new Error("COMPUTE_AUTH_SECRET is not set. Cannot call compute service.");
  }
  const secret = new TextEncoder().encode(process.env.COMPUTE_AUTH_SECRET);
  return new SignJWT({ sub: userId, role })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("5m")
    .sign(secret);
}
