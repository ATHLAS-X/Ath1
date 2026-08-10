/**
 * AthlasX web-worker — BullMQ job processor
 *
 * Runs as a standalone Node.js process inside the web-worker Docker container.
 * Add job processors here as background features are built (score recalculation,
 * email dispatch, bulk invite processing, etc.).
 *
 * Queue conventions (per architecture doc §11.1):
 *   Redis DB 0  — BullMQ (this worker)
 *   Redis DB 1  — ARQ (Mrigank's Python compute worker)
 *   Redis DB 2  — OTP short-lived keys
 */

"use strict";

const { Worker, Queue } = require("bullmq");

const REDIS_URL = process.env.REDIS_URL ?? "redis://localhost:6379";

// Parse redis://[user:pass@]host:port[/db] into ioredis connection object
function parseRedisUrl(url) {
  try {
    const u = new URL(url);
    return {
      host: u.hostname,
      port: Number(u.port) || 6379,
      password: u.password || undefined,
      db: Number(u.pathname.replace("/", "")) || 0,
    };
  } catch {
    return { host: "localhost", port: 6379, db: 0 };
  }
}

const connection = parseRedisUrl(REDIS_URL);

// ── Job processors ───────────────────────────────────────────────────────────
// Each processor receives a BullMQ Job object. Return value is stored as the
// job result. Throw to mark the job as failed (BullMQ will retry per queue config).

const processors = {
  /**
   * Recalculate AthlasX score for a single player.
   * Enqueue with: queue.add("recalculate-score", { userId })
   */
  "recalculate-score": async (job) => {
    const { userId } = job.data;
    console.log(`[worker] recalculate-score → user ${userId}`);
    // TODO: import calculateAthlasXScore from score-engine when ESM migration is done
    // For now this is a no-op placeholder; the score is calculated synchronously
    // in /api/onboarding/score/calculate during onboarding.
    return { status: "noop", userId };
  },

  /**
   * Send a transactional email (welcome, invite, coach approval, etc.)
   * Enqueue with: queue.add("send-email", { to, subject, body })
   */
  "send-email": async (job) => {
    const { to, subject } = job.data;
    console.log(`[worker] send-email → ${to} "${subject}"`);
    // TODO: wire Resend / SendGrid here when email provider is chosen
    return { status: "noop", to };
  },

  /**
   * Send an SMS notification via MSG91.
   * Enqueue with: queue.add("send-sms", { phone, message })
   */
  "send-sms": async (job) => {
    const { phone } = job.data;
    console.log(`[worker] send-sms → ${phone}`);
    // TODO: wire MSG91 SDK here when SMS_GATEWAY_API_KEY is set
    return { status: "noop", phone };
  },
};

// ── Worker setup ─────────────────────────────────────────────────────────────

const QUEUE_NAME = "athlasx-jobs";

const worker = new Worker(
  QUEUE_NAME,
  async (job) => {
    const processor = processors[job.name];
    if (!processor) {
      console.warn(`[worker] Unknown job type: ${job.name} — skipping`);
      return { status: "unknown-job", name: job.name };
    }
    return processor(job);
  },
  {
    connection,
    concurrency: 5,
  },
);

worker.on("completed", (job, result) => {
  console.log(`[worker] ✓ ${job.name} (${job.id}) →`, result);
});

worker.on("failed", (job, err) => {
  console.error(`[worker] ✗ ${job?.name} (${job?.id}):`, err.message);
});

worker.on("error", (err) => {
  console.error("[worker] Worker error:", err.message);
});

// ── Startup ──────────────────────────────────────────────────────────────────

console.log(`[worker] AthlasX web-worker started`);
console.log(`[worker] Queue: ${QUEUE_NAME} | Redis: ${connection.host}:${connection.port}/db${connection.db}`);
console.log(`[worker] Registered job types: ${Object.keys(processors).join(", ")}`);

// ── Graceful shutdown ────────────────────────────────────────────────────────

async function shutdown(signal) {
  console.log(`[worker] ${signal} received — draining and closing`);
  await worker.close();
  process.exit(0);
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT",  () => shutdown("SIGINT"));
