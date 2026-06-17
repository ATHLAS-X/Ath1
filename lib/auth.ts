import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { sql } from "@/lib/db";

/* The 7 user roles from the V1 spec. Keep in lock-step with prisma/schema.prisma. */
export const ROLES = [
  "player",
  "parent",
  "academy_admin",
  "coach",
  "scout",
  "tournament_organizer",
  "sportx_admin",
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
  secret: process.env.NEXTAUTH_SECRET,
  pages: {
    signIn: "/auth/login",
  },
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials.password) return null;

        const rows = (await sql`
          SELECT id, name, email, password_hash, role, account_status, phone, phone_verified_at
          FROM users
          WHERE email = ${credentials.email}
          LIMIT 1
        `) as unknown as DbUser[];

        const user = rows[0];
        if (!user) return null;

        const ok = await bcrypt.compare(credentials.password, user.password_hash);
        if (!ok) return null;

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
    async jwt({ token, user, trigger }) {
      if (user) {
        const u = user as any;
        token.id = u.id;
        token.role = (u.role ?? "player") as UserRole;
        token.account_status = (u.account_status ?? "pending") as AccountStatus;
        token.phone_verified = Boolean(u.phone_verified);
      }
      /* When the client calls `update()` (e.g. after OTP verification or admin
         activation), pull fresh account_status + phone_verified from the DB. */
      if (trigger === "update" && token.id) {
        const rows = (await sql`
          SELECT account_status, phone_verified_at
          FROM users WHERE id = ${token.id as string} LIMIT 1
        `) as unknown as Array<{ account_status: string | null; phone_verified_at: Date | null }>;
        if (rows[0]) {
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
        u.role = token.role as UserRole;
        u.account_status = (token.account_status as AccountStatus) ?? "pending";
        u.phone_verified = Boolean(token.phone_verified);
      }
      return session;
    },
  },
};
