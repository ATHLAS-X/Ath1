import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { advanceStep, TOTAL_ONBOARDING_STEPS } from "@/lib/onboarding";

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    let body: any;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ success: false, error: "Invalid JSON body" }, { status: 400 });
    }

    const step = Number(body?.step);
    if (!Number.isInteger(step) || step < 1 || step > TOTAL_ONBOARDING_STEPS) {
      return NextResponse.json(
        { success: false, error: `step must be an integer in [1, ${TOTAL_ONBOARDING_STEPS}]` },
        { status: 400 }
      );
    }

    const state = await advanceStep(session.user.id, step);
    return NextResponse.json({ success: true, data: state });
  } catch (e: any) {
    console.error("POST /api/onboarding/advance failed:", e);
    return NextResponse.json(
      { success: false, error: e?.message ?? "Server error" },
      { status: 500 }
    );
  }
}
