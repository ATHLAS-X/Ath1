/**
 * Typed HTTP client for the Backend/AI compute service.
 *
 * Every call mints a fresh forwarding JWT via computeAuth.ts, builds the full
 * URL from COMPUTE_SERVICE_URL, and returns parsed JSON on success or throws
 * a ComputeServiceError on any non-2xx response.
 *
 * Route handlers catch ComputeServiceError to return 503 (service unavailable)
 * with a user-friendly message — they never leak raw compute errors to the
 * browser.
 */

import { mintComputeToken } from "@/lib/computeAuth";

// ---------------------------------------------------------------------------
// Error class
// ---------------------------------------------------------------------------

export class ComputeServiceError extends Error {
  public readonly httpStatus: number;
  public readonly errorCode: string;

  constructor(message: string, httpStatus: number, errorCode = "COMPUTE_ERROR") {
    super(message);
    this.name = "ComputeServiceError";
    this.httpStatus = httpStatus;
    this.errorCode = errorCode;
  }
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

function getBaseUrl(): string {
  const url = process.env.COMPUTE_SERVICE_URL;
  if (!url) {
    throw new ComputeServiceError(
      "COMPUTE_SERVICE_URL is not set.",
      500,
      "CONFIG_ERROR",
    );
  }
  // Strip trailing slash so callers can pass paths like "/api/v1/..."
  return url.replace(/\/+$/, "");
}

async function buildHeaders(userId: string, role: string): Promise<HeadersInit> {
  const token = await mintComputeToken(userId, role);
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };
}

async function handleResponse(res: Response): Promise<any> {
  let body: any;
  try {
    body = await res.json();
  } catch {
    body = null;
  }

  if (res.ok) return body;

  // Compute service error envelope: { detail: "..." } or { detail: { code, message } }
  const detail = body?.detail;
  const message =
    typeof detail === "string"
      ? detail
      : typeof detail?.message === "string"
        ? detail.message
        : `Compute service returned ${res.status}`;
  const code =
    typeof detail?.code === "string" ? detail.code : `HTTP_${res.status}`;

  throw new ComputeServiceError(message, res.status, code);
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * POST to the compute service.
 *
 * @param path     - e.g. "/api/v1/compute/video/analyze"
 * @param body     - JSON-serializable request body
 * @param userId   - Authenticated user's UUID
 * @param role     - User role in Next.js lowercase format
 * @returns        - Parsed JSON response
 * @throws ComputeServiceError on any non-2xx response or network failure
 */
export async function computePost(
  path: string,
  body: unknown,
  userId: string,
  role: string,
): Promise<any> {
  const url = `${getBaseUrl()}${path}`;
  const headers = await buildHeaders(userId, role);

  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });
  } catch (err: any) {
    throw new ComputeServiceError(
      `Compute service unreachable: ${err?.message ?? "network error"}`,
      503,
      "NETWORK_ERROR",
    );
  }

  return handleResponse(res);
}

/**
 * GET from the compute service.
 *
 * @param path     - e.g. "/api/v1/compute/video/status/abc123"
 * @param userId   - Authenticated user's UUID
 * @param role     - User role in Next.js lowercase format
 * @returns        - Parsed JSON response
 * @throws ComputeServiceError on any non-2xx response or network failure
 */
export async function computeGet(
  path: string,
  userId: string,
  role: string,
): Promise<any> {
  const url = `${getBaseUrl()}${path}`;
  const headers = await buildHeaders(userId, role);

  let res: Response;
  try {
    res = await fetch(url, { method: "GET", headers });
  } catch (err: any) {
    throw new ComputeServiceError(
      `Compute service unreachable: ${err?.message ?? "network error"}`,
      503,
      "NETWORK_ERROR",
    );
  }

  return handleResponse(res);
}
