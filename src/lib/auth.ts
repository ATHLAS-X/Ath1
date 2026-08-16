import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";

/**
 * NextAuth config. `session: { strategy: "jwt" }` so every route can verify
 * a session by decoding the request's own cookie (via next-auth/jwt's
 * getToken, see src/lib/require-auth.ts) without needing Next's ambient
 * request context — this is what makes the auth gate testable by calling a
 * route handler directly with a bare NextRequest, the pattern
 * tests/security/auth-and-consent.test.ts already uses.
 *
 * IMPORTANT — sign-in is not wired up. `User` has no password/credential
 * field anywhere in prisma/schema.prisma, so there is currently no way to
 * verify a real login. `authorize()` below always returns null on purpose
 * — building a fake "logs in by email alone" check would be worse than no
 * login at all. This file exists so the session/JWT machinery every route's
 * auth gate depends on has a real place to originate a token from once a
 * credential-verification decision (password? OTP? SSO?) is made; that
 * decision is out of scope for this pass.
 */
export const authOptions: NextAuthOptions = {
  session: { strategy: "jwt" },
  secret: process.env.NEXTAUTH_SECRET,
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
      },
      async authorize() {
        // See file-level comment — no credential to verify against yet.
        return null;
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        const u = user as unknown as { id: string; role: string };
        token.id = u.id;
        token.role = u.role;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as { id?: string; role?: string }).id = token.id as string;
        (session.user as { id?: string; role?: string }).role = token.role as string;
      }
      return session;
    },
  },
};
