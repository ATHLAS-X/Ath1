import { sql } from "@/lib/db";
import { requireAdmin } from "@/lib/admin-server";
import { ok } from "@/lib/onboarding-server";

type CheckStatus = "PASS" | "FAIL" | "WARN";
interface CheckResult {
  id: string;
  label: string;
  status: CheckStatus;
  detail: string;
  /** Optional numeric/string side-info for the UI. */
  value?: string | number;
}
interface CheckGroup {
  group: "infrastructure" | "data" | "flows";
  title: string;
  items: CheckResult[];
}

const REQUIRED_ENV = [
  "DATABASE_URL",
  "NEXTAUTH_SECRET",
  "NEXTAUTH_URL",
];
const OPTIONAL_ENV = [
  "ANTHROPIC_API_KEY",
  "SENDGRID_API_KEY",
  "MSG91_API_KEY",
  "RAZORPAY_KEY_ID",
  "RAZORPAY_KEY_SECRET",
];

function envCheck(): CheckResult {
  const missing = REQUIRED_ENV.filter((k) => !process.env[k]);
  const optMissing = OPTIONAL_ENV.filter((k) => !process.env[k]);
  if (missing.length) {
    return {
      id: "env",
      label: "Environment variables",
      status: "FAIL",
      detail: `Missing required keys: ${missing.join(", ")}`,
      value: `${REQUIRED_ENV.length - missing.length}/${REQUIRED_ENV.length} required set`,
    };
  }
  if (optMissing.length) {
    return {
      id: "env",
      label: "Environment variables",
      status: "WARN",
      detail: `All required keys present. Optional missing: ${optMissing.join(", ")}`,
      value: `${REQUIRED_ENV.length}/${REQUIRED_ENV.length} required · ${OPTIONAL_ENV.length - optMissing.length}/${OPTIONAL_ENV.length} optional`,
    };
  }
  return {
    id: "env",
    label: "Environment variables",
    status: "PASS",
    detail: "All required and optional environment variables are set.",
    value: "All set",
  };
}

async function dbPing(): Promise<CheckResult> {
  const t0 = Date.now();
  try {
    await sql`SELECT 1 AS ok`;
    const ms = Date.now() - t0;
    return {
      id: "db",
      label: "NeonDB connection",
      status: ms < 1500 ? "PASS" : "WARN",
      detail: ms < 1500 ? "Ping under 1.5s." : "Ping slow (cold start?).",
      value: `${ms}ms`,
    };
  } catch (e: any) {
    return {
      id: "db",
      label: "NeonDB connection",
      status: "FAIL",
      detail: e?.message ?? "Could not reach NeonDB.",
    };
  }
}

function sendgridCheck(): CheckResult {
  const key = process.env.SENDGRID_API_KEY;
  if (!key) {
    return { id: "sendgrid", label: "SendGrid API key", status: "WARN", detail: "Not configured (emails will not send)." };
  }
  // Validate format only — sending a real test email costs $$ + needs a verified sender.
  if (!key.startsWith("SG.") || key.length < 40) {
    return { id: "sendgrid", label: "SendGrid API key", status: "FAIL", detail: "Key does not match the SendGrid `SG.…` format." };
  }
  return { id: "sendgrid", label: "SendGrid API key", status: "PASS", detail: "Key present with valid prefix.", value: "Configured" };
}

function msg91Check(): CheckResult {
  const key = process.env.MSG91_API_KEY;
  if (!key) return { id: "msg91", label: "MSG91 API key", status: "WARN", detail: "Not configured (SMS will not send)." };
  if (key.length < 16) return { id: "msg91", label: "MSG91 API key", status: "FAIL", detail: "Key looks too short." };
  return { id: "msg91", label: "MSG91 API key", status: "PASS", detail: "Key configured.", value: "Configured" };
}

