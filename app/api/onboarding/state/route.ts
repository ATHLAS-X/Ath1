import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getUserOnboardingState } from "@/lib/onboarding";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }
    const state = await getUserOnboardingState(session.user.id);
    return NextResponse.json({ success: true, data: state });
  } catch (e: any) {
    console.error("GET /api/onboarding/state failed:", e);
    return NextResponse.json(
      { success: false, error: e?.message ?? "Server error" },
      { status: 500 }
    );
  }
}
