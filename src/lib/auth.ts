import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { encode } from "next-auth/jwt";
import type { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { comparePassword, compareDummyForTiming } from "@/lib/password";
import { rateLimit } from "@/lib/rate-limit";
import { extractClientIp } from "@/lib/request-ip";

export interface AuthenticatedUser {
  id: string;
  email: string;
  role: string;
}

// Per-account cap stays at 10/15min (unchanged). This second bucket is
// keyed by IP instead of email, so a spray attack that stays under the
// per-email cap by trying many DIFFERENT emails from one source still gets
// caught. Deliberately higher than the per-email max: a shared IP (office
// NAT, campus network, mobile carrier CGNAT) can legitimately represent
// many real users, and this bucket exists to catch spray patterns, not to
// further restrict a single legitimate user who already has their own
// per-email limit.
const LOGIN_IP_MAX_ATTEMPTS = 30;
const LOGIN_IP_WINDOW_SECONDS = 900;

// Throttling + visibility only, per instruction — NOT account lockout.
// Fires once when an account's failed-attempt count in the window first
// reaches this threshold (not on every attempt past it), as a structured
// log line something could eventually alert on (e.g. a log-based monitor).
// No new notification channel is wired up in this pass.
const FAILED_LOGIN_ALERT_THRESHOLD = 5;
const FAILED_LOGIN_ALERT_WINDOW_SECONDS = 900;

function recordFailedLoginForAlerting(email: string): void {
  // A separate, effectively-unbounded bucket used purely as a counter —
  // it never itself blocks anything (max is far above any real attempt
  // count), it just tracks how many failures happened in the window so
  // this can log exactly once at the threshold crossing.
  const counter = rateLimit("login-failure-alert-count", email, 1_000_000, FAILED_LOGIN_ALERT_WINDOW_SECONDS);
  const failuresSoFar = 1_000_000 - counter.remaining;
  if (failuresSoFar === FAILED_LOGIN_ALERT_THRESHOLD) {
    // eslint-disable-next-line no-console
    console.warn(
      JSON.stringify({
        event: "auth.repeated_failed_logins",
        email,
        failureCount: failuresSoFar,
        windowSeconds: FAILED_LOGIN_ALERT_WINDOW_SECONDS,
        note: "throttling only (see login-password rate limit) — no account lockout applied",
      }),
    );
  }
}

export async function authenticateWithPassword(
  email: string,
  password: string,
  ip?: string,
): Promise<AuthenticatedUser | null> {
  const normalizedEmail = email.trim().toLowerCase();
  if (!normalizedEmail || !password) return null;

  // The actual login path had no rate limiting at all — every other
  // password/OTP-adjacent endpoint in this codebase does. Keyed by the
  // submitted email (the account being targeted), same "identity being
  // targeted" pattern claim/start uses for phone.
  const limit = rateLimit("login-password", normalizedEmail, 10, 900);
  const ipLimit = rateLimit("login-password-ip", ip ?? "unknown", LOGIN_IP_MAX_ATTEMPTS, LOGIN_IP_WINDOW_SECONDS);
  if (!limit.success || !ipLimit.success) return null;

  const user = await db.user.findUnique({
    where: { email: normalizedEmail },
    select: { id: true, email: true, role: true, password_hash: true },
  });

  if (!user?.password_hash) {
    // Timing-attack normalization: without this, "no such user" returns
    // immediately while a wrong-password attempt below goes on to run a
    // real bcrypt.compare — a measurable, exploitable timing difference
    // that lets an attacker enumerate valid emails. Burn the same bcrypt
    // cost here against a fixed dummy hash so both paths take comparable
    // time; the result is discarded, only the elapsed work matters.
    await compareDummyForTiming(password);
    recordFailedLoginForAlerting(normalizedEmail);
    return null;
  }
  const ok = await comparePassword(password, user.password_hash);
  if (!ok) {
    recordFailedLoginForAlerting(normalizedEmail);
    return null;
  }

  return {
    id: user.id,
    email: user.email,
    role: user.role,
  };
}

/** Cookie name `getSessionUser` / next-auth/jwt#getToken read in this project. */
export const SESSION_COOKIE_NAME = "next-auth.session-token";

/**
 * Encodes the same JWT claims the CredentialsProvider jwt callback writes
 * (`id`, `email`, `role`) so a Set-Cookie from a non-NextAuth route is
 * indistinguishable from a staff sign-in session.
 */
export async function encodeSessionToken(user: AuthenticatedUser): Promise<string> {
  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret) throw new Error("NEXTAUTH_SECRET is not set");
  return encode({
    token: { id: user.id, email: user.email, role: user.role },
    secret,
  });
}

export function applySessionCookie(res: NextResponse, token: string): NextResponse {
  const useSecureCookies =
    process.env.NEXTAUTH_URL?.startsWith("https://") ?? !!process.env.VERCEL;
  const name = useSecureCookies ? `__Secure-${SESSION_COOKIE_NAME}` : SESSION_COOKIE_NAME;
  res.cookies.set(name, token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: useSecureCookies,
    maxAge: 30 * 24 * 60 * 60,
  });
  return res;
}

/**
 * NextAuth config. `session: { strategy: "jwt" }` so every route can verify
 * a session by decoding the request's own cookie (via next-auth/jwt's
 * getToken, see src/lib/require-auth.ts) without needing Next's ambient
 * request context — this is what makes the auth gate testable by calling a
 * route handler directly with a bare NextRequest, the pattern
 * tests/security/auth-and-consent.test.ts already uses.
 */
export const authOptions: NextAuthOptions = {
  session: { strategy: "jwt" },
  secret: process.env.NEXTAUTH_SECRET,
  // Without this, NextAuth falls back to its own unstyled built-in page at
  // /api/auth/signin for any internal redirect (expired session, a bare
  // signIn() call, etc.) — this app has its own real sign-in/sign-up UI at
  // /auth (src/app/auth/page.tsx) and that default page should never be
  // reachable.
  pages: { signIn: "/auth" },
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials, req) {
        if (!credentials?.email || !credentials.password) return null;
        const ip = extractClientIp(req?.headers ?? {});
        return authenticateWithPassword(credentials.email, credentials.password, ip);
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        const u = user as unknown as AuthenticatedUser;
        token.id = u.id;
        token.role = u.role;
        token.email = u.email;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as { id?: string; role?: string; email?: string }).id = token.id as string;
        (session.user as { id?: string; role?: string; email?: string }).role = token.role as string;
        (session.user as { id?: string; role?: string; email?: string }).email = token.email as string;
      }
      return session;
    },
  },
};
