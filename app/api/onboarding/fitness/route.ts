import { sql } from "@/lib/db";
import { advanceStep } from "@/lib/onboarding";
import { fail, ok, requireUserId, saveUpload } from "@/lib/onboarding-server";
import { calculateFitness, bmiFrom } from "@/lib/fitness-math";

function optNum(v: FormDataEntryValue | null): number | null {
  if (v == null) return null;
  const s = String(v).trim();
  if (s === "") return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

export async function POST(req: Request) {
  const guard = await requireUserId();
  if (guard instanceof Response) return guard;

  const ct = req.headers.get("content-type") ?? "";
  const isMultipart = ct.includes("multipart/form-data");
  let sprint: number | null, pushups: number | null, rhr: number | null,
      yoyo: number | null, run2km: number | null, height: number | null, weight: number | null;
  let cert: File | null = null;

  if (isMultipart) {
    const form = await req.formData();
    sprint = optNum(form.get("sprint_time"));
    pushups = optNum(form.get("pushups_60s"));
    rhr = optNum(form.get("resting_hr_bpm"));
    yoyo = optNum(form.get("yoyo_level"));
    run2km = optNum(form.get("run_2km_seconds"));
    height = optNum(form.get("height_cm"));
    weight = optNum(form.get("weight_kg"));
    cert = (form.get("medical_cert") as File | null) ?? null;
  } else {
    let body: any;
    try { body = await req.json(); } catch { return fail("Invalid JSON"); }
    const num = (v: any): number | null => {
      if (v === undefined || v === null || v === "") return null;
      const n = Number(v);
      return Number.isFinite(n) ? n : null;
    };
    sprint = num(body?.sprint_time);
    pushups = num(body?.pushups_60s);
    rhr = num(body?.resting_hr_bpm);
    yoyo = num(body?.yoyo_level);
    run2km = num(body?.run_2km_seconds);
    height = num(body?.height_cm);
    weight = num(body?.weight_kg);
  }

  const bmi = bmiFrom(height, weight);
  const breakdown = calculateFitness({ sprint, pushups, rhr, yoyo, run2km, height, weight });

  const certUrl = cert ? await saveUpload(guard.userId, cert, "fitness") : null;

  // Upsert.
  await sql`DELETE FROM fitness_data WHERE user_id = ${guard.userId}`;
  await sql`
    INSERT INTO fitness_data
      (user_id, sprint_time, pushups_60s, resting_hr_bpm, yoyo_level, run_2km_time,
       height_cm, weight_kg, bmi, fitness_score, medical_cert_url, updated_at)
    VALUES
      (${guard.userId}, ${sprint}, ${pushups}, ${rhr}, ${yoyo}, ${run2km},
       ${height}, ${weight}, ${bmi}, ${breakdown.fitnessScore}, ${certUrl}, NOW())
  `;

  const state = await advanceStep(guard.userId, 7);

  const advisory = (bmi != null && bmi > 32) || (sprint != null && sprint > 5.5);
  return ok({
    bmi,
    fitness_score: breakdown.fitnessScore,
    breakdown,
    medical_cert_url: certUrl,
    advisory_flag: advisory,
    onboarding: state,
  });
}
