import { fail, ok, requireUserId } from "@/lib/onboarding-server";

// TODO: Production should call Surepass Aadhaar OTP API:
//   POST https://kyc-api.surepass.io/api/v1/aadhaar-v2/generate-otp
//   Headers: Authorization: Bearer <SUREPASS_TOKEN>
//   Body: { id_number: "<12-digit-aadhaar>" }
//   Response: { client_id: "...", message: "OTP sent" }
//   Persist client_id server-side keyed by (userId, aadhaar) so confirm() can reference it.

export async function POST(req: Request) {
  const guard = await requireUserId();
  if (guard instanceof Response) return guard;

  let body: any;
  try { body = await req.json(); } catch { return fail("Invalid JSON"); }
  const raw = String(body?.aadhaar ?? "").replace(/\D/g, "");
  if (raw.length !== 12) return fail("Aadhaar must be 12 digits");

  // MVP: pretend an OTP was sent.
  console.log(`[aadhaar.initiate] userId=${guard.userId} aadhaar=${raw.slice(0,2)}XXXXXXXX${raw.slice(-2)} → OTP "123456" (simulated)`);
  return ok({ message: "OTP sent to Aadhaar-linked mobile" });
}
