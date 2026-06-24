/**
 * Fail loudly at boot instead of letting NextAuth silently fall back to an
 * insecure default secret. Uses TextEncoder (not Buffer) so this also works
 * unmodified in middleware.ts's Edge runtime.
 */
const MIN_SECRET_BYTES = 32;

export function assertNextAuthSecret(secret: string | undefined): string {
  const byteLength = secret ? new TextEncoder().encode(secret).length : 0;
  if (!secret || byteLength < MIN_SECRET_BYTES) {
    throw new Error(
      "NEXTAUTH_SECRET is not set (or is under 32 bytes). Generate one with " +
        "`openssl rand -base64 32` and set it in .env.local / your deployment env — " +
        "NextAuth must never fall back to its insecure development default.",
    );
  }
  return secret;
}
