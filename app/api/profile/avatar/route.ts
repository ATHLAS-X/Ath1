import { sql } from "@/lib/db";
import { fail, ok, requireUserId, saveUpload } from "@/lib/onboarding-server";

const MAX_BYTES = 5 * 1024 * 1024; // 5 MB

export async function POST(req: Request) {
  const guard = await requireUserId();
  if (guard instanceof Response) return guard;

  const ct = req.headers.get("content-type") ?? "";
  if (!ct.includes("multipart/form-data")) return fail("Expected multipart/form-data");
  const form = await req.formData();
  const file = form.get("avatar") as File | null;
  if (!file) return fail("No file uploaded");
  if (!file.type.startsWith("image/")) return fail("Only image files are allowed");
  if (file.size > MAX_BYTES) return fail("Image must be under 5MB");

  const url = await saveUpload(guard.userId, file, "avatar");

  // Upsert player_profiles row (it might not exist yet for brand-new accounts).
  const existing = (await sql`
    SELECT id FROM player_profiles WHERE user_id = ${guard.userId} LIMIT 1
  `) as unknown as Array<{ id: string }>;
  if (existing.length) {
    await sql`
      UPDATE player_profiles SET avatar_url = ${url}, updated_at = NOW()
      WHERE user_id = ${guard.userId}
    `;
  } else {
    await sql`
      INSERT INTO player_profiles (user_id, avatar_url) VALUES (${guard.userId}, ${url})
    `;
  }

  return ok({ avatar_url: url });
}
