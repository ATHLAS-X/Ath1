import { sql } from "@/lib/db";
import { advanceStep } from "@/lib/onboarding";
import { clientIp, fail, ok, requireUserId, saveUpload } from "@/lib/onboarding-server";
import { IMAGE_OR_PDF_ALLOWLIST, UploadValidationError, readAndValidateUpload } from "@/lib/upload-validation";

const MAX_BYTES = 10 * 1024 * 1024; // 10 MB

export async function POST(req: Request) {
  const guard = await requireUserId();
  if (guard instanceof Response) return guard;

  const ct = req.headers.get("content-type") ?? "";
  if (!ct.includes("multipart/form-data")) return fail("Expected multipart/form-data");
  const form = await req.formData();

  const phone = String(form.get("parent_phone") ?? "").replace(/\D/g, "");
  const otp = String(form.get("otp") ?? "").trim();
  const disclaimerSigned = String(form.get("disclaimer_signed") ?? "") === "true";
  const file = form.get("guardian_id_doc") as File | null;

  if (phone.length < 10) return fail("Parent phone is required");
  if (!/^\d{6}$/.test(otp)) return fail("OTP must be 6 digits");
  if (!disclaimerSigned) return fail("Disclaimer must be confirmed");
  if (!file) return fail("Guardian ID document is required");

  let upload;
  try {
    upload = await readAndValidateUpload(file, MAX_BYTES, IMAGE_OR_PDF_ALLOWLIST);
  } catch (e) {
    if (e instanceof UploadValidationError) return fail(e.message);
    throw e;
  }
  const docUrl = await saveUpload(guard.userId, upload, "guardian");
  const ip = clientIp(req);
  const pts = 1;

  await sql`DELETE FROM guardian_consent WHERE user_id = ${guard.userId}`;
  await sql`
    INSERT INTO guardian_consent
      (user_id, parent_phone, parent_phone_verified, guardian_id_doc_url,
       disclaimer_signed, signed_at, signed_ip, minor_flag, verification_pts)
    VALUES
      (${guard.userId}, ${phone}, true, ${docUrl},
       true, NOW(), ${ip}, true, ${pts})
  `;

  const state = await advanceStep(guard.userId, 3);
  return ok({ guardian_id_doc_url: docUrl, verification_pts: pts, onboarding: state });
}
