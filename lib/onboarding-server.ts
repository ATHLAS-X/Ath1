/**
 * Server-side helpers used by /api/onboarding/* routes.
 */
import { writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function requireUserId(): Promise<{ userId: string } | NextResponse> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }
  return { userId: session.user.id };
}

export function ok<T>(data: T, init?: ResponseInit) {
  return NextResponse.json({ success: true, data }, init);
}
export function fail(error: string, status = 400) {
  return NextResponse.json({ success: false, error }, { status });
}

/**
 * Persist an upload to public/uploads/<userId>/<filename> so Next can serve
 * it from /uploads/... . Returns the public URL.
 */
export async function saveUpload(
  userId: string,
  file: File,
  subfolder = "",
): Promise<string> {
  const root = path.join(process.cwd(), "public", "uploads", userId, subfolder).replace(/\\/g, "/");
  await mkdir(root, { recursive: true });
  const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const filename = `${Date.now()}_${safe}`;
  const full = path.join(root, filename);
  const bytes = Buffer.from(await file.arrayBuffer());
  await writeFile(full, bytes);
  const rel = ["/uploads", userId, subfolder, filename].filter(Boolean).join("/");
  return rel.replace(/\/+/g, "/");
}

/** Age in completed years from a Date or ISO string. */
export function ageFromDob(dob: Date | string): number {
  const d = typeof dob === "string" ? new Date(dob) : dob;
  const now = new Date();
  let age = now.getFullYear() - d.getFullYear();
  const m = now.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age--;
  return age;
}

/** Best-effort client IP from a NextRequest. */
export function clientIp(req: Request): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  return req.headers.get("x-real-ip") ?? "unknown";
}
