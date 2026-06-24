import { GoogleGenerativeAI } from "@google/generative-ai";
import { sql } from "@/lib/db";
import { advanceStep } from "@/lib/onboarding";
import { fail, ok, requireUserId } from "@/lib/onboarding-server";

const MODEL = "gemini-2.5-flash";
const SYSTEM_PROMPT =
  "You are a cricket sports psychologist. Analyse these MCQ answers and free text from a cricket player. " +
  "Return ONLY valid JSON (no markdown): {strengths: string[], gaps: string[], mental_rating: number (0-100), coaching_tip: string}";

interface AnalysisResult {
  strengths: string[];
  gaps: string[];
  mental_rating: number;
  coaching_tip: string;
}

function fallbackAnalysis(answers: Record<string, string>, freeText: string): AnalysisResult {
  const letters = Object.values(answers);
  const tally: Record<string, number> = { A: 0, B: 0, C: 0, D: 0 };
  letters.forEach((l) => { if (tally[l] != null) tally[l]++; });
  const composureLike = (tally.B ?? 0) + (tally.C ?? 0) + (tally.D ?? 0);
  const baseline = 45 + Math.round((composureLike / Math.max(1, letters.length)) * 50);
  const longText = freeText.split(/\s+/).filter(Boolean).length >= 50 ? 5 : 0;
  return {
    strengths: ["Composure under pressure", "Process-oriented thinking", "Open to constructive feedback"],
    gaps: ["Verbalising frustration sooner", "Pre-shot routine consistency"],
    mental_rating: Math.min(95, baseline + longText),
    coaching_tip: "Use a 4-breath reset routine between deliveries when chasing or after a setback.",
  };
}

function parseJsonResponse(text: string): AnalysisResult | null {
  // Tolerate stray prose by extracting the first JSON object.
  const m = text.match(/\{[\s\S]*\}/);
  if (!m) return null;
  try {
    const obj = JSON.parse(m[0]);
    if (
      Array.isArray(obj.strengths) &&
      Array.isArray(obj.gaps) &&
      typeof obj.mental_rating === "number" &&
      typeof obj.coaching_tip === "string"
    ) {
      return {
        strengths: obj.strengths.map(String),
        gaps: obj.gaps.map(String),
        mental_rating: Math.max(0, Math.min(100, Math.round(obj.mental_rating))),
        coaching_tip: String(obj.coaching_tip),
      };
    }
    return null;
  } catch { return null; }
}

export async function POST(req: Request) {
  const guard = await requireUserId();
  if (guard instanceof Response) return guard;

  let body: any;
  try { body = await req.json(); } catch { return fail("Invalid JSON"); }

  const answers = body?.mcq_answers && typeof body.mcq_answers === "object" ? body.mcq_answers as Record<string, string> : {};
  const freeText = String(body?.free_text ?? "").trim();
  const words = freeText.split(/\s+/).filter(Boolean).length;
  if (Object.keys(answers).length < 10) return fail("All 10 MCQ answers are required");
  if (words < 50) return fail("Free text must be at least 50 words");

  let analysis: AnalysisResult | null = null;

  if (process.env.GEMINI_API_KEY) {
    try {
      const genai = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
      const model = genai.getGenerativeModel({ model: MODEL, systemInstruction: SYSTEM_PROMPT });
      const resp = await model.generateContent(
        `MCQ answers: ${JSON.stringify(answers)}. Free text: ${freeText}`
      );
      const text = resp.response.text();
      analysis = parseJsonResponse(text);
      if (!analysis) console.warn("[behaviour] Gemini returned unparseable JSON, falling back:", text.slice(0, 200));
    } catch (e: any) {
      console.warn("[behaviour] Gemini call failed, using fallback:", e?.message);
    }
  } else {
    console.log("[behaviour] GEMINI_API_KEY not set — using deterministic fallback analysis.");
  }

  if (!analysis) analysis = fallbackAnalysis(answers, freeText);

  const mindsetScore = analysis.mental_rating;
  const strengthsArr = analysis.strengths.slice(0, 5);
  const gapsArr = analysis.gaps.slice(0, 5);

  await sql`DELETE FROM behavioral_assessment WHERE user_id = ${guard.userId}`;
  await sql`
    INSERT INTO behavioral_assessment
      (user_id, mcq_answers, free_text, strengths, gaps, mental_rating, coaching_tip, mindset_score)
    VALUES
      (${guard.userId}, ${JSON.stringify(answers)}::jsonb, ${freeText},
       ${strengthsArr}, ${gapsArr}, ${analysis.mental_rating}, ${analysis.coaching_tip}, ${mindsetScore})
  `;

  const state = await advanceStep(guard.userId, 8);
  return ok({
    strengths: strengthsArr,
    gaps: gapsArr,
    mental_rating: analysis.mental_rating,
    coaching_tip: analysis.coaching_tip,
    mindset_score: mindsetScore,
    onboarding: state,
  });
}