async function razorpayCheck(): Promise<CheckResult> {
  const id = process.env.RAZORPAY_KEY_ID;
  const secret = process.env.RAZORPAY_KEY_SECRET;
  if (!id || !secret) return { id: "razorpay", label: "Razorpay keys", status: "WARN", detail: "Not configured (subscriptions disabled)." };
  // Live ping: GET /v1/plans?count=1 with Basic auth.
  try {
    const res = await fetch("https://api.razorpay.com/v1/plans?count=1", {
      headers: { Authorization: "Basic " + Buffer.from(`${id}:${secret}`).toString("base64") },
    });
    if (res.ok) return { id: "razorpay", label: "Razorpay keys", status: "PASS", detail: "Plans endpoint reachable.", value: "API reachable" };
    return { id: "razorpay", label: "Razorpay keys", status: "FAIL", detail: `Razorpay returned ${res.status} ${res.statusText}` };
  } catch (e: any) {
    return { id: "razorpay", label: "Razorpay keys", status: "FAIL", detail: e?.message ?? "Could not reach Razorpay." };
  }
}

/* -------------------- data integrity checks -------------------- */
async function dataIntegrity(): Promise<CheckResult[]> {
  const items: CheckResult[] = [];

  // Players stuck in DRAFT > 48h.
  const stuck = (await sql`
    SELECT COUNT(*)::int AS n FROM onboarding_progress
    WHERE status = 'DRAFT' AND updated_at < NOW() - INTERVAL '48 hours'
  `) as unknown as Array<{ n: number }>;
  const n1 = stuck[0]?.n ?? 0;
  items.push({
    id: "stuck-drafts",
    label: "Players stuck in DRAFT > 48h",
    status: n1 === 0 ? "PASS" : n1 < 10 ? "WARN" : "FAIL",
    detail: n1 === 0 ? "No stalled drafts." : `${n1} player${n1 === 1 ? "" : "s"} have not advanced in 48h.`,
    value: n1,
  });

  // Scorecards pending > 72h.
  const sc = (await sql`
    SELECT COUNT(*)::int AS n FROM match_logs
    WHERE ocr_status IN ('PENDING', 'MANUAL_REVIEW')
      AND created_at < NOW() - INTERVAL '72 hours'
  `) as unknown as Array<{ n: number }>;
  const n2 = sc[0]?.n ?? 0;
  items.push({
    id: "stale-scorecards",
    label: "Scorecards pending > 72h",
    status: n2 === 0 ? "PASS" : n2 < 10 ? "WARN" : "FAIL",
    detail: n2 === 0 ? "Review queue is fresh." : `${n2} pending scorecard${n2 === 1 ? "" : "s"} older than 72h.`,
    value: n2,
  });

  // Coach certs pending > 72h.
  const co = (await sql`
    SELECT COUNT(*)::int AS n FROM coach_registry
    WHERE coach_status = 'PENDING_REVIEW' AND created_at < NOW() - INTERVAL '72 hours'
  `) as unknown as Array<{ n: number }>;
  const n3 = co[0]?.n ?? 0;
  items.push({
    id: "stale-coaches",
    label: "Coach certs pending > 72h",
    status: n3 === 0 ? "PASS" : n3 < 5 ? "WARN" : "FAIL",
    detail: n3 === 0 ? "Coach queue is fresh." : `${n3} coach application${n3 === 1 ? "" : "s"} older than 72h.`,
    value: n3,
  });

  // Open fraud flags unreviewed.
  const ff = (await sql`
    SELECT COUNT(*)::int AS n FROM fraud_flags WHERE status = 'OPEN'
  `) as unknown as Array<{ n: number }>;
  const n4 = ff[0]?.n ?? 0;
  items.push({
    id: "open-flags",
    label: "Open fraud flags unreviewed",
    status: n4 === 0 ? "PASS" : n4 < 5 ? "WARN" : "FAIL",
    detail: n4 === 0 ? "No flags awaiting review." : `${n4} fraud flag${n4 === 1 ? "" : "s"} still OPEN.`,
    value: n4,
  });

  return items;
}

