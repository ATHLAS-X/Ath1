import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { sql } from "@/lib/db";
import { saveUpload } from "@/lib/onboarding-server";
import { IMAGE_ALLOWLIST, UploadValidationError, readAndValidateUpload } from "@/lib/upload-validation";

const MAX_BYTES = 2 * 1024 * 1024; // 2 MB

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  if ((session.user as any).role !== "academy_admin") {
    return NextResponse.json({ success: false, error: "Academy admin only" }, { status: 403 });
  }
  const userId = (session.user as any).id as string;

  const ct = req.headers.get("content-type") ?? "";
  if (!ct.includes("multipart/form-data")) {
    return NextResponse.json({ success: false, error: "Expected multipart/form-data" }, { status: 400 });
  }
  const form = await req.formData();
  const file = form.get("logo") as File | null;
  if (!file) return NextResponse.json({ success: false, error: "Missing logo file" }, { status: 400 });

  let upload;
  try {
    upload = await readAndValidateUpload(file, MAX_BYTES, IMAGE_ALLOWLIST);
  } catch (e) {
    if (e instanceof UploadValidationError) {
      return NextResponse.json({ success: false, error: e.message }, { status: 400 });
    }
    throw e;
  }

  const url = await saveUpload(userId, upload, "academy-assets");
  await sql`UPDATE academies SET logo_url = ${url} WHERE user_id = ${userId}`;

  return NextResponse.json({ success: true, logo_url: url });
}
