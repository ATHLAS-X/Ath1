import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { encode } from "next-auth/jwt";
import type { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { comparePassword } from "@/lib/password";
import { rateLimit } from "@/lib/rate-limit";

export interface AuthenticatedUser {
  id: string;
  email: string;
  role: string;
}

export async function authenticateWithPassword(
  email: string,
  password: string,
): Promise<AuthenticatedUser | null> {
  const normalizedEmail = email.trim().toLowerCase();
  if (!normalizedEmail || !password) return null;

  // The actual login path had no rate limiting at all — every other
  // password/OTP-adjacent endpoint in this codebase does. Keyed by the
  // submitted email (the account being targeted), same "identity being
  // targeted" pattern claim/start uses for phone.
  const limit = rateLimit("login-password", normalizedEmail, 10, 900);
  if (!limit.success) return null;

  const user = await db.user.findUnique({
    where: { email: normalizedEmail },
    select: { id: true, email: true, role: true, password_hash: true },
  });

  if (!user?.password_hash) return null;
  const ok = await comparePassword(password, user.password_hash);
  if (!ok) return null;

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
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials.password) return null;
        return authenticateWithPassword(credentials.email, credentials.password);
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
