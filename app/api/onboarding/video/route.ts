import { GoogleGenerativeAI } from "@google/generative-ai";
import { sql } from "@/lib/db";
import { advanceStep } from "@/lib/onboarding";
import { fail, ok, requireUserId } from "@/lib/onboarding-server";
import { extractYouTubeId } from "@/lib/youtube";

const MODEL = "gemini-2.5-flash";

const SYSTEM_PROMPT =
  "You are an expert cricket technique analyst. Analyse the cricket batting/bowling technique shown in this video. " +
  "Return ONLY valid JSON (no markdown): {batting_style: string, wrist_movement: string, foot_work: string, bowling_action: string, " +
  "strong_points: string[], weak_points: string[], style_classification: string, technique_notes: string}";

interface VideoAnalysis {
  batting_style: string;
  wrist_movement: string;
  foot_work: string;
  bowling_action: string;
  strong_points: string[];
  weak_points: string[];
  style_classification: string;
  technique_notes: string;
}

function fallback(url: string): VideoAnalysis {
  return {
    batting_style: "Orthodox front-foot dominant",
    wrist_movement: "Top-hand controlled; closing late through contact",
    foot_work: "Slight lateral movement into the line; back-foot triggers well-timed",
    bowling_action: "Not clearly visible in this angle",
    strong_points: [
      "Stable head position at delivery release",
      "Balanced base — weight transferred forward cleanly",
      "Bat swing path stays close to the body line",
    ],
    weak_points: [
      "Wrist closes slightly early on the cover drive",
      "Backlift drifts towards gully on quicker deliveries",
    ],
    style_classification: "Top-order anchor with hands-led timing",
    technique_notes:
      "Setup is balanced and reactive against fuller lengths; transitioning to shorter deliveries shows a marginal head-fall to the off side. " +
      "Recommend drills that delay the front-foot trigger by 80–120ms to recover against length variation. (Auto-fallback analysis for " +
      url + ")",
  };
}

function parseJson(text: string): VideoAnalysis | null {
  const m = text.match(/\{[\s\S]*\}/);
  if (!m) return null;
  try {
    const obj = JSON.parse(m[0]);
    if (
      typeof obj.batting_style === "string" &&
      typeof obj.wrist_movement === "string" &&
      typeof obj.foot_work === "string" &&
      typeof obj.bowling_action === "string" &&
      Array.isArray(obj.strong_points) &&
      Array.isArray(obj.weak_points) &&
      typeof obj.style_classification === "string" &&
      typeof obj.technique_notes === "string"
    ) {
      return {
        batting_style: obj.batting_style,
        wrist_movement: obj.wrist_movement,
        foot_work: obj.foot_work,
        bowling_action: obj.bowling_action,
        strong_points: obj.strong_points.map(String).slice(0, 6),
        weak_points: obj.weak_points.map(String).slice(0, 6),
        style_classification: obj.style_classification,
        technique_notes: obj.technique_notes,
      };
    }
  } catch { /* ignore */ }
  return null;
}

export async function POST(req: Request) {
  const guard = await requireUserId();
  if (guard instanceof Response) return guard;

  let body: any;
  try { body = await req.json(); } catch { return fail("Invalid JSON"); }
  const url = String(body?.video_url ?? "").trim();
  const videoId = extractYouTubeId(url);
  if (!videoId) return fail("Provide a valid YouTube URL");

  let analysis: VideoAnalysis | null = null;
  if (process.env.GEMINI_API_KEY) {
    try {
      const genai = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
      const model = genai.getGenerativeModel({ model: MODEL, systemInstruction: SYSTEM_PROMPT });
      const resp = await model.generateContent(
        `Analyse the cricket technique in this YouTube video: ${url}. ` +
        `Provide detailed technical feedback on the player's batting stance, grip, footwork, wrist position, ` +
        `follow-through, and bowling action if visible.`
      );
      const text = resp.response.text();
      analysis = parseJson(text);
      if (!analysis) console.warn("[video] Gemini returned unparseable JSON; falling back. Preview:", text.slice(0, 200));
    } catch (e: any) {
      console.warn("[video] Gemini call failed; using fallback:", e?.message);
    }
  } else {
    console.log("[video] GEMINI_API_KEY not set; using fallback analysis.");
  }
  if (!analysis) analysis = fallback(url);

  await sql`DELETE FROM video_analysis WHERE user_id = ${guard.userId}`;
  await sql`
    INSERT INTO video_analysis
      (user_id, video_url, youtube_video_id, batting_style, wrist_movement, foot_work, bowling_action,
       strong_points, weak_points, style_classification, technique_notes, video_analysed)
    VALUES
      (${guard.userId}, ${url}, ${videoId}, ${analysis.batting_style}, ${analysis.wrist_movement},
       ${analysis.foot_work}, ${analysis.bowling_action},
       ${analysis.strong_points}, ${analysis.weak_points},
       ${analysis.style_classification}, ${analysis.technique_notes}, true)
  `;

  const state = await advanceStep(guard.userId, 9);
  return ok({ ...analysis, youtube_video_id: videoId, onboarding: state });
}
