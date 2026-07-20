import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import bcrypt from "bcryptjs";
import { sql } from "@/lib/db";
import { isLockedOut, recordFailedAttempt } from "@/lib/rate-limit";
import { assertNextAuthSecret } from "@/lib/env-checks";

/* Throws at module load (first import — app boot / first request) if unset
   or too short, instead of letting NextAuth silently use its insecure dev
   default. */
const NEXTAUTH_SECRET = assertNextAuthSecret(process.env.NEXTAUTH_SECRET);

const LOGIN_MAX_FAILURES = 10;
const LOGIN_LOCKOUT_WINDOW_SECONDS = 15 * 60;

/* The 7 user roles from the V1 spec. Keep in lock-step with prisma/schema.prisma. */
export const ROLES = [
  "player",
  "parent",
  "academy_admin",
  "coach",
  "scout",
  "tournament_organizer",
  "athlasx_admin",
] as const;
export type UserRole = (typeof ROLES)[number];

export const ACCOUNT_STATUSES = ["pending", "active", "suspended"] as const;
export type AccountStatus = (typeof ACCOUNT_STATUSES)[number];

interface DbUser {
  id: string;
  name: string;
  email: string;
  password_hash: string;
  role: string;
  account_status: string | null;
  phone: string | null;
  phone_verified_at: Date | null;
}

export const authOptions: NextAuthOptions = {
  session: { strategy: "jwt" },
  secret: NEXTAUTH_SECRET,
  pages: {
    signIn: "/auth/login",
  },
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID ?? "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
    }),
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials.password) return null;
        const email = credentials.email.trim().toLowerCase();

        /* Locked-out and "no such user"/"wrong password" all return null with
           the same generic failure — never reveal which reason applied. */
        if (await isLockedOut("login-fail", email, LOGIN_MAX_FAILURES, LOGIN_LOCKOUT_WINDOW_SECONDS)) {
          return null;
        }

        const rows = (await sql`
          SELECT id, name, email, password_hash, role, account_status, phone, phone_verified_at
          FROM users
          WHERE email = ${email}
          LIMIT 1
        `) as unknown as DbUser[];

        const user = rows[0];
        if (!user) {
          await recordFailedAttempt("login-fail", email, LOGIN_LOCKOUT_WINDOW_SECONDS);
          return null;
        }

        const ok = await bcrypt.compare(credentials.password, user.password_hash);
        if (!ok) {
          await recordFailedAttempt("login-fail", email, LOGIN_LOCKOUT_WINDOW_SECONDS);
          return null;
        }

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          account_status: user.account_status ?? "pending",
          phone: user.phone,
          phone_verified: !!user.phone_verified_at,
        } as any;
      },
    }),
  ],
  callbacks: {
    /* OAuth account-linking guard — see the module doc comment above the
       providers array for the full reasoning. Credentials sign-ins skip
       this entirely (account.provider !== "google"); authorize() already
       did all the checking for that path. */
    async signIn({ user, account }) {
      if (account?.provider !== "google") return true;

      const email = (user.email ?? "").trim().toLowerCase();
      if (!email) return false;

      const rows = (await sql`
        SELECT password_hash, oauth_provider FROM users WHERE email = ${email} LIMIT 1
      `) as unknown as Array<{ password_hash: string | null; oauth_provider: string | null }>;
      const existing = rows[0];

      if (existing) {
        /* Already linked to Google — normal repeat sign-in, let it through.
           Anything else (credentials-only, or linked to a different OAuth
           provider) is a same-email account conflict — block rather than
           silently link, which would let anyone who controls a Google
           account with someone else's email address take over their
           existing AthlasX account. */
        if (existing.oauth_provider === "google") return true;
        return "/auth/login?error=OAuthAccountNotLinked";
      }

      /* Brand-new user. role is left NULL — the post-login role picker
         (see middleware.ts) is responsible for setting it before the user
         reaches any role-scoped page. */
      await sql`
        INSERT INTO users (name, email, oauth_provider, oauth_id, account_status, role)
        VALUES (${user.name ?? email}, ${email}, 'google', ${account.providerAccountId}, 'pending', NULL)
      `;
      return true;
    },
    async jwt({ token, user, account, trigger }) {
      if (user && account?.provider === "google") {
        /* No database adapter is configured (JWT-only session strategy), so
           the `user` object here is whatever GoogleProvider's default
           profile() mapping produced — { id: profile.sub, name, email,
           image } — NOT a row from our `users` table. Using u.id directly
           would put Google's `sub` into the session as if it were our
           internal UUID, breaking every query that does
           `WHERE user_id = session.user.id`. Re-resolve the real row by
           email (signIn() above guarantees one exists by this point). */
        const email = (user.email ?? "").trim().toLowerCase();
        const rows = (await sql`
          SELECT id, role, account_status, phone, phone_verified_at
          FROM users WHERE email = ${email} LIMIT 1
        `) as unknown as Array<{
          id: string;
          role: string | null;
          account_status: string | null;
          phone: string | null;
          phone_verified_at: Date | null;
        }>;
        const dbUser = rows[0];
        if (dbUser) {
          token.id = dbUser.id;
          token.role = (dbUser.role ?? undefined) as UserRole | undefined;
          token.account_status = (dbUser.account_status ?? "pending") as AccountStatus;
          token.phone_verified = !!dbUser.phone_verified_at;
        }
      } else if (user) {
        const u = user as any;
        token.id = u.id;
        token.role = (u.role ?? undefined) as UserRole | undefined;
        token.account_status = (u.account_status ?? "pending") as AccountStatus;
        token.phone_verified = Boolean(u.phone_verified);
      }
      /* When the client calls `update()` (e.g. after OTP verification, role
         picker submission, or admin activation), pull fresh account_status
         + role + phone_verified from the DB. */
      if (trigger === "update" && token.id) {
        const rows = (await sql`
          SELECT role, account_status, phone_verified_at
          FROM users WHERE id = ${token.id as string} LIMIT 1
        `) as unknown as Array<{ role: string | null; account_status: string | null; phone_verified_at: Date | null }>;
        if (rows[0]) {
          token.role = (rows[0].role ?? undefined) as UserRole | undefined;
          token.account_status = (rows[0].account_status ?? "pending") as AccountStatus;
          token.phone_verified = !!rows[0].phone_verified_at;
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        const u = session.user as any;
        u.id = token.id as string;
        u.role = (token.role as UserRole | null) ?? null;
        u.account_status = (token.account_status as AccountStatus) ?? "pending";
        u.phone_verified = Boolean(token.phone_verified);
      }
      return session;
    },
  },
};
