import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { academyGate } from "@/lib/academy/gate";

export const dynamic = "force-dynamic";

/**
 * GET — public academy info for the join-link landing page
 * (design/import/AthlasX Player Self-Registration.html's header, "{Academy}
 * has invited you to register your child"). Only name/district/state are
 * exposed — nothing that isn't already shown to a parent following an
 * invite link the academy itself shared.
 */
export async function GET(_req: NextRequest, { params }: { params: { academyId: string } }) {
  const gate = academyGate();
  if (gate) return gate;

  const academy = await db.academy.findUnique({
    where: { id: params.academyId },
    select: { id: true, name: true, district: true, state: true },
  });
  if (!academy) return NextResponse.json({ error: "Invite link not found" }, { status: 404 });
  return NextResponse.json({ academy });
}
