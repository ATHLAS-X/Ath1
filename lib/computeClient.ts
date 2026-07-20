import { mintComputeToken } from "@/lib/computeAuth";

export interface CallerContext {
  userId: string;
  role: string;
}

export class ComputeServiceError extends Error {
  constructor(
    public readonly errorCode: string,
    message: string,
    public readonly statusCode: number,
  ) {
    super(message);
    this.name = "ComputeServiceError";
  }
}

function baseUrl(): string {
  const url = process.env.COMPUTE_SERVICE_URL;
  if (!url) throw new ComputeServiceError("CONFIG_ERROR", "COMPUTE_SERVICE_URL is not set.", 500);
  return url.replace(/\/$/, "");
}

async function authHeaders(caller: CallerContext): Promise<HeadersInit> {
  const token = await mintComputeToken(caller.userId, caller.role);
  return { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
}

async function handleResponse(res: Response): Promise<unknown> {
  if (res.ok) return res.json();
  let body: any = {};
  try { body = await res.json(); } catch { /* ignore */ }
  throw new ComputeServiceError(
    body?.error_code ?? "COMPUTE_ERROR",
    body?.message ?? `Compute service returned ${res.status}`,
    res.status,
  );
}

/** POST to the compute service. Throws ComputeServiceError on non-2xx. */
export async function computePost(
  path: string,
  body: unknown,
  caller: CallerContext,
): Promise<unknown> {
  const res = await fetch(`${baseUrl()}${path}`, {
    method: "POST",
    headers: await authHeaders(caller),
    body: JSON.stringify(body),
  });
  return handleResponse(res);
}

/** GET from the compute service. Throws ComputeServiceError on non-2xx. */
export async function computeGet(path: string, caller: CallerContext): Promise<unknown> {
  const res = await fetch(`${baseUrl()}${path}`, {
    method: "GET",
    headers: await authHeaders(caller),
  });
  return handleResponse(res);
}

/** Poll a status endpoint until COMPLETE/FAILED or timeout. Returns the final response. */
export async function pollUntilDone(
  statusPath: string,
  caller: CallerContext,
  intervalMs: number,
  maxAttempts: number,
): Promise<{ status: string; result?: unknown; message?: string; timedOut: boolean }> {
  for (let i = 0; i < maxAttempts; i++) {
    const resp = (await computeGet(statusPath, caller)) as any;
    if (resp.status === "COMPLETE" || resp.status === "FAILED") {
      return { status: resp.status, result: resp.result, message: resp.message, timedOut: false };
    }
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  return { status: "PENDING", timedOut: true };
}
