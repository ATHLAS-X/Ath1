import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { sql } from "@/lib/db";
import { ROLES, type UserRole } from "@/lib/auth";
import { clientIp } from "@/lib/onboarding-server";
import { rateLimit, rateLimitResponse } from "@/lib/rate-limit";

interface SignupBody {
  name?: string;
  email?: string;
  password?: string;
  role?: string;
  phone?: string;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^\+?[0-9]{7,15}$/;

function err(message: string, status: number) {
  return NextResponse.json({ success: false, error: message }, { status });
}

export async function POST(req: Request) {
  const ip = clientIp(req);
  const limit = await rateLimit("signup", ip, 10, 60 * 60);
  if (!limit.success) return rateLimitResponse(limit);

  let body: SignupBody;
  try {
    body = (await req.json()) as SignupBody;
  } catch {
    return err("Invalid JSON body", 400);
  }

  const name = body.name?.trim();
  const email = body.email?.trim().toLowerCase();
  const password = body.password;
  const roleRaw = (body.role ?? "player").trim().toLowerCase();
  const phone = body.phone?.trim();

  if (!name || name.length < 2) return err("Name must be at least 2 characters", 400);
  if (!email || !EMAIL_RE.test(email)) return err("Valid email is required", 400);
  if (!password || password.length < 8) return err("Password must be at least 8 characters", 400);
  if (phone && !PHONE_RE.test(phone)) return err("Phone number is invalid", 400);
  if (!ROLES.includes(roleRaw as UserRole)) return err(`Unknown role: ${roleRaw}`, 400);

  /* AthlasX Admin cannot self-register — must be promoted by an existing admin. */
  if (roleRaw === "athlasx_admin") return err("Admin accounts cannot self-register", 403);

  /* Everything below talks to the DB, which can throw on transient
     connectivity failures (timeouts, etc. — see lib/db.ts). Uncaught, that
     bypasses err()'s {success:false, error} shape entirely and falls
     through to Next's generic 500, which has no `error` field — the client
     then has nothing to show but a hardcoded "Signup failed" fallback, with
     the real reason buried in server logs only. Catch explicitly so the
     person signing up always sees something actionable. */
  try {
    const existing = (await sql`SELECT id FROM users WHERE email = ${email} LIMIT 1`) as unknown as {
      id: string;
    }[];
    if (existing.length > 0) return err("An account with this email already exists", 409);

    if (phone) {
      const phoneTaken = (await sql`SELECT id FROM users WHERE phone = ${phone} LIMIT 1`) as unknown as {
        id: string;
      }[];
      if (phoneTaken.length > 0) return err("Phone is already linked to another account", 409);
    }

    const password_hash = await bcrypt.hash(password, 10);
    const inserted = (await sql`
      INSERT INTO users (name, email, password_hash, role, phone, account_status)
      VALUES (${name}, ${email}, ${password_hash}, ${roleRaw}, ${phone ?? null}, 'pending')
      RETURNING id, name, email, role, account_status
    `) as unknown as {
      id: string;
      name: string;
      email: string;
      role: string;
      account_status: string;
    }[];

    return NextResponse.json({ success: true, data: { user: inserted[0] } }, { status: 201 });
  } catch (e) {
    console.error("[signup] DB error:", e);
    return err("Couldn't reach the database right now — please try again in a moment", 503);
  }
}
