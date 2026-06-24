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

/**
 * Placeholder analysis — NOT derived from the submitted video. Gemini
 * cannot fetch a YouTube URL directly (see the route's NOTE below); real
 * per-video analysis needs frame extraction or routing through Backend/AI,
 * neither of which is wired up yet. This exists so onboarding step 9 has
 * something to show while that's built, not to be presented as a real
 * finding — callers must surface `preliminary: true` (see POST handler)
 * rather than letting the UI imply this came from the user's footage.
 */
function fallback(): VideoAnalysis {
  return {
    batting_style: "Pending full review",
    wrist_movement: "Pending full review",
    foot_work: "Pending full review",
    bowling_action: "Pending full review",
    strong_points: ["Full technique breakdown pending manual/automated review"],
    weak_points: ["Full technique breakdown pending manual/automated review"],
    style_classification: "Preliminary — full review pending",
    technique_notes:
      "This is a placeholder, not an analysis of your video — automated per-video technique " +
      "breakdown isn't live yet. A coach or the platform will follow up with real feedback once " +
      "it is.",
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
  // NOTE: Gemini cannot fetch YouTube URLs directly — real video analysis
  // requires downloading frames and sending them as inline bytes, or using the
  // File API for uploads. That work belongs in apps/compute (Mrigank's lane).
  // For now this route always uses the deterministic fallback; the GEMINI_API_KEY
  // branch is left stubbed so it's easy to wire up once compute is ready.
  if (process.env.GEMINI_API_KEY && false) {
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
    console.log("[video] Using deterministic fallback — real analysis via compute service (TODO).");
  }
  const preliminary = analysis === null;
  if (!analysis) analysis = fallback();

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
  return ok({ ...analysis, youtube_video_id: videoId, preliminary, onboarding: state });
}
