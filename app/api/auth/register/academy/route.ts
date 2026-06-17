import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { sql } from "@/lib/db";
import { sendEmail } from "@/lib/email";
import { z } from "zod";

const schema = z.object({
  contact_name:        z.string().min(2),
  email:               z.string().email(),
  password:            z.string().min(8).regex(/\d/, "Password must include a number"),
  phone:               z.string().regex(/^\+91\d{10}$/, "Invalid Indian phone number"),
  academy_name:        z.string().min(2),
  city:                z.string().min(1),
  state:               z.string().min(1),
  address:             z.string().optional(),
  website:             z.string().url().optional().or(z.literal("")),
  founded_year:        z.number().int().min(1800).max(new Date().getFullYear()).optional(),
  academy_description: z.string().max(500).optional(),
  age_groups:          z.array(z.string()).default([]),
  facilities:          z.array(z.string()).default([]),
  specialties:         z.array(z.string()).default([]),
});

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });
  }

  const d = parsed.data;

  // Check email not already taken
  const existing = await sql`SELECT id FROM users WHERE email = ${d.email} LIMIT 1`;
  if (existing.length > 0) {
    return NextResponse.json({ error: "Email already registered" }, { status: 409 });
  }

  const passwordHash = await bcrypt.hash(d.password, 12);

  // Insert user
  const [user] = await sql`
    INSERT INTO users (name, email, password_hash, role, phone, account_status)
    VALUES (${d.contact_name}, ${d.email}, ${passwordHash}, 'academy_admin', ${d.phone}, 'pending')
    RETURNING id
  `;

  // Insert academy
  await sql`
    INSERT INTO academies (
      user_id, academy_name, city, state, address, website,
      founded_year, academy_description, contact_name, contact_email,
      contact_phone, age_groups, facilities, specialties, profile_status
    ) VALUES (
      ${user.id}, ${d.academy_name}, ${d.city}, ${d.state},
      ${d.address ?? null}, ${d.website || null},
      ${d.founded_year ?? null}, ${d.academy_description ?? null},
      ${d.contact_name}, ${d.email}, ${d.phone},
      ${d.age_groups}, ${d.facilities}, ${d.specialties},
      'Draft'
    )
  `;

  // Create email verification token (24h expiry)
  const token = crypto.randomBytes(32).toString("hex");
  await sql`
    INSERT INTO email_verifications (user_id, token, expires_at)
    VALUES (${user.id}, ${token}, now() + interval '24 hours')
  `;

  const verifyUrl = `${process.env.NEXTAUTH_URL ?? "http://localhost:3000"}/api/auth/verify-email?token=${token}`;

  await sendEmail({
    to: d.email,
    subject: "Verify your SportX Academy account",
    body: `Hi ${d.contact_name},\n\nWelcome to SportX! Please verify your email:\n\n${verifyUrl}\n\nThis link expires in 24 hours.\n\nThe SportX Team`,
  });

  return NextResponse.json({ success: true });
}
