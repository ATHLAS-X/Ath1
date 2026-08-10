/**
 * Aadhaar tokenization — keyed HMAC-SHA256, not a bare hash.
 *
 * Aadhaar numbers are only 12 digits with checksum constraints (Verhoeff),
 * so the full keyspace is small enough that an unkeyed hash (or no hash at
 * all) is rainbow-table breakable — anyone with DB read access could
 * recover the original number by hashing every valid 12-digit candidate.
 * Keying with a server-side secret makes that infeasible without the key.
 */
import { createHmac } from "node:crypto";

const MIN_SECRET_BYTES = 32;

let cachedSecret: string | null = null;

function getHmacSecret(): string {
  if (cachedSecret) return cachedSecret;
  const secret = process.env.AADHAAR_HMAC_SECRET;
  if (!secret || Buffer.byteLength(secret, "utf8") < MIN_SECRET_BYTES) {
    throw new Error(
      "AADHAAR_HMAC_SECRET is not set (or is under 32 bytes). Generate one with " +
        "`openssl rand -base64 32` and set it in .env.local / your deployment env.",
    );
  }
  cachedSecret = secret;
  return cachedSecret;
}

/** Deterministic, secret-keyed token for a 12-digit Aadhaar number. Used for
 *  cross-account duplicate detection without ever storing the raw number. */
export function tokenizeAadhaar(aadhaar: string): string {
  const digits = aadhaar.replace(/\D/g, "");
  return "hmac_" + createHmac("sha256", getHmacSecret()).update(digits).digest("hex");
}
