import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { sql } from "@/lib/db";
import AadhaarVerifyClient from "./AadhaarVerifyClient";

export default async function AadhaarVerifyPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/auth/login?from=/verify/aadhaar");
  const userId = (session.user as any).id as string;

  const [profileRows, aadhaarRows] = await Promise.all([
    sql`SELECT first_name, last_name, date_of_birth, gender FROM player_profiles WHERE user_id = ${userId} LIMIT 1` as unknown as Promise<any[]>,
    sql`SELECT masked_aadhaar, verified_dob, age_verified FROM aadhaar_verification WHERE user_id = ${userId} LIMIT 1` as unknown as Promise<any[]>,
  ]);

  const p = (profileRows as any[])[0] ?? null;
  const a = (aadhaarRows as any[])[0] ?? null;

  return (
    <AadhaarVerifyClient
      profile={p ? {
        name: [p.first_name, p.last_name].filter(Boolean).join(" "),
        dob: p.date_of_birth ? new Date(p.date_of_birth).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : null,
        gender: p.gender,
      } : null}
      verified={a?.age_verified === true}
      maskedAadhaar={a?.masked_aadhaar ?? null}
    />
  );
}