/* -------------------- flow signals -------------------- */
async function flowChecks(): Promise<CheckResult[]> {
  const items: CheckResult[] = [];

  // Player signup → profile → score: did any player complete the full path in the last 7 days?
  const players = (await sql`
    SELECT COUNT(*)::int AS n FROM sportx_score
    WHERE total_score > 0 AND updated_at > NOW() - INTERVAL '7 days'
  `) as unknown as Array<{ n: number }>;
  const n1 = players[0]?.n ?? 0;
  items.push({
    id: "flow-player",
    label: "Player signup → profile → score flow",
    status: n1 > 0 ? "PASS" : "WARN",
    detail: n1 > 0
      ? `${n1} player${n1 === 1 ? "" : "s"} scored in the last 7 days.`
      : "No fresh player completions in the last 7 days. Use `npm run e2e` to verify.",
    value: n1,
  });

  // Scout signup → subscribe → search: scouts with at least one shortlist.
  const scouts = (await sql`
    SELECT COUNT(DISTINCT scout_user_id)::int AS n FROM scout_shortlist
    WHERE created_at > NOW() - INTERVAL '7 days'
  `) as unknown as Array<{ n: number }>;
  const n2 = scouts[0]?.n ?? 0;
  items.push({
    id: "flow-scout",
    label: "Scout signup → subscribe → search flow",
    status: n2 > 0 ? "PASS" : "WARN",
    detail: n2 > 0
      ? `${n2} scout${n2 === 1 ? "" : "s"} engaged in the last 7 days.`
      : "No scout shortlists logged this week.",
    value: n2,
  });

  // Trial invite → email delivered: most-recent invite timestamp.
  const recent = (await sql`
    SELECT MAX(created_at) AS latest, COUNT(*)::int AS n
    FROM scout_trial_invites
    WHERE created_at > NOW() - INTERVAL '7 days'
  `) as unknown as Array<{ latest: string | null; n: number }>;
  const r = recent[0];
  items.push({
    id: "flow-trial",
    label: "Trial invite → email delivered",
    status: r?.n
      ? (process.env.SENDGRID_API_KEY ? "PASS" : "WARN")
      : "WARN",
    detail: r?.n
      ? `${r.n} trial invite${r.n === 1 ? "" : "s"} in the last 7 days. Latest at ${String(r.latest).slice(0, 19)}.`
      : "No trial invites sent in the last 7 days.",
    value: r?.n ?? 0,
  });

  return items;
}

export async function GET() {
  const guard = await requireAdmin();
  if (guard instanceof Response) return guard;

  const infrastructure: CheckResult[] = [];
  infrastructure.push(await dbPing());
  infrastructure.push(sendgridCheck());
  infrastructure.push(msg91Check());
  infrastructure.push(await razorpayCheck());
  infrastructure.push(envCheck());

  const data = await dataIntegrity();
  const flows = await flowChecks();

  const groups: CheckGroup[] = [
    { group: "infrastructure", title: "Infrastructure",   items: infrastructure },
    { group: "data",           title: "Data Integrity",   items: data },
    { group: "flows",          title: "Flows",            items: flows },
  ];

  // Aggregate summary.
  const all = groups.flatMap((g) => g.items);
  const summary = {
    pass: all.filter((x) => x.status === "PASS").length,
    warn: all.filter((x) => x.status === "WARN").length,
    fail: all.filter((x) => x.status === "FAIL").length,
    total: all.length,
    verdict:
      all.some((x) => x.status === "FAIL") ? "BLOCKED" :
      all.some((x) => x.status === "WARN") ? "READY_WITH_WARNINGS" :
      "LAUNCH_READY",
  };

  return ok({ summary, groups, checked_at: new Date().toISOString() });
}
